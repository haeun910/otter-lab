"use client";
// 실제 사무실 가구: 원목 상판에 철제 다리, 얇은 모니터, 사무용 의자, 레이저 프린터…
import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { type Furniture as Kind } from "../data/buildings";
import { barkMat, fabricMat, metal, pbr, wood } from "./materials";
import { Foliage, rng, type Blob } from "./Nature";

const OAK = "#c9a27a";
const WALNUT = "#7b5a42";
const STEEL = "#2c2e31";
const ALU = "#c4c7cb";

// ---------- 화면 속 그림 ----------
type Ui = "cards" | "news" | "blog";
const uiCache = new Map<Ui, THREE.MeshStandardMaterial>();
/** 모니터에 띄운 실제 프로그램 같은 화면 */
function screenMat(kind: Ui) {
  let m = uiCache.get(kind);
  if (m) return m;
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 320;
  const g = c.getContext("2d")!;
  const r = rng(kind.length * 7);
  g.fillStyle = "#f4f5f7";
  g.fillRect(0, 0, 512, 320);
  g.fillStyle = "#23272f";
  g.fillRect(0, 0, 512, 26);
  ["#ff5f57", "#febc2e", "#28c840"].forEach((col, i) => {
    g.fillStyle = col;
    g.beginPath();
    g.arc(14 + i * 16, 13, 5, 0, Math.PI * 2);
    g.fill();
  });
  const lines = (x: number, y: number, w: number, n: number, gap = 14) => {
    for (let i = 0; i < n; i++) {
      g.fillStyle = i === 0 ? "#2b2f36" : "#b9bec7";
      g.fillRect(x, y + i * gap, w * (i === 0 ? 0.7 : 0.6 + r() * 0.4), i === 0 ? 8 : 6);
    }
  };
  if (kind === "cards") {
    // 왼쪽 카드 목록, 가운데 큰 카드 미리보기
    for (let i = 0; i < 5; i++) {
      g.fillStyle = i === 1 ? "#dfe9f7" : "#ffffff";
      g.fillRect(10, 36 + i * 54, 90, 48);
      g.fillStyle = ["#8fb3d9", "#e3a08f", "#a6cbb5", "#e8cf8a", "#b7a7d9"][i];
      g.fillRect(16, 42 + i * 54, 30, 36);
    }
    g.fillStyle = "#ffffff";
    g.fillRect(122, 40, 200, 250);
    g.fillStyle = "#8fb3d9";
    g.fillRect(122, 40, 200, 120);
    g.fillStyle = "#1f2a3a";
    g.fillRect(138, 176, 150, 14);
    g.fillRect(138, 196, 110, 14);
    lines(138, 226, 160, 4, 12);
    lines(340, 44, 150, 12, 20);
  } else if (kind === "news") {
    for (let i = 0; i < 7; i++) {
      g.fillStyle = "#ffffff";
      g.fillRect(12, 36 + i * 40, 488, 34);
      g.fillStyle = ["#e3a08f", "#8fb3d9", "#a6cbb5"][i % 3];
      g.fillRect(18, 42 + i * 40, 22, 22);
      lines(50, 42 + i * 40, 380, 2, 12);
    }
  } else {
    g.fillStyle = "#ffffff";
    g.fillRect(90, 34, 332, 280);
    g.fillStyle = "#1f2a3a";
    g.fillRect(110, 52, 240, 14);
    for (let p = 0; p < 4; p++) lines(110, 84 + p * 56, 290, 4, 11);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  m = new THREE.MeshStandardMaterial({ color: "#000000", emissive: "#ffffff", emissiveMap: t, emissiveIntensity: 0.9, roughness: 0.18 });
  uiCache.set(kind, m);
  return m;
}

// ---------- 공통 가구 ----------

/** 원목 상판 + 검은 철제 다리 책상 */
function Desk({ w = 1.8, d = 0.85, top = OAK }: { w?: number; d?: number; top?: string }) {
  return (
    <group>
      <RoundedBox args={[w, 0.04, d]} radius={0.012} position={[0, 0.75, 0]} castShadow receiveShadow material={wood(top)} />
      {[-1, 1].map((sx) => (
        <group key={sx} position={[sx * (w / 2 - 0.08), 0, 0]}>
          {[-1, 1].map((sz) => (
            <mesh key={sz} position={[0, 0.365, sz * (d / 2 - 0.06)]} castShadow material={metal(STEEL, 0.45)}>
              <boxGeometry args={[0.04, 0.73, 0.04]} />
            </mesh>
          ))}
          <mesh position={[0, 0.06, 0]} material={metal(STEEL, 0.45)}>
            <boxGeometry args={[0.04, 0.03, d - 0.08]} />
          </mesh>
          <mesh position={[0, 0.71, 0]} material={metal(STEEL, 0.45)}>
            <boxGeometry args={[0.04, 0.04, d - 0.08]} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.69, -d / 2 + 0.08]} material={metal(STEEL, 0.45)}>
        <boxGeometry args={[w - 0.16, 0.06, 0.02]} />
      </mesh>
    </group>
  );
}

/** 바퀴 달린 사무용 의자 */
function OfficeChair({ z = 0.7, color = "#4b4f55", rot = Math.PI }: { z?: number; color?: string; rot?: number }) {
  return (
    <group position={[0, 0, z]} rotation={[0, rot, 0]}>
      {Array.from({ length: 5 }).map((_, i) => {
        const a = (i / 5) * Math.PI * 2;
        return (
          <group key={i} rotation={[0, a, 0]}>
            <mesh position={[0.15, 0.07, 0]} castShadow material={metal("#1e1f21", 0.4)}>
              <boxGeometry args={[0.3, 0.03, 0.04]} />
            </mesh>
            <mesh position={[0.29, 0.03, 0]} material={pbr("#111111", 0.5)}>
              <sphereGeometry args={[0.03, 8, 6]} />
            </mesh>
          </group>
        );
      })}
      <mesh position={[0, 0.26, 0]} material={metal("#d0d3d6", 0.25)}>
        <cylinderGeometry args={[0.025, 0.025, 0.36, 10]} />
      </mesh>
      <RoundedBox args={[0.48, 0.08, 0.46]} radius={0.03} position={[0, 0.46, 0]} castShadow material={fabricMat(color, 2)} />
      <RoundedBox args={[0.46, 0.5, 0.06]} radius={0.03} position={[0, 0.78, -0.22]} rotation={[-0.12, 0, 0]} castShadow material={fabricMat(color, 2)} />
      <mesh position={[0, 0.58, -0.24]} material={metal("#1e1f21", 0.4)}>
        <boxGeometry args={[0.05, 0.22, 0.03]} />
      </mesh>
    </group>
  );
}

function Mug({ x = 0, z = 0, y = 0.77 }: { x?: number; z?: number; y?: number }) {
  return (
    <group position={[x, y, z]}>
      <mesh position={[0, 0.05, 0]} castShadow material={pbr("#f3f1ec", 0.25)}>
        <cylinderGeometry args={[0.04, 0.036, 0.1, 18]} />
      </mesh>
      <mesh position={[0, 0.095, 0]} rotation={[-Math.PI / 2, 0, 0]} material={pbr("#3a2417", 0.15)}>
        <circleGeometry args={[0.034, 16]} />
      </mesh>
      <mesh position={[0.045, 0.05, 0]} rotation={[0, 0, Math.PI / 2]} material={pbr("#f3f1ec", 0.25)}>
        <torusGeometry args={[0.025, 0.007, 6, 12]} />
      </mesh>
    </group>
  );
}

/** 얇은 베젤의 모니터 + 키보드 + 마우스 */
function Monitor({ x = 0, ui = "cards" as Ui }: { x?: number; ui?: Ui }) {
  return (
    <group position={[x, 0.77, -0.18]}>
      <RoundedBox args={[0.92, 0.54, 0.03]} radius={0.01} position={[0, 0.47, 0]} castShadow material={pbr("#141517", 0.35)} />
      <mesh position={[0, 0.48, 0.0165]} material={screenMat(ui)}>
        <planeGeometry args={[0.88, 0.495]} />
      </mesh>
      <mesh position={[0, 0.2, -0.04]} rotation={[0.08, 0, 0]} material={metal(ALU, 0.3)}>
        <boxGeometry args={[0.07, 0.4, 0.02]} />
      </mesh>
      <mesh position={[0, 0.006, -0.02]} material={metal(ALU, 0.3)}>
        <boxGeometry args={[0.26, 0.012, 0.2]} />
      </mesh>
      {/* 키보드와 마우스 */}
      <RoundedBox args={[0.44, 0.015, 0.13]} radius={0.005} position={[0, 0.008, 0.36]} castShadow material={metal("#d9dbde", 0.4)} />
      <mesh position={[0, 0.017, 0.36]} material={pbr("#f4f4f4", 0.5)}>
        <boxGeometry args={[0.41, 0.004, 0.1]} />
      </mesh>
      <mesh position={[0.33, 0.012, 0.37]} scale={[0.6, 0.3, 1]} castShadow material={pbr("#f2f2f2", 0.3)}>
        <sphereGeometry args={[0.05, 14, 10]} />
      </mesh>
    </group>
  );
}

/** 탁상 스탠드 (실제로 불이 켜져 있어요) */
function DeskLamp({ x, z = -0.2, y = 0.77 }: { x: number; z?: number; y?: number }) {
  return (
    <group position={[x, y, z]}>
      <mesh position={[0, 0.012, 0]} castShadow material={metal("#1e1f21", 0.35)}>
        <cylinderGeometry args={[0.09, 0.1, 0.024, 20]} />
      </mesh>
      <mesh position={[0.06, 0.2, 0]} rotation={[0, 0, -0.35]} material={metal("#1e1f21", 0.35)}>
        <cylinderGeometry args={[0.01, 0.01, 0.4, 8]} />
      </mesh>
      <mesh position={[0.2, 0.38, 0]} rotation={[0, 0, 1.0]} material={metal("#1e1f21", 0.35)}>
        <cylinderGeometry args={[0.01, 0.01, 0.3, 8]} />
      </mesh>
      <mesh position={[0.3, 0.32, 0.0]} rotation={[0, 0, 0.5]} castShadow material={metal("#1e1f21", 0.35)}>
        <coneGeometry args={[0.08, 0.13, 20, 1, true]} />
      </mesh>
      <mesh position={[0.31, 0.29, 0]} material={new THREE.MeshBasicMaterial({ color: "#fff3d6" })}>
        <sphereGeometry args={[0.03, 10, 8]} />
      </mesh>
      <pointLight position={[0.32, 0.22, 0.05]} intensity={1.2} distance={2.2} decay={2} color="#ffd9a0" />
    </group>
  );
}

/** 화분 (도자기 화분에 잎이 무성한 식물) */
export function Plant({ x, z, s = 1, y = 0 }: { x: number; z: number; s?: number; y?: number }) {
  const blobs = useMemo<Blob[]>(
    () => [
      { x: 0, y: 0.75 * s, z: 0, rx: 0.32 * s, ry: 0.36 * s, rz: 0.32 * s, n: 40, size: 0.26 * s, hue: -0.02 },
      { x: 0.08 * s, y: 1.05 * s, z: -0.05 * s, rx: 0.22 * s, ry: 0.22 * s, rz: 0.22 * s, n: 18, size: 0.24 * s, hue: 0.02 },
    ],
    [s],
  );
  return (
    <group position={[x, y, z]}>
      <mesh castShadow receiveShadow position={[0, 0.2 * s, 0]} material={pbr("#e9e5dd", 0.55)}>
        <cylinderGeometry args={[0.2 * s, 0.15 * s, 0.4 * s, 24]} />
      </mesh>
      <mesh position={[0, 0.395 * s, 0]} rotation={[-Math.PI / 2, 0, 0]} material={pbr("#3b2c20", 1)}>
        <circleGeometry args={[0.19 * s, 20]} />
      </mesh>
      <mesh position={[0, 0.55 * s, 0]} material={barkMat("#6a5640")}>
        <cylinderGeometry args={[0.012 * s, 0.018 * s, 0.4 * s, 6]} />
      </mesh>
      <Foliage blobs={blobs} seed={Math.round((x + 10) * 31 + (z + 10) * 7)} />
    </group>
  );
}

// ---------- 방마다 사물 ----------

function MonitorDesk({ ui }: { ui: Ui }) {
  return (
    <group>
      <Desk />
      <Monitor x={-0.15} ui={ui} />
      <Mug x={0.62} z={0.1} />
      {/* 메모지와 펜 */}
      <mesh position={[0.5, 0.772, 0.25]} rotation={[-Math.PI / 2, 0, 0.2]} material={pbr("#f3e3a1", 0.8)}>
        <planeGeometry args={[0.12, 0.12]} />
      </mesh>
      <OfficeChair />
    </group>
  );
}

function Printer() {
  const paper = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (paper.current) paper.current.position.z = 0.3 + ((clock.elapsedTime * 0.25) % 1) * 0.18;
  });
  return (
    <group>
      {/* 프린터 받침장 */}
      <RoundedBox args={[1.1, 0.55, 0.7]} radius={0.015} position={[0, 0.275, 0]} castShadow receiveShadow material={wood(OAK)} />
      <mesh position={[0, 0.28, 0.352]} material={pbr("#2a2a2a", 0.5)}>
        <boxGeometry args={[0.02, 0.4, 0.005]} />
      </mesh>
      {/* 레이저 프린터 */}
      <RoundedBox args={[0.82, 0.38, 0.62]} radius={0.04} position={[0, 0.74, 0]} castShadow material={pbr("#e6e6e3", 0.45)} />
      <RoundedBox args={[0.8, 0.06, 0.4]} radius={0.02} position={[0, 0.95, -0.08]} material={pbr("#3a3c3f", 0.5)} />
      <mesh position={[0, 0.66, 0.312]} material={pbr("#cfcfcb", 0.5)}>
        <boxGeometry args={[0.6, 0.1, 0.01]} />
      </mesh>
      <mesh ref={paper} position={[0, 0.88, 0.3]} rotation={[-Math.PI / 2 + 0.25, 0, 0]} material={pbr("#fbfbf9", 0.8)}>
        <planeGeometry args={[0.32, 0.26]} />
      </mesh>
      {/* 조작판과 초록 불 */}
      <mesh position={[0.28, 0.93, 0.2]} rotation={[-0.5, 0, 0]} material={pbr("#1c1d1f", 0.3)}>
        <boxGeometry args={[0.16, 0.06, 0.01]} />
      </mesh>
      <mesh position={[0.36, 0.935, 0.21]} material={new THREE.MeshBasicMaterial({ color: "#58e08a" })}>
        <sphereGeometry args={[0.008, 8, 6]} />
      </mesh>
      {/* 옆에 뽑아 둔 카드 */}
      {[0, 1, 2, 3].map((i) => (
        <mesh
          key={i}
          position={[0.75 + i * 0.01, 0.01 + i * 0.006, 0.2 - i * 0.01]}
          rotation={[-Math.PI / 2, 0, i * 0.12 - 0.1]}
          receiveShadow
          material={pbr(["#f6f6f3", "#dce8f2", "#f6f6f3", "#f3e0d8"][i], 0.6)}
        >
          <planeGeometry args={[0.3, 0.37]} />
        </mesh>
      ))}
    </group>
  );
}

