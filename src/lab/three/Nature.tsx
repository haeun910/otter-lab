"use client";
import { RoundedBox } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { BUILDINGS, COLORS, MAP, doorPoint } from "../data/buildings";
import { useLab } from "../store";
import { toyMat } from "./Otter";

export function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface TreeSpot {
  x: number;
  z: number;
  s: number;
  kind: number;
}

/** 나무 자리: 지도 가장자리를 둘러싸고, 건물과 길을 피해 듬성듬성 */
export function makeTrees(): TreeSpot[] {
  const r = rng(7);
  const spots: TreeSpot[] = [];
  const near = (x: number, z: number, pad: number) =>
    BUILDINGS.some((b) => Math.hypot(x - b.pos[0], z - b.pos[1]) < Math.max(b.size[0], b.size[1]) / 2 + pad) ||
    BUILDINGS.some((b) => {
      const [dx, dz] = doorPoint(b, 1.6);
      return Math.hypot(x - dx, z - dz) < 2.2;
    }) ||
    Math.hypot(x, z + 2.5) < 4.6 || // 광장
    spots.some((t) => Math.hypot(x - t.x, z - t.z) < 1.5);
  // 뒤쪽과 양옆 가장자리
  for (let i = 0; i < 70 && spots.length < 34; i++) {
    const side = r();
    let x: number;
    let z: number;
    if (side < 0.5) {
      x = MAP.minX + r() * (MAP.maxX - MAP.minX);
      z = MAP.minZ - 0.5 + r() * 2.6;
    } else if (side < 0.75) {
      x = MAP.minX - 0.6 + r() * 2.4;
      z = MAP.minZ + r() * (MAP.maxZ - MAP.minZ - 2);
    } else {
      x = MAP.maxX - 1.8 + r() * 2.4;
      z = MAP.minZ + r() * (MAP.maxZ - MAP.minZ - 2);
    }
    if (!near(x, z, 1.4)) spots.push({ x, z, s: 0.8 + r() * 0.5, kind: Math.floor(r() * 3) });
  }
  // 안쪽에 몇 그루
  for (let i = 0; i < 80 && spots.length < 46; i++) {
    const x = MAP.minX + 2 + r() * (MAP.maxX - MAP.minX - 4);
    const z = MAP.minZ + 2 + r() * (MAP.maxZ - MAP.minZ - 4.5);
    if (!near(x, z, 2.2)) spots.push({ x, z, s: 0.65 + r() * 0.35, kind: Math.floor(r() * 3) });
  }
  return spots;
}

export function Tree({ t }: { t: TreeSpot }) {
  const leaf = [COLORS.leaf, "#8FD39B", COLORS.leafDeep][t.kind];
  return (
    <group position={[t.x, 0, t.z]} scale={t.s}>
      <mesh castShadow position={[0, 0.55, 0]} material={toyMat(COLORS.woodDark)}>
        <cylinderGeometry args={[0.16, 0.22, 1.1, 8]} />
      </mesh>
      {t.kind === 1 ? (
        <>
          <mesh castShadow position={[0, 1.55, 0]} material={toyMat(leaf)}>
            <coneGeometry args={[0.95, 1.4, 10]} />
          </mesh>
          <mesh castShadow position={[0, 2.25, 0]} material={toyMat(leaf)}>
            <coneGeometry args={[0.7, 1.1, 10]} />
          </mesh>
        </>
      ) : (
        <>
          <mesh castShadow position={[0, 1.65, 0]} material={toyMat(leaf)}>
            <sphereGeometry args={[0.85, 18, 14]} />
          </mesh>
          <mesh castShadow position={[0.45, 1.35, 0.2]} material={toyMat(leaf)}>
            <sphereGeometry args={[0.55, 16, 12]} />
          </mesh>
          <mesh castShadow position={[-0.35, 2.1, -0.1]} material={toyMat(leaf)}>
            <sphereGeometry args={[0.5, 16, 12]} />
          </mesh>
        </>
      )}
    </group>
  );
}

