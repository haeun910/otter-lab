"use client";
import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { COLORS, type Furniture as Kind } from "../data/buildings";
import { toyMat } from "./Otter";

const glow = (c: string) => new THREE.MeshBasicMaterial({ color: c });
const SCREEN = glow("#BFF3E4");
const SCREEN_SKY = glow("#CFE9FF");

function Desk({ w = 1.8, color = COLORS.wood }: { w?: number; color?: string }) {
  return (
    <group>
      <RoundedBox args={[w, 0.1, 0.9]} radius={0.04} position={[0, 0.78, 0]} castShadow receiveShadow material={toyMat(color)} />
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * (w / 2 - 0.12), 0.38, sz * 0.32]} castShadow material={toyMat(COLORS.woodDark)}>
            <cylinderGeometry args={[0.05, 0.05, 0.76, 8]} />
          </mesh>
        )),
      )}
    </group>
  );
}

function Stool({ z = 0.75 }: { z?: number }) {
  return (
    <group position={[0, 0, z]}>
      <mesh position={[0, 0.48, 0]} castShadow material={toyMat(COLORS.coral)}>
        <cylinderGeometry args={[0.28, 0.28, 0.12, 18]} />
      </mesh>
      <mesh position={[0, 0.22, 0]} material={toyMat(COLORS.woodDark)}>
        <cylinderGeometry args={[0.05, 0.08, 0.44, 8]} />
      </mesh>
    </group>
  );
}

function Monitor({ x = 0, screen = SCREEN }: { x?: number; screen?: THREE.Material }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.position.y = 0.26 + Math.sin(clock.elapsedTime * 3) * 0.004;
  });
  return (
    <group position={[x, 0.83, -0.15]}>
      <RoundedBox args={[0.95, 0.66, 0.1]} radius={0.06} position={[0, 0.48, 0]} castShadow material={toyMat(COLORS.navy)} />
      <mesh position={[0, 0.48, 0.055]} material={screen}>
        <planeGeometry args={[0.82, 0.52]} />
      </mesh>
      {/* 화면 속 줄글 */}
      {[0.14, 0.04, -0.06].map((y, i) => (
        <mesh key={i} ref={i === 0 ? ref : undefined} position={[-0.08 + i * 0.03, 0.48 + y, 0.06]} material={toyMat(i === 0 ? COLORS.coral : "#7FB8A8", 0.9)}>
          <planeGeometry args={[0.5 - i * 0.1, 0.05]} />
        </mesh>
      ))}
      <mesh position={[0, 0.1, 0]} material={toyMat(COLORS.navy)}>
        <cylinderGeometry args={[0.04, 0.04, 0.2, 8]} />
      </mesh>
      <RoundedBox args={[0.34, 0.04, 0.22]} radius={0.02} position={[0, 0.02, 0]} material={toyMat(COLORS.navy)} />
      <RoundedBox args={[0.6, 0.04, 0.2]} radius={0.02} position={[0, 0.02, 0.36]} material={toyMat("#FFFFFF")} />
    </group>
  );
}

function Printer() {
  const paper = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (paper.current) paper.current.position.z = 0.38 + ((clock.elapsedTime * 0.25) % 1) * 0.25;
  });
  return (
    <group>
      <RoundedBox args={[1.2, 0.9, 0.9]} radius={0.12} position={[0, 0.45, 0]} castShadow material={toyMat(COLORS.coral)} />
      <RoundedBox args={[1, 0.12, 0.5]} radius={0.04} position={[0, 0.95, -0.12]} castShadow material={toyMat("#FFFFFF")} />
      <mesh ref={paper} position={[0, 0.62, 0.4]} rotation={[-Math.PI / 2 + 0.15, 0, 0]} material={toyMat("#FFFFFF")}>
        <planeGeometry args={[0.6, 0.45]} />
      </mesh>
      <mesh position={[0.4, 0.82, 0.46]} material={glow(COLORS.mint)}>
        <sphereGeometry args={[0.05, 10, 8]} />
      </mesh>
      {/* 옆에 쌓인 카드 */}
      {[0, 1, 2, 3].map((i) => (
        <RoundedBox
          key={i}
          args={[0.36, 0.03, 0.45]}
          radius={0.01}
          position={[0.9, 0.03 + i * 0.035, 0.2]}
          rotation={[0, i * 0.15, 0]}
          material={toyMat([COLORS.sky, "#FFFFFF", COLORS.mint, COLORS.coral][i])}
        />
      ))}
    </group>
  );
}