/** 블로그 서재: 원목 책상 위 노트북·원고·스탠드 */
function WritingDesk() {
  return (
    <group>
      <Desk w={2} top="#a77c57" />
      {/* 노트북 */}
      <group position={[0.15, 0.77, -0.05]}>
        <RoundedBox args={[0.5, 0.015, 0.34]} radius={0.006} position={[0, 0.008, 0.08]} castShadow material={metal(ALU, 0.3)} />
        <group position={[0, 0.015, -0.09]} rotation={[-0.25, 0, 0]}>
          <RoundedBox args={[0.5, 0.33, 0.01]} radius={0.006} position={[0, 0.165, 0]} castShadow material={metal(ALU, 0.3)} />
          <mesh position={[0, 0.168, 0.006]} material={screenMat("blog")}>
            <planeGeometry args={[0.46, 0.29]} />
          </mesh>
        </group>
      </group>
      {/* 원고 뭉치 */}
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          position={[-0.45 + i * 0.02, 0.772 + i * 0.002, 0.12]}
          rotation={[-Math.PI / 2, 0, -0.15 + i * 0.1]}
          receiveShadow
          material={pbr("#f7f6f1", 0.8)}
        >
          <planeGeometry args={[0.21, 0.297]} />
        </mesh>
      ))}
      {/* 책 몇 권 */}
      {["#6c2f2a", "#2f4a5f", "#5c6a3c"].map((c, i) => (
        <RoundedBox
          key={c}
          args={[0.24, 0.035, 0.17]}
          radius={0.004}
          position={[0.75, 0.79 + i * 0.036, -0.2]}
          rotation={[0, i * 0.12, 0]}
          castShadow
          material={pbr(c, 0.7)}
        />
      ))}
      <Mug x={-0.15} z={0.25} />
      <DeskLamp x={-0.85} />
      <OfficeChair color="#6b5a4a" />
    </group>
  );
}

