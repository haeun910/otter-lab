"use client";
// 강가의 자연: 잎이 하나하나 달린 나무와 덤불, 반짝이는 강물, 떠내려오는 소식 병
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { COLORS } from "../data/buildings";
import { useLab } from "../store";
import { barkMat, glass, pbr, ripples, wood } from "./materials";

export function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- 잎 ----------

/** 잎 몇 장이 모인 작은 가지 그림 (투명 배경) */
let leafTex: THREE.CanvasTexture | null = null;
function leafTexture() {
  if (leafTex) return leafTex;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const r = rng(3);
  const leaf = (x: number, y: number, len: number, ang: number) => {
    g.save();
    g.translate(x, y);
    g.rotate(ang);
    const w = len * 0.42;
    const grad = g.createLinearGradient(0, -w, 0, w);
    const tone = 0.85 + r() * 0.3;
    const col = (a: number, b: number, cc: number) => `rgb(${Math.round(a * tone)},${Math.round(b * tone)},${Math.round(cc * tone)})`;
    grad.addColorStop(0, col(96, 142, 62));
    grad.addColorStop(0.5, col(122, 168, 78));
    grad.addColorStop(1, col(70, 112, 48));
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(len * 0.45, -w, len, 0);
    g.quadraticCurveTo(len * 0.45, w, 0, 0);
    g.fill();
    // 잎맥
    g.strokeStyle = "rgba(210,230,170,0.45)";
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(len * 0.05, 0);
    g.lineTo(len * 0.92, 0);
    g.stroke();
    g.restore();
  };
  // 가운데 잔가지에서 사방으로
  g.strokeStyle = "#5a4630";
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(128, 250);
  g.lineTo(128, 70);
  g.stroke();
  for (let i = 0; i < 11; i++) {
    const y = 230 - i * 16;
    const side = i % 2 ? 1 : -1;
    leaf(128, y, 62 + r() * 30, -Math.PI / 2 + side * (0.6 + r() * 0.5));
  }
  leaf(128, 74, 70, -Math.PI / 2);
  leafTex = new THREE.CanvasTexture(c);
  leafTex.colorSpace = THREE.SRGBColorSpace;
  leafTex.anisotropy = 4;
  return leafTex;
}

const windUniform = { value: 0 };

/** 잎 재질: 잎마다 덩어리 바깥쪽을 향하는 법선을 써서, 나무 전체가 둥글게 빛을 받아요 */
let leafMaterial: THREE.MeshStandardMaterial | null = null;
function leafMat() {
  if (leafMaterial) return leafMaterial;
  const m = new THREE.MeshStandardMaterial({
    map: leafTexture(),
    alphaTest: 0.45,
    side: THREE.DoubleSide,
    roughness: 0.75,
    emissive: new THREE.Color("#1d2c10"),
    emissiveIntensity: 0.35,
  });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uWind = windUniform;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec3 aNormal;\nuniform float uWind;")
      .replace("#include <defaultnormal_vertex>", "#include <defaultnormal_vertex>\ntransformedNormal = normalize(normalMatrix * aNormal);")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 ip = instanceMatrix[3].xyz;
          float sway = sin(uWind * 1.3 + ip.x * 0.7 + ip.z * 0.5) * 0.03 + sin(uWind * 2.9 + ip.y * 3.0) * 0.012;
          transformed.x += sway * (position.y + 0.5);
          transformed.z += sway * 0.6 * (position.y + 0.5);
        #endif`,
      );
    sh.fragmentShader = sh.fragmentShader.replace(
      "#include <normal_fragment_begin>",
      THREE.ShaderChunk.normal_fragment_begin.replace("normal *= faceDirection;", ""),
    );
  };
  leafMaterial = m;
  return m;
}

/** 잎 덩어리 (타원체). 잎은 겉면 쪽에 많이 달려요 */
export interface Blob {
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
  n: number; // 잎 수
  size: number; // 잎 가지 크기 (m)
  hue?: number; // 0이면 기본, ±로 노랗게·짙게
}

const LEAF_GEO = new THREE.PlaneGeometry(1, 1);

