"use client";
import { RoundedBox } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { BUILDINGS, COLORS, ROOM, SITE, byId, toWorld, type Building, type RoomObject, type Side } from "../data/buildings";
import { useLab } from "../store";
import Crew from "./Crew";
import Furniture, { FOOTPRINT } from "./Furniture";
import { Anchor } from "./labels";
import { Bottles, River, Tree, rng, type TreeSpot } from "./Nature";
import { toyMat } from "./Otter";
import { grassTexture, painted, rugTexture, toon, woodFloor } from "./style";

import { DOOR_W, WALL_H, WALL_T, wallPieces } from "./walls";

function Walls({ b }: { b: Building }) {
  return (
    <group>
      {(["n", "s", "e", "w"] as Side[]).flatMap((side) =>
        wallPieces(side, b.doors.includes(side)).map((p, i) => (
          <group key={`${side}${i}`}>
            <RoundedBox
              args={[p.w, WALL_H[side], p.d]}
              radius={0.06}
              position={[p.x, WALL_H[side] / 2, p.z]}
              castShadow
              receiveShadow
              material={toyMat(b.wall)}
            />
            {/* 벽 위 띠 */}
            <mesh position={[p.x, WALL_H[side] + 0.02, p.z]} material={toyMat(b.accent)}>
              <boxGeometry args={[p.w + 0.02, 0.06, p.d + 0.02]} />
            </mesh>
          </group>
        )),
      )}
      {/* 뒷벽 창문 */}
      {!b.doors.includes("n") &&
        [-1.8, 1.8].map((x) => (
          <group key={x} position={[x, 1.2, -ROOM.d / 2 + WALL_T / 2 + 0.01]}>
            <RoundedBox args={[1.1, 0.75, 0.06]} radius={0.05} material={toyMat(b.accent)} />
            <mesh position={[0, 0, 0.035]} material={WINDOW}>
              <planeGeometry args={[0.92, 0.58]} />
            </mesh>
          </group>
        ))}
    </group>
  );
}
const WINDOW = new THREE.MeshBasicMaterial({ color: "#D6F0FF" });

function Interactable({ b, o }: { b: Building; o: RoomObject }) {
  const hover = useLab((s) => s.hover === `o-${o.id}`);
  const inRoom = useLab((s) => s.scene === b.id && !s.focus);
  const ref = useRef<THREE.Group>(null);
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dt) => {
    if (!ref.current) return;
    const s = hover && inRoom ? 1.04 : 1;
    ref.current.scale.lerp(v.set(s, s, s), 1 - Math.pow(0.001, dt));
  });
  const f = FOOTPRINT[o.furniture];
  const top =
    o.furniture === "bookshelf" || o.furniture === "board"
      ? 2.75
      : o.furniture === "roundTable"
        ? 3.4
        : o.furniture === "drawer" || o.furniture === "chalkboard"
          ? 2.1
          : 1.95;
  const use = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 8) return;
    const st = useLab.getState();
    if (st.scene !== b.id) st.travel(b.id);
    else if (!st.focus) st.openFocus(o);
  };
  return (
    <group position={[o.pos[0], 0, o.pos[1]]} rotation={[0, o.rot ?? 0, 0]}>
      <group
        ref={ref}
        onClick={use}
        onPointerOver={(e) => {
          e.stopPropagation();
          useLab.getState().setHover(`o-${o.id}`);
        }}
        onPointerOut={() => useLab.getState().setHover(null)}
      >
        <Furniture kind={o.furniture} />
        {o.furniture !== "roundTable" && (
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, f.d / 2 + 0.45]}>
            <ringGeometry args={[0.28, 0.37, 28]} />
            <meshBasicMaterial color={hover ? COLORS.coral : COLORS.mint} transparent opacity={0.9} />
          </mesh>
        )}
      </group>
      <Anchor id={`obj-${o.id}`} position={[0, top, 0]} />
    </group>
  );
}

function Plant({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh castShadow position={[0, 0.2, 0]} material={toyMat(COLORS.coral)}>
        <cylinderGeometry args={[0.2, 0.15, 0.4, 12]} />
      </mesh>
      <mesh castShadow position={[0, 0.62, 0]} material={toyMat(COLORS.leaf)}>
        <sphereGeometry args={[0.32, 14, 10]} />
      </mesh>
    </group>
  );
}

