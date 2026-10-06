"use client";
import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { SITE, byId, toWorld } from "../data/buildings";
import { live, useLab } from "../store";

// 그림책처럼 원근 없이(정사영) 비스듬히 내려다봐요. 가까이 가는 건 확대(zoom)로 해요.
const ELEV = 0.92; // 내려다보는 각도 (라디안, 약 53°)
const DIST = 90; // 카메라는 늘 이만큼 떨어져 있어요 (정사영이라 크기와는 상관없어요)
const CENTER = new THREE.Vector3(1.8, 0, (SITE.minZ + SITE.riverZ) / 2 - 0.5);

/** 화면에 보여 줄 폭(w)과 깊이(d)를 다 담는 확대 배율 */
function fitZoom(px: { width: number; height: number }, w: number, d: number) {
  // 깊이 방향은 비스듬히 보여서 sin(ELEV)만큼 줄어 보여요
  return Math.min(px.width / w, px.height / (d * Math.sin(ELEV) + 2));
}

/** 본관 전체 → 방 → 사물 순서로 다가가요 */
export default function CameraRig() {
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera;
  const size = useThree((s) => s.size);
  const scene = useLab((s) => s.scene);
  const focus = useLab((s) => s.focus);
  const look = useRef(CENTER.clone());
  const wantLook = useRef(new THREE.Vector3());
  const first = useRef(true);
  const tmp = useRef(new THREE.Vector3());

  useFrame((_, dt) => {
    let zoom: number;
    if (focus && scene !== "overview") {
      const [ox, oz] = toWorld(byId(scene), focus.pos);
      const table = focus.furniture === "roundTable";
      wantLook.current.set(ox, table ? 0.6 : 1.0, oz);
      zoom = fitZoom(size, table ? 7.5 : 4.2, table ? 6.5 : 3.8);
    } else if (scene !== "overview") {
      const [x, z] = byId(scene).pos;
      wantLook.current.set(x, 0.6, z - 0.3);
      zoom = fitZoom(size, 8.6, 7.2);
    } else {
      wantLook.current.copy(CENTER);
      zoom = fitZoom(size, SITE.maxX - SITE.minX + 6, SITE.riverZ + 4 - SITE.minZ) / live.camZoom;
    }
    const az = scene === "overview" ? live.camAzimuth : 0;
    const k = first.current ? 1 : 1 - Math.pow(focus ? 0.02 : 0.012, dt);
    first.current = false;
    look.current.lerp(wantLook.current, k);
    const dir = tmp.current.set(Math.sin(az) * Math.cos(ELEV), Math.sin(ELEV), Math.cos(az) * Math.cos(ELEV));
    camera.position.copy(look.current).addScaledVector(dir, DIST);
    camera.lookAt(look.current);
    const z = THREE.MathUtils.lerp(camera.zoom, zoom, k);
    if (Math.abs(z - camera.zoom) > 1e-4) {
      camera.zoom = z;
      camera.updateProjectionMatrix();
    }
  });
  return null;
}