function Lamp({ x }: { x: number }) {
  return (
    <group position={[x, 0.83, -0.2]}>
      <mesh position={[0, 0.25, 0]} material={toyMat(COLORS.navy)}>
        <cylinderGeometry args={[0.025, 0.025, 0.5, 6]} />
      </mesh>
      <mesh position={[0.08, 0.52, 0]} rotation={[0, 0, -0.6]} material={toyMat(COLORS.butter)}>
        <coneGeometry args={[0.16, 0.2, 16, 1, true]} />
      </mesh>
      <pointLight position={[0.1, 0.4, 0.1]} intensity={0.6} distance={2.5} color="#FFE7B0" />
    </group>
  );
}

function WritingDesk() {
  return (
    <group>
      <Desk w={2} color="#C99A6E" />
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[-0.3 + i * 0.03, 0.84 + i * 0.012, 0.05]} rotation={[-Math.PI / 2, 0, -0.1 + i * 0.08]} material={toyMat("#FFFFFF")}>
          <planeGeometry args={[0.5, 0.65]} />
        </mesh>
      ))}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[-0.32, 0.875, -0.1 + i * 0.1]} rotation={[-Math.PI / 2, 0, 0]} material={toyMat("#9AA0C0")}>
          <planeGeometry args={[0.36, 0.025]} />
        </mesh>
      ))}
      {/* 깃펜 */}
      <group position={[0.3, 0.9, 0.1]} rotation={[0, 0.4, 1.1]}>
        <mesh material={toyMat(COLORS.mint)}>
          <coneGeometry args={[0.06, 0.45, 8]} />
        </mesh>
      </group>
      <mesh position={[0.55, 0.88, -0.1]} material={toyMat(COLORS.navy)}>
        <cylinderGeometry args={[0.08, 0.09, 0.12, 12]} />
      </mesh>
      <Lamp x={-0.75} />
    </group>
  );
}

function Boat() {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.y = 0.18 + Math.sin(clock.elapsedTime * 1.6) * 0.04;
      ref.current.rotation.z = Math.sin(clock.elapsedTime * 1.2) * 0.04;
    }
  });
  return (
    <group>
      {/* 실내 물길 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, -0.2]} material={toyMat(COLORS.water, 0.3)}>
        <planeGeometry args={[4.6, 1.6]} />
      </mesh>
      <group ref={ref} position={[0, 0.18, -0.2]}>
        <mesh castShadow scale={[1.6, 0.42, 0.62]} material={toyMat("#FFFFFF")}>
          <sphereGeometry args={[1, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        </mesh>
        <mesh position={[0, 0.02, 0]} scale={[1.62, 0.1, 0.64]} material={toyMat(COLORS.skyDeep)}>
          <cylinderGeometry args={[1, 1, 1, 24]} />
        </mesh>
        {/* 우편 자루 */}
        {[-0.5, 0.1, 0.65].map((x, i) => (
          <mesh key={i} castShadow position={[x, 0.24, 0]} scale={[0.32, 0.28, 0.28]} material={toyMat(["#F2D2A9", COLORS.butter, "#F2D2A9"][i])}>
            <sphereGeometry args={[1, 14, 10]} />
          </mesh>
        ))}
        <mesh position={[-1.1, 0.5, 0]} material={toyMat(COLORS.woodDark)}>
          <cylinderGeometry args={[0.04, 0.04, 1, 6]} />
        </mesh>
        <mesh position={[-0.9, 0.8, 0]} rotation={[0, 0, -0.1]} material={toyMat(COLORS.coral)}>
          <boxGeometry args={[0.4, 0.26, 0.02]} />
        </mesh>
      </group>
    </group>
  );
}