/** 잎 덩어리 여러 개를 한 번에 그려요 */
export function Foliage({ blobs, seed = 1, castShadow = true }: { blobs: Blob[]; seed?: number; castShadow?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = blobs.reduce((s, b) => s + b.n, 0);
  const normals = useMemo(() => new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3), [count]);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const r = rng(seed);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    const n = new THREE.Vector3();
    const col = new THREE.Color();
    let i = 0;
    for (const b of blobs) {
      for (let k = 0; k < b.n; k++) {
        // 겉면 쪽으로 몰린 점
        const u = r() * 2 - 1;
        const th = r() * Math.PI * 2;
        const rad = 0.55 + Math.pow(r(), 0.5) * 0.45;
        const sx = Math.sqrt(1 - u * u) * Math.cos(th);
        const sz = Math.sqrt(1 - u * u) * Math.sin(th);
        p.set(b.x + sx * b.rx * rad, b.y + u * b.ry * rad, b.z + sz * b.rz * rad);
        n.set(sx / b.rx, u / b.ry + 0.35, sz / b.rz).normalize();
        e.set(r() * Math.PI, r() * Math.PI * 2, r() * Math.PI);
        q.setFromEuler(e);
        const sc = b.size * (0.7 + r() * 0.6);
        s.set(sc, sc, sc);
        m.compose(p, q, s);
        mesh.setMatrixAt(i, m);
        normals.setXYZ(i, n.x, n.y, n.z);
        // 위쪽 잎은 햇빛에 바래서 조금 밝고 노랗게
        const hue = (b.hue ?? 0) + (r() - 0.5) * 0.08;
        const light = 0.85 + r() * 0.3 + u * 0.08;
        col.setRGB(light * (1 + hue * 0.6), light, light * (1 - hue * 0.8));
        mesh.setColorAt(i, col);
        i++;
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [blobs, seed, normals]);
  const geo = useMemo(() => {
    const g = LEAF_GEO.clone();
    g.setAttribute("aNormal", normals);
    return g;
  }, [normals]);
  return <instancedMesh ref={ref} args={[geo, leafMat(), count]} castShadow={castShadow} receiveShadow frustumCulled={false} />;
}

export function Wind() {
  useFrame(({ clock }) => {
    windUniform.value = clock.elapsedTime;
  });
  return null;
}

// ---------- 나무 ----------
export interface TreeSpot {
  x: number;
  z: number;
  s: number;
  kind: number;
}

/** 나무 한 그루의 줄기와 잎 덩어리 */
export function treeParts(t: TreeSpot, seed: number) {
  const r = rng(seed);
  const s = t.s;
  const blobs: Blob[] = [];
  if (t.kind === 1) {
    // 키 큰 포플러: 좁고 길쭉해요
    const h = 4.2 * s;
    for (let i = 0; i < 4; i++)
      blobs.push({
        x: t.x + (r() - 0.5) * 0.4 * s,
        y: 1.6 * s + i * 0.75 * s,
        z: t.z + (r() - 0.5) * 0.4 * s,
        rx: 0.75 * s * (1 - i * 0.12),
        ry: 0.9 * s,
        rz: 0.75 * s * (1 - i * 0.12),
        n: 70,
        size: 0.42 * s,
        hue: -0.05,
      });
    return { trunkH: h * 0.55, trunkR: 0.11 * s, blobs };
  }
  // 넓은 활엽수: 둥근 덩어리 여러 개
  const crownY = 2.3 * s;
  blobs.push({ x: t.x, y: crownY, z: t.z, rx: 1.35 * s, ry: 1.05 * s, rz: 1.35 * s, n: 150, size: 0.5 * s, hue: t.kind === 2 ? -0.08 : 0.02 });
  const lobes = 3 + Math.floor(r() * 3);
  for (let i = 0; i < lobes; i++) {
    const a = (i / lobes) * Math.PI * 2 + r();
    blobs.push({
      x: t.x + Math.cos(a) * 0.95 * s,
      y: crownY - 0.2 * s + r() * 0.7 * s,
      z: t.z + Math.sin(a) * 0.95 * s,
      rx: 0.8 * s,
      ry: 0.7 * s,
      rz: 0.8 * s,
      n: 60,
      size: 0.46 * s,
      hue: t.kind === 2 ? -0.08 : 0.04,
    });
  }
  return { trunkH: crownY, trunkR: 0.15 * s, blobs };
}

export function Trunk({ t, h, rad }: { t: TreeSpot; h: number; rad: number }) {
  return (
    <group position={[t.x, 0, t.z]}>
      <mesh castShadow receiveShadow position={[0, h / 2, 0]} material={barkMat("#7a6650")}>
        <cylinderGeometry args={[rad * 0.65, rad * 1.25, h, 10, 4]} />
      </mesh>
      {/* 굵은 가지 두어 개 */}
      {[0.6, 2.4].map((a, i) => (
        <mesh
          key={i}
          castShadow
          position={[Math.cos(a) * 0.35 * t.s, h * (0.72 + i * 0.1), Math.sin(a) * 0.35 * t.s]}
          rotation={[Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7]}
          material={barkMat("#7a6650")}
        >
          <cylinderGeometry args={[rad * 0.3, rad * 0.5, h * 0.45, 6]} />
        </mesh>
      ))}
    </group>
  );
}

/** 여러 그루를 한꺼번에 (잎은 한 번에 그려요) */
export function Forest({ trees }: { trees: TreeSpot[] }) {
  const parts = useMemo(() => trees.map((t, i) => treeParts(t, i * 13 + 5)), [trees]);
  const blobs = useMemo(() => parts.flatMap((p) => p.blobs), [parts]);
  return (
    <group>
      {trees.map((t, i) => (
        <Trunk key={i} t={t} h={parts[i].trunkH} rad={parts[i].trunkR} />
      ))}
      <Foliage blobs={blobs} seed={17} />
    </group>
  );
}

// ---------- 강 ----------
export function River({ z, width }: { z: number; width: number }) {
  const mat = useMemo(() => {
    const rp = ripples();
    const nm = rp.normalMap.clone();
    nm.repeat.set(28, 4);
    nm.needsUpdate = true;
    return new THREE.MeshPhysicalMaterial({
      color: "#2f5b5e",
      roughness: 0.04,
      metalness: 0,
      normalMap: nm,
      normalScale: new THREE.Vector2(0.35, 0.35),
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      envMapIntensity: 1.3,
    });
  }, []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    mat.normalMap!.offset.set(-t * 0.012, Math.sin(t * 0.15) * 0.01);
  });
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, z]} material={mat} receiveShadow>
        <planeGeometry args={[160, width, 1, 1]} />
      </mesh>
      {/* 물가의 얕은 물빛 */}
      {[-1, 1].map((s) => (
        <mesh key={s} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.008, z + (s * width) / 2 - s * 0.35]}>
          <planeGeometry args={[160, 0.7]} />
          <meshStandardMaterial color="#6f8f7a" transparent opacity={0.35} roughness={0.2} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

/** 강둑의 둥근 돌 */
export function Rocks({ spots }: { spots: [number, number, number][] }) {
  const geo = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(1, 2);
    const p = g.attributes.position;
    const r = rng(9);
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      v.multiplyScalar(0.85 + r() * 0.25);
      p.setXYZ(i, v.x, v.y * 0.55, v.z);
    }
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <group>
      {spots.map(([x, z, s], i) => (
        <mesh
          key={i}
          geometry={geo}
          position={[x, 0, z]}
          scale={s}
          rotation={[0, i * 1.7, 0]}
          castShadow
          receiveShadow
          material={pbr(i % 3 ? "#9a958c" : "#b3ab9e", 0.85)}
        />
      ))}
    </group>
  );
}

