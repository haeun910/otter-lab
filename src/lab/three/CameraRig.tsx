"use client";
import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { ROOM } from "../data/buildings";
import { live, useLab } from "../store";

const ELEV = 0.86; // 위에서 내려다보는 각도 (라디안)
const BASE = 32; // 바깥 기본 거리

/** 바깥에서는 내 수달을 비스듬히 따라가고, 방에서는 방 전체를, 사물을 누르면 사물 가까이로 */
export default function CameraRig({ mode }: { mode: "outside" | "room" }) {
  const camera = useThree((s) => s.camera);
  const aspect = useThree((s) => s.size.width / s.size.height);
  const focus = useLab((s) => s.focus);
  const look = useRef(new THREE.Vector3(live.player.x, 0, live.player.z));
  const first = useRef(true);
  const want = new THREE.Vector3();
  const wantLook = new THREE.Vector3();

  useFrame((_, dt) => {
    const p = live.player;
    if (mode === "outside") {
      // 세로로 긴 휴대폰 화면에서는 조금 더 멀리서 봐요
      const dist = BASE * live.camZoom * (aspect < 1 ? 1 + (1 - aspect) * 0.9 : 1);
      const az = live.camAzimuth;
      wantLook.set(p.x, 0.6, p.z);
      want.set(
        p.x + Math.sin(az) * dist * Math.cos(ELEV),
        dist * Math.sin(ELEV),
        p.z + Math.cos(az) * dist * Math.cos(ELEV),
      );
    } else if (focus) {
      const [ox, oz] = focus.pos;
      wantLook.set(ox, 1.05, oz);
      const far = aspect < 1 ? 1 + (1 - aspect) * 0.8 : 1;
      want.set(ox, 2.7 * far, oz + 2.9 * far);
    } else {
      const sx = THREE.MathUtils.clamp(p.x * 0.35, -1, 1);
      wantLook.set(sx, 0.4, -0.2);
      const far = aspect < 1 ? 1 + (1 - aspect) * 1.6 : 1;
      want.set(sx * (aspect < 1 ? 0.3 : 1), 9.2 * far, ROOM.d / 2 + 6.4 * far);
    }
    const k = first.current ? 1 : 1 - Math.pow(focus ? 0.02 : 0.004, dt);
    first.current = false;
    camera.position.lerp(want, k);
    look.current.lerp(wantLook, k);
    camera.lookAt(look.current);
  });
  return null;
}
