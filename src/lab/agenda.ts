// 회의 안건을 만드는 순수 함수들. 화면(company.ts)과 매일 자동 회의 스크립트(scripts/daily.ts)가 같이 써요.
import type { Draft, DraftType, NewsItem, Post } from "./data/demo";
import { CATEGORIES, DEFAULT_MIX, type Category, type Mix } from "./news/category";

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
export { DEFAULT_MIX, type Mix } from "./news/category";

/** size개를 분야 비율대로 나눠요. 남는 자리는 비율이 큰 분야부터 (같으면 앞 분야부터) */
export function quotas(size: number, mix: Partial<Mix> = DEFAULT_MIX): Mix {
  const w = CATEGORIES.map((c) => Math.max(0, Number(mix[c] ?? 0) || 0));
  const weights = w.some((x) => x > 0) ? w : CATEGORIES.map(() => 1);
  const sum = weights.reduce((a, b) => a + b, 0);
  const exact = weights.map((x) => (x / sum) * size);
  const out = exact.map(Math.floor);
  const order = exact.map((x, i) => [x - Math.floor(x), weights[i], -i] as const).map((k, i) => ({ k, i }));
  order.sort((a, b) => b.k[0] - a.k[0] || b.k[1] - a.k[1] || b.k[2] - a.k[2]);
  let left = size - out.reduce((a, b) => a + b, 0);
  for (const { i } of order) {
    if (left <= 0) break;
    if (weights[i] > 0) {
      out[i]++;
      left--;
    }
  }
  return Object.fromEntries(CATEGORIES.map((c, i) => [c, out[i]])) as Mix;
}

/** 소식 점수: 최근 것, 요약이 넉넉한 것, 인기 있는 것(추천·별·좋아요)일수록 높아요.
 *  topScore는 같은 매체에서 가장 높은 인기 점수 (매체마다 숫자 크기가 달라서 나눠 봐요) */
export function scoreNews(n: NewsItem, newest: number, topScore = 0) {
  const ageH = Math.max(0, (newest - n.publishedAt) / 3600_000);
  const fresh = Math.max(0, 2 - ageH / 12);
  const body = Math.min(n.excerpt.length, 140) / 70;
  const pop = n.score && topScore > 0 ? (Math.log10(1 + n.score) / Math.log10(1 + topScore)) * 1.5 : 0;
  return 1 + fresh + body + pop;
}

export interface Picks {
  candidates: NewsItem[]; // 회의에 올린 후보 (분야 순서, 분야 안에서는 점수순)
  bundle: string[]; // 묶음으로 추천하는 소식 링크
  deep: string | null; // 심층으로 추천하는 소식 링크
}

/**
 * 최근 소식 중 아직 초안에 안 쓴 것으로 묶음 size개 + 심층 1개를 골라요.
 * 묶음은 분야 비율(mix)대로 나누고, 국내·해외가 반반이 되게 번갈아 고르고, 한 매체에서는 2개까지만.
 */