function Flowers() {
  const items = useMemo(() => {
    const r = rng(21);
    const out: { x: number; z: number; c: string }[] = [];
    for (let i = 0; i < 60; i++) {
      const x = MAP.minX + 1 + r() * (MAP.maxX - MAP.minX - 2);
      const z = MAP.minZ + 1 + r() * (MAP.maxZ - MAP.minZ - 1.5);
      if (BUILDINGS.some((b) => Math.hypot(x - b.pos[0], z - b.pos[1]) < 3.4)) continue;
      out.push({ x, z, c: [COLORS.coral, "#FFFFFF", COLORS.butter, "#C9B8FF"][i % 4] });
    }
    return out;
  }, []);
  return (
    <group>
      {items.map((f, i) => (
        <group key={i} position={[f.x, 0, f.z]}>
          <mesh position={[0, 0.12, 0]} material={toyMat(COLORS.leafDeep)}>
            <cylinderGeometry args={[0.015, 0.015, 0.24, 4]} />
          </mesh>
          <mesh position={[0, 0.26, 0]} material={toyMat(f.c)}>
            <sphereGeometry args={[0.07, 8, 6]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

const riverVert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const riverFrag = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    vec3 deep = vec3(0.42, 0.74, 0.93);
    vec3 light = vec3(0.66, 0.88, 0.98);
    float edge = smoothstep(0.0, 0.18, vUv.y) * smoothstep(1.0, 0.82, vUv.y);
    float w = sin(vUv.x * 120.0 - uTime * 2.2 + sin(vUv.y * 9.0) * 1.6) * 0.5 + 0.5;
    float stripe = smoothstep(0.86, 0.98, w) * 0.55 * edge;
    vec3 col = mix(light, deep, edge * 0.7) + stripe * 0.35;
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

function River() {
  const mat = useMemo(
    () => new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 } }, vertexShader: riverVert, fragmentShader: riverFrag }),
    [],
  );
  useFrame(({ clock }) => {
    mat.uniforms.uTime.value = clock.elapsedTime;
  });
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, MAP.riverZ]} material={mat}>
      <planeGeometry args={[90, MAP.riverWidth, 1, 1]} />
    </mesh>
  );
}

function Bridge() {
  const z0 = MAP.riverZ - MAP.riverWidth / 2 - 0.6;
  const len = MAP.riverWidth + 1.2;
  return (
    <group position={[0, 0, z0 + len / 2]}>
      {Array.from({ length: 12 }).map((_, i) => {
        const t = i / 11;
        const y = 0.28 + Math.sin(t * Math.PI) * 0.55;
        return (
          <mesh key={i} castShadow receiveShadow position={[0, y, -len / 2 + t * len]} rotation={[Math.cos(t * Math.PI) * -0.3, 0, 0]} material={toyMat(i % 2 ? COLORS.wood : "#E2B88A")}>
            <boxGeometry args={[2, 0.14, 0.5]} />
          </mesh>
        );
      })}
      {[-1, 1].map((s) =>
        [0, 0.33, 0.66, 1].map((t) => (
          <mesh key={`${s}${t}`} position={[s * 1.02, 0.65 + Math.sin(t * Math.PI) * 0.55, -len / 2 + t * len]} material={toyMat(COLORS.coral)}>
            <sphereGeometry args={[0.1, 10, 8]} />
          </mesh>
        )),
      )}
    </group>
  );
}

