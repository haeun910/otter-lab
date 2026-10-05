// 오터랩의 하루: 회의 소집, 결정 뒤 초안 만들기 (안건을 만드는 순수 함수는 agenda.ts)
export * from "./agenda";
import { byId } from "./data/buildings";
import { jobsFrom, kstDay, meetingNotes, statsReport } from "./agenda";
import type { Draft, DraftType, NewsItem } from "./data/demo";
import { fetchNews, writeDraft } from "./gen/client";
import { draftLabel, useLab } from "./store";

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
  const jobs = jobsFrom(bundleItems, deepItem);
  const notes = meetingNotes({
    staffNames: Object.values(st.staff).map((x) => x.name),
    inboxCount: st.inbox.length,
    considered: dec?.considered ?? 0,
    jobs,
    statsLine: statsReport(st.posts),
    waiting: st.drafts.filter((d) => d.status === "검토 대기").length,
    memo: dec?.memo,
  });
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
