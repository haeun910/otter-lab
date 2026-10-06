// 오터랩의 하루: 회의 소집, 결정 뒤 초안 만들기 (안건을 만드는 순수 함수는 agenda.ts)
export * from "./agenda";
import { byId } from "./data/buildings";
import { jobsFrom, kstDay, meetingNotes, statsReport } from "./agenda";
import type { Draft, DraftType, NewsItem } from "./data/demo";
import { fetchNews, writeDraft } from "./gen/client";
import { useLab } from "./store";
import { templateDeck } from "./gen/template";
import type { GenerationTarget } from "./gen/generate";
import type { DraftRequest } from "./gen/prompt";

// ---------- 회의 진행 ----------
let gatherTimer: ReturnType<typeof setTimeout> | undefined;

/** 연구원들이 가운데 마당 나무 아래로 모여요. 잠깐 뒤 오늘 회의 창이 열려요 */
export function startMeeting(reason: "time" | "manual") {
  const st = useLab.getState();
  if (st.phase !== "work") return;
  st.setPhase("gathering");
  st.say(
    reason === "time"
      ? `${st.schedule.meetingAt} 회의 시간이에요. 연구원들이 마당 나무 아래로 모여요.`
      : "회의를 소집했어요. 연구원들이 마당 나무 아래로 모여요.",
  );
  // 루미는 모이는 동안 최신 소식을 한 번 더 받아 와요 (서버가 있을 때만)
  void fetchNews().then((res) => {
    if (res?.items.length) useLab.getState().receiveNews(res.items, res.fetchedAt);
  });
  clearTimeout(gatherTimer);
  gatherTimer = setTimeout(openAgenda, 2_500);
}

/** 다 모이면 회의 창을 열어요 */
export function openAgenda() {
  clearTimeout(gatherTimer);
  const st = useLab.getState();
  if (st.phase !== "gathering") return;
  st.setPhase("meeting");
  st.travel("meeting");
  st.say("다 모였어요. 회의를 시작할게요.");
  // 마당을 잠깐 보여 주고 안건을 펼쳐요
  const table = byId("meeting").objects.find((o) => o.panel === "meeting")!;
  setTimeout(() => {
    if (useLab.getState().phase === "meeting") useLab.getState().openFocus(table);
  }, 900);
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
  }, 1_500);

  for (const job of jobs) await writeJob(job.type, job.items, meetingId);
}

/** Parts are saved independently; a blog failure cannot replace the cards. */
export async function writeJob(type: DraftType, items: NewsItem[], meetingId?: string, options: { target?: GenerationTarget; request?: DraftRequest; draftId?: string } = {}) {
  const st = useLab.getState();
  if (st.busy || !items.length) return;
  const target = options.target ?? "both";
  const request = structuredClone(options.request ?? { type, items, brand: st.brand, prompts: { cards: st.staff.cards?.prompt, blog: st.staff.blog?.prompt } });
  const previous = options.draftId ? st.drafts.find((d) => d.id === options.draftId) : undefined;
  if (options.draftId && (!previous || previous.status === "게시함")) return;
  const now = Date.now();
  const draft: Draft = previous ?? {
    id: `d${now.toString(36)}`, type, createdAt: now, status: "검토 대기", engine: "template",
    sources: items.map((n) => n.link), deck: templateDeck(type, items, request.brand),
    blog: { title: "", intro: "", sections: [], outro: "", tags: [] },
    generation: { request, cards: { status: "pending", engine: "template" }, blog: { status: target === "cards" ? "skipped" : "pending" } },
  };
  if (!previous) {
    st.addDraft(draft);
    if (meetingId) useLab.setState((s) => ({ meetings: s.meetings.map((m) => m.id === meetingId ? { ...m, drafts: [...m.drafts, draft.id] } : m) }));
  }
  let lastDeck = draft.deck;
  let lastBlog = draft.blog;
  st.setBusy("draft");
  try {
    await writeDraft(request, undefined, {
      target,
      ...(previous ? { previous: { deck: previous.deck, blog: previous.blog, cards: previous.generation?.cards ?? { status: "complete" as const, engine: previous.engine === "groq" ? "groq" as const : "template" as const }, blogState: previous.generation?.blog ?? { status: "complete" as const } } } : {}),
      onUpdate: (value) => {
        const s = useLab.getState();
        s.setWriting("cards", value.cards.status === "running");
        s.setWriting("blog", value.blogState.status === "running");
        s.patchDraft(draft.id, { ...(value.deck !== lastDeck ? { deck: value.deck } : {}), ...(value.blog !== lastBlog ? { blog: value.blog } : {}), engine: value.cards.engine ?? "template", generation: { request, cards: value.cards, blog: value.blogState } });
        lastDeck = value.deck; lastBlog = value.blog;
      },
    });
    const result = useLab.getState().drafts.find((d) => d.id === draft.id)!;
    st.say(result.generation?.cards.status === "failed" || result.generation?.blog.status === "failed" ? "생성하지 못한 작업이 있어요. 초안에서 이유를 확인하고 해당 작업만 다시 시도해 주세요." : "요청한 작업을 마쳤어요. 초안을 확인해 주세요.");
    return result;
  } finally {
    const s = useLab.getState(); s.setBusy(null); s.setWriting("cards", false); s.setWriting("blog", false);
  }
}

export async function retryDraftPart(draft: Draft, target: "cards" | "blog") {
  const request = draft.generation?.request;
  if (!request) return;
  return writeJob(draft.type, request.items, undefined, { target, request, draftId: draft.id });
}
