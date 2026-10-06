"use client";
import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { SITE, byId, toWorld } from "../data/buildings";
import { live, useLab } from "../store";

// 실제 카메라처럼 원근이 있어요. 망원 렌즈(좁은 화각)로 멀리서 비스듬히 내려다봐요.
export const FOV = 30;
const CENTER = new THREE.Vector3(1.8, 0, (SITE.minZ + SITE.riverZ) / 2 + 0.6);

/** 땅 위 w×d 넓이(높이 h까지)를 화면에 다 담는 거리 */
function fitDistance(aspect: number, elev: number, w: number, d: number, h = 1.5) {
  const t = Math.tan(THREE.MathUtils.degToRad(FOV) / 2);
  const vert = d * Math.sin(elev) + h * Math.cos(elev);
  return Math.max(vert / 2 / t, w / 2 / (t * aspect)) * 1.1;
}

/** 본관 전체 → 방 → 사물 순서로 다가가요 */
export default function CameraRig() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const scene = useLab((s) => s.scene);
  const focus = useLab((s) => s.focus);
  const look = useRef(CENTER.clone());
  const want = useRef({ look: new THREE.Vector3(), dist: 60, elev: 0.98 });
  const cur = useRef({ dist: 60, elev: 0.98 });
  const first = useRef(true);
  const dir = useRef(new THREE.Vector3());

  useFrame((_, dt) => {
    const aspect = size.width / Math.max(1, size.height);
    const w = want.current;
    if (focus && scene !== "overview") {
      const [ox, oz] = toWorld(byId(scene), focus.pos);
      const table = focus.furniture === "roundTable";
      w.look.set(ox, table ? 0.6 : 0.9, oz + (table ? 0 : 0.3));
      w.elev = table ? 0.95 : 0.72;
      w.dist = fitDistance(aspect, w.elev, table ? 7 : 3.8, table ? 6 : 3.2, 2);
    } else if (scene !== "overview") {
      const [x, z] = byId(scene).pos;
      w.look.set(x, 0.5, z - 0.1);
      w.elev = 0.9;
      w.dist = fitDistance(aspect, w.elev, 8.2, 6.6, 2) * live.camZoom;
    } else {
      w.look.copy(CENTER);
      w.elev = 0.98;
      w.dist = fitDistance(aspect, w.elev, SITE.maxX - SITE.minX + 5, SITE.riverZ + 3 - SITE.minZ, 2) * live.camZoom;
    }
    // 사물에 다가갈 때 말고는, 끌어서 정한 각도를 따라요
    const az = focus ? 0 : live.camAzimuth;
    if (!focus) w.elev = THREE.MathUtils.clamp(w.elev + live.camTilt, 0.32, 1.48);
    const k = first.current ? 1 : 1 - Math.pow(focus ? 0.02 : 0.012, dt);
    first.current = false;
    look.current.lerp(w.look, k);
    cur.current.dist = THREE.MathUtils.lerp(cur.current.dist, w.dist, k);
    cur.current.elev = THREE.MathUtils.lerp(cur.current.elev, w.elev, k);
    const e = cur.current.elev;
    const d = dir.current.set(Math.sin(az) * Math.cos(e), Math.sin(e), Math.cos(az) * Math.cos(e));
    camera.position.copy(look.current).addScaledVector(d, cur.current.dist);
    camera.lookAt(look.current);
  });
  return null;
}
