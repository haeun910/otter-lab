"use client";
// 손그림 강가 지도. 방을 누르면 그 방으로 다가가고, 그림 위에 지금 하는 일·말풍선을 띄워요.
// 끌어서 지도를 옮기고, 휠·두 손가락으로 확대해요.
import { useCallback, useEffect, useRef, useState } from "react";
import mapImg from "../assets/otter-map.webp";
import { fmtHM, heldToday, parseHM } from "../company";
import { byId } from "../data/buildings";
import { CREW_IDS, MAP_H, MAP_W, SPOTS, boxOf, roomOfCrew } from "../data/map";
import { staffLine } from "../staff";
import { useLab } from "../store";

const MAP_SRC = typeof mapImg === "string" ? mapImg : (mapImg as { src: string }).src;
const ROOMS = Object.keys(SPOTS);
const MAX_SCALE = 2.4; // 그림 픽셀보다 너무 크게 키우면 흐려져요

interface View {
  x: number;
  y: number;
  s: number;
}

const coverScale = (W: number, H: number) => Math.max(W / MAP_W, H / MAP_H);

/** 지도가 화면 밖으로 빠져 빈 곳이 보이지 않게 */
function clampView(v: View, W: number, H: number): View {
  const s = Math.min(MAX_SCALE, Math.max(coverScale(W, H), v.s));
  const x = Math.min(0, Math.max(W - MAP_W * s, v.x));
  const y = Math.min(0, Math.max(H - MAP_H * s, v.y));
  return { x, y, s };
}

/** 지금 보고 있는 곳(본관 전체 또는 방)에 맞는 화면 */
function targetView(scene: string, W: number, H: number): View {
  if (scene === "overview" || !SPOTS[scene]) {
    const s = coverScale(W, H);
    return clampView({ x: (W - MAP_W * s) / 2, y: (H - MAP_H * s) / 2, s }, W, H);
  }
  const [x0, y0, x1, y1] = boxOf(scene);
  const pad = 30;
  const top = 76; // 위쪽 시계·버튼
  const bottom = W < 720 ? 190 : 150; // 아래쪽 방 안내
  const availH = Math.max(120, H - top - bottom);
  const s = Math.min(MAX_SCALE, (W * 0.92) / (x1 - x0 + pad * 2), availH / (y1 - y0 + pad * 2));
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  return clampView({ x: W / 2 - cx * s, y: top + availH / 2 - cy * s, s }, W, H);
}

/** 방 아래 한 줄: 그 방이 지금 하고 있는 일 */
export function useRoomStatus(id: string): string {
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
        return s.phase === "gathering"
          ? "모이는 중…"
          : s.phase === "meeting"
            ? "회의 중"
            : heldToday(s.meetings)
              ? "오늘 회의 끝"
              : `${fmtHM(parseHM(s.schedule.meetingAt))} 회의`;
      case "office":
        return waiting ? `확인할 초안 ${waiting}` : "";
      default:
        return "";
    }
  });
}

function Badge({ id, at }: { id: string; at: (p: [number, number]) => { left: number; top: number } }) {
  const status = useRoomStatus(id);
  const busy = status.endsWith("…") || status === "회의 중";
  if (!status && id !== "meeting") return null;
  const pos = at(SPOTS[id].badge);
  return (
    <div className={`badge ${busy ? "badge--busy" : ""} ${id === "meeting" ? "badge--sign" : ""}`} style={pos}>
      {id === "meeting" && <strong>회의 마당</strong>}
      {status}
    </div>
  );
}

function Talk({ id, at }: { id: string; at: (p: [number, number]) => { left: number; top: number } }) {
  const key = `staff-${id}`;
  const speech = useLab((s) => (s.speech?.key === key ? s.speech.text : null));
  const writing = useLab((s) => s.writing.includes(id));
  const who = useLab((s) => (id === "me" ? "소장" : `${s.staff[id]?.title} ${s.staff[id]?.name}`));
  if (!speech && !writing) return null;
  const pos = at(SPOTS[roomOfCrew(id)].otter);
  return speech ? (
    <div className="bubble bubble--map" style={pos}>
      <b>{who}</b>
      {speech}
    </div>
  ) : (
    <div className="writing" style={pos}>
      ✎ 쓰는 중
    </div>
  );
}

