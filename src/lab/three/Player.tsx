"use client";
import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { COLORS } from "../data/buildings";
import type { NavGrid } from "../nav/grid";
import { live, useLab } from "../store";
import Otter, { toyMat, type OtterAnim } from "./Otter";

const SPEED = 3.4;
const KEYMAP: Record<string, [number, number]> = {
  w: [0, 1],
  arrowup: [0, 1],
  s: [0, -1],
  arrowdown: [0, -1],
  a: [-1, 0],
  arrowleft: [-1, 0],
  d: [1, 0],
  arrowright: [1, 0],
};

/** 내 수달(연구소장). 클릭한 길을 따라가거나 키보드로 움직여요. */
export default function Player({ nav, onArrive, frozen }: { nav: NavGrid; onArrive: () => void; frozen: boolean }) {
  const grp = useRef<THREE.Group>(null);
  const anim = useRef<OtterAnim>("idle");
  const wasMoving = useRef(false);
  const camera = useThree((s) => s.camera);
  const setMarker = useLab((s) => s.setMarker);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const p = live.player;
    let mx = 0;
    let mz = 0;

    // 키보드 이동 (화면 기준 방향)
    if (!frozen && live.keys.size) {
      let ix = 0;
      let iz = 0;
      live.keys.forEach((k) => {
        const v = KEYMAP[k];
        if (v) {
          ix += v[0];
          iz += v[1];
        }
      });
      if (ix || iz) {
        const fwd = new THREE.Vector3();
        camera.getWorldDirection(fwd);
        fwd.y = 0;
        fwd.normalize();
        const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
        const dir = fwd.multiplyScalar(iz).add(right.multiplyScalar(ix)).normalize();
        mx = dir.x * SPEED * dt;
        mz = dir.z * SPEED * dt;
        if (live.path.length) {
          live.path = [];
          setMarker(null);
          useLab.getState().setPending(null);
        }
      }
    }

    // 길 따라가기
    if (!mx && !mz && live.path.length && !frozen) {
      const [tx, tz] = live.path[0];
      const dx = tx - p.x;
      const dz = tz - p.z;
      const dist = Math.hypot(dx, dz);
      const step = SPEED * dt;
      if (dist <= step) {
        p.x = tx;
        p.z = tz;
        live.path.shift();
        if (!live.path.length) {
          setMarker(null);
          wasMoving.current = false;
          p.moving = false;
          onArrive();
        }
      } else {
        mx = (dx / dist) * step;
        mz = (dz / dist) * step;
      }
    }

    if (mx || mz) {
      // 막히면 벽을 따라 미끄러지듯 움직여요
      if (nav.isFree(p.x + mx, p.z + mz)) {
        p.x += mx;
        p.z += mz;
      } else if (nav.isFree(p.x + mx, p.z)) p.x += mx;
      else if (nav.isFree(p.x, p.z + mz)) p.z += mz;
      const want = Math.atan2(mx, mz);
      let d = want - p.heading;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      p.heading += d * Math.min(1, dt * 12);
      p.moving = true;
      wasMoving.current = true;
    } else {
      p.moving = false;
    }

    anim.current = p.moving ? "walk" : "idle";
    if (grp.current) {
      grp.current.position.set(p.x, 0, p.z);
      grp.current.rotation.y = p.heading;
    }
  });

  return (
    <group ref={grp}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <ringGeometry args={[0.52, 0.62, 32]} />
        <meshBasicMaterial color={COLORS.coral} transparent opacity={0.85} />
      </mesh>
      <Otter gear="beretBag" animRef={anim} scale={0.92} />
    </group>
  );
}

/** 목적지 표시 */
export function Marker() {
  const marker = useLab((s) => s.marker);
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      const k = 1 + Math.sin(clock.elapsedTime * 6) * 0.12;
      ref.current.scale.set(k, k, k);
    }
  });
  if (!marker) return null;
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[marker[0], 0.05, marker[1]]} material={toyMat(COLORS.coral)}>
      <ringGeometry args={[0.18, 0.3, 24]} />
    </mesh>
  );
}