/** 현관 벽시계: 실제 한국 시간을 가리켜요 */
function WallClock() {
  const hour = useRef<THREE.Mesh>(null);
  const min = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const t = new Date(Date.now() + 9 * 3600_000);
    const m = t.getUTCMinutes() + t.getUTCSeconds() / 60;
    const h = (t.getUTCHours() % 12) + m / 60;
    if (min.current) min.current.rotation.z = -(m / 60) * Math.PI * 2;
    if (hour.current) hour.current.rotation.z = -(h / 12) * Math.PI * 2;
  });
  return (
    <group position={[-2.3, 1.45, -ROOM.d / 2 + 0.16]}>
      <mesh material={toyMat("#FFFFFF")}>
        <cylinderGeometry args={[0.42, 0.42, 0.06, 32]} />
      </mesh>
      <group rotation={[Math.PI / 2, 0, 0]}>
        <mesh position={[0, 0, -0.04]} rotation={[-Math.PI / 2, 0, 0]} material={toyMat(COLORS.navy)}>
          <torusGeometry args={[0.42, 0.04, 8, 32]} />
        </mesh>
      </group>
      <group position={[0, 0, 0.05]}>
        <mesh ref={hour} material={toyMat(COLORS.navy)}>
          <boxGeometry args={[0.04, 0.22, 0.02]} />
        </mesh>
        <mesh ref={min} material={toyMat(COLORS.coral)}>
          <boxGeometry args={[0.03, 0.34, 0.02]} />
        </mesh>
      </group>
    </group>
  );
}

function LobbyDeco() {
  return (
    <group>
      <WallClock />
      {/* 현관 매트와 간판 */}
      <RoundedBox args={[2, 0.04, 1]} radius={0.02} position={[0, 0.03, ROOM.d / 2 - 0.7]} material={toyMat(COLORS.coral)} />
      <group position={[-2.2, 0, 0.6]}>
        <mesh castShadow position={[0, 0.7, 0]} material={toyMat(COLORS.woodDark)}>
          <cylinderGeometry args={[0.06, 0.08, 1.4, 8]} />
        </mesh>
        <RoundedBox args={[1.6, 0.6, 0.1]} radius={0.06} position={[0, 1.45, 0]} castShadow material={toyMat(COLORS.wood)} />
        <mesh position={[0, 1.45, 0.06]} material={toyMat(COLORS.cream)}>
          <planeGeometry args={[1.36, 0.4]} />
        </mesh>
      </group>
      {/* 벤치 */}
      <RoundedBox args={[1.8, 0.14, 0.5]} radius={0.05} position={[2.1, 0.45, -1.6]} castShadow material={toyMat(COLORS.wood)} />
      {[-0.7, 0.7].map((x) => (
        <mesh key={x} position={[2.1 + x, 0.2, -1.6]} material={toyMat(COLORS.woodDark)}>
          <boxGeometry args={[0.1, 0.4, 0.4]} />
        </mesh>
      ))}
      <Plant x={-2.9} z={-2.1} />
      <Plant x={2.9} z={1.9} />
    </group>
  );
}

function DockDeck() {
  const { w, d } = ROOM;
  return (
    <group>
      {Array.from({ length: 12 }).map((_, i) => (
        <mesh key={i} receiveShadow castShadow position={[-w / 2 + (i + 0.5) * (w / 12), -0.08, 0]} material={toyMat(i % 2 ? COLORS.wood : "#E2B88A")}>
          <boxGeometry args={[w / 12 - 0.05, 0.16, d]} />
        </mesh>
      ))}
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} castShadow position={[(sx * w) / 2, 0.2, (sz * d) / 2]} material={toyMat(COLORS.woodDark)}>
            <cylinderGeometry args={[0.12, 0.12, 1.4, 8]} />
          </mesh>
        )),
      )}
      {/* 구명튜브 */}
      <mesh position={[w / 2 - 0.4, 0.5, -d / 2 + 0.3]} rotation={[0, 0.4, 0]} material={toyMat(COLORS.coral)}>
        <torusGeometry args={[0.3, 0.09, 10, 20]} />
      </mesh>
    </group>
  );
}

const rugMat = (c: string) => painted(`rug:${c}`, () => rugTexture(c));

/** 잔디 재질: 붓으로 찍은 얼룩이 일정한 크기로 반복돼요 */
function grassMat(base: string, w: number, d: number) {
  return painted(`grass:${base}:${w}x${d}`, () => {
    const t = grassTexture(base).clone();
    t.repeat.set(w / 7, d / 7);
    t.needsUpdate = true;
    return t;
  });
}