/** 강을 따라 떠내려오는 소식 병 */
function Bottles() {
  const say = useLab((s) => s.say);
  const items = useMemo(
    () =>
      Array.from({ length: 7 }).map((_, i) => ({
        offset: i / 7,
        lane: MAP.riverZ + (i % 3 - 1) * 1.1,
        color: [COLORS.sky, COLORS.mint, COLORS.coral, COLORS.butter][i % 4],
      })),
    [],
  );
  const refs = useRef<(THREE.Group | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    items.forEach((it, i) => {
      const g = refs.current[i];
      if (!g) return;
      const p = (it.offset + t * 0.012) % 1;
      g.position.set(-40 + p * 80, 0.12 + Math.sin(t * 2 + i) * 0.05, it.lane + Math.sin(t * 0.6 + i) * 0.2);
      g.rotation.set(Math.sin(t * 1.4 + i) * 0.2, i, Math.PI / 2 + Math.sin(t + i) * 0.15);
    });
  });
  const click = (e: ThreeEvent<MouseEvent>, i: number) => {
    e.stopPropagation();
    if (e.delta > 8) return;
    // 가장 최근에 받은 소식 중 하나를 건져요
    const { inbox, library } = useLab.getState();
    const link = inbox[(i * 3) % Math.max(1, inbox.length)];
    const news = library.find((n) => n.link === link) ?? library[0];
    if (news) say(`떠내려온 소식: ${news.title}`);
  };
  return (
    <group>
      {items.map((it, i) => (
        <group
          key={i}
          ref={(g) => (refs.current[i] = g)}
          onClick={(e) => click(e, i)}
          onPointerOver={() => (document.body.style.cursor = "pointer")}
          onPointerOut={() => (document.body.style.cursor = "")}
        >
          <mesh castShadow material={toyMat("#DDF5FF", 0.2)}>
            <capsuleGeometry args={[0.16, 0.34, 6, 12]} />
          </mesh>
          <mesh position={[0, 0.34, 0]} material={toyMat(COLORS.woodDark)}>
            <cylinderGeometry args={[0.07, 0.08, 0.12, 8]} />
          </mesh>
          <mesh position={[0, 0, 0]} material={toyMat(it.color)}>
            <boxGeometry args={[0.2, 0.22, 0.2]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Reeds() {
  const items = useMemo(() => {
    const r = rng(3);
    return Array.from({ length: 40 }).map(() => ({
      x: MAP.minX + r() * (MAP.maxX - MAP.minX),
      z: MAP.maxZ + 0.2 + r() * 0.5,
      h: 0.5 + r() * 0.5,
    }));
  }, []).filter((r) => Math.abs(r.x) > 1.6 && Math.abs(r.x - 14.4) > 1.4);
  return (
    <group>
      {items.map((it, i) => (
        <group key={i} position={[it.x, 0, it.z]}>
          <mesh position={[0, it.h / 2, 0]} material={toyMat(COLORS.leafDeep)}>
            <cylinderGeometry args={[0.025, 0.03, it.h, 4]} />
          </mesh>
          <mesh position={[0, it.h, 0]} material={toyMat(COLORS.woodDark)}>
            <capsuleGeometry args={[0.045, 0.14, 4, 6]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Rocks() {
  const items = useMemo(() => {
    const r = rng(11);
    return Array.from({ length: 16 }).map(() => ({
      x: MAP.minX + r() * (MAP.maxX - MAP.minX),
      z: MAP.maxZ + 0.1 + r() * 0.6,
      s: 0.2 + r() * 0.3,
    }));
  }, []);
  return (
    <group>
      {items.map((it, i) => (
        <mesh key={i} castShadow position={[it.x, it.s * 0.4, it.z]} scale={[it.s * 1.4, it.s, it.s * 1.1]} material={toyMat(COLORS.stone)}>
          <sphereGeometry args={[1, 10, 8]} />
        </mesh>
      ))}
    </group>
  );
}

function Plaza() {
  return (
    <group position={[0, 0, -2.5]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} receiveShadow material={toyMat("#F4E7D2")}>
        <circleGeometry args={[3.6, 40]} />
      </mesh>
      {Array.from({ length: 14 }).map((_, i) => {
        const a = (i / 14) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 3.6, 0.05, Math.sin(a) * 3.6]} rotation={[-Math.PI / 2, 0, a]} material={toyMat(COLORS.stone)}>
            <circleGeometry args={[0.35, 12]} />
          </mesh>
        );
      })}
      {/* 이정표 */}
      <group position={[0, 0, 0]}>
        <mesh castShadow position={[0, 0.9, 0]} material={toyMat(COLORS.woodDark)}>
          <cylinderGeometry args={[0.08, 0.1, 1.8, 8]} />
        </mesh>
        {[
          [0.5, 1.5, 0.3, COLORS.sky],
          [-0.5, 1.2, -0.4, COLORS.mint],
          [0.45, 0.9, 2.6, COLORS.coral],
        ].map(([x, y, r, c], i) => (
          <RoundedBox key={i} args={[1, 0.24, 0.06]} radius={0.04} position={[x as number, y as number, 0]} rotation={[0, r as number, 0]} castShadow material={toyMat(c as string)} />
        ))}
      </group>
    </group>
  );
}

/** 길: 광장에서 각 건물 문 앞까지 이어진 디딤돌 */
function Paths() {
  const stones = useMemo(() => {
    const out: { x: number; z: number; r: number }[] = [];
    const r = rng(5);
    for (const b of BUILDINGS) {
      const [dx, dz] = doorPoint(b, 0.7);
      const sx = 0;
      const sz = -2.5;
      const len = Math.hypot(dx - sx, dz - sz);
      const n = Math.floor(len / 0.9);
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const x = sx + (dx - sx) * t;
        const z = sz + (dz - sz) * t;
        if (Math.hypot(x, z + 2.5) < 3.7) continue;
        out.push({ x: x + (r() - 0.5) * 0.25, z: z + (r() - 0.5) * 0.25, r: 0.28 + r() * 0.08 });
      }
    }
    return out;
  }, []);
  return (
    <group>
      {stones.map((s, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[s.x, 0.035, s.z]} receiveShadow material={toyMat("#F1E4CF")}>
          <circleGeometry args={[s.r, 10]} />
        </mesh>
      ))}
    </group>
  );
}

export default function Nature({ onGround, trees }: { onGround: (e: ThreeEvent<MouseEvent>) => void; trees: TreeSpot[] }) {
  return (
    <group>
      {/* 땅 (이쪽 강둑) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, (MAP.minZ + MAP.maxZ) / 2 - 6]} receiveShadow onClick={onGround}>
        <planeGeometry args={[90, MAP.maxZ - MAP.minZ + 20]} />
        <meshStandardMaterial color={COLORS.grass} roughness={1} />
      </mesh>
      {/* 모래 강둑 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, MAP.maxZ + 0.35]} receiveShadow>
        <planeGeometry args={[90, 1]} />
        <meshStandardMaterial color="#F3E3C3" roughness={1} />
      </mesh>
      <River />
      {/* 건너편 강둑 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, MAP.riverZ + MAP.riverWidth / 2 + 10]} receiveShadow>
        <planeGeometry args={[90, 20]} />
        <meshStandardMaterial color={COLORS.grassDeep} roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, MAP.riverZ + MAP.riverWidth / 2 + 0.3]} receiveShadow>
        <planeGeometry args={[90, 0.8]} />
        <meshStandardMaterial color="#F3E3C3" roughness={1} />
      </mesh>
      {[-14, -7, 6, 12, 19].map((x, i) => (
        <Tree key={i} t={{ x, z: MAP.riverZ + MAP.riverWidth / 2 + 2 + (i % 2) * 1.5, s: 1.1, kind: i % 3 }} />
      ))}
      <Plaza />
      <Paths />
      <Bridge />
      <Bottles />
      <Reeds />
      <Rocks />
      <Flowers />
      {trees.map((t, i) => (
        <Tree key={i} t={t} />
      ))}
    </group>
  );
}
