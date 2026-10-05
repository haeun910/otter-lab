"use client";
import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { SITE, byId, toWorld } from "../data/buildings";
import { live, useLab } from "../store";

const ELEV = 0.98; // 위에서 내려다보는 각도 (라디안)
const CENTER = new THREE.Vector3(1.8, 0, (SITE.minZ + SITE.riverZ) / 2 - 0.5);

/** 본관 전체 → 방 → 사물 순서로 다가가요 */
export default function CameraRig() {
  const camera = useThree((s) => s.camera);
  const aspect = useThree((s) => s.size.width / s.size.height);
  const scene = useLab((s) => s.scene);
  const focus = useLab((s) => s.focus);
  const look = useRef(CENTER.clone());
  const want = useRef(new THREE.Vector3());
  const wantLook = useRef(new THREE.Vector3());
  const first = useRef(true);

  useFrame((_, dt) => {
    // 세로로 긴 휴대폰 화면에서도 양옆이 잘리지 않게, 보여줄 폭에 맞춰 물러나요
    const tanH = Math.tan(THREE.MathUtils.degToRad(15)) * aspect;
    const fit = (halfW: number, len: number) => Math.max(1, halfW / tanH / len);
    if (focus && scene !== "overview") {
      const [ox, oz] = toWorld(byId(scene), focus.pos);
      wantLook.current.set(ox, 1.0, oz);
      // 회의 탁자는 둘러앉은 연구원들이 다 보이게 위에서
      const [y, z, half] = focus.furniture === "roundTable" ? [9, 5, 3.2] : [2.8, 3.1, 1.8];
      const f = fit(half, Math.hypot(y, z));
      want.current.set(ox, y * f, oz + z * f);
    } else if (scene !== "overview") {
      const [x, z] = byId(scene).pos;
      wantLook.current.set(x, 0.5, z - 0.7);
      const f = fit(4, Math.hypot(8.6, 6.6));
      want.current.set(x, 8.6 * f, z + 6.6 * f);
    } else {
      const dist = Math.max(54, 17 / tanH) * live.camZoom;
      const az = live.camAzimuth;
      wantLook.current.copy(CENTER);
      want.current.set(CENTER.x + Math.sin(az) * dist * Math.cos(ELEV), dist * Math.sin(ELEV), CENTER.z + Math.cos(az) * dist * Math.cos(ELEV));
    }
    const k = first.current ? 1 : 1 - Math.pow(focus ? 0.02 : 0.012, dt);
    first.current = false;
    camera.position.lerp(want.current, k);
    look.current.lerp(wantLook.current, k);
    camera.lookAt(look.current);
  });
  return null;
}
