"use client";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import { COLORS, type Gear } from "../data/buildings";
import { toon } from "./style";

export type OtterAnim = "idle" | "walk" | "work" | "wave";

/** 그림책 같은 툰 재질 (예전 이름 그대로 써요. 두 번째 인자는 이제 쓰지 않아요) */
export function toyMat(color: string, _rough?: number) {
  return toon(color);
}

const BLUSH = new THREE.MeshBasicMaterial({ color: "#FF9FAE", transparent: true, opacity: 0.55 });
const EYE = toyMat("#2A2230", 0.35);
const WHITE = new THREE.MeshBasicMaterial({ color: "#ffffff" });

/** 머리에 붙는 소품 (머리 기준 좌표) */
function HeadGear({ gear }: { gear: Gear }) {
  switch (gear) {
    case "beretBag":
      return (
        <group position={[0.06, 0.42, -0.02]} rotation={[0.12, 0, -0.28]}>
          <mesh castShadow material={toyMat(COLORS.coral)} scale={[1, 0.32, 1]}>
            <sphereGeometry args={[0.36, 24, 16]} />
          </mesh>
          <mesh castShadow position={[0, 0.13, 0]} material={toyMat(COLORS.coralDeep)}>
            <sphereGeometry args={[0.05, 12, 8]} />
          </mesh>
        </group>
      );
    case "headset":
      return (
        <group position={[0, 0.04, 0]}>
          <mesh material={toyMat(COLORS.navy)}>
            <torusGeometry args={[0.5, 0.035, 8, 24, Math.PI]} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[0.5 * s, -0.02, 0]} rotation={[0, 0, Math.PI / 2]} material={toyMat(COLORS.sky)}>
              <cylinderGeometry args={[0.11, 0.11, 0.08, 18]} />
            </mesh>
          ))}
          <mesh position={[0.38, -0.2, 0.25]} rotation={[0.9, 0.5, 0]} material={toyMat(COLORS.navy)}>
            <cylinderGeometry args={[0.018, 0.018, 0.34, 6]} />
          </mesh>
          <mesh position={[0.25, -0.31, 0.4]} material={toyMat(COLORS.coral)}>
            <sphereGeometry args={[0.04, 10, 8]} />
          </mesh>
        </group>
      );
    case "glasses":
      return (
        <group position={[0, 0.06, 0.45]}>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[0.17 * s, 0, 0]} material={toyMat(COLORS.navy, 0.4)}>
              <torusGeometry args={[0.11, 0.018, 8, 24]} />
            </mesh>
          ))}
          <mesh material={toyMat(COLORS.navy, 0.4)}>
            <boxGeometry args={[0.1, 0.02, 0.02]} />
          </mesh>
        </group>
      );
    case "captainHat":
      return (
        <group position={[0, 0.4, 0]} rotation={[0.1, 0, 0]}>
          <mesh castShadow material={toyMat("#FFFFFF")}>
            <cylinderGeometry args={[0.3, 0.32, 0.22, 24]} />
          </mesh>
          <mesh position={[0, -0.05, 0]} material={toyMat(COLORS.navy)}>
            <cylinderGeometry args={[0.325, 0.325, 0.07, 24]} />
          </mesh>
          <mesh position={[0, -0.1, 0.2]} rotation={[0.35, 0, 0]} material={toyMat(COLORS.navy)} scale={[1, 0.2, 0.7]}>
            <sphereGeometry args={[0.28, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
          <mesh position={[0, 0.02, 0.31]} material={toyMat(COLORS.butter)}>
            <sphereGeometry args={[0.04, 10, 8]} />
          </mesh>
        </group>
      );
    default:
      return null;
  }
}

