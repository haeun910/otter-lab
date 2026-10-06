"use client";
import { useEffect, useState } from "react";
import campus from "../assets/research-campus.webp";
import { heldToday } from "../agenda";
import { byId, type PanelKind } from "../data/buildings";
import { fetchStatus } from "../gen/client";
import { draftLabel, useLab } from "../store";
import { Clock, OtterFace } from "./Hud";

/** All entry points reuse the existing panels and their actions. */
export function openLabRoom(room: string, panel?: PanelKind) {
  const s = useLab.getState();
  const building = byId(room);
  const object = panel ? building.objects.find((o) => o.panel === panel) : building.objects[0];
  if (!object) return;
  s.travel(room);
  s.openFocus(object);
}

const ROOMS = [
  { id: "receiver", icon: "✉", panel: "inbox", x: 23, y: 16 },
  { id: "cards", icon: "✎", panel: "cardEditor", x: 75, y: 16 },
  { id: "blog", icon: "▤", panel: "blogDesk", x: 22, y: 48 },
  { id: "office", icon: "⌂", panel: "drafts", x: 76, y: 48 },
  { id: "meeting", icon: "♧", panel: "meeting", x: 49, y: 62 },
  { id: "library", icon: "▥", panel: "library", x: 22, y: 79 },
  { id: "dock", icon: "⚓", panel: "mailboat", x: 78, y: 83 },
] as const;

const date = (at: number) => new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" }).format(at);