function Bookshelf() {
  const books = Array.from({ length: 4 }).flatMap((_, row) =>
    Array.from({ length: 9 }).map((__, i) => ({
      row,
      i,
      h: 0.32 + ((i * 7 + row * 3) % 5) * 0.04,
      c: [COLORS.sky, COLORS.mint, COLORS.coral, COLORS.butter, "#B9A6F2", "#FFFFFF"][(i + row * 2) % 6],
    })),
  );
  return (
    <group>
      <RoundedBox args={[3, 2.4, 0.6]} radius={0.08} position={[0, 1.2, -0.1]} castShadow receiveShadow material={toyMat(COLORS.woodDark)} />
      {[0, 1, 2, 3].map((r) => (
        <mesh key={r} position={[0, 0.3 + r * 0.55, 0.05]} material={toyMat("#8A5E3B")}>
          <boxGeometry args={[2.8, 0.48, 0.42]} />
        </mesh>
      ))}
      {books.map((b) => (
        <RoundedBox
          key={`${b.row}-${b.i}`}
          args={[0.24, b.h, 0.34]}
          radius={0.03}
          position={[-1.18 + b.i * 0.295, 0.08 + b.row * 0.55 + b.h / 2, 0.1]}
          material={toyMat(b.c)}
        />
      ))}
      {/* 사다리 */}
      <group position={[1.2, 0, 0.45]} rotation={[-0.2, 0, 0]}>
        {[-0.2, 0.2].map((x) => (
          <mesh key={x} position={[x, 1.1, 0]} material={toyMat(COLORS.wood)}>
            <boxGeometry args={[0.05, 2.2, 0.05]} />
          </mesh>
        ))}
        {[0.4, 0.9, 1.4, 1.9].map((y) => (
          <mesh key={y} position={[0, y, 0]} material={toyMat(COLORS.wood)}>
            <boxGeometry args={[0.4, 0.04, 0.05]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Board() {
  const bars = [0.4, 0.7, 0.35, 0.9, 0.55, 0.75];
  return (
    <group>
      {[-1.1, 1.1].map((x) => (
        <mesh key={x} position={[x, 0.75, 0]} material={toyMat(COLORS.woodDark)}>
          <boxGeometry args={[0.1, 1.5, 0.1]} />
        </mesh>
      ))}
      <RoundedBox args={[2.5, 1.5, 0.12]} radius={0.06} position={[0, 1.55, 0]} castShadow material={toyMat("#E9C79B")} />
      {bars.map((v, i) => (
        <mesh key={i} position={[-0.9 + i * 0.36, 0.95 + v / 2, 0.08]} material={toyMat([COLORS.sky, COLORS.coral][i % 2])}>
          <boxGeometry args={[0.22, v, 0.03]} />
        </mesh>
      ))}
      {/* 핀으로 꽂은 메모 */}
      {[
        [-0.8, 2.05, COLORS.butter],
        [0.1, 2.08, "#FFFFFF"],
        [0.85, 2.02, COLORS.mint],
      ].map(([x, y, c], i) => (
        <group key={i} position={[x as number, y as number, 0.08]} rotation={[0, 0, (i - 1) * 0.1]}>
          <mesh material={toyMat(c as string)}>
            <planeGeometry args={[0.42, 0.3]} />
          </mesh>
          <mesh position={[0, 0.12, 0.02]} material={toyMat(COLORS.coral)}>
            <sphereGeometry args={[0.03, 8, 6]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function RosterBook() {
  return (
    <group>
      <mesh position={[0, 0.5, 0]} castShadow material={toyMat(COLORS.woodDark)}>
        <cylinderGeometry args={[0.12, 0.2, 1, 10]} />
      </mesh>
      <RoundedBox args={[0.9, 0.08, 0.6]} radius={0.03} position={[0, 1.02, 0]} rotation={[0.35, 0, 0]} castShadow material={toyMat(COLORS.wood)} />
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.2, 1.09, 0.02]} rotation={[0.35 - Math.PI / 2, s * 0.08, 0]} material={toyMat("#FFFFFF")}>
          <planeGeometry args={[0.38, 0.5]} />
        </mesh>
      ))}
      <mesh position={[0, 1.08, 0.04]} rotation={[0.35 - Math.PI / 2, 0, 0]} material={toyMat(COLORS.leafDeep)}>
        <planeGeometry args={[0.04, 0.5]} />
      </mesh>
      {/* 침대 두 개 */}
      {[-2, 2].map((x) => (
        <group key={x} position={[x, 0, -0.1]}>
          <RoundedBox args={[1.1, 0.4, 1.7]} radius={0.1} position={[0, 0.2, 0]} castShadow material={toyMat(COLORS.wood)} />
          <RoundedBox args={[1, 0.16, 1.4]} radius={0.07} position={[0, 0.46, 0.08]} material={toyMat(x < 0 ? COLORS.mint : COLORS.sky)} />
          <RoundedBox args={[0.7, 0.16, 0.36]} radius={0.07} position={[0, 0.5, -0.6]} material={toyMat("#FFFFFF")} />
        </group>
      ))}
    </group>
  );
}

function BigDesk() {
  return (
    <group>
      <RoundedBox args={[2.2, 0.85, 1]} radius={0.1} position={[0, 0.43, 0]} castShadow receiveShadow material={toyMat(COLORS.woodDark)} />
      <RoundedBox args={[2.3, 0.08, 1.1]} radius={0.04} position={[0, 0.88, 0]} castShadow material={toyMat(COLORS.wood)} />
      <RoundedBox args={[0.6, 0.16, 0.06]} radius={0.02} position={[0, 0.98, 0.4]} rotation={[-0.3, 0, 0]} material={toyMat(COLORS.coral)} />
      {/* 지구본 */}
      <group position={[0.75, 0.92, -0.2]}>
        <mesh position={[0, 0.06, 0]} material={toyMat(COLORS.navy)}>
          <cylinderGeometry args={[0.12, 0.14, 0.08, 12]} />
        </mesh>
        <mesh position={[0, 0.34, 0]} material={toyMat(COLORS.sky)}>
          <sphereGeometry args={[0.22, 18, 14]} />
        </mesh>
      </group>
      <mesh position={[-0.6, 0.93, 0]} rotation={[-Math.PI / 2, 0, 0.2]} material={toyMat("#FFFFFF")}>
        <planeGeometry args={[0.5, 0.6]} />
      </mesh>
      {/* 소장 의자 */}
      <group position={[0, 0, -0.95]}>
        <RoundedBox args={[0.8, 0.14, 0.7]} radius={0.06} position={[0, 0.5, 0]} material={toyMat(COLORS.coral)} />
        <RoundedBox args={[0.8, 0.9, 0.14]} radius={0.06} position={[0, 0.95, -0.3]} material={toyMat(COLORS.coral)} />
      </group>
    </group>
  );
}

function Drawer() {
  return (
    <group>
      <RoundedBox args={[1.2, 1.5, 0.7]} radius={0.08} position={[0, 0.75, 0]} castShadow material={toyMat(COLORS.wood)} />
      {[0.35, 0.75, 1.15].map((y, i) => (
        <group key={y} position={[0, y, 0.36]}>
          <RoundedBox args={[1.02, 0.3, 0.05]} radius={0.03} material={toyMat([COLORS.sky, COLORS.mint, COLORS.butter][i])} />
          <mesh position={[0, 0, 0.04]} material={toyMat(COLORS.navy)}>
            <boxGeometry args={[0.24, 0.05, 0.04]} />
          </mesh>
        </group>
      ))}
      <mesh position={[0.25, 1.62, 0]} castShadow material={toyMat(COLORS.leaf)}>
        <sphereGeometry args={[0.2, 14, 10]} />
      </mesh>
      <mesh position={[0.25, 1.52, 0]} material={toyMat(COLORS.coral)}>
        <cylinderGeometry args={[0.13, 0.1, 0.18, 12]} />
      </mesh>
    </group>
  );
}

/** 회의실 가운데: 실내 나무를 둘러싼 둥근 탁자와 의자 */
export const SEATS = 8;
export const SEAT_R = 2.05;
function RoundTable() {
  return (
    <group>
      {/* 나무 화단 */}
      <mesh position={[0, 0.25, 0]} castShadow receiveShadow material={toyMat(COLORS.stone)}>
        <cylinderGeometry args={[0.55, 0.6, 0.5, 20]} />
      </mesh>
      <mesh position={[0, 0.95, 0]} castShadow material={toyMat(COLORS.woodDark)}>
        <cylinderGeometry args={[0.11, 0.16, 1.4, 10]} />
      </mesh>
      {[
        [0, 1.95, 0, 0.62],
        [0.38, 1.75, 0.15, 0.42],
        [-0.36, 1.8, -0.12, 0.45],
        [0.05, 2.35, -0.15, 0.38],
      ].map(([x, y, z, r], i) => (
        <mesh key={i} castShadow position={[x, y, z]} material={toyMat(i % 2 ? COLORS.leafDeep : COLORS.leaf)}>
          <sphereGeometry args={[r, 18, 14]} />
        </mesh>
      ))}
      {/* 탁자 (가운데가 뚫린 고리) */}
      <mesh position={[0, 0.78, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow material={toyMat(COLORS.wood)}>
        <ringGeometry args={[0.7, 1.45, 40]} />
      </mesh>
      <mesh position={[0, 0.74, 0]} castShadow material={toyMat(COLORS.woodDark)}>
        <cylinderGeometry args={[1.45, 1.45, 0.08, 40, 1, true]} />
      </mesh>
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        return (
          <mesh key={i} position={[Math.cos(a) * 1.1, 0.37, Math.sin(a) * 1.1]} material={toyMat(COLORS.woodDark)}>
            <cylinderGeometry args={[0.06, 0.06, 0.74, 8]} />
          </mesh>
        );
      })}
      {/* 탁자 위 서류 */}
      {[0.4, 2.2, 4.1].map((a, i) => (
        <mesh key={i} position={[Math.cos(a) * 1.1, 0.79, Math.sin(a) * 1.1]} rotation={[-Math.PI / 2, 0, a]} material={toyMat(["#FFFFFF", COLORS.butter, COLORS.sky][i])}>
          <planeGeometry args={[0.3, 0.4]} />
        </mesh>
      ))}
      {/* 의자 */}
      {Array.from({ length: SEATS }).map((_, i) => {
        const a = (i / SEATS) * Math.PI * 2;
        return (
          <group key={i} position={[Math.sin(a) * (SEAT_R + 0.35), 0, Math.cos(a) * (SEAT_R + 0.35)]} rotation={[0, a, 0]}>
            <mesh position={[0, 0.3, 0]} castShadow material={toyMat(i % 2 ? COLORS.mint : COLORS.sky)}>
              <cylinderGeometry args={[0.24, 0.24, 0.1, 14]} />
            </mesh>
            <mesh position={[0, 0.15, 0]} material={toyMat(COLORS.woodDark)}>
              <cylinderGeometry args={[0.04, 0.06, 0.3, 6]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function Chalkboard() {
  return (
    <group>
      {[-0.75, 0.75].map((x) => (
        <mesh key={x} position={[x, 0.7, 0]} material={toyMat(COLORS.woodDark)}>
          <boxGeometry args={[0.08, 1.4, 0.08]} />
        </mesh>
      ))}
      <RoundedBox args={[1.7, 1.1, 0.1]} radius={0.05} position={[0, 1.45, 0]} castShadow material={toyMat(COLORS.wood)} />
      <mesh position={[0, 1.45, 0.06]} material={toyMat("#3E6B5A", 0.95)}>
        <planeGeometry args={[1.5, 0.9]} />
      </mesh>
      {[0.25, 0.08, -0.09, -0.26].map((y, i) => (
        <mesh key={y} position={[-0.15 + (i % 2) * 0.1, 1.45 + y, 0.07]} material={toyMat("#E8F2EC", 0.95)}>
          <planeGeometry args={[0.9 - i * 0.12, 0.04]} />
        </mesh>
      ))}
    </group>
  );
}

function MonitorDesk() {
  return (
    <group>
      <Desk />
      <Monitor x={-0.15} />
      <mesh position={[0.65, 0.88, 0.1]} material={toyMat(COLORS.butter)}>
        <cylinderGeometry args={[0.07, 0.06, 0.14, 12]} />
      </mesh>
      <Stool />
    </group>
  );
}

export default function Furniture({ kind }: { kind: Kind }) {
  switch (kind) {
    case "monitorDesk":
      return <MonitorDesk />;
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

/** 사물이 차지하는 대략적인 반지름 (길찾기에서 피해 가요) */
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

export { SCREEN_SKY };
