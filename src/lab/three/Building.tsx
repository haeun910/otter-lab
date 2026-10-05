"use client";
import { RoundedBox } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { COLORS, type Building } from "../data/buildings";
import { useLab } from "../store";
import { Anchor } from "./labels";
import { toyMat } from "./Otter";

/** 둥근 박공지붕: 삼각형을 밀어내고 모서리를 굴려요 */
function useRoofGeometry(w: number, d: number, h: number) {
  return useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2, 0);
    shape.lineTo(0, h);
    shape.lineTo(w / 2, 0);
    shape.lineTo(-w / 2, 0);
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: d,
      bevelEnabled: true,
      bevelThickness: 0.14,
      bevelSize: 0.14,
      bevelSegments: 4,
    });
    g.translate(0, 0, -d / 2);
    g.computeVertexNormals();
    return g;
  }, [w, d, h]);
}

function WaterWheel() {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.x -= dt * 0.8;
  });
  return (
    <group ref={ref}>
      <mesh rotation={[0, Math.PI / 2, 0]} material={toyMat(COLORS.woodDark)}>
        <torusGeometry args={[0.95, 0.07, 8, 28]} />
      </mesh>
      {Array.from({ length: 8 }).map((_, i) => (
        <group key={i} rotation={[(i / 8) * Math.PI * 2, 0, 0]}>
          <mesh position={[0, 0.5, 0]} material={toyMat(COLORS.wood)}>
            <boxGeometry args={[0.06, 1, 0.06]} />
          </mesh>
          <mesh position={[0, 0.98, 0]} material={toyMat(COLORS.wood)}>
            <boxGeometry args={[0.36, 0.08, 0.26]} />
          </mesh>
        </group>
      ))}
      <mesh rotation={[0, 0, Math.PI / 2]} material={toyMat(COLORS.navy)}>
        <cylinderGeometry args={[0.12, 0.12, 0.3, 12]} />
      </mesh>
    </group>
  );
}

