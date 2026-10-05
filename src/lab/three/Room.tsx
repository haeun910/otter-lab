"use client";
import { RoundedBox } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { COLORS, ROOM, type Building, type RoomObject } from "../data/buildings";
import { NavGrid, type Blocker } from "../nav/grid";
import { live, useLab } from "../store";
import Furniture, { FOOTPRINT } from "./Furniture";
import { Anchor } from "./labels";
import Otter, { toyMat } from "./Otter";
import Player, { Marker } from "./Player";

// 방마다 직원이 일하는 자리
const STAFF_SPOT: Record<string, [number, number]> = {
  receiver: [1.3, -1.15],
  cards: [-2.55, -1.05],
  blog: [1.45, -1.15],
  dock: [-2.4, 0.3],
  library: [-1.95, -0.85],
  stats: [1.65, -0.95],
  dorm: [-0.95, -0.95],
};

const ENTRANCE: [number, number] = [0, ROOM.d / 2 - 0.75];

/** 사물 앞에 서는 자리 */
export function standPoint(o: RoomObject): [number, number] {
  const f = FOOTPRINT[o.furniture];
  return [o.pos[0], o.pos[1] + f.d / 2 + 0.6];
}

function Interactable({ o, onUse }: { o: RoomObject; onUse: (o: RoomObject) => void }) {
  const hover = useLab((s) => s.hover === `o-${o.id}`);
  const setHover = useLab((s) => s.setHover);
  const ref = useRef<THREE.Group>(null);
  const focus = useLab((s) => s.focus);
  useFrame((_, dt) => {
    if (!ref.current) return;
    const s = hover && !focus ? 1.04 : 1;
    ref.current.scale.lerp(new THREE.Vector3(s, s, s), 1 - Math.pow(0.001, dt));
  });
  const f = FOOTPRINT[o.furniture];
  const top = o.furniture === "bookshelf" || o.furniture === "board" ? 2.75 : o.furniture === "drawer" ? 2.1 : 1.95;
  return (
    <group position={[o.pos[0], 0, o.pos[1]]} rotation={[0, o.rot ?? 0, 0]}>
      <group
        ref={ref}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          if (e.delta > 8) return;
          onUse(o);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(`o-${o.id}`);
        }}
        onPointerOut={() => setHover(null)}
      >
        <Furniture kind={o.furniture} />
        {/* 눌러볼 수 있다는 표시: 바닥의 은은한 원 */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, f.d / 2 + 0.55]}>
          <ringGeometry args={[0.32, 0.42, 28]} />
          <meshBasicMaterial color={hover ? COLORS.coral : COLORS.mint} transparent opacity={0.9} />
        </mesh>
      </group>
      <Anchor id={`obj-${o.id}`} position={[0, top, 0]} />
    </group>
  );
}

function StaffAtWork({ b }: { b: Building }) {
  const spot = STAFF_SPOT[b.id];
  const target = b.objects[0].pos;
  const setSpeech = useLab((s) => s.setSpeech);
  const setHover = useLab((s) => s.setHover);
  const anim = useRef<"work" | "wave">("work");
  const waveUntil = useRef(0);
  useFrame(({ clock }) => {
    if (waveUntil.current < 0) waveUntil.current = clock.elapsedTime + 2;
    anim.current = clock.elapsedTime < waveUntil.current ? "wave" : "work";
  });
  if (!spot || !b.staff) return null;
  // 하던 일을 하면서도 얼굴은 방 안쪽(소장님 쪽)으로 보이게 비스듬히 서요
  const facing = Math.atan2(target[0] - spot[0], target[1] + 3 - spot[1]);
  const key = `staff-${b.id}`;
  return (
    <group position={[spot[0], 0, spot[1]]}>
      <group
        rotation={[0, facing, 0]}
        onClick={(e) => {
          e.stopPropagation();
          if (e.delta > 8) return;
          waveUntil.current = -1; // 다음 프레임부터 2초간 손을 흔들어요
          setSpeech({ key, text: b.staff!.line });
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(`staff-${b.id}`);
        }}
        onPointerOut={() => setHover(null)}
      >
        <Otter gear={b.staff.gear} animRef={anim as React.MutableRefObject<"work">} scale={0.88} seed={b.id.length} />
      </group>
      <Anchor id={`staff-${b.id}`} position={[0, 2.05, 0]} />
    </group>
  );
}