export default function PaintedMap() {
  const wrap = useRef<HTMLDivElement>(null);
  const scene = useLab((s) => s.scene);
  const hover = useLab((s) => s.hover);
  const panel = useLab((s) => s.panelOpen || s.mapOpen);
  const [size, setSize] = useState({ W: 1280, H: 800 });
  const [view, setView] = useState<View>({ x: 0, y: 0, s: 1 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const anim = useRef(0);
  const ready = useRef(false);

  // 화면 크기
  useEffect(() => {
    const el = wrap.current!;
    const ro = new ResizeObserver(() => setSize({ W: el.clientWidth, H: el.clientHeight }));
    ro.observe(el);
    setSize({ W: el.clientWidth, H: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  /** 부드럽게 옮겨 가기 */
  const flyTo = useCallback((to: View, ms = 650) => {
    cancelAnimationFrame(anim.current);
    const from = viewRef.current;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      setView({ x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, s: from.s + (to.s - from.s) * e });
      if (k < 1) anim.current = requestAnimationFrame(step);
    };
    anim.current = requestAnimationFrame(step);
  }, []);

  // 방을 고르거나 화면 크기가 바뀌면 그곳으로
  useEffect(() => {
    const to = targetView(scene, size.W, size.H);
    if (!ready.current) {
      ready.current = true;
      setView(to);
    } else flyTo(to);
  }, [scene, size, flyTo]);

  // 끌기·두 손가락·휠
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const moved = useRef(0);
  const pinch = useRef(0);
  const onDown = (e: React.PointerEvent) => {
    cancelAnimationFrame(anim.current);
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.current.size === 1) moved.current = 0;
    if (pts.current.size === 2) {
      const [a, b] = [...pts.current.values()];
      pinch.current = Math.hypot(a.x - b.x, a.y - b.y);
    }
  };
  const onMove = (e: React.PointerEvent) => {
    const prev = pts.current.get(e.pointerId);
    if (!prev || !e.buttons) return;
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const v = viewRef.current;
    if (pts.current.size === 1) {
      moved.current += Math.abs(dx) + Math.abs(dy);
      if (moved.current > 6) setView(clampView({ ...v, x: v.x + dx, y: v.y + dy }, size.W, size.H));
    } else if (pts.current.size === 2) {
      const [a, b] = [...pts.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const rect = wrap.current!.getBoundingClientRect();
      const cx = (a.x + b.x) / 2 - rect.left;
      const cy = (a.y + b.y) / 2 - rect.top;
      if (pinch.current) setView(zoomAt(v, (d / pinch.current) * v.s, cx, cy));
      pinch.current = d;
      moved.current = 99;
    }
  };
  const onUp = (e: React.PointerEvent) => {
    pts.current.delete(e.pointerId);
    pinch.current = 0;
  };
  const zoomAt = (v: View, s: number, cx: number, cy: number) => {
    const c = clampView({ ...v, s }, size.W, size.H);
    return clampView({ s: c.s, x: cx - ((cx - v.x) / v.s) * c.s, y: cy - ((cy - v.y) / v.s) * c.s }, size.W, size.H);
  };
  useEffect(() => {
    const el = wrap.current!;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      cancelAnimationFrame(anim.current);
      const rect = el.getBoundingClientRect();
      const v = viewRef.current;
      setView(zoomAt(v, v.s * Math.exp(-e.deltaY * 0.0015), e.clientX - rect.left, e.clientY - rect.top));
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  });

  const pick = (id: string) => {
    if (moved.current > 6) return; // 끌던 중이면 누른 게 아니에요
    const st = useLab.getState();
    if (st.focus) return;
    if (st.scene !== id) {
      st.travel(id);
      return;
    }
    // 이미 와 있는 방을 한 번 더 누르면 연구원이 한마디 해요
    const who = id === "office" ? "me" : CREW_IDS.includes(id) ? id : null;
    if (who) st.setSpeech({ key: `staff-${who}`, text: staffLine(who) });
  };

  const at = (p: [number, number]) => ({ left: Math.round(view.x + p[0] * view.s), top: Math.round(view.y + p[1] * view.s) });
  const here = scene !== "overview" && SPOTS[scene] ? scene : null;

  return (
    <div className="map" ref={wrap} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      <div className="map__world" style={{ width: MAP_W, height: MAP_H, transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})` }}>
        <img className="map__img" src={MAP_SRC} width={MAP_W} height={MAP_H} alt="숲속 강가의 오터랩: 방마다 수달 연구원들이 일하고 있어요" draggable={false} />
        <svg className="map__spots" viewBox={`0 0 ${MAP_W} ${MAP_H}`} width={MAP_W} height={MAP_H}>
          {here && (
            <>
              <defs>
                <mask id="spotlight">
                  <rect width={MAP_W} height={MAP_H} fill="white" />
                  <polygon points={SPOTS[here].poly.map((p) => p.join(",")).join(" ")} fill="black" />
                </mask>
              </defs>
              <rect className="map__dim" width={MAP_W} height={MAP_H} mask="url(#spotlight)" />
            </>
          )}
          {ROOMS.map((id) => (
            <polygon
              key={id}
              points={SPOTS[id].poly.map((p) => p.join(",")).join(" ")}
              className={`spot ${hover === `room-${id}` ? "spot--hover" : ""} ${here === id ? "spot--here" : ""}`}
              onClick={() => pick(id)}
              onPointerEnter={() => useLab.getState().setHover(`room-${id}`)}
              onPointerLeave={() => useLab.getState().setHover(null)}
            >
              <title>{byId(id).name}</title>
            </polygon>
          ))}
        </svg>
      </div>
      <div className={`map__overlay ${panel ? "map__overlay--hidden" : ""}`} aria-hidden="true">
        {ROOMS.map((id) => (
          <Badge key={id} id={id} at={at} />
        ))}
        {CREW_IDS.map((id) => (
          <Talk key={id} id={id} at={at} />
        ))}
      </div>
    </div>
  );
}