function Smoke() {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(({ clock }) => {
    refs.current.forEach((m, i) => {
      if (!m) return;
      const t = (clock.elapsedTime * 0.35 + i / 3) % 1;
      m.position.set(Math.sin(t * 6 + i) * 0.12, t * 1.4, 0);
      m.scale.setScalar(0.12 + t * 0.22);
      (m.material as THREE.MeshStandardMaterial).opacity = 0.75 * (1 - t);
    });
  });
  return (
    <group>
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(m) => (refs.current[i] = m)}>
          <sphereGeometry args={[1, 12, 10]} />
          <meshStandardMaterial color="#ffffff" transparent roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

function Extras({ b }: { b: Building }) {
  const [w, d] = b.size;
  const h = b.height;
  switch (b.id) {
    case "receiver":
      return (
        <group>
          <group position={[-w / 2 - 0.25, 0.95, 0.2]}>
            <WaterWheel />
          </group>
          {/* 지붕 위 안테나 */}
          <group position={[w * 0.22, h + 1.15, 0]}>
            <mesh material={toyMat(COLORS.navy)}>
              <cylinderGeometry args={[0.04, 0.04, 0.9, 8]} />
            </mesh>
            <mesh position={[0, 0.5, 0]} rotation={[0.6, 0, 0]} material={toyMat("#FFFFFF")}>
              <sphereGeometry args={[0.28, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.6]} />
            </mesh>
            <mesh position={[0, 0.62, 0.12]} material={toyMat(COLORS.coral)}>
              <sphereGeometry args={[0.06, 10, 8]} />
            </mesh>
          </group>
        </group>
      );
    case "dock":
      return (
        <group>
          {/* 강으로 뻗은 잔교 */}
          {Array.from({ length: 9 }).map((_, i) => (
            <mesh key={i} castShadow receiveShadow position={[w * 0.18, 0.12, d / 2 + 2.2 + i * 0.5]} material={toyMat(i % 2 ? COLORS.wood : "#E2B88A")}>
              <boxGeometry args={[1.5, 0.12, 0.44]} />
            </mesh>
          ))}
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[w * 0.18 + 0.82, 0.1, d / 2 + 2.6 + i * 1.6]} material={toyMat(COLORS.woodDark)}>
              <cylinderGeometry args={[0.09, 0.09, 0.9, 8]} />
            </mesh>
          ))}
        </group>
      );
    case "library":
      return (
        <group position={[w / 2 - 0.4, 0, -0.3]}>
          <RoundedBox args={[1.4, h + 1.6, 1.4]} radius={0.14} smoothness={3} position={[0, (h + 1.6) / 2, 0]} castShadow receiveShadow material={toyMat(b.wall)} />
          <mesh position={[0, h + 1.9, 0]} castShadow material={toyMat(b.roof)}>
            <coneGeometry args={[1.05, 1.1, 4]} />
          </mesh>
          <mesh position={[0, h + 0.6, 0.71]} rotation={[Math.PI / 2, 0, 0]} material={toyMat(COLORS.sky, 0.4)}>
            <cylinderGeometry args={[0.32, 0.32, 0.05, 20]} />
          </mesh>
        </group>
      );
    case "stats":
      return (
        <group position={[w / 2 + 0.9, 0, d / 2 - 0.2]} rotation={[0, -0.3, 0]}>
          {[-0.5, 0.5].map((x) => (
            <mesh key={x} position={[x, 0.6, 0]} material={toyMat(COLORS.woodDark)}>
              <boxGeometry args={[0.1, 1.2, 0.1]} />
            </mesh>
          ))}
          <RoundedBox args={[1.4, 0.9, 0.12]} radius={0.05} position={[0, 1.4, 0]} castShadow material={toyMat("#E9C79B")} />
          {[0.3, 0.55, 0.42, 0.7].map((v, i) => (
            <mesh key={i} position={[-0.42 + i * 0.28, 1.05 + v / 2, 0.08]} material={toyMat([COLORS.sky, COLORS.mint, COLORS.coral, COLORS.butter][i])}>
              <boxGeometry args={[0.18, v, 0.04]} />
            </mesh>
          ))}
        </group>
      );
    case "dorm":
      return (
        <group position={[-w * 0.25, h + 0.5, -0.4]}>
          <RoundedBox args={[0.45, 1.1, 0.45]} radius={0.06} castShadow material={toyMat("#E7C3A0")} />
          <group position={[0, 0.7, 0]}>
            <Smoke />
          </group>
        </group>
      );
    case "office":
      return (
        <group position={[w / 2 + 0.7, 0, d / 2 - 0.3]}>
          <mesh position={[0, 1.6, 0]} material={toyMat("#FFFFFF")}>
            <cylinderGeometry args={[0.05, 0.05, 3.2, 8]} />
          </mesh>
          <Flag />
        </group>
      );
    case "cards":
      return (
        <group position={[-w / 2 - 0.5, 0, d / 2 - 0.4]} rotation={[0, 0.3, 0]}>
          {[0, 1, 2].map((i) => (
            <RoundedBox
              key={i}
              args={[0.7, 0.9, 0.05]}
              radius={0.04}
              position={[i * 0.1, 0.5 + i * 0.02, -i * 0.12]}
              rotation={[0, 0, (i - 1) * 0.12]}
              castShadow
              material={toyMat([COLORS.coral, "#FFFFFF", COLORS.sky][i])}
            />
          ))}
        </group>
      );
    case "blog":
      return (
        <group position={[w / 2 + 0.45, 0, d / 2 - 0.5]} rotation={[0, 0, -0.25]}>
          <mesh position={[0, 0.9, 0]} castShadow material={toyMat(COLORS.butter)}>
            <cylinderGeometry args={[0.16, 0.16, 1.4, 6]} />
          </mesh>
          <mesh position={[0, 0.06, 0]} rotation={[Math.PI, 0, 0]} material={toyMat("#F2D2A9")}>
            <coneGeometry args={[0.16, 0.36, 6]} />
          </mesh>
          <mesh position={[0, 1.66, 0]} material={toyMat(COLORS.coral)}>
            <cylinderGeometry args={[0.16, 0.16, 0.18, 6]} />
          </mesh>
        </group>
      );
    default:
      return null;
  }
}

