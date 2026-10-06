"use client";
import { useEffect } from "react";
import PaintedMap from "./map/PaintedMap";
import { staffLine } from "./staff";
import { useLab } from "./store";
import Hud from "./ui/Hud";
import LoginGate from "./ui/LoginGate";
import PanelHost from "./ui/PanelHost";
import "./lab.css";

export default function OtterLab() {
  const scene = useLab((s) => s.scene);

  // 방에 들어가면 그 방 직원이 한마디 해요
  useEffect(() => {
    if (scene === "overview") return;
    const t = setTimeout(() => {
      const st = useLab.getState();
      if (st.phase !== "work" || st.scene !== scene) return;
      if (st.staff[scene]) st.setSpeech({ key: `staff-${scene}`, text: staffLine(scene) });
      else if (scene === "office") st.say("소장실이에요. 소장 책상에서 브랜드 설정을, 보관함 서랍장에서 초안을 볼 수 있어요.");
      else if (scene === "meeting") st.say("회의 마당이에요. 매일 회의 시간에 다 같이 이 나무 아래 모여요.");
    }, 700);
    return () => clearTimeout(t);
  }, [scene]);

  // Esc: 작업 창 닫기 → 방에서 나와 전체 지도로
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

  return (
    <div className="lab">
      <PaintedMap />
      <Hud />
      <PanelHost />
      <LoginGate />
    </div>
  );
}
