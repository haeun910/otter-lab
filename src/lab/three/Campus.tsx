"use client";
import { RoundedBox } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { BUILDINGS, COLORS, ROOM, SITE, byId, toWorld, type Building, type RoomObject, type Side } from "../data/buildings";
import { useLab } from "../store";
import Crew from "./Crew";
import Furniture, { FOOTPRINT, Plant } from "./Furniture";
import { Anchor } from "./labels";
import { fabricMat, floor, glass, lawnMat, metal, pbr, plasterMat, sandMat, wood, type FloorKind } from "./materials";
import { Bottles, Foliage, Forest, River, Rocks, Wind, rng, type Blob, type TreeSpot } from "./Nature";

import { WALL_H, WALL_T, wallPieces } from "./walls";

/** 방마다 바닥재: 나무 마루 · 짙은 원목 · 카펫 · 돌 타일 */
const FLOORS: Record<string, [FloorKind, string]> = {
  library: ["walnut", "#9b7556"],
  stats: ["oak", "#d2b08a"],
  dorm: ["carpet", "#c9bca8"],
  cards: ["oak", "#dcc09c"],
  meeting: ["oak", "#c49b72"],
  office: ["walnut", "#8e6a4c"],
  receiver: ["oak", "#d6b48e"],
  lobby: ["stone", "#e0dbd2"],
  blog: ["oak", "#caa27a"],
};

const WALL = "#efebe4"; // 흰 회벽
/** 방 대표 색을 실제 페인트처럼 차분하게 */
const muted = (c: string, k = 0.5) => `#${new THREE.Color(c).lerp(new THREE.Color("#d8d2c8"), k).getHexString()}`;

function Walls({ b }: { b: Building }) {
  const accent = muted(b.roof, 0.45);
  return (
    <group>
      {(["n", "s", "e", "w"] as Side[]).flatMap((side) =>
        wallPieces(side, b.doors.includes(side)).map((p, i) => {
          const h = WALL_H[side];
          const long = Math.max(p.w, p.d);
          return (
            <group key={`${side}${i}`}>
              <mesh position={[p.x, h / 2, p.z]} castShadow receiveShadow material={plasterMat(WALL, long / 2, h / 2)}>
                <boxGeometry args={[p.w, h, p.d]} />
              </mesh>
              {/* 걸레받이 */}
              <mesh position={[p.x, 0.05, p.z]} receiveShadow material={pbr("#f7f5f0", 0.5)}>
                <boxGeometry args={[p.w + (p.w > p.d ? 0 : 0.03), 0.1, p.d + (p.d > p.w ? 0 : 0.03)]} />
              </mesh>
            </group>
          );
        }),
      )}
      {/* 뒷벽 안쪽은 방 색 페인트 */}
      {!b.doors.includes("n") && (
        <mesh position={[0, WALL_H.n / 2 + 0.05, -ROOM.d / 2 + WALL_T / 2 + 0.006]} receiveShadow material={plasterMat(accent, 3, 1)}>
          <planeGeometry args={[ROOM.w - WALL_T, WALL_H.n - 0.1]} />
        </mesh>
      )}
      {/* 뒷벽 창문 */}
      {!b.doors.includes("n") &&
        [-1.8, 1.8].map((x) => (
          <group key={x} position={[x, 1.15, -ROOM.d / 2 + WALL_T / 2 + 0.02]}>
            <mesh material={metal("#3b3d40", 0.5)}>
              <boxGeometry args={[1.12, 0.78, 0.05]} />
            </mesh>
            <mesh position={[0, 0, 0.028]} material={glass()}>
              <planeGeometry args={[1.0, 0.66]} />
            </mesh>
            <mesh position={[0, 0, 0.03]} material={metal("#3b3d40", 0.5)}>
              <boxGeometry args={[0.03, 0.66, 0.02]} />
            </mesh>
            {/* 창틀 아래 선반 */}
            <mesh position={[0, -0.42, 0.06]} castShadow material={pbr("#f4f2ee", 0.4)}>
              <boxGeometry args={[1.25, 0.04, 0.14]} />
            </mesh>
          </group>
        ))}
    </group>
  );
}