export function recommend(library: NewsItem[], inbox: string[], drafts: Draft[], size = 5, mix: Partial<Mix> = DEFAULT_MIX): Picks {
  const used = new Set(drafts.flatMap((d) => d.sources));
  const byLink = new Map(library.map((n) => [n.link, n]));
  const pool = (inbox.length ? inbox.map((l) => byLink.get(l)) : library.slice(0, 150)).filter((n): n is NewsItem => Boolean(n) && !used.has(n!.link));
  const newest = Math.max(0, ...pool.map((n) => n.publishedAt));
  const top = new Map<string, number>();
  for (const n of pool) if (n.score) top.set(n.source, Math.max(top.get(n.source) ?? 0, n.score));
  const score = new Map(pool.map((n) => [n.link, scoreNews(n, newest, top.get(n.source))]));
  const ranked = [...pool].sort((a, b) => score.get(b.link)! - score.get(a.link)!);

  // 심층: 상위 후보 중 요약이 넉넉한 것 (툴 소개는 짧아서 빼요)
  const deepItem =
    ranked
      .slice(0, 12)
      .filter((n) => n.category !== "Tools")
      .sort((a, b) => b.excerpt.length - a.excerpt.length)[0] ?? ranked[0];

  const picked: NewsItem[] = [];
  const perSource = new Map<string, number>();
  const region = { 국내: 0, 해외: 0, 미확인: 0 };
  const take = (list: NewsItem[]) => {
    const ok = list.filter((n) => n.link !== deepItem?.link && !picked.includes(n) && (perSource.get(n.source) ?? 0) < 2);
    if (!ok.length) return false;
    // 국내·해외 중 덜 뽑힌 쪽을 먼저 찾아요 (가장 좋은 후보 점수의 80% 이상일 때만)
    const want = region.국내 <= region.해외 ? "국내" : "해외";
    const bar = score.get(ok[0].link)! * 0.8;
    const n = ok.find((x) => x.region === want && score.get(x.link)! >= bar) ?? ok[0];
    picked.push(n);
    perSource.set(n.source, (perSource.get(n.source) ?? 0) + 1);
    region[n.region]++;
    return true;
  };
  const q = quotas(size, mix);
  const byCat = (c: Category) => ranked.filter((n) => n.category === c);
  // 분야를 돌아가며 한 개씩 (한 분야가 몰리지 않게)
  for (let round = 0; round < size; round++)
    for (const c of CATEGORIES) {
      if (picked.length >= size) break;
      if (picked.filter((n) => n.category === c).length >= q[c] || round >= q[c]) continue;
      take(byCat(c));
    }
  // 모자라면 분야와 상관없이 점수순으로 채워요
  while (picked.length < size && take(ranked));
  const order = (n: NewsItem) => CATEGORIES.indexOf(n.category);
  const bundle = [...picked].sort((a, b) => order(a) - order(b)).map((n) => n.link);

  // 회의 후보: 분야마다 상위 3개씩 + 점수순으로 16개까지
  const cand: NewsItem[] = [];
  for (const c of CATEGORIES) cand.push(...byCat(c).slice(0, 3));
  for (const n of [...picked, ...(deepItem ? [deepItem] : []), ...ranked]) {
    if (cand.length >= 16) break;
    if (!cand.includes(n)) cand.push(n);
  }
  for (const n of [...picked, ...(deepItem ? [deepItem] : [])]) if (!cand.includes(n)) cand.push(n);
  const rank = new Map(ranked.map((n, i) => [n.link, i]));
  cand.sort((a, b) => order(a) - order(b) || rank.get(a.link)! - rank.get(b.link)!);
  return { candidates: cand, bundle, deep: deepItem?.link ?? null };
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
  const lead =
    d > b
      ? `심층 카드가 저장을 더 많이 받고 있어요 (평균 ${Math.round(d)} 대 ${Math.round(b)}).`
      : `묶음 카드가 저장을 더 많이 받고 있어요 (평균 ${Math.round(b)} 대 ${Math.round(d)}).`;
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
  topics?: { title: string }[];
  auto?: boolean; // 소장 없이 자동으로 한 회의
}

export function meetingNotes(n: NotesInput): string[] {
  const chosen = n.topics?.length ?? n.jobs.reduce((a, j) => a + j.items.length, 0);
  return [
    `참석: ${n.auto ? "" : "소장, "}${n.staffNames.join(", ")}${n.auto ? " (소장 부재, 자동 회의)" : ""}`,
    `소식 보고: 수신 소식 ${n.inboxCount}개 중 후보 ${n.considered}개를 검토해서 ${chosen}개 선택`,
    `성과 보고: ${n.statsLine}`,
    `게시 대기: ${n.waiting}개`,
    ...(n.topics ? n.topics.length ? n.topics.map((t) => `결정: 주제 제안을 준비할 뉴스 (${t.title})`) : ["결정: 오늘은 새 주제 없음"] : n.jobs.length ? n.jobs.map((j) => `결정: ${j.type} 초안 (${j.items.map((x) => x.title).join(" / ")})`) : ["결정: 오늘은 새 초안 없음"]),
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