/** 우편선: 흰 칠을 한 나무 보트에 우편 자루 */
function Boat() {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.y = 0.04 + Math.sin(clock.elapsedTime * 1.6) * 0.025;
      ref.current.rotation.z = Math.sin(clock.elapsedTime * 1.2) * 0.025;
    }
  });
  return (
    <group>
      <group ref={ref} position={[0, 0.04, -0.2]}>
        <mesh castShadow scale={[1.6, 0.42, 0.6]} material={pbr("#f2f0ea", 0.45)}>
          <sphereGeometry args={[1, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        </mesh>
        <mesh position={[0, -0.005, 0]} scale={[1.6, 1, 0.6]} rotation={[Math.PI / 2, 0, 0]} material={wood("#8d6a48")}>
          <torusGeometry args={[1, 0.035, 8, 48]} />
        </mesh>
        <mesh position={[0, -0.12, 0]} scale={[1.55, 1, 0.56]} material={wood("#a5825d", 2)}>
          <cylinderGeometry args={[1, 1, 0.02, 32]} />
        </mesh>
        {/* 우편 자루 */}
        {[-0.5, 0.1, 0.65].map((x, i) => (
          <mesh key={i} castShadow position={[x, 0.04, 0]} scale={[0.3, 0.24, 0.26]} material={fabricMat(["#b79f78", "#a88f69", "#bba680"][i], 3)}>
            <sphereGeometry args={[1, 16, 12]} />
          </mesh>
        ))}
        <mesh position={[-1.05, 0.45, 0]} castShadow material={wood("#6e543c")}>
          <cylinderGeometry args={[0.03, 0.035, 1.1, 8]} />
        </mesh>
        <mesh position={[-0.86, 0.85, 0]} rotation={[0, 0, -0.05]} material={fabricMat("#c8553f", 2)}>
          <boxGeometry args={[0.36, 0.22, 0.01]} />
        </mesh>
      </group>
    </group>
  );
}

const BOOK_COLORS = ["#6c2f2a", "#2f4a5f", "#5c6a3c", "#d9cfb8", "#8a6a3f", "#3d3d42", "#7d5a6e", "#b4553e", "#e8e2d4"];

function Bookshelf() {
  const books = useMemo(() => {
    const r = rng(12);
    const out: { x: number; y: number; w: number; h: number; c: string; tilt: number }[] = [];
    for (let row = 0; row < 4; row++) {
      let x = -1.32;
      while (x < 1.25) {
        const w = 0.04 + r() * 0.05;
        const h = 0.26 + r() * 0.16;
        const lean = r() > 0.93 && x > 0.6;
        out.push({ x: x + w / 2, y: 0.1 + row * 0.55, w, h, c: BOOK_COLORS[Math.floor(r() * BOOK_COLORS.length)], tilt: lean ? 0.3 : 0 });
        x += w + (r() > 0.9 ? 0.15 : 0.004);
      }
    }
    return out;
  }, []);
  return (
    <group>
      {/* 틀 */}
      {[-1.48, 1.48].map((x) => (
        <mesh key={x} position={[x, 1.15, -0.1]} castShadow receiveShadow material={wood(WALNUT)}>
          <boxGeometry args={[0.04, 2.3, 0.5]} />
        </mesh>
      ))}
      {[0.06, 0.61, 1.16, 1.71, 2.28].map((y) => (
        <mesh key={y} position={[0, y, -0.1]} castShadow receiveShadow material={wood(WALNUT)}>
          <boxGeometry args={[3, 0.035, 0.5]} />
        </mesh>
      ))}
      <mesh position={[0, 1.15, -0.34]} receiveShadow material={wood("#6a4c38")}>
        <boxGeometry args={[3, 2.3, 0.02]} />
      </mesh>
      {books.map((b, i) => (
        <mesh key={i} position={[b.x, b.y + b.h / 2, -0.1]} rotation={[0, 0, b.tilt]} castShadow material={pbr(b.c, 0.65)}>
          <boxGeometry args={[b.w, b.h, 0.3 + (i % 3) * 0.03]} />
        </mesh>
      ))}
      <Plant x={-1.0} z={-0.12} y={2.3} s={0.5} />
      {/* 사다리 */}
      <group position={[1.2, 0, 0.42]} rotation={[-0.2, 0, 0]}>
        {[-0.2, 0.2].map((x) => (
          <mesh key={x} position={[x, 1.1, 0]} castShadow material={wood(OAK)}>
            <boxGeometry args={[0.04, 2.2, 0.05]} />
          </mesh>
        ))}
        {[0.4, 0.9, 1.4, 1.9].map((y) => (
          <mesh key={y} position={[0, y, 0]} material={metal(ALU, 0.35)}>
            <cylinderGeometry args={[0.015, 0.015, 0.4, 8]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** 성과 게시판: 철제 다리의 화이트보드에 출력한 그래프 */
function Board() {
  const bars = [0.4, 0.7, 0.35, 0.9, 0.55, 0.75];
  return (
    <group>
      {[-1.15, 1.15].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh position={[0, 1.1, 0]} castShadow material={metal(ALU, 0.3)}>
            <boxGeometry args={[0.04, 2.2, 0.04]} />
          </mesh>
          <mesh position={[0, 0.02, 0]} material={metal(ALU, 0.3)}>
            <boxGeometry args={[0.05, 0.04, 0.5]} />
          </mesh>
        </group>
      ))}
      <RoundedBox args={[2.4, 1.4, 0.04]} radius={0.01} position={[0, 1.5, 0]} castShadow material={metal(ALU, 0.3)} />
      <mesh position={[0, 1.5, 0.021]} material={pbr("#f8f8f6", 0.15)}>
        <planeGeometry args={[2.32, 1.32]} />
      </mesh>
      {/* 막대그래프 출력물 */}
      <mesh position={[-0.35, 1.45, 0.025]} material={pbr("#ffffff", 0.8)}>
        <planeGeometry args={[1.3, 0.95]} />
      </mesh>
      {bars.map((v, i) => (
        <mesh key={i} position={[-0.85 + i * 0.2, 1.08 + (v * 0.7) / 2, 0.028]} material={pbr(["#4f7ea8", "#c9705a"][i % 2], 0.7)}>
          <planeGeometry args={[0.12, v * 0.7]} />
        </mesh>
      ))}
      {/* 자석으로 붙인 메모 */}
      {[
        [0.6, 1.85, "#f3e3a1"],
        [0.85, 1.55, "#f7f6f1"],
        [0.62, 1.2, "#cfe3d4"],
      ].map(([x, y, c], i) => (
        <group key={i} position={[x as number, y as number, 0.026]} rotation={[0, 0, (i - 1) * 0.06]}>
          <mesh material={pbr(c as string, 0.8)}>
            <planeGeometry args={[0.28, 0.24]} />
          </mesh>
          <mesh position={[0, 0.09, 0.01]} material={pbr("#c43d32", 0.4)}>
            <cylinderGeometry args={[0.018, 0.018, 0.01, 12]} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.78, 0.06]} material={metal(ALU, 0.3)}>
        <boxGeometry args={[2.2, 0.03, 0.08]} />
      </mesh>
    </group>
  );
}

/** 숙소: 명부를 올려 둔 독서대와 침대 두 개 */
function RosterBook() {
  return (
    <group>
      <mesh position={[0, 0.5, 0]} castShadow material={wood(WALNUT)}>
        <boxGeometry args={[0.14, 1, 0.14]} />
      </mesh>
      <mesh position={[0, 0.02, 0]} castShadow material={wood(WALNUT)}>
        <boxGeometry args={[0.5, 0.04, 0.4]} />
      </mesh>
      <RoundedBox args={[0.7, 0.04, 0.5]} radius={0.01} position={[0, 1.02, 0]} rotation={[0.35, 0, 0]} castShadow material={wood(WALNUT)} />
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.15, 1.05, 0.01]} rotation={[0.35 - Math.PI / 2, s * 0.06, 0]} material={pbr("#f6f2e8", 0.85)}>
          <planeGeometry args={[0.28, 0.4]} />
        </mesh>
      ))}
      {/* 침대 */}
      {[-2, 2].map((x) => (
        <group key={x} position={[x, 0, -0.1]}>
          <RoundedBox args={[1.1, 0.3, 1.9]} radius={0.02} position={[0, 0.18, 0]} castShadow receiveShadow material={wood(OAK)} />
          <RoundedBox args={[1.12, 0.6, 0.06]} radius={0.02} position={[0, 0.45, -0.93]} castShadow material={wood(OAK)} />
          <RoundedBox args={[1.02, 0.16, 1.8]} radius={0.05} position={[0, 0.39, 0]} material={fabricMat("#f4f2ec", 2)} />
          <RoundedBox args={[1.06, 0.06, 1.2]} radius={0.03} position={[0, 0.49, 0.28]} castShadow material={fabricMat(x < 0 ? "#8fa3a6" : "#b9a58a", 3)} />
          <RoundedBox args={[0.7, 0.12, 0.34]} radius={0.06} position={[0, 0.53, -0.66]} castShadow material={fabricMat("#fbfaf6", 2)} />
        </group>
      ))}
    </group>
  );
}

/** 소장 책상: 짙은 원목 책상과 가죽 의자 */
function BigDesk() {
  return (
    <group>
      <RoundedBox args={[2.2, 0.72, 0.95]} radius={0.02} position={[0, 0.37, 0]} castShadow receiveShadow material={wood(WALNUT)} />
      <RoundedBox args={[2.3, 0.05, 1.05]} radius={0.015} position={[0, 0.755, 0]} castShadow receiveShadow material={wood("#6b4c37")} />
      {/* 서랍 손잡이 */}
      {[-0.7, 0.7].map((x) =>
        [0.25, 0.5].map((y) => (
          <mesh key={`${x}${y}`} position={[x, y, -0.48]} material={metal("#b89a5e", 0.3)}>
            <boxGeometry args={[0.16, 0.015, 0.02]} />
          </mesh>
        )),
      )}
      <RoundedBox args={[0.42, 0.008, 0.3]} radius={0.003} position={[-0.6, 0.785, 0.05]} rotation={[0, 0.15, 0]} material={pbr("#2d4a3e", 0.7)} />
      <mesh position={[-0.6, 0.79, 0.05]} rotation={[-Math.PI / 2, 0, 0.15]} material={pbr("#f7f6f1", 0.8)}>
        <planeGeometry args={[0.21, 0.297]} />
      </mesh>
      {/* 지구본 */}
      <group position={[0.8, 0.78, -0.25]}>
        <mesh position={[0, 0.03, 0]} material={metal("#b89a5e", 0.3)}>
          <cylinderGeometry args={[0.08, 0.1, 0.05, 16]} />
        </mesh>
        <mesh position={[0, 0.22, 0]} castShadow material={pbr("#4d7a8c", 0.4)}>
          <sphereGeometry args={[0.16, 24, 18]} />
        </mesh>
        <mesh position={[0, 0.22, 0]} rotation={[0, 0, 0.4]} material={metal("#b89a5e", 0.3)}>
          <torusGeometry args={[0.18, 0.006, 6, 32, Math.PI]} />
        </mesh>
      </group>
      <DeskLamp x={-0.95} z={-0.3} y={0.78} />
      {/* 가죽 의자 */}
      <group position={[0, 0, -0.95]}>
        <RoundedBox args={[0.66, 0.12, 0.6]} radius={0.05} position={[0, 0.5, 0]} castShadow material={pbr("#4a2f22", 0.45)} />
        <RoundedBox args={[0.66, 0.85, 0.12]} radius={0.05} position={[0, 0.95, -0.27]} castShadow material={pbr("#4a2f22", 0.45)} />
        {[-1, 1].map((s) => (
          <RoundedBox key={s} args={[0.08, 0.22, 0.5]} radius={0.03} position={[s * 0.36, 0.66, 0]} material={pbr("#4a2f22", 0.45)} />
        ))}
        <mesh position={[0, 0.25, 0]} material={metal("#c8cbce", 0.25)}>
          <cylinderGeometry args={[0.03, 0.03, 0.4, 10]} />
        </mesh>
        <mesh position={[0, 0.04, 0]} material={metal("#1e1f21", 0.4)}>
          <cylinderGeometry args={[0.3, 0.3, 0.03, 5]} />
        </mesh>
      </group>
    </group>
  );
}

/** 보관함: 원목 서랍장과 놋쇠 손잡이 */
function Drawer() {
  return (
    <group>
      <RoundedBox args={[1.2, 1.4, 0.6]} radius={0.015} position={[0, 0.72, 0]} castShadow receiveShadow material={wood(OAK)} />
      {[0.3, 0.72, 1.14].map((y) => (
        <group key={y} position={[0, y, 0.302]}>
          <mesh material={wood("#c09a72")}>
            <boxGeometry args={[1.1, 0.36, 0.01]} />
          </mesh>
          <mesh position={[0, 0.05, 0.02]} material={metal("#b89a5e", 0.3)}>
            <boxGeometry args={[0.26, 0.02, 0.025]} />
          </mesh>
        </group>
      ))}
      {[-0.5, 0.5].map((x) => (
        <mesh key={x} position={[x, 0.01, 0]} material={metal(STEEL, 0.4)}>
          <boxGeometry args={[0.05, 0.02, 0.5]} />
        </mesh>
      ))}
      <Plant x={0.28} z={0} y={1.42} s={0.55} />
      {/* 서류함 */}
      <RoundedBox args={[0.32, 0.24, 0.26]} radius={0.01} position={[-0.3, 1.54, 0]} castShadow material={pbr("#d9d4ca", 0.7)} />
    </group>
  );
}

/** 회의실 가운데: 실내 나무를 둘러싼 둥근 탁자와 의자 */
export const SEATS = 8;
export const SEAT_R = 2.05;
function RoundTable() {
  const crown = useMemo<Blob[]>(
    () => [
      { x: 0, y: 2.05, z: 0, rx: 0.75, ry: 0.55, rz: 0.75, n: 120, size: 0.34 },
      { x: 0.35, y: 1.8, z: 0.2, rx: 0.45, ry: 0.35, rz: 0.45, n: 40, size: 0.3 },
      { x: -0.3, y: 2.3, z: -0.15, rx: 0.45, ry: 0.35, rz: 0.45, n: 40, size: 0.3, hue: 0.03 },
    ],
    [],
  );
  return (
    <group>
      {/* 콘크리트 화단과 실내 나무 */}
      <mesh position={[0, 0.25, 0]} castShadow receiveShadow material={pbr("#b9b4ab", 0.9)}>
        <cylinderGeometry args={[0.55, 0.55, 0.5, 40]} />
      </mesh>
      <mesh position={[0, 0.49, 0]} rotation={[-Math.PI / 2, 0, 0]} material={pbr("#3b2c20", 1)}>
        <circleGeometry args={[0.5, 30]} />
      </mesh>
      <mesh position={[0, 1.15, 0]} castShadow material={barkMat("#8a7660")}>
        <cylinderGeometry args={[0.06, 0.1, 1.4, 10]} />
      </mesh>
      <Foliage blobs={crown} seed={77} />
      {/* 탁자 (가운데가 뚫린 고리) */}
      <mesh position={[0, 0.76, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow material={wood(OAK, 2)}>
        <ringGeometry args={[0.75, 1.45, 64]} />
      </mesh>
      <mesh position={[0, 0.74, 0]} castShadow material={wood(OAK, 2)}>
        <cylinderGeometry args={[1.45, 1.45, 0.04, 64, 1, true]} />
      </mesh>
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        return (
          <mesh key={i} position={[Math.cos(a) * 1.1, 0.37, Math.sin(a) * 1.1]} castShadow material={metal(STEEL, 0.4)}>
            <cylinderGeometry args={[0.03, 0.03, 0.74, 10]} />
          </mesh>
        );
      })}
      {/* 탁자 위 서류와 노트북 */}
      {[0.4, 2.2, 4.1].map((a, i) => (
        <mesh key={i} position={[Math.cos(a) * 1.1, 0.781, Math.sin(a) * 1.1]} rotation={[-Math.PI / 2, 0, a]} material={pbr("#f7f6f1", 0.8)}>
          <planeGeometry args={[0.21, 0.297]} />
        </mesh>
      ))}
      {/* 의자 */}
      {Array.from({ length: SEATS }).map((_, i) => {
        const a = (i / SEATS) * Math.PI * 2;
        return (
          <group key={i} position={[Math.sin(a) * (SEAT_R + 0.35), 0, Math.cos(a) * (SEAT_R + 0.35)]} rotation={[0, a, 0]}>
            <RoundedBox args={[0.44, 0.05, 0.42]} radius={0.02} position={[0, 0.45, 0]} castShadow material={fabricMat(i % 2 ? "#8c9a8e" : "#a7a196", 2)} />
            <RoundedBox
              args={[0.42, 0.3, 0.04]}
              radius={0.02}
              position={[0, 0.66, 0.2]}
              rotation={[0.12, 0, 0]}
              castShadow
              material={fabricMat(i % 2 ? "#8c9a8e" : "#a7a196", 2)}
            />
            {[-1, 1].flatMap((sx) =>
              [-1, 1].map((sz) => (
                <mesh key={`${sx}${sz}`} position={[sx * 0.18, 0.22, sz * 0.17]} material={wood(OAK)}>
                  <cylinderGeometry args={[0.018, 0.014, 0.44, 8]} />
                </mesh>
              )),
            )}
          </group>
        );
      })}
    </group>
  );
}

