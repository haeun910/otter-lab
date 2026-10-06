"use client";
import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect, useRef } from "react";
import * as THREE from "three";
import { live, useLab } from "./store";
import CameraRig, { FOV } from "./three/CameraRig";
import { Effects, HAZE, Sky, Sun } from "./three/Atmosphere";
import Campus from "./three/Campus";
import { Projector } from "./three/labels";
import LabelLayer from "./ui/LabelLayer";
import Hud from "./ui/Hud";
import LoginGate from "./ui/LoginGate";
import PanelHost from "./ui/PanelHost";
import { staffLine } from "./three/Crew";
import "./lab.css";

export default function OtterLab() {
  const scene = useLab((s) => s.scene);
  const wrap = useRef<HTMLDivElement>(null);

  // 방에 들어가면 그 방 직원이 한마디 해요
  useEffect(() => {
    if (scene === "overview") return;
    const t = setTimeout(() => {
      const st = useLab.getState();
      if (st.phase !== "work" || st.scene !== scene) return;
      if (st.staff[scene]) st.setSpeech({ key: `staff-${scene}`, text: staffLine(scene) });
      else if (scene === "office") st.say("소장실이에요. 책상에서 브랜드 설정을, 서랍장에서 보관함을 열 수 있어요.");
      else if (scene === "meeting") st.say("회의실이에요. 회의 탁자를 누르면 오늘 회의를, 칠판에서 회의록을 볼 수 있어요.");
    }, 900);
    return () => clearTimeout(t);
  }, [scene]);

  // 키보드
  useEffect(() => {
    const typing = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      return t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable;
    };
    const down = (e: KeyboardEvent) => {
      if (typing(e) || e.key !== "Escape") return;
      const st = useLab.getState();
      if (st.mapOpen) st.setMapOpen(false);
      else if (st.focus) st.closeFocus();
      else if (st.scene !== "overview") st.travel("overview");
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, []);

  // 바깥에서: 끌어서 돌려보기, 휠·두 손가락으로 확대
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const pts = new Map<number, { x: number; y: number }>();
    let pinch = 0;
    const isOutside = () => useLab.getState().scene === "overview" && !useLab.getState().focus;
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
        live.camAzimuth = THREE.MathUtils.clamp(live.camAzimuth - (e.clientX - prev.x) * 0.006, -0.7, 0.7);
      } else if (pts.size === 2) {
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch) live.camZoom = THREE.MathUtils.clamp(live.camZoom * (pinch / d), 0.45, 1.25);
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
      live.camZoom = THREE.MathUtils.clamp(live.camZoom * (1 + e.deltaY * 0.0012), 0.45, 1.25);
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
        shadows={{ type: THREE.PCFSoftShadowMap }}
        dpr={[1, 1.75]}
        camera={{ fov: FOV, near: 0.5, far: 400, position: [0, 50, 40] }}
        gl={{ antialias: false, powerPreference: "high-performance", stencil: false }}
        onPointerMissed={() => useLab.getState().setHover(null)}
      >
        <color attach="background" args={[HAZE]} />
        <Sky />
        <Sun />
        <Suspense fallback={null}>
          <Campus />
        </Suspense>
        <CameraRig />
        <Effects />
        <Projector />
      </Canvas>
      <LabelLayer />
      <Hud />
      <PanelHost />
      <LoginGate />
    </div>
  );
}
