// 회의 안건을 만드는 순수 함수들. 화면(company.ts)과 매일 자동 회의 스크립트(scripts/daily.ts)가 같이 써요.
import type { Draft, DraftType, NewsItem, Post } from "./data/demo";

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

export const heldToday = (meetings: { day: string }[], now = Date.now()) => meetings.some((m) => m.day === kstDay(now));

/** 오늘 회의 시간이 지났는데 아직 안 했으면 true */
export const meetingDue = (meetingAt: string, meetings: { day: string }[], now = Date.now()) =>
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

// ---------- 회의록 ----------
export interface NotesInput {
  staffNames: string[];
  inboxCount: number;
  considered: number;
  jobs: { type: DraftType; items: { title: string }[] }[];
  statsLine: string;
  waiting: number;
  memo?: string;
  auto?: boolean; // 소장 없이 자동으로 한 회의
}

export function meetingNotes(n: NotesInput): string[] {
  const chosen = n.jobs.reduce((a, j) => a + j.items.length, 0);
  return [
    `참석: ${n.auto ? "" : "소장, "}${n.staffNames.join(", ")}${n.auto ? " (소장 부재, 자동 회의)" : ""}`,
    `소식 보고: 수신 소식 ${n.inboxCount}개 중 후보 ${n.considered}개를 검토해서 ${chosen}개 선택`,
    `성과 보고: ${n.statsLine}`,
    `게시 대기: ${n.waiting}개`,
    ...(n.jobs.length ? n.jobs.map((j) => `결정: ${j.type} 초안 (${j.items.map((x) => x.title).join(" / ")})`) : ["결정: 오늘은 새 초안 없음"]),
    ...(n.memo?.trim() ? [`소장 메모: ${n.memo.trim()}`] : []),
  ];
}

/** 소식 목록을 묶음·심층 할 일로 바꿔요 (묶음은 2개 이상일 때만) */
export function jobsFrom(bundle: NewsItem[], deep: NewsItem | undefined): { type: DraftType; items: NewsItem[] }[] {
  const jobs: { type: DraftType; items: NewsItem[] }[] = [];
  if (bundle.length >= 2) jobs.push({ type: "묶음", items: bundle });
  if (deep) jobs.push({ type: "심층", items: [deep] });
  return jobs;
}