/** 몸에 붙는 소품 (몸통 기준 좌표) */
function BodyGear({ gear }: { gear: Gear }) {
  switch (gear) {
    case "beretBag":
      return (
        <group>
          <mesh position={[0, 0.74, 0.02]} rotation={[0, 0, 0.75]} material={toyMat(COLORS.navy)} scale={[1, 1, 0.86]}>
            <torusGeometry args={[0.5, 0.028, 8, 32]} />
          </mesh>
          <group position={[0.42, 0.42, 0.2]} rotation={[0, 0.5, 0.15]}>
            <mesh castShadow material={toyMat(COLORS.mint)}>
              <boxGeometry args={[0.26, 0.22, 0.12]} />
            </mesh>
            <mesh position={[0, 0.06, 0.065]} material={toyMat(COLORS.mintDeep)}>
              <boxGeometry args={[0.27, 0.1, 0.02]} />
            </mesh>
            <mesh position={[0, 0.04, 0.08]} material={toyMat(COLORS.butter)}>
              <sphereGeometry args={[0.025, 8, 6]} />
            </mesh>
          </group>
        </group>
      );
    case "apron":
      return (
        <group>
          <mesh position={[0, 0.56, 0.3]} rotation={[-0.08, 0, 0]} material={toyMat(COLORS.coral)} scale={[0.42, 0.42, 0.24]}>
            <sphereGeometry args={[1, 20, 14, -Math.PI / 2, Math.PI, Math.PI * 0.3, Math.PI * 0.55]} />
          </mesh>
          <mesh position={[0, 0.98, 0.26]} material={toyMat(COLORS.coralDeep)}>
            <boxGeometry args={[0.46, 0.05, 0.05]} />
          </mesh>
          <mesh position={[0.1, 0.5, 0.53]} material={toyMat(COLORS.cream)}>
            <boxGeometry args={[0.14, 0.1, 0.02]} />
          </mesh>
        </group>
      );
    case "cardigan":
      return (
        <group>
          <mesh castShadow position={[0, 0.6, -0.01]} material={toyMat("#B9A6F2")} scale={[0.545, 0.62, 0.495]}>
            <sphereGeometry args={[1, 24, 18, Math.PI * 0.62, Math.PI * 1.76]} />
          </mesh>
          {[0.78, 0.62, 0.46].map((y) => (
            <mesh key={y} position={[0.14, y, 0.44]} material={toyMat(COLORS.butter)}>
              <sphereGeometry args={[0.03, 8, 6]} />
            </mesh>
          ))}
        </group>
      );
    case "scarf":
      return (
        <group>
          <mesh position={[0, 0.98, 0.02]} rotation={[Math.PI / 2 - 0.12, 0, 0]} material={toyMat(COLORS.butter)}>
            <torusGeometry args={[0.36, 0.085, 10, 28]} />
          </mesh>
          <mesh position={[0.16, 0.8, 0.3]} rotation={[0.2, 0, 0.2]} material={toyMat(COLORS.butter)}>
            <boxGeometry args={[0.13, 0.32, 0.06]} />
          </mesh>
          <mesh position={[0.17, 0.66, 0.33]} rotation={[0.2, 0, 0.2]} material={toyMat(COLORS.coral)}>
            <boxGeometry args={[0.135, 0.05, 0.065]} />
          </mesh>
        </group>
      );
    case "nametag":
      return (
        <group position={[-0.16, 0.84, 0.43]} rotation={[-0.2, -0.3, 0]}>
          <mesh material={toyMat("#FFFFFF")}>
            <boxGeometry args={[0.2, 0.13, 0.02]} />
          </mesh>
          <mesh position={[0, 0.04, 0.012]} material={toyMat(COLORS.leafDeep)}>
            <boxGeometry args={[0.2, 0.04, 0.01]} />
          </mesh>
        </group>
      );
    default:
      return null;
  }
}