function Interactable({ b, o }: { b: Building; o: RoomObject }) {
  const hover = useLab((s) => s.hover === `o-${o.id}`);
  const inRoom = useLab((s) => s.scene === b.id && !s.focus);
  const ref = useRef<THREE.Group>(null);
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dt) => {
    if (!ref.current) return;
    const s = hover && inRoom ? 1.03 : 1;
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
        <Furniture kind={o.furniture} ui={o.panel === "inbox" ? "news" : "cards"} />
        {o.furniture !== "roundTable" && (
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, f.d / 2 + 0.45]}>
            <ringGeometry args={[0.3, 0.36, 40]} />
            <meshBasicMaterial color={hover ? "#ffffff" : "#e9f6f0"} transparent opacity={hover ? 0.95 : 0.55} toneMapped={false} />
          </mesh>
        )}
      </group>
      <Anchor id={`obj-${o.id}`} position={[0, top, 0]} />
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
    <group position={[-2.3, 1.45, -ROOM.d / 2 + 0.14]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} material={pbr("#fbfbf8", 0.3)}>
        <cylinderGeometry args={[0.36, 0.36, 0.04, 40]} />
      </mesh>
      <mesh material={metal("#2b2b2b", 0.4)}>
        <torusGeometry args={[0.37, 0.03, 10, 40]} />
      </mesh>
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.sin(a) * 0.3, Math.cos(a) * 0.3, 0.025]} rotation={[0, 0, -a]} material={pbr("#2b2b2b", 0.5)}>
            <boxGeometry args={[0.015, i % 3 ? 0.03 : 0.06, 0.005]} />
          </mesh>
        );
      })}
      <group position={[0, 0, 0.035]}>
        <mesh ref={hour} material={pbr("#1f1f1f", 0.5)}>
          <boxGeometry args={[0.025, 0.36, 0.01]} />
        </mesh>
        <mesh ref={min} material={pbr("#1f1f1f", 0.5)}>
          <boxGeometry args={[0.018, 0.52, 0.01]} />
        </mesh>
      </group>
    </group>
  );
}

function LobbyDeco() {
  return (
    <group>
      <WallClock />
      {/* 현관 매트 */}
      <RoundedBox args={[2, 0.02, 1]} radius={0.01} position={[0, 0.02, ROOM.d / 2 - 0.7]} receiveShadow material={fabricMat("#4a4a48", 4)} />
      {/* 안내판 */}
      <group position={[-2.2, 0, 0.6]}>
        <mesh castShadow position={[0, 0.7, 0]} material={metal("#2f3133", 0.4)}>
          <cylinderGeometry args={[0.03, 0.03, 1.4, 10]} />
        </mesh>
        <mesh position={[0, 0.02, 0]} material={metal("#2f3133", 0.4)}>
          <cylinderGeometry args={[0.22, 0.22, 0.03, 20]} />
        </mesh>
        <RoundedBox args={[1.4, 0.55, 0.05]} radius={0.02} position={[0, 1.45, 0]} castShadow material={wood("#b48a62")} />
        <mesh position={[0, 1.45, 0.03]} material={pbr("#f5f1e8", 0.6)}>
          <planeGeometry args={[1.22, 0.38]} />
        </mesh>
      </group>
      {/* 벤치 */}
      <group position={[2.1, 0, -1.6]}>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} castShadow receiveShadow position={[0, 0.45, -0.18 + i * 0.12]} material={wood("#b48a62")}>
            <boxGeometry args={[1.8, 0.04, 0.1]} />
          </mesh>
        ))}
        {[-0.75, 0.75].map((x) => (
          <mesh key={x} castShadow position={[x, 0.22, 0]} material={metal("#2f3133", 0.45)}>
            <boxGeometry args={[0.05, 0.44, 0.44]} />
          </mesh>
        ))}
      </group>
      <Plant x={-2.9} z={-2.1} />
      <Plant x={2.9} z={1.9} />
    </group>
  );
}

function DockDeck() {
  const { w, d } = ROOM;
  return (
    <group>
      {Array.from({ length: 14 }).map((_, i) => (
        <mesh key={i} receiveShadow castShadow position={[-w / 2 + (i + 0.5) * (w / 14), -0.06, 0]} material={wood(i % 3 ? "#9c7a58" : "#8d6c4c", 2)}>
          <boxGeometry args={[w / 14 - 0.03, 0.08, d]} />
        </mesh>
      ))}
      {/* 기둥 */}
      {[-1, 0, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} castShadow position={[(sx * w) / 2, -0.2, (sz * d) / 2]} material={wood("#6e543c")}>
            <cylinderGeometry args={[0.1, 0.11, 1.2, 10]} />
          </mesh>
        )),
      )}
      {/* 밧줄 난간 */}
      {[-1, 1].map((sz) => (
        <mesh key={sz} position={[0, 0.32, (sz * d) / 2]} rotation={[0, 0, Math.PI / 2]} material={pbr("#cbb994", 0.9)}>
          <cylinderGeometry args={[0.02, 0.02, w, 6]} />
        </mesh>
      ))}
      {/* 구명튜브 */}
      <mesh position={[w / 2 - 0.4, 0.45, -d / 2 + 0.15]} rotation={[0, 0.4, 0]} castShadow material={pbr("#e2563f", 0.55)}>
        <torusGeometry args={[0.28, 0.08, 12, 28]} />
      </mesh>
    </group>
  );
}

