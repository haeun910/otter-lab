"use client";
import { fmtHM, heldToday, parseHM } from "../company";
import { BUILDINGS, byId } from "../data/buildings";
import { useLab } from "../store";
import { CREW } from "../three/Crew";
import { useLabelRef } from "../three/labels";

function Bubble({ who, text }: { who: string; text: string }) {
  return (
    <div className="bubble">
      <b>{who}</b>
      {text}
    </div>
  );
}

/** 간판 아래 한 줄: 그 방이 지금 하고 있는 일 */
function useRoomStatus(id: string): string {
  return useLab((s) => {
    const waiting = s.drafts.filter((d) => d.status === "검토 대기").length;
    const writing = s.writing.length > 0;
    switch (id) {
      case "receiver":
        return s.busy === "news" ? "소식 받는 중…" : `소식 ${s.inbox.length}개`;
      case "cards":
        return writing ? "카드 쓰는 중…" : waiting ? `검토 대기 ${waiting}` : "다음 주제를 기다려요";
      case "blog":
        return writing ? "글 쓰는 중…" : waiting ? `원고 ${waiting}편` : "다음 주제를 기다려요";
      case "dock":
        return waiting ? `게시 대기 ${waiting}` : "쉬는 중";
      case "library":
        return `소식 ${s.library.length.toLocaleString()}건`;
      case "stats":
        return `게시물 ${s.posts.length}개`;
      case "dorm":
        return `연구원 ${Object.keys(s.staff).length}명`;
      case "meeting":
        return s.phase === "gathering" ? "모이는 중…" : s.phase === "meeting" ? "회의 중" : heldToday(s.meetings) ? "오늘 회의 끝" : `${fmtHM(parseHM(s.schedule.meetingAt))} 회의`;
      case "office":
        return "소장실";
      default:
        return "";
    }
  });
}

function RoomSign({ id }: { id: string }) {
  const b = byId(id);
  const ref = useLabelRef(`sign-${id}`);
  const hover = useLab((s) => s.hover === `room-${id}`);
  const name = useLab((s) => s.staff[id]);
  const status = useRoomStatus(id);
  const busy = status.endsWith("…") || status === "회의 중";
  return (
    <div ref={ref} className="label">
      <button
        className={`sign ${hover ? "sign--hover" : ""}`}
        onClick={() => useLab.getState().travel(id)}
        onPointerEnter={() => useLab.getState().setHover(`room-${id}`)}
        onPointerLeave={() => useLab.getState().setHover(null)}
        tabIndex={-1}
      >
        <strong>
          <i className="sign__dot" style={{ background: b.roof }} />
          {b.name}
        </strong>
        <span>{name ? `${name.title} ${name.name}` : id === "office" ? "나의 방" : ""}</span>
        {status && <em className={busy ? "sign__busy" : ""}>{status}</em>}
      </button>
    </div>
  );
}

function ObjectTag({ id, label, room }: { id: string; label: string; room: string }) {
  const ref = useLabelRef(`obj-${id}`);
  const hover = useLab((s) => s.hover === `o-${id}`);
  return (
    <div ref={ref} className="label">
      <button
        className={`tag3d ${hover ? "tag3d--hover" : ""}`}
        onClick={() => {
          const st = useLab.getState();
          const o = byId(room).objects.find((x) => x.id === id)!;
          st.openFocus(o);
        }}
        onPointerEnter={() => useLab.getState().setHover(`o-${id}`)}
        onPointerLeave={() => useLab.getState().setHover(null)}
        tabIndex={-1}
      >
        {label}
      </button>
    </div>
  );
}

function CrewTag({ id, showName }: { id: string; showName: boolean }) {
  const key = `staff-${id}`;
  const ref = useLabelRef(key);
  const speech = useLab((s) => (s.speech?.key === key ? s.speech.text : null));
  const hover = useLab((s) => s.hover === key);
  const writing = useLab((s) => s.writing.includes(id));
  const who = useLab((s) => (id === "me" ? "소장" : `${s.staff[id]?.title} ${s.staff[id]?.name}`));
  return (
    <div ref={ref} className="label">
      {speech ? (
        <Bubble who={who} text={speech} />
      ) : writing ? (
        <div className="nametag3d nametag3d--busy">✎ 쓰는 중</div>
      ) : showName || hover ? (
        <div className="nametag3d">{who}</div>
      ) : null}
    </div>
  );
}

/** 3D 장면 위에 떠 있는 간판·이름표·말풍선 */
export default function LabelLayer() {
  const scene = useLab((s) => s.scene);
  const hidden = useLab((s) => Boolean(s.focus) || s.mapOpen);
  const overview = scene === "overview";
  const room = overview ? null : byId(scene);
  return (
    <div className={`labels ${hidden ? "labels--hidden" : ""}`} aria-hidden="true">
      {overview && BUILDINGS.filter((b) => !b.deco).map((b) => <RoomSign key={b.id} id={b.id} />)}
      {room?.objects.map((o) => (
        <ObjectTag key={o.id} id={o.id} label={o.label} room={room.id} />
      ))}
      {CREW.map((m) => (
        <CrewTag key={m.id} id={m.id} showName={!overview} />
      ))}
    </div>
  );
}
