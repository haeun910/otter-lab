"use client";
import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect, useRef } from "react";
import * as THREE from "three";
import { byId, COLORS, ROOM } from "./data/buildings";
import { live, useLab } from "./store";
import CameraRig from "./three/CameraRig";
import Outside from "./three/Outside";
import Room from "./three/Room";
import { Projector } from "./three/labels";
import LabelLayer from "./ui/LabelLayer";
import Hud from "./ui/Hud";
import PanelHost from "./ui/PanelHost";
import "./lab.css";

function Lights({ outside }: { outside: boolean }) {
  return (
    <>
      <hemisphereLight args={["#FFFFFF", "#CDEBD3", outside ? 1.55 : 1.25]} />
      <directionalLight
        position={outside ? [14, 22, 12] : [4, 9, 6]}
        intensity={outside ? 1.35 : 0.9}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-26}
        shadow-camera-right={26}
        shadow-camera-top={26}
        shadow-camera-bottom={-26}
        shadow-camera-near={1}
        shadow-camera-far={70}
      />
    </>
  );
}

export default function OtterLab() {
  const scene = useLab((s) => s.scene);
  const fading = useLab((s) => s.fading);
  const wrap = useRef<HTMLDivElement>(null);
  const outside = scene === "outside";

  // 방에 들어가면 입구에 서고, 직원이 인사해요
  useEffect(() => {
    if (outside) return;
    Object.assign(live.player, { x: 0, z: ROOM.d / 2 - 1.25, heading: Math.PI });
    live.path = [];
    const b = byId(scene);
    const st = useLab.getState();
    if (b.staff) {
      const n = st.staff[b.id];
      setTimeout(() => useLab.getState().setSpeech({ key: `staff-${b.id}`, text: b.staff!.line }), 700);
      void n;
    } else {
      setTimeout(() => useLab.getState().say("소장실이에요. 책상에서 브랜드 설정을, 서랍장에서 보관함을 열 수 있어요."), 700);
    }
  }, [scene, outside]);

  // 키보드
  useEffect(() => {
    const typing = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      return t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable;
    };
    const down = (e: KeyboardEvent) => {
      if (typing(e)) return;
      const k = e.key.toLowerCase();
      const st = useLab.getState();
      if (k === "escape") {
        if (st.mapOpen) st.setMapOpen(false);
        else if (st.focus) st.closeFocus();
        else if (st.scene !== "outside") st.go("outside", st.scene);
        return;
      }
      if (st.focus || st.mapOpen) return;
      if ((k === "e" || k === "enter") && st.scene === "outside" && st.nearDoor) {
        st.go(st.nearDoor);
        return;
      }
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) {
        e.preventDefault();
        live.keys.add(k);
        st.dismissHint();
      }
    };
    const up = (e: KeyboardEvent) => live.keys.delete(e.key.toLowerCase());
    const blur = () => live.keys.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  // 바깥에서: 끌어서 돌려보기, 휠·두 손가락으로 확대
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const pts = new Map<number, { x: number; y: number }>();
    let pinch = 0;
    const isOutside = () => useLab.getState().scene === "outside" && !useLab.getState().focus;
    const down = (e: PointerEvent) => {
      if ((e.target as HTMLElement).tagName !== "CANVAS") return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch = Math.hypot(a.x - b.x, a.y - b.y);
      }
    };
    const move = (e: PointerEvent) => {
      const prev = pts.get(e.pointerId);
      if (!prev || !isOutside()) return;
      if (pts.size === 1 && e.buttons) {
        live.camAzimuth = THREE.MathUtils.clamp(live.camAzimuth - (e.clientX - prev.x) * 0.006, -0.35, 1.25);
      } else if (pts.size === 2) {
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch) live.camZoom = THREE.MathUtils.clamp(live.camZoom * (pinch / d), 0.5, 1.3);
        pinch = d;
        return;
      }
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    };
    const up = (e: PointerEvent) => {
      pts.delete(e.pointerId);
      pinch = 0;
    };
    const wheel = (e: WheelEvent) => {
      if (!isOutside() || (e.target as HTMLElement).tagName !== "CANVAS") return;
      e.preventDefault();
      live.camZoom = THREE.MathUtils.clamp(live.camZoom * (1 + e.deltaY * 0.0012), 0.5, 1.3);
    };
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    el.addEventListener("wheel", wheel, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      el.removeEventListener("wheel", wheel);
    };
  }, []);

  return (
    <div className="lab" ref={wrap}>
      <Canvas
        className="lab__canvas"
        flat
        shadows={{ type: THREE.PCFShadowMap }}
        dpr={[1, 2]}
        camera={{ fov: 30, near: 0.5, far: 200, position: [10, 16, 18] }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <color attach="background" args={[COLORS.bg]} />
        <fog attach="fog" args={[COLORS.bg, outside ? 48 : 30, outside ? 90 : 60]} />
        <Lights outside={outside} />
        <Suspense fallback={null}>{outside ? <Outside /> : <Room b={byId(scene)} key={scene} />}</Suspense>
        <CameraRig mode={outside ? "outside" : "room"} key={`cam-${scene}`} />
        <Projector />
      </Canvas>
      <LabelLayer />
      <Hud />
      <PanelHost />
      <div className={`fade ${fading ? "fade--on" : ""}`} aria-hidden="true" />
    </div>
  );
}