function Flag() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = Math.sin(clock.elapsedTime * 2) * 0.25;
  });
  return (
    <mesh ref={ref} position={[0.4, 2.9, 0]} material={toyMat(COLORS.coral)}>
      <boxGeometry args={[0.8, 0.5, 0.04]} />
    </mesh>
  );
}

export default function BuildingMesh({ b, onSelect }: { b: Building; onSelect: (b: Building) => void }) {
  const [w, d] = b.size;
  const h = b.height;
  const roof = useRoofGeometry(w + 0.5, d + 0.4, 1.35);
  const hover = useLab((s) => s.hover === `b-${b.id}`);
  const setHover = useLab((s) => s.setHover);
  const grp = useRef<THREE.Group>(null);

  useFrame((_, dt) => {
    if (!grp.current) return;
    const target = hover ? 1.03 : 1;
    const k = 1 - Math.pow(0.001, dt);
    grp.current.scale.lerp(new THREE.Vector3(target, target, target), k);
  });

  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 8) return;
    onSelect(b);
  };

  return (
    <group position={[b.pos[0], 0, b.pos[1]]} rotation={[0, b.rot, 0]}>
      <group
        ref={grp}
        onClick={click}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(`b-${b.id}`);
        }}
        onPointerOut={() => setHover(null)}
      >
        {/* 돌 받침 */}
        <RoundedBox args={[w + 0.7, 0.24, d + 0.7]} radius={0.1} position={[0, 0.12, 0]} receiveShadow material={toyMat(COLORS.stone)} />
        {/* 벽 */}
        <RoundedBox args={[w, h, d]} radius={0.16} smoothness={4} position={[0, h / 2 + 0.2, 0]} castShadow receiveShadow material={toyMat(b.wall)} />
        {/* 지붕 */}
        <mesh geometry={roof} position={[0, h + 0.18, 0]} castShadow material={toyMat(b.roof)} />
        {/* 문 */}
        <RoundedBox args={[0.95, 1.5, 0.2]} radius={0.08} position={[0, 0.95, d / 2 + 0.02]} material={toyMat(COLORS.woodDark)} />
        <mesh position={[0, 1.38, d / 2 + 0.13]} rotation={[Math.PI / 2, 0, 0]} material={toyMat(COLORS.butter, 0.5)}>
          <cylinderGeometry args={[0.14, 0.14, 0.04, 16]} />
        </mesh>
        <mesh position={[0.3, 0.92, d / 2 + 0.14]} material={toyMat(COLORS.butter, 0.4)}>
          <sphereGeometry args={[0.05, 10, 8]} />
        </mesh>
        {/* 창문 */}
        {[-1, 1].map((s) => (
          <group key={s} position={[s * (w / 2 - 0.85), h * 0.55 + 0.2, d / 2 + 0.03]}>
            <RoundedBox args={[0.8, 0.7, 0.1]} radius={0.06} material={toyMat(b.accent)} />
            <RoundedBox args={[0.62, 0.52, 0.1]} radius={0.05} position={[0, 0, 0.03]} material={toyMat("#DDF1FF", 0.3)} />
            <mesh position={[0, 0, 0.09]} material={toyMat(b.accent)}>
              <boxGeometry args={[0.05, 0.52, 0.02]} />
            </mesh>
          </group>
        ))}
        {/* 문 앞 계단 */}
        <RoundedBox args={[1.3, 0.12, 0.6]} radius={0.04} position={[0, 0.06, d / 2 + 0.6]} receiveShadow material={toyMat("#E6E9F0")} />
        <Extras b={b} />
      </group>

      <Anchor id={`sign-${b.id}`} position={[0, h + 2.3, 0]} />
    </group>
  );
}