/** 회의록 칠판: 나무 이젤에 올린 진짜 칠판 */
function Chalkboard() {
  return (
    <group>
      {[-0.75, 0.75].map((x) => (
        <mesh key={x} position={[x, 0.85, -0.05]} rotation={[0.06, 0, 0]} castShadow material={wood(OAK)}>
          <boxGeometry args={[0.05, 1.7, 0.05]} />
        </mesh>
      ))}
      <RoundedBox args={[1.7, 1.1, 0.05]} radius={0.01} position={[0, 1.45, 0]} castShadow material={wood("#8d6a4b")} />
      <mesh position={[0, 1.45, 0.026]} material={pbr("#26342e", 0.92)}>
        <planeGeometry args={[1.56, 0.96]} />
      </mesh>
      {[0.28, 0.12, -0.04, -0.2].map((y, i) => (
        <mesh key={y} position={[-0.12 + (i % 2) * 0.08, 1.45 + y, 0.028]} material={pbr("#d9ddd6", 1)}>
          <planeGeometry args={[0.95 - i * 0.12, 0.02]} />
        </mesh>
      ))}
      <mesh position={[0, 0.86, 0.06]} material={wood("#8d6a4b")}>
        <boxGeometry args={[1.6, 0.03, 0.08]} />
      </mesh>
    </group>
  );
}