/** 강을 따라 떠내려오는 소식 병 */
export function Bottles({ z }: { z: number }) {
  const say = useLab((s) => s.say);
  const items = useMemo(
    () =>
      Array.from({ length: 7 }).map((_, i) => ({
        offset: i / 7,
        lane: z + ((i % 3) - 1) * 1.1,
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
      g.position.set(-40 + p * 80, 0.02 + Math.sin(t * 2 + i) * 0.03, it.lane + Math.sin(t * 0.6 + i) * 0.2);
      g.rotation.set(Math.sin(t * 1.4 + i) * 0.12, i, Math.PI / 2 + Math.sin(t + i) * 0.1);
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
          ref={(g) => {
            refs.current[i] = g;
          }}
          onClick={(e) => click(e, i)}
          onPointerOver={() => (document.body.style.cursor = "pointer")}
          onPointerOut={() => (document.body.style.cursor = "")}
        >
          <mesh castShadow material={glass()}>
            <capsuleGeometry args={[0.13, 0.3, 6, 14]} />
          </mesh>
          <mesh position={[0, 0.29, 0]} material={pbr("#cfe3d9", 0.1)}>
            <cylinderGeometry args={[0.05, 0.08, 0.1, 10]} />
          </mesh>
          <mesh position={[0, 0.36, 0]} material={wood("#a07a52")}>
            <cylinderGeometry args={[0.045, 0.04, 0.07, 8]} />
          </mesh>
          {/* 안에 말아 넣은 편지 */}
          <mesh material={pbr("#efe4cc", 0.8)}>
            <cylinderGeometry args={[0.07, 0.07, 0.26, 10]} />
          </mesh>
          <mesh material={pbr(it.color, 0.7)}>
            <cylinderGeometry args={[0.072, 0.072, 0.04, 10]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
