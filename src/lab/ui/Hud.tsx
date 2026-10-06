"use client";
import { useEffect, useRef, useState } from "react";
import { fmtHM, heldToday, kstDay, kstMinutes, meetingDue, parseHM, startMeeting } from "../company";
import { BUILDINGS, byId } from "../data/buildings";
import { useRoomStatus } from "../map/PaintedMap";
import { useLab } from "../store";
import { OTTER_SVG_INNER } from "./otterSvg";

/** 오터랩 마스코트 얼굴 (2D) */
export function OtterFace({ size = 32 }: { size?: number }) {
  return <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" dangerouslySetInnerHTML={{ __html: OTTER_SVG_INNER }} />;
}

/** 저장 상태: Supabase에 저장 중인지, 이 브라우저에만 저장하는지 */
function CloudBadge() {
  const cloud = useLab((s) => s.cloud);
  const label = { off: "이 브라우저에만 저장", saving: "저장 중…", saved: "클라우드 저장됨", error: "저장 실패, 다시 시도 중" }[cloud];
  return <em className={`cloud cloud--${cloud}`}>{label}</em>;
}

/** 지금 한국 시간과 다음 회의. 회의 시간이 되면 연구원들을 마당으로 불러요 */
export function Clock() {
  const [now, setNow] = useState(() => Date.now());
  const meetingAt = useLab((s) => s.schedule.meetingAt);
  const meetings = useLab((s) => s.meetings);
  const phase = useLab((s) => s.phase);
  const prev = useRef(now);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(t);
  }, []);
  // 창을 열어 둔 채로 회의 시간을 지나면 자동으로 모여요
  useEffect(() => {
    const at = parseHM(meetingAt);
    const crossed = kstMinutes(prev.current) < at && kstMinutes(now) >= at && kstDay(prev.current) === kstDay(now);
    prev.current = now;
    if (crossed && !heldToday(meetings, now) && useLab.getState().phase === "work") startMeeting("time");
  }, [now, meetingAt, meetings]);
  const due = meetingDue(meetingAt, meetings, now);
  return (
    <div className="clock">
      <span className="clock__now">{fmtHM(kstMinutes(now))}</span>
      {phase === "work" && (
        <button className={`chip ${due ? "chip--alert" : ""}`} onClick={() => startMeeting("manual")}>
          {due && <span className="dot" aria-hidden="true" />}
          {due ? "오늘 회의 시작" : "회의 소집"}
        </button>
      )}
    </div>
  );
}

/** 방에 들어갔을 때 아래쪽 안내: 누가 있는지, 지금 하는 일, 열어 볼 수 있는 것 */
function RoomBar({ id }: { id: string }) {
  const b = byId(id);
  const who = useLab((s) => s.staff[id]);
  const status = useRoomStatus(id);
  const travel = useLab((s) => s.travel);
  const openFocus = useLab((s) => s.openFocus);
  return (
    <section className="roombar" aria-label={b.name}>
      <div className="roombar__head">
        <h2>
          <i className="sign__dot" style={{ background: b.roof }} />
          {b.name}
        </h2>
        <p>
          {[who ? `${who.title} ${who.name}` : id === "office" ? "나의 방" : id === "meeting" ? "다 같이 모이는 곳" : "", status].filter(Boolean).join(" · ")}
        </p>
      </div>
      <div className="roombar__tools">
        {b.objects.map((o) => (
          <button key={o.id} className="btn btn--primary" onClick={() => openFocus(o)}>
            {o.label}
          </button>
        ))}
        <button className="btn btn--light" onClick={() => travel("overview")}>
          전체 지도
        </button>
      </div>
    </section>
  );
}

export default function Hud() {
  const scene = useLab((s) => s.scene);
  const hint = useLab((s) => s.hint);
  const toast = useLab((s) => s.toast);
  const focus = useLab((s) => s.focus);
  const mapOpen = useLab((s) => s.mapOpen);
  const staff = useLab((s) => s.staff);
  const setMapOpen = useLab((s) => s.setMapOpen);
  const travel = useLab((s) => s.travel);
  const overview = scene === "overview";
  const waiting = useLab((s) => s.drafts.filter((d) => d.status === "검토 대기").length);

  return (
    <>
      <header className="hud-top">
        <div className="hud-actions">
          <Clock />
          {!focus && waiting > 0 && (
            <button className="chip" onClick={() => travel("cards")}>
              검토할 초안 {waiting}개
            </button>
          )}
          <button className="btn btn--light" onClick={() => setMapOpen(true)} aria-haspopup="dialog">
            빠른 이동
          </button>
        </div>
      </header>

      {!focus && (
        <div className="hud-bottom">
          {!overview ? (
            <RoomBar id={scene} />
          ) : (
            <>
              <CloudBadge />
              {hint && <p className="hint">방을 누르면 다가가서 봐요. 끌어서 지도를 옮기고, 휠·두 손가락으로 확대해요.</p>}
            </>
          )}
        </div>
      )}

      <p className={`toast ${toast ? "toast--on" : ""}`} role="status" aria-live="polite">
        {toast}
      </p>

      {mapOpen && (
        <div className="sheet-wrap" onMouseDown={(e) => e.target === e.currentTarget && setMapOpen(false)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="map-title">
            <header className="sheet__head">
              <h2 id="map-title">어디로 갈까요?</h2>
              <button className="icon-btn" onClick={() => setMapOpen(false)} aria-label="닫기">
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                </svg>
              </button>
            </header>
            <ul className="places">
              <li>
                <button className={`place ${overview ? "place--here" : ""}`} onClick={() => travel("overview")}>
                  <span className="place__swatch" style={{ background: "#BFE8B0" }} />
                  <span className="place__name">전체 지도</span>
                  <span className="place__who">모든 방을 한눈에</span>
                </button>
              </li>
              {BUILDINGS.filter((b) => !b.deco).map((b) => (
                <li key={b.id}>
                  <button className={`place ${scene === b.id ? "place--here" : ""}`} onClick={() => travel(b.id)}>
                    <span className="place__swatch" style={{ background: b.roof }} />
                    <span className="place__name">{b.name}</span>
                    <span className="place__who">
                      {staff[b.id] ? `${staff[b.id].title} ${staff[b.id].name}` : b.id === "office" ? "나의 방" : "다 같이 모이는 곳"}
                    </span>
                    <span className="place__what">{b.objects.map((o) => o.label).join(", ")}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