export default function Furniture({ kind, ui = "cards" }: { kind: Kind; ui?: Ui }) {
  switch (kind) {
    case "monitorDesk":
      return <MonitorDesk ui={ui} />;
    case "printer":
      return <Printer />;
    case "writingDesk":
      return <WritingDesk />;
    case "boat":
      return <Boat />;
    case "bookshelf":
      return <Bookshelf />;
    case "board":
      return <Board />;
    case "rosterBook":
      return <RosterBook />;
    case "bigDesk":
      return <BigDesk />;
    case "drawer":
      return <Drawer />;
    case "roundTable":
      return <RoundTable />;
    case "chalkboard":
      return <Chalkboard />;
  }
}

/** 사물이 차지하는 대략적인 크기 (길찾기에서 피해 가요) */
export const FOOTPRINT: Record<Kind, { w: number; d: number }> = {
  monitorDesk: { w: 1.9, d: 1 },
  printer: { w: 1.6, d: 1 },
  writingDesk: { w: 2.1, d: 1 },
  boat: { w: 4.6, d: 1.6 },
  bookshelf: { w: 3, d: 0.7 },
  board: { w: 2.5, d: 0.3 },
  rosterBook: { w: 0.6, d: 0.6 },
  bigDesk: { w: 2.3, d: 1.1 },
  drawer: { w: 1.2, d: 0.7 },
  roundTable: { w: 3.2, d: 3.2 },
  chalkboard: { w: 1.7, d: 0.3 },
};