export default function LabWorkspace() {
  const s = useLab();
  const [tab, setTab] = useState("lab");
  const [status, setStatus] = useState<Awaited<ReturnType<typeof fetchStatus>> | "loading">("loading");
  useEffect(() => { let active = true; void fetchStatus().then((v) => { if (active) setStatus(v); }); return () => { active = false; }; }, []);
  const waiting = s.drafts.filter((d) => d.status === "검토 대기");
  const real = waiting.filter((d) => d.engine !== "sample");
  const samples = waiting.length - real.length;
  const generating = s.busy === "draft";
  const selected = s.drafts.find((d) => d.id === s.current && d.engine !== "sample") ?? s.drafts.find((d) => d.engine !== "sample");
  const generationLabels = { pending: "대기", running: "작성 중", complete: "완료", partial: "일부 실패", failed: "실패 · 재시도 필요", skipped: "요청하지 않음" };
  const partStatus = (part: "cards" | "blog") => selected?.generation ? (selected.generation[part].status === "running" && !generating ? "작업 중단 · 재시도 필요" : generationLabels[selected.generation[part].status]) : `검토 대기 ${real.length}개`;
  const cloudLabel = { off: "브라우저 저장", saving: "저장 중", saved: "클라우드 저장됨", error: "저장 오류" }[s.cloud];
  const roomStatus = (id: string) => {
    if (id === "receiver") return s.busy === "news" ? "소식 수집 중" : s.lastFetch ? `최근 소식 ${s.inbox.length}개` : "새 소식을 받아 주세요";
    if (id === "cards" || id === "blog") return selected?.generation ? partStatus(id === "cards" ? "cards" : "blog") : `검토 대기 ${real.length}개${samples ? ` · 예시 ${samples}` : ""}`;
    if (id === "office") return `확인할 초안 ${real.length}개`;
    if (id === "meeting") return s.phase === "gathering" ? "회의 준비 중" : s.phase === "meeting" ? "회의 중" : heldToday(s.meetings) ? "오늘 회의 기록 있음" : `${s.schedule.meetingAt} 회의`;
    if (id === "library") return `소식 ${s.library.length.toLocaleString()}건`;
    return "콘텐츠 확인 · 내보내기";
  };
  const activities = [
    ...(s.lastFetch ? [{ id: "news", at: s.lastFetch, title: `소식 ${s.inbox.length}개 수집`, room: "receiver", panel: "inbox" as PanelKind }] : []),
    ...s.drafts.filter((d) => d.engine !== "sample").map((d) => ({ id: d.id, at: d.createdAt, title: `${d.engine === "template" ? "뼈대" : "AI"} 초안 · ${draftLabel(d)}`, room: "cards", panel: "cardEditor" as PanelKind })),
    ...s.meetings.map((m) => ({ id: m.id, at: m.at, title: `회의 기록 · 초안 ${m.drafts.length}개`, room: "meeting", panel: "minutes" as PanelKind })),
  ].sort((a, b) => b.at - a.at).slice(0, 4);
  const stages = [
    { name: "소식 수집", detail: s.busy === "news" ? "루미가 소식을 받고 있어요" : s.lastFetch ? `마지막 수집 ${date(s.lastFetch)}` : "수신소에서 새 소식을 받아 주세요", room: "receiver", panel: "inbox" as PanelKind, active: s.busy === "news" },
    { name: "모모 · 카드 작성", detail: partStatus("cards"), room: "cards", panel: "cardEditor" as PanelKind, active: s.writing.includes("cards") },
    { name: "테오 · 블로그 작성", detail: partStatus("blog"), room: "blog", panel: "blogDesk" as PanelKind, active: s.writing.includes("blog") },
    { name: "소장 검토", detail: `${real.length}개 검토 대기${samples ? ` · 예시 ${samples}개 별도` : ""}`, room: "office", panel: "drafts" as PanelKind, active: false },
    { name: "게시 준비", detail: "콘텐츠 확인 후 내보내기 · 외부 게시는 직접", room: "dock", panel: "mailboat" as PanelKind, active: false },
  ];
  return <div className="workspace" data-view={tab}>
    <header className="workspace__header">
      <a className="workspace__brand" href="#" onClick={(e) => { e.preventDefault(); s.closeFocus(); s.travel("overview"); setTab("lab"); }}><OtterFace size={44} /><span><strong>오터랩</strong><small>OTTER LAB · 나의 자동화 연구소</small></span></a>
      <Clock />
      <button className={`workspace__storage workspace__storage--${s.cloud}`} onClick={() => openLabRoom("office", "brand")}>{cloudLabel} ↗</button>
      <button className="workspace__settings" onClick={() => openLabRoom("office", "brand")} aria-label="운영 설정">⚙</button>
    </header>
    <nav className="workspace__tabs" aria-label="화면 선택"><button aria-pressed={tab === "lab"} onClick={() => setTab("lab")}>연구소</button><button aria-pressed={tab === "work"} onClick={() => setTab("work")}>작업 보드 · {real.length}</button></nav>
    <main className="workspace__main">
      <section className="campus" aria-label="연구소 업무 공간">
        <img className="campus__art" src={typeof campus === "string" ? campus : campus.src} alt="숲과 강 사이에서 수달 연구원들이 각자의 책상에서 일하는 오터랩" />
        <div className="campus__intro"><span>숲속 강가의 작은 연구소</span><strong>오늘도 함께, 좋은 소식을 만들어요.</strong></div>
        {ROOMS.map((room) => <button key={room.id} className={`campus__room ${s.writing.includes(room.id) ? "campus__room--working" : ""}`} style={{ left: `${room.x}%`, top: `${room.y}%` }} onClick={() => openLabRoom(room.id, room.panel)}>
          <strong><span aria-hidden="true">{room.icon}</span> {byId(room.id).name}</strong>
          <span>{s.staff[room.id]?.name ?? (room.id === "office" ? "소장" : "다 함께")} <em>{roomStatus(room.id)}</em></span>
        </button>)}
        <div className="campus__shortcuts"><button onClick={() => openLabRoom("dorm")}>연구원 명부 ↗</button><button onClick={() => openLabRoom("stats")}>성과 게시판 ↗</button></div>
      </section>
      <aside className="workboard" aria-label="작업 보드">
        <section className="workboard__section"><div className="workboard__heading"><h1>연구소의 작업</h1><span>실제 작업 상태</span></div><p className="workboard__intro">소식에서 초안까지, 소장님의 검토를 기다려요.</p>
          <ol className="workboard__stages">{stages.map((stage, i) => <li key={stage.name}><button onClick={() => openLabRoom(stage.room, stage.panel)}><span className={`workboard__step ${stage.active ? "workboard__step--active" : ""}`}>{stage.active ? "◌" : i + 1}</span><span><strong>{stage.name}</strong><small>{stage.detail}</small></span><span aria-hidden="true">›</span></button></li>)}</ol>
          <button className="workboard__review" onClick={() => openLabRoom("office", "drafts")}>초안 검토하기 <span>{real.length}개 →</span></button>
          {!real.length && <p className="workboard__note">{samples ? "예시 초안은 보관함에서 따로 확인할 수 있어요." : "소식을 선택하고 첫 초안을 만들어 보세요."}</p>}
        </section>
        <section className="workboard__section"><div className="workboard__heading"><h2>최근 활동</h2><button onClick={() => openLabRoom("meeting", "minutes")}>회의록 ↗</button></div>
          {activities.length ? <ul className="workboard__activity">{activities.map((a) => <li key={a.id}><button onClick={() => { if (s.drafts.some((d) => d.id === a.id)) s.setCurrent(a.id); openLabRoom(a.room, a.panel); }}><span className="workboard__avatar"><OtterFace size={30} /></span><span><strong>{a.title}</strong><time>{date(a.at)}</time></span></button></li>)}</ul> : <p className="workboard__empty">아직 실행 기록이 없어요.<br />새 소식을 받거나 회의를 시작해 보세요.</p>}
        </section>
        <section className="workboard__connections"><h2>연결 · 저장 상태</h2><dl><div><dt>Groq</dt><dd>{status === "loading" ? "확인 중" : !status ? "상태 확인 실패" : status.groq ? "키 설정됨" : "키 미설정"}</dd></div><div><dt>Supabase</dt><dd>{cloudLabel}</dd></div><div><dt>Discord</dt><dd>실행 결과는 회의록·Actions에서 확인</dd></div></dl><p>키 설정 여부와 실제 호출 성공은 달라요. 초안 생성 실패는 해당 작업 화면에서 확인·재시도할 수 있어요.</p></section>
      </aside>
    </main>
    <nav className="workspace__actions" aria-label="빠른 업무"><button onClick={() => openLabRoom("receiver")}><span>✉</span> 소식 받기 <i>›</i></button><button onClick={() => openLabRoom("meeting", "meeting")}><span>♧</span> 회의 소집 <i>›</i></button><button onClick={() => openLabRoom("office", "drafts")}><span>▤</span> 초안 보기 <i>›</i></button><button onClick={() => openLabRoom("office", "brand")}><span>⚙</span> 운영 설정 <i>›</i></button></nav>
    <p className={`toast ${s.toast ? "toast--on" : ""}`} role="status" aria-live="polite">{s.toast}</p>
  </div>;
}
