"use client";
import { useState } from "react";
import { writingOf } from "../../gen/prompt";
import { closeMeeting, fmtHM, heldToday, parseHM, recommend, startMeeting, statsReport } from "../../company";
import { draftLabel, useLab } from "../../store";

const fmtDate = (t: number) =>
  new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" }).format(t);
const BUNDLE_MAX = 6;

function Speaker({ id, topic }: { id: string; topic: string }) {
  const who = useLab((s) => s.staff[id]);
  return (
    <h3 className="agenda__who">
      <span>
        {who?.title} {who?.name}
      </span>
      {topic}
    </h3>
  );
}

// ---------- 오늘 회의 ----------
export function MeetingPanel() {
  const phase = useLab((s) => s.phase);
  if (phase !== "meeting") return <MeetingIdle />;
  return <Agenda />;
}

function MeetingIdle() {
  const meetingAt = useLab((s) => s.schedule.meetingAt);
  const meetings = useLab((s) => s.meetings);
  const phase = useLab((s) => s.phase);
  const held = heldToday(meetings);
  return (
    <div className="pn">
      <p>
        매일 <strong>{fmtHM(parseHM(meetingAt))}</strong>이 되면 연구원들이 이 탁자에 모여요. 루미가 오늘 소식에서 추천을 골라 오고, 나래가 성과를, 바다가 게시
        대기 초안을 보고해요. 소장님이 정하면 모모와 테오가 초안을 써요.
      </p>
      {held && <p className="muted">오늘 회의는 이미 했어요. 회의록에서 내용을 볼 수 있어요.</p>}
      <footer className="pn__foot">
        <span className="muted">회의 시간은 회의록에서 바꿀 수 있어요.</span>
        <button
          className="btn btn--primary"
          disabled={phase !== "work"}
          onClick={() => {
            useLab.getState().closeFocus();
            startMeeting("manual");
          }}
        >
          {held ? "한 번 더 회의하기" : "지금 회의 소집"}
        </button>
      </footer>
    </div>
  );
}