function RoomShell({ b }: { b: Building }) {
  const hover = useLab((s) => s.hover === `room-${b.id}`);
  const overview = useLab((s) => s.scene === "overview");
  const { w, d } = ROOM;
  const enter = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 8) return;
    const st = useLab.getState();
    if (st.focus) return;
    if (st.scene !== b.id) st.travel(b.id);
  };
  return (
    <group position={[b.pos[0], 0, b.pos[1]]}>
      {b.open ? (
        <DockDeck />
      ) : (
        <>
          {/* 나뭇결이 보이는 마루 */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} receiveShadow material={painted(`floor:${b.floor}`, () => woodFloor(b.floor))}>
            <planeGeometry args={[w, d]} />
          </mesh>
          {!b.deco && b.id !== "meeting" && (
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0.9]} receiveShadow material={rugMat(b.id === "office" ? COLORS.butter : b.roof)}>
              <circleGeometry args={[1, 36]} />
            </mesh>
          )}
          <Walls b={b} />
        </>
      )}
      {/* 방을 누르는 자리 (본관 전체에서 방 고르기) */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.03, 0]}
        onClick={enter}
        onPointerOver={(e) => {
          e.stopPropagation();
          useLab.getState().setHover(`room-${b.id}`);
        }}
        onPointerOut={() => useLab.getState().setHover(null)}
      >
        <planeGeometry args={[w, d]} />
        <meshBasicMaterial color={COLORS.butter} transparent opacity={hover && overview ? 0.35 : 0} depthWrite={false} />
      </mesh>
      {b.deco && <LobbyDeco />}
      {!b.open && !b.deco && b.id !== "meeting" && <Plant x={w / 2 - 0.55} z={d / 2 - 0.6} />}
      {b.objects.map((o) => (
        <Interactable key={o.id} b={b} o={o} />
      ))}
      {/* 간판은 방 앞쪽 왼편 (뒤쪽에서 일하는 모습을 가리지 않게) */}
      <Anchor id={`sign-${b.id}`} position={b.open ? [-w / 2 + 1.2, 0.5, -d / 2 + 1.2] : [-w / 2 + 1.5, 0.5, d / 2 - 0.2]} />
    </group>
  );
}