function Shell({ b }: { b: Building }) {
  const { w, d } = ROOM;
  const H = 2.9;
  return (
    <group>
      {/* 바닥 */}
      <RoundedBox args={[w, 0.3, d]} radius={0.1} position={[0, -0.15, 0]} receiveShadow material={toyMat(b.floor)} />
      {Array.from({ length: 7 }).map((_, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[-w / 2 + (i + 0.5) * (w / 7), 0.002, 0]} receiveShadow material={toyMat(i % 2 ? b.floor : "#E2CDB0")}>
          <planeGeometry args={[w / 7 - 0.02, d - 0.1]} />
        </mesh>
      ))}
      {/* 러그 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0.6]} receiveShadow material={toyMat(b.roof)}>
        <circleGeometry args={[1.25, 40]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0.6]} material={toyMat("#FFFFFF")}>
        <ringGeometry args={[0.95, 1.05, 40]} />
      </mesh>
      {/* 뒷벽 + 옆벽 (앞쪽은 열려 있어요) */}
      <RoundedBox args={[w + 0.3, H, 0.25]} radius={0.08} position={[0, H / 2, -d / 2 - 0.12]} receiveShadow material={toyMat(b.wall)} />
      {[-1, 1].map((s) => (
        <RoundedBox key={s} args={[0.25, H, d + 0.3]} radius={0.08} position={[s * (w / 2 + 0.12), H / 2, 0]} receiveShadow castShadow material={toyMat(b.wall)} />
      ))}
      {/* 걸레받이 */}
      <mesh position={[0, 0.18, -d / 2 + 0.02]} material={toyMat(b.accent)}>
        <boxGeometry args={[w, 0.12, 0.04]} />
      </mesh>
      {/* 창문 */}
      {[-2.4, 2.4].map((x) => (
        <group key={x} position={[x, 1.85, -d / 2 + 0.02]}>
          <RoundedBox args={[1.2, 0.95, 0.08]} radius={0.06} material={toyMat(b.accent)} />
          <mesh position={[0, 0, 0.05]} material={new THREE.MeshBasicMaterial({ color: "#D6F0FF" })}>
            <planeGeometry args={[1, 0.75]} />
          </mesh>
          <mesh position={[0, -0.12, 0.06]} material={new THREE.MeshBasicMaterial({ color: "#BFE8B0" })}>
            <planeGeometry args={[1, 0.3]} />
          </mesh>
          <mesh position={[0, 0, 0.07]} material={toyMat(b.accent)}>
            <boxGeometry args={[0.05, 0.75, 0.02]} />
          </mesh>
        </group>
      ))}
      {/* 오터랩 포스터 */}
      <group position={[w / 2 - 0.02, 1.7, -0.6]} rotation={[0, -Math.PI / 2, 0]}>
        <mesh material={toyMat("#FFFFFF")}>
          <planeGeometry args={[0.9, 1.1]} />
        </mesh>
        <mesh position={[0, 0.12, 0.01]} material={toyMat(COLORS.sky)}>
          <circleGeometry args={[0.28, 24]} />
        </mesh>
        <mesh position={[0, -0.32, 0.01]} material={toyMat(COLORS.coral)}>
          <planeGeometry args={[0.6, 0.08]} />
        </mesh>
      </group>
      {/* 화분 */}
      {[
        [-w / 2 + 0.5, -d / 2 + 0.5],
        [w / 2 - 0.5, d / 2 - 0.6],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh castShadow position={[0, 0.22, 0]} material={toyMat(COLORS.coral)}>
            <cylinderGeometry args={[0.22, 0.17, 0.44, 14]} />
          </mesh>
          <mesh castShadow position={[0, 0.7, 0]} material={toyMat(COLORS.leaf)}>
            <sphereGeometry args={[0.36, 16, 12]} />
          </mesh>
          <mesh castShadow position={[0.15, 0.95, 0.05]} material={toyMat(COLORS.leafDeep)}>
            <sphereGeometry args={[0.22, 14, 10]} />
          </mesh>
        </group>
      ))}
      {/* 천장 조명 */}
      <group position={[0, 2.5, -0.6]}>
        <mesh position={[0, 0.5, 0]} material={toyMat(COLORS.navy)}>
          <cylinderGeometry args={[0.015, 0.015, 1, 6]} />
        </mesh>
        <mesh material={toyMat(COLORS.butter)}>
          <coneGeometry args={[0.3, 0.26, 20, 1, true]} />
        </mesh>
        <pointLight position={[0, -0.3, 0]} intensity={4} distance={8} color="#FFF1D6" />
      </group>
    </group>
  );
}