export default function Otter({
  gear,
  anim = "idle",
  animRef,
  scale = 1,
  seed = 0,
}: {
  gear: Gear;
  anim?: OtterAnim;
  animRef?: MutableRefObject<OtterAnim>;
  scale?: number;
  seed?: number;
}) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const footL = useRef<THREE.Mesh>(null);
  const footR = useRef<THREE.Mesh>(null);
  const tail = useRef<THREE.Group>(null);
  const blinkAt = useRef(2 + seed);
  const eyes = useRef<THREE.Group>(null);

  const fur = useMemo(() => toyMat(COLORS.otter), []);
  const furDark = useMemo(() => toyMat(COLORS.otterDark), []);
  const cream = useMemo(() => toyMat(COLORS.otterCream), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed * 1.7;
    const a = animRef?.current ?? anim;
    if (!body.current || !head.current || !armL.current || !armR.current || !footL.current || !footR.current || !tail.current) return;

    let bob = Math.sin(t * 2.2) * 0.015;
    let roll = 0;
    let headNod = Math.sin(t * 1.1) * 0.04;
    let headTurn = Math.sin(t * 0.5) * 0.12;
    let aL = 0.25;
    let aR = -0.25;
    let aLx = 0;
    let aRx = 0;
    let fL = 0;
    let fR = 0;

    if (a === "walk") {
      const w = t * 11;
      bob = Math.abs(Math.sin(w)) * 0.08;
      roll = Math.sin(w) * 0.09;
      headNod = 0.06;
      headTurn = 0;
      aLx = Math.sin(w) * 0.7;
      aRx = -Math.sin(w) * 0.7;
      fL = Math.sin(w) * 0.12;
      fR = -Math.sin(w) * 0.12;
    } else if (a === "work") {
      headNod = 0.18 + Math.sin(t * 3) * 0.05;
      headTurn = Math.sin(t * 0.7) * 0.2;
      aLx = -1.1 + Math.sin(t * 14) * 0.15;
      aRx = -1.1 + Math.sin(t * 14 + 1.4) * 0.15;
      aL = 0.15;
      aR = -0.15;
    } else if (a === "wave") {
      aR = -2.4 + Math.sin(t * 9) * 0.35;
      headTurn = 0.15;
      bob = Math.abs(Math.sin(t * 4)) * 0.04;
    }

    body.current.position.y = bob;
    body.current.rotation.z = roll;
    head.current.rotation.x = headNod;
    head.current.rotation.y = headTurn;
    armL.current.rotation.set(aLx, 0, aL);
    armR.current.rotation.set(aRx, 0, aR);
    footL.current.position.z = 0.12 + fL;
    footR.current.position.z = 0.12 + fR;
    tail.current.rotation.y = Math.sin(t * (a === "walk" ? 11 : 1.6)) * 0.25;

    // 눈 깜빡임
    if (eyes.current) {
      const since = clock.elapsedTime - blinkAt.current;
      eyes.current.scale.y = since > 0 && since < 0.12 ? 0.15 : 1;
      if (since > 0.12) blinkAt.current = clock.elapsedTime + 2.5 + Math.random() * 3;
    }
  });

  return (
    <group ref={root} scale={scale}>
      {/* 발 (몸이 흔들려도 땅에 붙어 있어요) */}
      <mesh ref={footL} castShadow position={[-0.2, 0.07, 0.12]} scale={[1, 0.6, 1.3]} material={furDark}>
        <sphereGeometry args={[0.12, 14, 10]} />
      </mesh>
      <mesh ref={footR} castShadow position={[0.2, 0.07, 0.12]} scale={[1, 0.6, 1.3]} material={furDark}>
        <sphereGeometry args={[0.12, 14, 10]} />
      </mesh>

      <group ref={body}>
        {/* 몸통과 배 */}
        <mesh castShadow position={[0, 0.6, 0]} scale={[0.52, 0.6, 0.47]} material={fur}>
          <sphereGeometry args={[1, 28, 20]} />
        </mesh>
        <mesh position={[0, 0.66, 0.19]} scale={[0.36, 0.48, 0.3]} material={cream}>
          <sphereGeometry args={[1, 24, 16]} />
        </mesh>

        {/* 굵고 둥근 꼬리 */}
        <group ref={tail} position={[0, 0.3, -0.42]}>
          <mesh castShadow rotation={[-1.05, 0, 0]} position={[0, 0.05, -0.28]} material={furDark}>
            <capsuleGeometry args={[0.13, 0.5, 6, 12]} />
          </mesh>
        </group>

        {/* 팔 (어깨 기준으로 돌아가요) */}
        <group ref={armL} position={[-0.44, 0.86, 0.06]}>
          <mesh castShadow position={[0, -0.18, 0]} material={fur}>
            <capsuleGeometry args={[0.09, 0.22, 6, 10]} />
          </mesh>
        </group>
        <group ref={armR} position={[0.44, 0.86, 0.06]}>
          <mesh castShadow position={[0, -0.18, 0]} material={fur}>
            <capsuleGeometry args={[0.09, 0.22, 6, 10]} />
          </mesh>
        </group>

        {/* 머리 */}
        <group ref={head} position={[0, 1.32, 0]}>
          <mesh castShadow scale={[1.14, 0.86, 0.96]} material={fur}>
            <sphereGeometry args={[0.48, 32, 24]} />
          </mesh>
          {/* 귀 */}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[0.44 * s, 0.2, -0.06]} scale={[0.9, 0.8, 0.6]} material={furDark}>
              <sphereGeometry args={[0.1, 14, 10]} />
            </mesh>
          ))}
          {/* 얼굴 크림색 부분과 주둥이 */}
          <mesh position={[0, -0.12, 0.27]} scale={[0.42, 0.25, 0.25]} material={cream}>
            <sphereGeometry args={[1, 24, 16]} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[0.085 * s, -0.09, 0.44]} scale={[1, 0.85, 0.8]} material={cream}>
              <sphereGeometry args={[0.1, 16, 12]} />
            </mesh>
          ))}
          <mesh position={[0, -0.03, 0.52]} scale={[1.3, 0.85, 0.9]} material={toyMat("#4A3326", 0.4)}>
            <sphereGeometry args={[0.065, 14, 10]} />
          </mesh>
          <mesh position={[-0.03, -0.01, 0.575]} material={WHITE}>
            <sphereGeometry args={[0.014, 6, 6]} />
          </mesh>
          {/* 입 */}
          <mesh position={[0, -0.16, 0.5]} rotation={[0, 0, Math.PI]} material={toyMat("#4A3326", 0.6)}>
            <torusGeometry args={[0.04, 0.009, 6, 12, Math.PI]} />
          </mesh>
          {/* 수염 점 */}
          {[-1, 1].map((s) =>
            [0, 1].map((k) => (
              <mesh key={`${s}${k}`} position={[0.11 * s + 0.045 * s * k, -0.07 - 0.04 * k, 0.52 - 0.03 * k]} material={toyMat("#7A5136")}>
                <sphereGeometry args={[0.012, 6, 6]} />
              </mesh>
            )),
          )}
          {/* 눈 */}
          <group ref={eyes} position={[0, 0.05, 0]}>
            {[-1, 1].map((s) => (
              <group key={s} position={[0.2 * s, 0, 0.4]}>
                <mesh material={EYE} scale={[0.9, 1.1, 0.6]}>
                  <sphereGeometry args={[0.068, 16, 12]} />
                </mesh>
                <mesh position={[0.022, 0.028, 0.04]} material={WHITE}>
                  <sphereGeometry args={[0.02, 8, 6]} />
                </mesh>
              </group>
            ))}
          </group>
          {/* 볼터치 */}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[0.29 * s, -0.12, 0.37]} rotation={[0, 0.55 * s, 0]} material={BLUSH}>
              <circleGeometry args={[0.07, 16]} />
            </mesh>
          ))}
          <HeadGear gear={gear} />
        </group>

        <BodyGear gear={gear} />
      </group>
    </group>
  );
}
