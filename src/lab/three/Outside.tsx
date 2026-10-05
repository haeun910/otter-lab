"use client";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { BUILDINGS, MAP, byId, doorPoint, type Building } from "../data/buildings";
import { NavGrid, type Blocker } from "../nav/grid";
import { live, useLab } from "../store";
import BuildingMesh from "./Building";
import { Anchor } from "./labels";
import Nature, { makeTrees, rng, type TreeSpot } from "./Nature";
import Otter, { type OtterAnim } from "./Otter";
import Player, { Marker } from "./Player";

function localToWorld(b: Building, lx: number, lz: number): [number, number] {
  const c = Math.cos(b.rot);
  const s = Math.sin(b.rot);
  return [b.pos[0] + lx * c + lz * s, b.pos[1] - lx * s + lz * c];
}

function buildNav(trees: TreeSpot[]) {
  const blockers: Blocker[] = [];
  for (const b of BUILDINGS) {
    blockers.push({ kind: "rect", x: b.pos[0], z: b.pos[1], w: b.size[0] + 0.5, d: b.size[1] + 0.5, rot: b.rot });
    const [w, d] = b.size;
    const extra: [number, number, number][] = [];
    if (b.id === "receiver") extra.push([-w / 2 - 0.25, 0.2, 1.1]);
    if (b.id === "library") extra.push([w / 2 - 0.4, -0.3, 0.9]);
    if (b.id === "stats") extra.push([w / 2 + 0.9, d / 2 - 0.2, 0.8]);
    if (b.id === "office") extra.push([w / 2 + 0.7, d / 2 - 0.3, 0.25]);
    if (b.id === "cards") extra.push([-w / 2 - 0.5, d / 2 - 0.4, 0.5]);
    if (b.id === "blog") extra.push([w / 2 + 0.45, d / 2 - 0.5, 0.3]);
    for (const [lx, lz, r] of extra) {
      const [x, z] = localToWorld(b, lx, lz);
      blockers.push({ kind: "circle", x, z, r });
    }
  }
  for (const t of trees) blockers.push({ kind: "circle", x: t.x, z: t.z, r: 0.45 * t.s });
  blockers.push({ kind: "circle", x: 0, z: -2.5, r: 0.25 }); // 이정표
  return new NavGrid({ minX: MAP.minX, maxX: MAP.maxX, minZ: MAP.minZ, maxZ: MAP.maxZ }, 0.4, blockers, 0.3);
}

/** 바깥을 산책하는 직원 */
function Walker({ id, nav, seed }: { id: string; nav: NavGrid; seed: number }) {
  const b = byId(id);
  const grp = useRef<THREE.Group>(null);
  const anim = useRef<OtterAnim>("idle");
  const st = useRef({ x: 0, z: 0, heading: 0, path: [] as [number, number][], wait: 1 + seed, r: rng(seed * 97 + 3) });
  const setSpeech = useLab((s) => s.setSpeech);
  const setHover = useLab((s) => s.setHover);
  const key = `walker-${id}`;

  useEffect(() => {
    const [x, z] = nav.nearestFree(...doorPoint(b, 1.8));
    st.current.x = x;
    st.current.z = z;
  }, [b, nav]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const s = st.current;
    const talking = useLab.getState().speech?.key === key;
    if (talking) {
      // 말할 때는 나를 바라봐요
      s.heading = Math.atan2(live.player.x - s.x, live.player.z - s.z);
      anim.current = "wave";
    } else if (s.path.length) {
      const [tx, tz] = s.path[0];
      const dx = tx - s.x;
      const dz = tz - s.z;
      const d = Math.hypot(dx, dz);
      const step = 1.6 * dt;
      if (d <= step) {
        s.x = tx;
        s.z = tz;
        s.path.shift();
        if (!s.path.length) s.wait = 2 + s.r() * 4;
      } else {
        s.x += (dx / d) * step;
        s.z += (dz / d) * step;
        s.heading = Math.atan2(dx, dz);
      }
      anim.current = "walk";
    } else {
      anim.current = "idle";
      s.wait -= dt;
      if (s.wait <= 0) {
        // 광장과 자기 건물 사이 어딘가로
        const [hx, hz] = doorPoint(b, 2.5);
        const t = s.r();
        const tx = hx * (1 - t) + 0 * t + (s.r() - 0.5) * 5;
        const tz = hz * (1 - t) + -2.5 * t + (s.r() - 0.5) * 4;
        s.path = nav.findPath([s.x, s.z], [tx, tz]);
        s.wait = 3;
      }
    }
    if (grp.current) {
      grp.current.position.set(s.x, 0, s.z);
      grp.current.rotation.y = s.heading;
    }
  });

  if (!b.staff) return null;
  return (
    <group ref={grp}>
      <group
        onClick={(e) => {
          e.stopPropagation();
          if (e.delta > 8) return;
          setSpeech({ key, text: `산책 중이에요. ${b.name}에 오시면 일하는 모습 보여드릴게요!` });
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(key);
        }}
        onPointerOut={() => setHover(null)}
      >
        <Otter gear={b.staff.gear} animRef={anim} scale={0.85} seed={seed} />
      </group>
      <Anchor id={key} position={[0, 2.0, 0]} />
    </group>
  );
}

