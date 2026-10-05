"use client";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { COLORS } from "../data/buildings";
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

export function River({ z, width }: { z: number; width: number }) {
  const mat = useMemo(
    () => new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 } }, vertexShader: riverVert, fragmentShader: riverFrag }),
    [],
  );
  useFrame(({ clock }) => {
    mat.uniforms.uTime.value = clock.elapsedTime;
  });
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0, z]} material={mat}>
      <planeGeometry args={[140, width, 1, 1]} />
    </mesh>
  );
}

/** 강을 따라 떠내려오는 소식 병 */
export function Bottles({ z }: { z: number }) {
  const say = useLab((s) => s.say);
  const items = useMemo(
    () =>
      Array.from({ length: 7 }).map((_, i) => ({
        offset: i / 7,
        lane: z + (i % 3 - 1) * 1.1,
        color: [COLORS.sky, COLORS.mint, COLORS.coral, COLORS.butter][i % 4],
      })),
    [z],
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
