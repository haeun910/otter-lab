// 매일 자동 회의 (GitHub Actions가 매시간 실행해요).
// 회의 시간이 지났고 오늘 회의를 아직 안 했으면: 소식 받기 → 주제 후보 준비 → 소장 검토 대기 → 회의록 → 알림.
// 실행: npm run daily   (회의 시간과 상관없이 지금 하려면 FORCE=1 npm run daily)
import { heldToday, kstDay, kstMinutes, meetingNotes, parseHM, recommend, statsReport, fmtHM } from "../src/lab/agenda";
import { fromRows, toRows } from "../src/lab/cloud/mapping";
import { cleanKey, cleanUrl, selectRows, upsertRows, type Cloud } from "../src/lab/cloud/rest";
import { BUILDINGS } from "../src/lab/data/buildings";
import type { Draft, Meeting, NewsItem } from "../src/lab/data/demo";
import { groqLLM, groqNotes, groqReady } from "../src/lab/gen/groq";
import { DEFAULT_BRAND, DEFAULT_PROMPTS, writingOf, type BrandVoice } from "../src/lab/gen/prompt";
import { newTopicProject, type TopicProject } from "../src/lab/research/types";
import { proposeTopics } from "../src/lab/research/workflow";
import { FEEDS } from "../src/lab/news/feeds";
import { CATEGORIES } from "../src/lab/news/category";
import { refineCategories } from "../src/lab/news/classifyLLM";
import { collectNews, mergeNews } from "../src/lab/news/rss";
import { sendDiscord } from "../src/lab/notify/discord";
import { sendTelegram } from "../src/lab/notify/telegram";

export interface DailyEnv {
  supabaseUrl: string;
  serviceKey: string;
  telegramToken?: string;
  telegramChat?: string;
  discordWebhook?: string;
  discordMention?: string; // 디스코드 사용자 ID (넣으면 @멘션으로 휴대폰 알림이 확실히 와요)
  labUrl?: string;
  force?: boolean;
}

type Staff = Record<string, { title: string; name: string; prompt?: string }>;

