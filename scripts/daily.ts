// 매일 자동 회의 (GitHub Actions가 매시간 실행해요).
// 회의 시간이 지났고 오늘 회의를 아직 안 했으면: 소식 받기 → 루미 추천 → 묶음·심층 초안 쓰기 → 회의록 → 텔레그램 알림.
// 실행: npm run daily   (회의 시간과 상관없이 지금 하려면 FORCE=1 npm run daily)
import { heldToday, jobsFrom, kstDay, kstMinutes, meetingNotes, parseHM, recommend, statsReport, fmtHM } from "../src/lab/agenda";
import { fromRows, toRows } from "../src/lab/cloud/mapping";
import { selectRows, upsertRows, type Cloud } from "../src/lab/cloud/rest";
import { BUILDINGS } from "../src/lab/data/buildings";
import type { Draft, Meeting, NewsItem } from "../src/lab/data/demo";
import { groqReady, writeWithGroq } from "../src/lab/gen/groq";
import { DEFAULT_BRAND, DEFAULT_PROMPTS, type BrandVoice } from "../src/lab/gen/prompt";
import { templateBlog, templateDeck } from "../src/lab/gen/template";
import { FEEDS } from "../src/lab/news/feeds";
import { collectNews, mergeNews } from "../src/lab/news/rss";
import { sendTelegram } from "../src/lab/notify/telegram";

export interface DailyEnv {
  supabaseUrl: string;
  serviceKey: string;
  telegramToken?: string;
  telegramChat?: string;
  labUrl?: string;
  force?: boolean;
}

type Staff = Record<string, { title: string; name: string; prompt?: string }>;

export async function runDaily(env: DailyEnv, now = Date.now()): Promise<{ ran: boolean; reason: string; drafts: Draft[]; message?: string }> {
  const cloud: Cloud = { url: env.supabaseUrl, key: env.serviceKey, token: async () => env.serviceKey };
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

  // 1. 루미: 소식 받기
  const news = await collectNews(FEEDS);
  const library = mergeNews(news.items, data.library ?? []);
  const inbox = news.items.length ? news.items.map((n) => n.link) : data.inbox ?? [];
  await upsertRows(cloud, toRows({ library: news.items, inbox, lastFetch: news.fetchedAt }));

  // 2. 루미 추천대로 오늘 할 일 정하기
  const drafts = data.drafts ?? [];
  const picks = recommend(library, inbox, drafts);
  const byLink = new Map(library.map((n) => [n.link, n]));
  const bundle = picks.bundle.map((l) => byLink.get(l)).filter((n): n is NewsItem => Boolean(n));
  const deep = picks.deep ? byLink.get(picks.deep) : undefined;
  const jobs = jobsFrom(bundle, deep);

  // 3. 모모·테오: 초안 쓰기 (Groq가 안 되면 뼈대 초안)
  const made: Draft[] = [];
  const problems: string[] = [];
  for (const [i, job] of jobs.entries()) {
    const req = { type: job.type, items: job.items, brand, prompts: { cards: staff.cards?.prompt, blog: staff.blog?.prompt } };
    let out: Pick<Draft, "deck" | "blog" | "engine">;
    if (groqReady()) {
      try {
        out = { ...(await writeWithGroq(req)), engine: "groq" };
      } catch (e) {
        problems.push(`${job.type} 초안은 Groq 연결이 안 돼서 뼈대로 썼어요 (${e instanceof Error ? e.message.slice(0, 80) : "오류"})`);
        out = { deck: templateDeck(job.type, job.items, brand), blog: templateBlog(job.type, job.items, now), engine: "template" };
      }
    } else {
      out = { deck: templateDeck(job.type, job.items, brand), blog: templateBlog(job.type, job.items, now), engine: "template" };
    }
    made.push({ id: `d${now.toString(36)}${i}`, type: job.type, createdAt: now + i, status: "검토 대기", sources: job.items.map((n) => n.link), ...out });
  }
  if (jobs.length && !groqReady()) problems.push("GROQ_API_KEY가 없어서 뼈대 초안으로 썼어요");
  if (news.failed.length) problems.push(`이번에 못 받은 매체: ${news.failed.join(", ")}`);

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
        jobs,
        statsLine: statsReport(data.posts ?? []),
        waiting,
      }),
      ...problems.map((p) => `참고: ${p}`),
    ],
    drafts: made.map((d) => d.id),
  };
  await upsertRows(cloud, toRows({ drafts: made, meetings: [meeting] }));

  // 5. 소장님께 알림
  const label = (d: Draft) => d.deck.cards[0]?.title || d.blog.title;
  const message = [
    `[오터랩] ${kstDay(now).slice(5).replace("-", "/")} ${fmtHM(kstMinutes(now))} 회의 끝`,
    made.length ? `루미가 고른 소식으로 초안 ${made.length}개를 썼어요.` : "오늘은 새로 다룰 소식이 없어서 초안을 쓰지 않았어요.",
    ...made.map((d) => `- ${d.type}: ${label(d)}${d.engine === "template" ? " (뼈대)" : ""}`),
    `검토 대기 ${waiting}개. 공방에서 확인하고 우편선으로 보내 주세요.`,
    ...problems.map((p) => `참고: ${p}`),
    ...(env.labUrl ? [env.labUrl] : []),
  ].join("\n");
  if (env.telegramToken && env.telegramChat) await sendTelegram(env.telegramToken, env.telegramChat, message);
  return { ran: true, reason: "회의를 했어요", drafts: made, message };
}

async function main() {
  const need = (k: string) => {
    const v = process.env[k];
    if (!v) throw new Error(`${k} 환경변수가 없어요 (SETUP.md 참고)`);
    return v;
  };
  const res = await runDaily({
    supabaseUrl: process.env.SUPABASE_URL || need("NEXT_PUBLIC_SUPABASE_URL"),
    serviceKey: need("SUPABASE_SERVICE_ROLE_KEY"),
    telegramToken: process.env.TELEGRAM_BOT_TOKEN,
    telegramChat: process.env.TELEGRAM_CHAT_ID,
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