function ExitMat({ onExit }: { onExit: () => void }) {
  const hover = useLab((s) => s.hover === "exit");
  const setHover = useLab((s) => s.setHover);
  return (
    <group position={[0, 0, ROOM.d / 2 - 0.3]}>
      <RoundedBox
        args={[1.4, 0.05, 0.55]}
        radius={0.02}
        position={[0, 0.025, 0]}
        material={toyMat(hover ? COLORS.coral : COLORS.mint)}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          if (e.delta > 8) return;
          onExit();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover("exit");
        }}
        onPointerOut={() => setHover(null)}
      />
      <Anchor id="exit" position={[0, 0.45, 0.1]} />
    </group>
  );
}

export default function Room({ b }: { b: Building }) {
  const pending = useLab((s) => s.pending);
  const focus = useLab((s) => s.focus);

  const nav = useMemo(() => {
    const blockers: Blocker[] = b.objects.map((o) => {
      const f = FOOTPRINT[o.furniture];
      return { kind: "rect", x: o.pos[0], z: o.pos[1], w: f.w, d: f.d, rot: o.rot ?? 0 };
    });
    const spot = STAFF_SPOT[b.id];
    if (spot) blockers.push({ kind: "circle", x: spot[0], z: spot[1], r: 0.4 });
    if (b.id === "dorm") for (const x of [-2, 2]) blockers.push({ kind: "rect", x, z: b.objects[0].pos[1] - 0.1, w: 1.1, d: 1.7, rot: 0 });
    blockers.push({ kind: "circle", x: -ROOM.w / 2 + 0.5, z: -ROOM.d / 2 + 0.5, r: 0.3 }, { kind: "circle", x: ROOM.w / 2 - 0.5, z: ROOM.d / 2 - 0.6, r: 0.3 });
    return new NavGrid({ minX: -ROOM.w / 2 + 0.35, maxX: ROOM.w / 2 - 0.35, minZ: -ROOM.d / 2 + 0.35, maxZ: ROOM.d / 2 - 0.1 }, 0.2, blockers, 0.32);
  }, [b]);

  const walkTo = (x: number, z: number) => {
    live.path = nav.findPath([live.player.x, live.player.z], [x, z]);
    const end = live.path[live.path.length - 1];
    useLab.getState().setMarker(end ?? null);
  };

  const onFloor = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 8 || focus) return;
    useLab.getState().dismissHint();
    useLab.getState().setPending(null);
    walkTo(e.point.x, e.point.z);
  };

  const use = (o: RoomObject) => {
    if (focus) return;
    useLab.getState().dismissHint();
    useLab.getState().setPending({ type: "use", object: o });
    const [x, z] = standPoint(o);
    walkTo(x, z);
    if (!live.path.length) onArrive();
  };

  const exit = () => {
    useLab.getState().setPending({ type: "exit" });
    walkTo(ENTRANCE[0], ROOM.d / 2 - 0.3);
    if (!live.path.length) onArrive();
  };

  useEffect(() => {
    useLab.getState().setActions({ use, exit });
    return () => useLab.getState().setActions({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav]);

  function onArrive() {
    const p = useLab.getState().pending;
    if (!p) return;
    if (p.type === "use") {
      // 사물을 바라보고 확대
      live.player.heading = Math.PI;
      useLab.getState().openFocus(p.object);
    } else if (p.type === "exit") {
      useLab.getState().go("outside", b.id);
    }
  }

  return (
    <group>
      <Shell b={b} />
      {/* 바닥 클릭 영역 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} onClick={onFloor}>
        <planeGeometry args={[ROOM.w, ROOM.d]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {b.objects.map((o) => (
        <Interactable key={o.id} o={o} onUse={use} />
      ))}
      <StaffAtWork b={b} />
      <ExitMat onExit={exit} />
      <Player nav={nav} onArrive={onArrive} frozen={Boolean(focus) || pending?.type === "enter"} />
      <Marker />
    </group>
  );
}

export { ENTRANCE };