export async function runDaily(env: DailyEnv, now = Date.now()): Promise<{ ran: boolean; reason: string; drafts: Draft[]; projects?: TopicProject[]; message?: string }> {
  const cloud: Cloud = { url: env.supabaseUrl, key: env.serviceKey, token: async () => "" };
  const data = fromRows(await selectRows(cloud));
  const meetings = data.meetings ?? [];
  const schedule = (data.schedule as { meetingAt?: string } | undefined) ?? {};
  const meetingAt = schedule.meetingAt || "10:00";
  if (!env.force) {
    if (heldToday(meetings, now)) return { ran: false, reason: "오늘 회의는 이미 했어요", drafts: [] };
    if (kstMinutes(now) < parseHM(meetingAt)) return { ran: false, reason: `아직 회의 시간(${meetingAt}) 전이에요`, drafts: [] };
  }

  const brand = { ...DEFAULT_BRAND, ...((data.brand as Partial<BrandVoice>) ?? {}) };
  const staff: Staff = {
    ...Object.fromEntries(BUILDINGS.filter((b) => b.staff).map((b) => [b.id, { title: b.staff!.title, name: b.staff!.name, prompt: DEFAULT_PROMPTS[b.id] }])),
    ...((data.staff as Staff) ?? {}),
  };

  // 1. 루미: 소식 받기 (분야가 애매한 소식은 Groq에게 한 번 더 물어봐요)
  const news = await collectNews(FEEDS);
  const notes: string[] = [];
  if (groqReady() && news.unsure.length) {
    try {
      news.items = (await refineCategories(news.items, news.unsure, groqLLM)).items;
    } catch (e) {
      notes.push(`분야 다시 가리기를 못 했어요 (${String((e as Error)?.message ?? e).slice(0, 80)}). 규칙으로 가린 분야를 그대로 써요.`);
    }
  }
  if (news.failed.length) notes.push(`소식을 못 받은 곳: ${news.failed.join(", ")}`);
  const library = mergeNews(news.items, data.library ?? []);
  const inbox = news.items.length ? news.items.map((n) => n.link) : (data.inbox ?? []);
  await upsertRows(cloud, toRows({ library: news.items, inbox, lastFetch: news.fetchedAt }));

  // 2. 루미 추천대로 오늘 할 일 정하기
  const drafts = data.drafts ?? [];
  const plan = writingOf(brand);
  const pendingProjects = data.projects ?? [];
  const pendingLinks = new Set(pendingProjects.flatMap((p)=>p.seeds.map((n)=>n.link)));
  const picks = recommend(library.filter((n)=>!pendingLinks.has(n.link)), inbox.filter((link)=>!pendingLinks.has(link)), drafts, plan.bundleCount, plan.mix);
  const byLink = new Map(library.map((n)=>[n.link,n]));
  const seedLinks = [...new Set([picks.deep,...picks.bundle].filter((link):link is string=>Boolean(link)))].slice(0,2);
  const seeds = seedLinks.map((link)=>byLink.get(link)).filter((n):n is NewsItem=>Boolean(n));

  // Topics wait for approval. No research, card writing, or publishing runs unattended.
  const projects: TopicProject[] = [];
  const problems: string[] = [];
  for (const [i,seed] of seeds.entries()) {
    const p = newTopicProject([seed],now+i);
    if (groqReady()) {
      try {p.proposals=await proposeTopics(groqLLM,p.seeds);}
      catch (e) {p.error=e instanceof Error?e.message:"주제 제안 실패";problems.push(p.error);}
    } else p.error="GROQ_API_KEY가 없어서 주제를 자동 제안하지 못했어요. 수신소에서 직접 정하거나 다시 시도해 주세요.";
    projects.push(p);
  }
  if (projects.length && !groqReady()) problems.push("GROQ_API_KEY가 없어서 주제 제안은 검토 대기로 남겼어요");
  problems.push(...groqNotes);groqNotes.clear();
  if (news.failed.length) problems.push(`이번에 못 받은 매체: ${news.failed.join(", ")}`);
  const made: Draft[] = [];

  // 4. 회의록
  const waiting = drafts.filter((d) => d.status === "검토 대기").length + made.length;
  const meeting: Meeting = {
    id: `m${now.toString(36)}`,
    day: kstDay(now),
    at: now,
    notes: [
      ...meetingNotes({
        auto: true,
        staffNames: Object.values(staff).map((s) => s.name),
        inboxCount: inbox.length,
        considered: picks.candidates.length,
        jobs: [],
        topics: seeds,
        statsLine: statsReport(data.posts ?? []),
        waiting,
      }),
      ...problems.map((p) => `참고: ${p}`),
    ],
    drafts: [],
    topicProjects: projects.map((p)=>p.id),
  };
  const latest = fromRows(await selectRows(cloud));
  await upsertRows(cloud, toRows({ projects: [...projects,...(latest.projects ?? [])], meetings: [meeting] }));

  // 5. 소장님께 알림
  const title = `[오터랩] ${kstDay(now).slice(5).replace("-", "/")} ${fmtHM(kstMinutes(now))} 회의 끝`;
  const perCat = CATEGORIES.map((c) => `${c} ${news.items.filter((n) => n.category === c).length}`).join(" · ");
  const lines = [
    `받은 소식 ${news.items.length}개 (${perCat})`,
    projects.length ? `뉴스 ${projects.length}개에서 조사할 주제 후보를 준비했어요.` : "오늘은 새로 다룰 주제가 없어요.",
    ...projects.map((p)=>`- 주제 검토: ${p.proposals[0]?.title ?? p.seeds[0].title}${p.error ? " (제안 확인 필요)" : ""}`),
    `주제 검토 ${projects.length}개 · 기존 초안 검토 대기 ${waiting}개. 수신소에서 주제를 확정하면 조사에 들어가요.`,
    ...[...notes, ...problems].map((p) => `참고: ${p}`),
  ];
  const message = [title, ...lines, ...(env.labUrl ? [env.labUrl] : [])].join("\n");
  // 알림은 한쪽이 실패해도 다른 쪽은 보내요
  const fails: string[] = [];
  if (env.telegramToken && env.telegramChat) await sendTelegram(env.telegramToken, env.telegramChat, message).catch((e) => fails.push(String(e?.message ?? e)));
  if (env.discordWebhook)
    await sendDiscord(env.discordWebhook, {
      title,
      lines: [...lines, ...(env.labUrl ? [env.labUrl] : [])],
      url: env.labUrl,
      mention: env.discordMention,
    }).catch((e) => fails.push(String(e?.message ?? e)));
  if (fails.length) throw new Error(`회의는 끝났지만 알림을 못 보냈어요: ${fails.join(" / ")}`);
  return { ran: true, reason: "회의를 했어요", drafts: made, projects, message };
}

async function main() {
  const need = (k: string) => {
    const v = process.env[k];
    if (!v) throw new Error(`${k === "SUPABASE_SERVICE_ROLE_KEY" ? "SUPABASE_SECRET_KEY" : k} 환경변수가 없어요 (SETUP.md 참고)`);
    return v;
  };
  const res = await runDaily({
    supabaseUrl: cleanUrl(process.env.SUPABASE_URL || need("NEXT_PUBLIC_SUPABASE_URL")),
    serviceKey: cleanKey(process.env.SUPABASE_SECRET_KEY || need("SUPABASE_SERVICE_ROLE_KEY")),
    telegramToken: process.env.TELEGRAM_BOT_TOKEN,
    telegramChat: process.env.TELEGRAM_CHAT_ID,
    discordWebhook: process.env.DISCORD_WEBHOOK_URL,
    discordMention: process.env.DISCORD_MENTION_USER_ID,
    labUrl: process.env.LAB_URL,
    force: process.env.FORCE === "1" || process.env.FORCE === "true",
  });
  console.log(res.reason);
  if (res.message) console.log(res.message);
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/daily.ts")) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