/** 본관 바닥, 둘레 담, 앞마당 길 */
function Grounds() {
  const w = SITE.maxX - SITE.minX;
  const d = SITE.maxZ - SITE.minZ;
  const cx = (SITE.maxX + SITE.minX) / 2;
  const cz = (SITE.maxZ + SITE.minZ) / 2;
  const bank = SITE.riverZ - SITE.riverWidth / 2;
  const dock = byId("dock");
  const stones = useMemo(() => {
    const out: [number, number][] = [];
    for (let z = SITE.maxZ + 0.5; z < bank - 0.2; z += 0.85) out.push([0, z]);
    for (let x = 1; x < dock.pos[0] - ROOM.w / 2; x += 0.9) out.push([x, bank - 0.9]);
    return out;
  }, [bank, dock]);
  return (
    <group>
      {/* 잔디 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow material={grassMat(COLORS.grass, 400, 300)}>
        <planeGeometry args={[400, 300]} />
      </mesh>
      {/* 본관 바닥 (복도) */}
      <RoundedBox args={[w, 0.3, d]} radius={0.12} position={[cx, -0.15, cz]} receiveShadow material={toyMat("#E8D9C0")} />
      {/* 둘레 담 (앞 가운데는 현관 길) */}
      {[
        [cx, SITE.minZ, w, 0.3],
        [SITE.minX, cz, 0.3, d],
        [SITE.maxX, cz, 0.3, d],
        [(SITE.minX - 0.9) / 2, SITE.maxZ, -0.9 - SITE.minX, 0.3],
        [(SITE.maxX + 0.9) / 2, SITE.maxZ, SITE.maxX - 0.9, 0.3],
      ].map(([x, z, ww, dd], i) => (
        <RoundedBox key={i} args={[ww, 0.4, dd]} radius={0.08} position={[x, 0.2, z]} castShadow receiveShadow material={toyMat(COLORS.stone)} />
      ))}
      {/* 모래 강둑 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, bank - 0.5]} receiveShadow material={toon("#F3E3C3")}>
        <planeGeometry args={[140, 1.2]} />
      </mesh>
      {stones.map(([x, z], i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.02, z]} receiveShadow material={toyMat("#F1E4CF")}>
          <circleGeometry args={[0.32, 10]} />
        </mesh>
      ))}
    </group>
  );
}

function makeTrees(): TreeSpot[] {
  const r = rng(7);
  const out: TreeSpot[] = [];
  const bank = SITE.riverZ - SITE.riverWidth / 2;
  for (let i = 0; i < 200 && out.length < 44; i++) {
    const x = -30 + r() * 60;
    const z = -24 + r() * (bank + 22);
    const inSite = x > SITE.minX - 1.6 && x < SITE.maxX + 1.6 && z > SITE.minZ - 1.6;
    const nearPath = Math.abs(x) < 2.4 && z > SITE.maxZ;
    const nearDock = x > 8 && z > SITE.maxZ - 1;
    if (inSite || nearPath || nearDock || out.some((t) => Math.hypot(t.x - x, t.z - z) < 1.8)) continue;
    out.push({ x, z, s: 0.8 + r() * 0.6, kind: Math.floor(r() * 3) });
  }
  // 강 건너편
  for (let i = 0; i < 9; i++) out.push({ x: -26 + i * 6.5 + r() * 2, z: SITE.riverZ + SITE.riverWidth / 2 + 2 + r() * 3, s: 1 + r() * 0.4, kind: i % 3 });
  return out;
}

const PETALS = ["#FFFFFF", "#F7C6D0", "#F6D98B", "#C9B8F0", "#F09A86"];

/** 담장 밖 덤불과 잔디밭에 핀 작은 꽃 */
function Garden() {
  const { bushes, flowers } = useMemo(() => {
    const r = rng(23);
    const bank = SITE.riverZ - SITE.riverWidth / 2;
    const bushes: [number, number, number][] = [];
    // 담장 앞쪽 양옆과 옆면을 따라
    for (let x = SITE.minX + 0.8; x < -2.2; x += 1.5) bushes.push([x, SITE.maxZ + 0.75, 0.75 + r() * 0.3]);
    for (let x = 2.2; x < SITE.maxX - 0.8; x += 1.5) bushes.push([x, SITE.maxZ + 0.75, 0.75 + r() * 0.3]);
    for (let z = SITE.minZ + 1; z < SITE.maxZ; z += 1.8) {
      bushes.push([SITE.minX - 0.8, z, 0.7 + r() * 0.35]);
      bushes.push([SITE.maxX + 0.8, z, 0.7 + r() * 0.35]);
    }
    const flowers: [number, number, string][] = [];
    for (let i = 0; i < 400 && flowers.length < 90; i++) {
      const x = -28 + r() * 56;
      const z = SITE.minZ - 10 + r() * (bank - SITE.minZ + 9);
      const inSite = x > SITE.minX - 1.4 && x < SITE.maxX + 1.4 && z > SITE.minZ - 1.4 && z < SITE.maxZ + 1.4;
      if (inSite || (Math.abs(x) < 1.6 && z > SITE.maxZ) || z > bank - 1.3) continue;
      // 몇 송이씩 모여 피어요
      for (let k = 0; k < 3; k++) flowers.push([x + (r() - 0.5) * 0.7, z + (r() - 0.5) * 0.5, PETALS[Math.floor(r() * PETALS.length)]]);
    }
    return { bushes, flowers };
  }, []);
  return (
    <group>
      {bushes.map(([x, z, s], i) => (
        <group key={i} position={[x, 0, z]} scale={s}>
          <mesh castShadow position={[0, 0.38, 0]} material={toon(i % 3 ? COLORS.leaf : "#8FC48A")}>
            <sphereGeometry args={[0.55, 16, 12]} />
          </mesh>
          <mesh castShadow position={[0.4, 0.28, 0.1]} material={toon(i % 3 ? COLORS.leaf : "#8FC48A")}>
            <sphereGeometry args={[0.38, 14, 10]} />
          </mesh>
        </group>
      ))}
      {flowers.map(([x, z, c], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.14, 0]} material={toon(COLORS.leafDeep)}>
            <cylinderGeometry args={[0.02, 0.02, 0.28, 4]} />
          </mesh>
          <mesh position={[0, 0.3, 0]} material={toon(c)}>
            <sphereGeometry args={[0.12, 10, 8]} />
          </mesh>
          <mesh position={[0, 0.33, 0.06]} material={toon(COLORS.butter)}>
            <sphereGeometry args={[0.05, 8, 6]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export default function Campus() {
  const trees = useMemo(makeTrees, []);
  return (
    <group>
      <Grounds />
      <River z={SITE.riverZ} width={SITE.riverWidth} />
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.01, SITE.riverZ + SITE.riverWidth / 2 + 12]}
        receiveShadow
        material={grassMat(COLORS.grassDeep, 140, 24)}
      >
        <planeGeometry args={[140, 24]} />
      </mesh>
      <Bottles z={SITE.riverZ} />
      {BUILDINGS.map((b) => (
        <RoomShell key={b.id} b={b} />
      ))}
      {trees.map((t, i) => (
        <Tree key={i} t={t} />
      ))}
      <Garden />
      <Crew />
    </group>
  );
}

export { toWorld };
