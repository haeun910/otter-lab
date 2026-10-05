// 오터랩의 하루: 회의 시간, 회의 안건(추천 소식·성과·게시 대기), 결정 뒤 초안 만들기
import { byId } from "./data/buildings";
import type { Draft, DraftType, Meeting, NewsItem, Post } from "./data/demo";
import { fetchNews, writeDraft } from "./gen/client";
import { draftLabel, useLab } from "./store";

// ---------- 시계 (모두 한국 시간) ----------
const KST = 9 * 3600_000;
export const kstDay = (t: number) => new Date(t + KST).toISOString().slice(0, 10);
export const kstMinutes = (t: number) => {
  const d = new Date(t + KST);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
};
export const parseHM = (hm: string) => {
  const [h, m] = hm.split(":").map(Number);
  return (Number.isFinite(h) ? h : 10) * 60 + (Number.isFinite(m) ? m : 0);
};
export const fmtHM = (min: number) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h < 12 ? "오전" : "오후"} ${h % 12 || 12}:${String(m).padStart(2, "0")}`;
};

export const heldToday = (meetings: Meeting[], now = Date.now()) => meetings.some((m) => m.day === kstDay(now));

/** 오늘 회의 시간이 지났는데 아직 안 했으면 true */
export const meetingDue = (meetingAt: string, meetings: Meeting[], now = Date.now()) =>
  !heldToday(meetings, now) && kstMinutes(now) >= parseHM(meetingAt);

// ---------- 루미의 추천 ----------
const WEIGHT: Record<NewsItem["category"], number> = { AI: 3, 개발: 1.2, 업계: 1 };

/** 소식 점수: AI 소식, 국내 매체, 요약이 넉넉한 것, 최근 것일수록 높아요 */
export function scoreNews(n: NewsItem, newest: number) {
  const ageH = Math.max(0, (newest - n.publishedAt) / 3600_000);
  return WEIGHT[n.category] + (n.region === "국내" ? 1 : 0) + Math.min(n.excerpt.length, 140) / 70 + Math.max(0, 2 - ageH / 12);
}

export interface Picks {
  candidates: NewsItem[]; // 회의에 올린 후보 (점수순)
  bundle: string[]; // 묶음으로 추천하는 소식 링크
  deep: string | null; // 심층으로 추천하는 소식 링크
}

/** 최근 소식 중 아직 초안에 안 쓴 것으로 묶음 5개 + 심층 1개를 골라요 (한 매체에서 2개까지) */
export function recommend(library: NewsItem[], inbox: string[], drafts: Draft[], size = 5): Picks {
  const used = new Set(drafts.flatMap((d) => d.sources));
  const byLink = new Map(library.map((n) => [n.link, n]));
  const pool = (inbox.length ? inbox.map((l) => byLink.get(l)) : library.slice(0, 60)).filter((n): n is NewsItem => Boolean(n) && !used.has(n!.link));
  const newest = Math.max(0, ...pool.map((n) => n.publishedAt));
  const ranked = [...pool].sort((a, b) => scoreNews(b, newest) - scoreNews(a, newest));
  // 심층: 상위 후보 중 요약이 가장 긴 AI 소식
  const deepItem = ranked.slice(0, 8).filter((n) => n.category === "AI").sort((a, b) => b.excerpt.length - a.excerpt.length)[0] ?? ranked[0];
  const bundle: string[] = [];
  const perSource = new Map<string, number>();
  for (const n of ranked) {
    if (bundle.length >= size) break;
    if (n.link === deepItem?.link) continue;
    const c = perSource.get(n.source) ?? 0;
    if (c >= 2) continue;
    perSource.set(n.source, c + 1);
    bundle.push(n.link);
  }
  return { candidates: ranked.slice(0, 14), bundle, deep: deepItem?.link ?? null };
}

// ---------- 나래의 보고 ----------
export function statsReport(posts: Post[]): string {
  const real = posts.filter((p) => !p.sample);
  const pool = real.length >= 2 ? real : posts;
  if (!pool.length) return "아직 게시한 카드뉴스가 없어요. 첫 게시물이 나오면 반응을 모아 올게요.";
  const avg = (t: DraftType) => {
    const xs = pool.filter((p) => p.type === t);
    return xs.length ? xs.reduce((a, p) => a + p.saves, 0) / xs.length : 0;
  };
  const [b, d] = [avg("묶음"), avg("심층")];
  const last = [...pool].sort((x, y) => y.postedAt - x.postedAt)[0];
  const lead = d > b ? `심층 카드가 저장을 더 많이 받고 있어요 (평균 ${Math.round(d)} 대 ${Math.round(b)}).` : `묶음 카드가 저장을 더 많이 받고 있어요 (평균 ${Math.round(b)} 대 ${Math.round(d)}).`;
  const sample = real.length < 2 ? " 아직 예시 수치가 섞여 있어요." : "";
  return `${lead} 가장 최근 게시물 '${last.title}'은 저장 ${last.saves}, 좋아요 ${last.likes}이에요.${sample}`;
}

// ---------- 회의 진행 ----------
let gatherTimer: ReturnType<typeof setTimeout> | undefined;

/** 연구원들이 회의실로 모여요. 다 모이면(또는 조금 기다린 뒤) 회의 탁자 창이 열려요 */
export function startMeeting(reason: "time" | "manual") {
  const st = useLab.getState();
  if (st.phase !== "work") return;
  st.setPhase("gathering");
  // 다들 복도를 지나 모이는 모습이 보이게 본관 전체로
  st.travel("overview");
  st.say(reason === "time" ? `${st.schedule.meetingAt} 회의 시간이에요. 연구원들이 회의실로 모여요.` : "회의를 소집했어요. 연구원들이 회의실로 모여요.");
  // 루미는 모이는 동안 최신 소식을 한 번 더 받아 와요 (서버가 있을 때만)
  void fetchNews().then((res) => {
    if (res?.items.length) useLab.getState().receiveNews(res.items, res.fetchedAt);
  });
  clearTimeout(gatherTimer);
  gatherTimer = setTimeout(openAgenda, 20_000);
}

/** 모두 앉았을 때 Crew가 불러요 */
export function openAgenda() {
  clearTimeout(gatherTimer);
  const st = useLab.getState();
  if (st.phase !== "gathering") return;
  st.setPhase("meeting");
  st.travel("meeting");
  st.say("다 모였어요. 회의를 시작할게요.");
  // 둘러앉은 모습을 잠깐 보여 주고 안건을 펼쳐요
  const table = byId("meeting").objects.find((o) => o.panel === "meeting")!;
  setTimeout(() => {
    if (useLab.getState().phase === "meeting") useLab.getState().openFocus(table);
  }, 1800);
}

export interface Decision {
  bundle: string[];
  deep: string | null;
  memo: string;
  considered: number; // 회의에 올라온 후보 수
}

/** 소장 결정: 회의록을 남기고, 다들 자리로 돌아가 초안을 써요 */
export async function closeMeeting(dec: Decision | null) {
  const st = useLab.getState();
  const now = Date.now();
  const byLink = new Map(st.library.map((n) => [n.link, n]));
  const bundleItems = (dec?.bundle ?? []).map((l) => byLink.get(l)).filter((n): n is NewsItem => Boolean(n));
  const deepItem = dec?.deep ? byLink.get(dec.deep) : undefined;
  const jobs: { type: DraftType; items: NewsItem[] }[] = [];
  if (bundleItems.length >= 2) jobs.push({ type: "묶음", items: bundleItems });
  if (deepItem) jobs.push({ type: "심층", items: [deepItem] });

  const notes = [
    `참석: 소장, ${Object.values(st.staff).map((s) => s.name).join(", ")}`,
    `소식 보고: 수신 소식 ${st.inbox.length}개 중 후보 ${dec?.considered ?? 0}개를 검토해서 ${jobs.reduce((a, j) => a + j.items.length, 0)}개 선택`,
    `성과 보고: ${statsReport(st.posts)}`,
    `게시 대기: ${st.drafts.filter((d) => d.status === "검토 대기").length}개`,
    ...(jobs.length ? jobs.map((j) => `결정: ${j.type} 초안 (${j.items.map((n) => n.title).join(" / ")})`) : ["결정: 오늘은 새 초안 없음"]),
    ...(dec?.memo.trim() ? [`소장 메모: ${dec.memo.trim()}`] : []),
  ];
  const meetingId = `m${now.toString(36)}`;
  st.addMeeting({ id: meetingId, day: kstDay(now), at: now, notes, drafts: [] });
  st.closeFocus();
  st.setPhase("returning");
  st.travel("overview");
  st.say(jobs.length ? `회의 끝! ${jobs.map((j) => j.type).join("·")} 초안을 쓰러 각자 자리로 돌아가요.` : "회의 끝! 다들 자리로 돌아가요.");
  setTimeout(() => {
    if (useLab.getState().phase === "returning") useLab.getState().setPhase("work");
  }, 15_000);

  for (const job of jobs) await writeJob(job.type, job.items, meetingId);
}

/** 모모(카드)와 테오(블로그)가 초안 한 건을 써요 */
export async function writeJob(type: DraftType, items: NewsItem[], meetingId?: string) {
  const st = useLab.getState();
  st.setBusy("draft");
  st.setWriting("cards", true);
  st.setWriting("blog", true);
  try {
    const w = await writeDraft({
      type,
      items,
      brand: st.brand,
      prompts: { cards: st.staff.cards?.prompt, blog: st.staff.blog?.prompt },
    });
    const now = Date.now();
    const draft: Draft = { id: `d${now.toString(36)}`, type, createdAt: now, status: "검토 대기", engine: w.engine, sources: items.map((n) => n.link), deck: w.deck, blog: w.blog };
    useLab.getState().addDraft(draft);
    if (meetingId) useLab.setState((s) => ({ meetings: s.meetings.map((m) => (m.id === meetingId ? { ...m, drafts: [...m.drafts, draft.id] } : m)) }));
    const why = w.engine === "groq" ? "" : w.why === "nokey" ? " (Groq 키가 없어 뼈대 초안)" : w.why === "error" ? " (Groq 연결 실패로 뼈대 초안)" : " (서버 없이 뼈대 초안)";
    useLab.getState().say(`${type} 초안 '${draftLabel(draft)}'이 나왔어요${why}. 카드뉴스 공방에서 확인해 보세요.`);
    return draft;
  } finally {
    const s = useLab.getState();
    s.setBusy(null);
    s.setWriting("cards", false);
    s.setWriting("blog", false);
  }
}