function Agenda() {
  const library = useLab((s) => s.library);
  const inbox = useLab((s) => s.inbox);
  const drafts = useLab((s) => s.drafts);
  const posts = useLab((s) => s.posts);
  // 회의를 연 순간의 추천을 그대로 써요 (회의 중에 목록이 흔들리지 않게)
  const brand = useLab((s) => s.brand);
  const [picks] = useState(() => {
    const w = writingOf(brand);
    return recommend(library, inbox, drafts, w.bundleCount, w.mix);
  });
  const [bundle, setBundle] = useState<string[]>(picks.bundle);
  const [deep, setDeep] = useState<string | null>(picks.deep);
  const [memo, setMemo] = useState("");
  const waiting = drafts.filter((d) => d.status === "검토 대기");
  const toggle = (l: string) => setBundle((b) => (b.includes(l) ? b.filter((x) => x !== l) : [...b, l]));
  const okBundle = bundle.length >= 2 && bundle.length <= BUNDLE_MAX;
  const plan = [okBundle ? `묶음 초안 (소식 ${bundle.length}개)` : null, deep ? "심층 초안 1개" : null].filter(Boolean);

  return (
    <div className="pn agenda">
      <section>
        <Speaker id="receiver" topic="오늘 들어온 소식" />
        <p className="muted">
          소식 {inbox.length}개 중 아직 다루지 않은 후보 {picks.candidates.length}개를 분야별로 골라 왔어요. ★는 루미 추천이에요 (분야 비율은 소장 책상에서
          바꿔요). 묶음은 2~{BUNDLE_MAX}개, 심층은 1개를 골라 주세요.
        </p>
        {picks.candidates.length ? (
          <ul className="news news--compact agenda__news">
            {picks.candidates.map((n) => {
              const inB = bundle.includes(n.link);
              const rec = picks.bundle.includes(n.link) || picks.deep === n.link;
              return (
                <li key={n.link} className={inB || deep === n.link ? "news--on" : ""}>
                  <div className="agenda__pick">
                    <label>
                      <input type="checkbox" checked={inB} onChange={() => toggle(n.link)} disabled={deep === n.link} />
                      묶음
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="deep"
                        checked={deep === n.link}
                        onChange={() => (setDeep(n.link), setBundle((b) => b.filter((x) => x !== n.link)))}
                      />
                      심층
                    </label>
                  </div>
                  <div className="news__main">
                    <p className="news__meta">
                      {rec && (
                        <span className="star" aria-label="추천">
                          ★
                        </span>
                      )}
                      <span className={`cat cat--${n.category}`}>{n.category}</span>
                      {n.source} · {n.region}
                    </p>
                    <a href={n.link} target="_blank" rel="noreferrer" className="news__title">
                      {n.title}
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="empty">새로 다룰 소식이 없어요. 수신소에서 새 소식을 받아 오면 후보가 생겨요.</p>
        )}
        {deep && (
          <button className="link-btn" onClick={() => setDeep(null)}>
            심층은 오늘 쉬기
          </button>
        )}
      </section>

      <section>
        <Speaker id="stats" topic="성과 보고" />
        <p>{statsReport(posts)}</p>
      </section>

      <section>
        <Speaker id="dock" topic="게시 대기" />
        {waiting.length ? (
          <ul className="agenda__list">
            {waiting.map((d) => (
              <li key={d.id}>
                {d.type} · {draftLabel(d)}
              </li>
            ))}
          </ul>
        ) : (
          <p>게시를 기다리는 초안은 없어요.</p>
        )}
      </section>

      <section>
        <h3 className="agenda__who">
          <span>소장</span>결정
        </h3>
        <p>{plan.length ? `${plan.join(", ")}을 만들어요.` : "오늘은 새 초안을 만들지 않아요."}</p>
        {bundle.length === 1 && <p className="muted">묶음은 소식이 2개 이상이어야 해요. 하나만 다루려면 심층으로 골라 주세요.</p>}
        {bundle.length > BUNDLE_MAX && <p className="muted">묶음은 {BUNDLE_MAX}개까지예요.</p>}
        <label className="field">
          <span>회의록에 남길 메모 (선택)</span>
          <input id="meeting-memo" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="예: 이번 주는 에이전트 소식 위주로" />
        </label>
      </section>

      <footer className="pn__foot">
        <button className="btn btn--light" onClick={() => closeMeeting({ bundle: [], deep: null, memo, considered: picks.candidates.length })}>
          초안 없이 마치기
        </button>
        <button
          className="btn btn--primary"
          disabled={!plan.length || bundle.length > BUNDLE_MAX}
          onClick={() => closeMeeting({ bundle: okBundle ? bundle : [], deep, memo, considered: picks.candidates.length })}
        >
          이대로 진행
        </button>
      </footer>
    </div>
  );
}

// ---------- 회의록 ----------
export function MinutesPanel() {
  const meetings = useLab((s) => s.meetings);
  const drafts = useLab((s) => s.drafts);
  const schedule = useLab((s) => s.schedule);
  const setSchedule = useLab((s) => s.setSchedule);
  const setCurrent = useLab((s) => s.setCurrent);
  const travel = useLab((s) => s.travel);
  return (
    <div className="pn">
      <div className="pn__bar">
        <label className="field field--inline">
          <span>매일 회의 시간 (한국 시간)</span>
          <input
            id="meeting-at"
            type="time"
            value={schedule.meetingAt}
            onChange={(e) => e.target.value && setSchedule({ ...schedule, meetingAt: e.target.value })}
          />
        </label>
        <span className="muted">이 화면을 열어 두면 시간에 맞춰 모여요</span>
      </div>
      {meetings.length ? (
        <ul className="minutes">
          {meetings.map((m) => (
            <li key={m.id}>
              <time>{fmtDate(m.at)}</time>
              <ul>
                {m.notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
              {m.drafts.length > 0 && (
                <div className="row">
                  {m.drafts.map((id) => {
                    const d = drafts.find((x) => x.id === id);
                    return d ? (
                      <button
                        key={id}
                        className="btn btn--light"
                        onClick={() => {
                          setCurrent(id);
                          travel("cards");
                        }}
                      >
                        {d.type} 초안 열기
                      </button>
                    ) : null;
                  })}
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty">아직 회의록이 없어요. 첫 회의를 열어 보세요.</p>
      )}
    </div>
  );
}