function RoomShell({ b }: { b: Building }) {
  const hover = useLab((s) => s.hover === `room-${b.id}`);
  const overview = useLab((s) => s.scene === "overview");
  const { w, d } = ROOM;
  const [fk, fc] = FLOORS[b.id] ?? ["oak", "#d2b08a"];
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
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} receiveShadow material={floor(fk, fc, w, d)}>
            <planeGeometry args={[w, d]} />
          </mesh>
          {!b.deco && b.id !== "meeting" && b.id !== "dorm" && (
            <RoundedBox
              args={[2.6, 0.015, 1.7]}
              radius={0.007}
              position={[0, 0.02, 0.9]}
              receiveShadow
              material={fabricMat(muted(b.id === "office" ? COLORS.butter : b.roof, 0.6), 3)}
            />
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
        <meshBasicMaterial color="#ffffff" transparent opacity={hover && overview ? 0.18 : 0} depthWrite={false} toneMapped={false} />
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

/** 본관 바닥, 둘레 담, 앞마당 길, 강둑 */
function Grounds() {
  const w = SITE.maxX - SITE.minX;
  const d = SITE.maxZ - SITE.minZ;
  const cx = (SITE.maxX + SITE.minX) / 2;
  const cz = (SITE.maxZ + SITE.minZ) / 2;
  const bank = SITE.riverZ - SITE.riverWidth / 2;
  const dock = byId("dock");
  const stones = useMemo(() => {
    const r = rng(4);
    const out: [number, number, number][] = [];
    for (let z = SITE.maxZ + 0.6; z < bank - 0.4; z += 0.8) out.push([(r() - 0.5) * 0.25, z, r()]);
    for (let x = 1; x < dock.pos[0] - ROOM.w / 2; x += 0.85) out.push([x, bank - 0.9 + (r() - 0.5) * 0.2, r()]);
    return out;
  }, [bank, dock]);
  const rocks = useMemo(() => {
    const r = rng(8);
    const out: [number, number, number][] = [];
    for (let x = -45; x < 45; x += 0.7 + r() * 1.6) {
      if (x > dock.pos[0] - ROOM.w / 2 - 0.5 && x < dock.pos[0] + ROOM.w / 2 + 0.5) continue;
      out.push([x, bank + 0.05 + r() * 0.3, 0.18 + r() * 0.3]);
      if (r() > 0.6) out.push([x + 0.3, SITE.riverZ + SITE.riverWidth / 2 - 0.1 - r() * 0.3, 0.2 + r() * 0.35]);
    }
    return out;
  }, [bank, dock]);
  return (
    <group>
      {/* 잔디 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow material={lawnMat(300, 220)}>
        <planeGeometry args={[300, 220]} />
      </mesh>
      {/* 본관 바닥 (콘크리트 기단 위 테라조 복도) */}
      <mesh position={[cx, -0.16, cz]} receiveShadow castShadow material={pbr("#c9c4bb", 0.9)}>
        <boxGeometry args={[w + 0.3, 0.3, d + 0.3]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.002, cz]} receiveShadow material={floor("terrazzo", "#f1ece3", w, d)}>
        <planeGeometry args={[w, d]} />
      </mesh>
      {/* 둘레 담 (앞 가운데는 현관 길) */}
      {[
        [cx, SITE.minZ, w, 0.3],
        [SITE.minX, cz, 0.3, d],
        [SITE.maxX, cz, 0.3, d],
        [(SITE.minX - 0.9) / 2, SITE.maxZ, -0.9 - SITE.minX, 0.3],
        [(SITE.maxX + 0.9) / 2, SITE.maxZ, SITE.maxX - 0.9, 0.3],
      ].map(([x, z, ww, dd], i) => (
        <mesh key={i} position={[x, 0.22, z]} castShadow receiveShadow material={plasterMat("#e6e1d8", Math.max(ww, dd) / 2, 0.3)}>
          <boxGeometry args={[ww, 0.44, dd]} />
        </mesh>
      ))}
      {/* 강둑 모래 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.004, bank - 0.45]} receiveShadow material={sandMat("#d8c9a8", 160, 1.6)}>
        <planeGeometry args={[160, 1.6]} />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.004, SITE.riverZ + SITE.riverWidth / 2 + 0.4]}
        receiveShadow
        material={sandMat("#cbbd9c", 160, 1.4)}
      >
        <planeGeometry args={[160, 1.4]} />
      </mesh>
      {/* 디딤돌 */}
      {stones.map(([x, z, k], i) => (
        <mesh key={i} position={[x, 0.0, z]} rotation={[0, k * 3, 0]} receiveShadow castShadow material={pbr(k > 0.5 ? "#bdb6aa" : "#aaa397", 0.85)}>
          <cylinderGeometry args={[0.32 + k * 0.05, 0.34 + k * 0.05, 0.06, 9]} />
        </mesh>
      ))}
      <Rocks spots={rocks} />
    </group>
  );
}

function makeTrees(): TreeSpot[] {
  const r = rng(7);
  const out: TreeSpot[] = [];
  const bank = SITE.riverZ - SITE.riverWidth / 2;
  for (let i = 0; i < 260 && out.length < 40; i++) {
    const x = -32 + r() * 64;
    const z = -26 + r() * (bank + 24);
    const inSite = x > SITE.minX - 2.2 && x < SITE.maxX + 2.2 && z > SITE.minZ - 2.4;
    const nearPath = Math.abs(x) < 2.6 && z > SITE.maxZ;
    const nearDock = x > 8 && z > SITE.maxZ - 1;
    const nearBank = z > bank - 2.2;
    if (inSite || nearPath || nearDock || nearBank || out.some((t) => Math.hypot(t.x - x, t.z - z) < 2.6)) continue;
    out.push({ x, z, s: 0.85 + r() * 0.5, kind: r() < 0.25 ? 1 : r() < 0.5 ? 2 : 0 });
  }
  // 강 건너편
  for (let i = 0; i < 10; i++) out.push({ x: -30 + i * 6.5 + r() * 2, z: SITE.riverZ + SITE.riverWidth / 2 + 3 + r() * 4, s: 1 + r() * 0.4, kind: i % 3 });
  return out;
}

/** 담장 밖 산울타리와 잔디밭 들꽃 */
function Garden() {
  const { hedges, flowers } = useMemo(() => {
    const r = rng(23);
    const blobs: Blob[] = [];
    const hedge = (x: number, z: number, s: number) =>
      blobs.push({ x, y: 0.42 * s, z, rx: 0.7 * s, ry: 0.5 * s, rz: 0.6 * s, n: 34, size: 0.32, hue: -0.04 + r() * 0.06 });
    for (let x = SITE.minX + 0.8; x < -2.4; x += 1.1) hedge(x, SITE.maxZ + 0.7, 0.9 + r() * 0.3);
    for (let x = 2.4; x < SITE.maxX - 0.8; x += 1.1) hedge(x, SITE.maxZ + 0.7, 0.9 + r() * 0.3);
    for (let z = SITE.minZ + 0.8; z < SITE.maxZ; z += 1.2) {
      hedge(SITE.minX - 0.75, z, 0.85 + r() * 0.35);
      hedge(SITE.maxX + 0.75, z, 0.85 + r() * 0.35);
    }
    const bank = SITE.riverZ - SITE.riverWidth / 2;
    const fl: [number, number, string][] = [];
    const PETALS = ["#f4f1ea", "#f4f1ea", "#e9c7cf", "#efd27a", "#c9bde3"];
    for (let i = 0; i < 400 && fl.length < 120; i++) {
      const x = -28 + r() * 56;
      const z = SITE.minZ - 10 + r() * (bank - SITE.minZ + 9);
      const inSite = x > SITE.minX - 1.6 && x < SITE.maxX + 1.6 && z > SITE.minZ - 1.6 && z < SITE.maxZ + 1.6;
      if (inSite || (Math.abs(x) < 1.6 && z > SITE.maxZ) || z > bank - 1.4) continue;
      const c = PETALS[Math.floor(r() * PETALS.length)];
      for (let k = 0; k < 4; k++) fl.push([x + (r() - 0.5) * 0.8, z + (r() - 0.5) * 0.6, c]);
    }
    return { hedges: blobs, flowers: fl };
  }, []);
  return (
    <group>
      <Foliage blobs={hedges} seed={29} />
      {flowers.map(([x, z, c], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.09, 0]} material={pbr("#4f6b35", 0.8)}>
            <cylinderGeometry args={[0.008, 0.01, 0.18, 4]} />
          </mesh>
          <mesh position={[0, 0.19, 0]} scale={[1, 0.45, 1]} material={pbr(c, 0.7)}>
            <sphereGeometry args={[0.055, 8, 6]} />
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
      <Wind />
      <Grounds />
      <River z={SITE.riverZ} width={SITE.riverWidth} />
      <Bottles z={SITE.riverZ} />
      {BUILDINGS.map((b) => (
        <RoomShell key={b.id} b={b} />
      ))}
      <Forest trees={trees} />
      <Garden />
      <Crew />
    </group>
  );
}

export { toWorld };