export const WALKERS = (() => {
  const ids = BUILDINGS.filter((b) => b.staff).map((b) => b.id);
  const k = new Date().getHours() % ids.length;
  return [ids[k], ids[(k + 3) % ids.length]];
})();

export default function Outside() {
  const trees = useMemo(makeTrees, []);
  const nav = useMemo(() => buildNav(trees), [trees]);
  const pending = useLab((s) => s.pending);
  const spawnAt = useLab((s) => s.spawnAt);
  const setNearDoor = useLab((s) => s.setNearDoor);

  // 오늘 산책하는 직원 두 명 (시간에 따라 바뀌어요)
  const walkers = WALKERS;

  // 등장 위치
  useEffect(() => {
    if (spawnAt) {
      const b = byId(spawnAt);
      const [x, z] = nav.nearestFree(...doorPoint(b, 1.2));
      Object.assign(live.player, { x, z, heading: b.rot });
    } else if (!live.player.x && !live.player.z) {
      Object.assign(live.player, { x: 0, z: 0.4, heading: 0 });
    }
    live.path = [];
  }, [spawnAt, nav]);

  const walkTo = (x: number, z: number) => {
    live.path = nav.findPath([live.player.x, live.player.z], [x, z]);
    useLab.getState().setMarker(live.path[live.path.length - 1] ?? null);
    useLab.getState().dismissHint();
  };

  const onGround = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 8) return;
    useLab.getState().setPending(null);
    walkTo(e.point.x, e.point.z);
  };

  const select = (b: Building) => {
    useLab.getState().setPending({ type: "enter", id: b.id });
    const [x, z] = doorPoint(b);
    walkTo(x, z);
    if (!live.path.length) onArrive();
  };

  function onArrive() {
    const p = useLab.getState().pending;
    if (p?.type === "enter") useLab.getState().go(p.id);
  }

  useEffect(() => {
    useLab.getState().setActions({ enter: (id: string) => select(byId(id)) });
    return () => useLab.getState().setActions({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav]);

  // 문 앞에 서 있는지 (E 키 안내)
  useFrame(() => {
    let near: string | null = null;
    for (const b of BUILDINGS) {
      const [x, z] = doorPoint(b);
      if (Math.hypot(live.player.x - x, live.player.z - z) < 1.4) near = b.id;
    }
    setNearDoor(near);
  });

  return (
    <group>
      <Nature onGround={onGround} trees={trees} />
      {BUILDINGS.map((b) => (
        <BuildingMesh key={b.id} b={b} onSelect={select} />
      ))}
      {walkers.map((id, i) => (
        <Walker key={id} id={id} nav={nav} seed={i + 1} />
      ))}
      <Player nav={nav} onArrive={onArrive} frozen={pending?.type === "exit"} />
      <Marker />
    </group>
  );
}
