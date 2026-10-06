"use client";
// 진짜 수달처럼: 길쭉한 몸, 납작하고 작은 머리, 넓은 주둥이와 수염, 굵고 긴 꼬리.
// 털은 몸 겉면을 얇은 껍질 여러 겹으로 겹쳐 그려서(셸 퍼) 보송보송하게 보여요.
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { type Gear } from "../data/buildings";
import { fabricMat, metal, pbr } from "./materials";

export type OtterAnim = "idle" | "walk" | "work" | "wave";

/** 무늬 없는 물리 재질 (예전 이름 그대로 남겨 둬요) */
export function toyMat(color: string, rough = 0.6) {
  return pbr(color, rough);
}

// ---------- 털 ----------
const FUR = new THREE.Color("#5b3f2c"); // 등·머리: 짙은 밤색
const PALE = new THREE.Color("#b49c80"); // 목·볼: 옅은 베이지
const DARK = new THREE.Color("#3e2a1d"); // 발·꼬리 끝

/** 껍질(shell) 여러 겹을 한 덩어리로 합쳐요. aShell: 0(피부) ~ 1(털 끝) */
function furry(base: THREE.BufferGeometry, shells: number) {
  const g = base;
  const uv = g.getAttribute("uv");
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i <= shells; i++) {
    const c = g.clone();
    c.setAttribute("aShell", new THREE.Float32BufferAttribute(new Float32Array(g.getAttribute("position").count).fill(i / shells), 1));
    c.setAttribute("aFurUv", uv.clone());
    c.deleteAttribute("uv");
    parts.push(c);
  }
  const merged = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  return merged;
}

/** 위치·법선에 따라 털 색을 칠해요 */
function paint(g: THREE.BufferGeometry, fn: (p: THREE.Vector3, n: THREE.Vector3) => THREE.Color) {
  const pos = g.getAttribute("position");
  const nor = g.getAttribute("normal");
  const col = new Float32Array(pos.count * 3);
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    n.fromBufferAttribute(nor, i);
    const c = fn(p, n);
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  return g;
}

const furMats = new Map<string, THREE.MeshStandardMaterial>();
/** 털 재질: 털끝으로 갈수록 가늘어지고, 뿌리 쪽은 그늘져요 */
function furMat(len: number, du: number, dv: number) {
  const key = `${len}:${du}:${dv}`;
  let m = furMats.get(key);
  if (m) return m;
  m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uFurLen = { value: len };
    sh.uniforms.uDensity = { value: new THREE.Vector2(du, dv) };
    sh.vertexShader = sh.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute float aShell;\nattribute vec2 aFurUv;\nvarying float vShell;\nvarying vec2 vFurUv;\nuniform float uFurLen;\nuniform vec2 uDensity;",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvShell = aShell;\nvFurUv = aFurUv * uDensity;\ntransformed += objectNormal * aShell * uFurLen;\ntransformed.y -= aShell * aShell * uFurLen * 0.4;",
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying float vShell;\nvarying vec2 vFurUv;\nfloat furHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }",
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        if (vShell > 0.0) {
          vec2 cell = floor(vFurUv);
          vec2 f = fract(vFurUv) - 0.5;
          float h = furHash(cell);
          float r = 0.5 * (1.0 - vShell * 0.75);
          if (vShell > 0.35 + h * 0.65 || length(f) > r) discard;
        }
        diffuseColor.rgb *= mix(0.55, 1.12, vShell) * (0.92 + furHash(floor(vFurUv)) * 0.16);`,
      );
  };
  m.customProgramCacheKey = () => "otter-fur";
  furMats.set(key, m);
  return m;
}

const SHELLS = 16;

function useOtterGeometry() {
  return useMemo(() => {
    // 몸통과 목: 아래가 통통하고 위로 갈수록 가늘어지는 원통 (선반으로 깎듯이)
    const profile = [
      [0.0, 0.02],
      [0.15, 0.04],
      [0.25, 0.12],
      [0.3, 0.26],
      [0.305, 0.42],
      [0.28, 0.6],
      [0.24, 0.78],
      [0.19, 0.95],
      [0.16, 1.08],
      [0.15, 1.2],
      [0.0, 1.24],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const torso = new THREE.LatheGeometry(profile, 40);
    torso.scale(1, 1, 0.86);
    torso.computeVertexNormals();
    paint(torso, (p, n) => {
      // 앞쪽 목과 가슴은 옅은 색
      const front = THREE.MathUtils.smoothstep(n.z, 0.1, 0.7) * THREE.MathUtils.smoothstep(p.y, 0.62, 0.95);
      return FUR.clone().lerp(PALE, front * 0.9);
    });

    // 머리: 넓고 납작한 두개골
    const skull = new THREE.SphereGeometry(1, 36, 24);
    skull.scale(0.215, 0.165, 0.2);
    paint(skull, (p, n) => {
      const cheek = THREE.MathUtils.smoothstep(-p.y, 0.02, 0.12) * THREE.MathUtils.smoothstep(n.z, -0.2, 0.5);
      return FUR.clone().lerp(PALE, cheek);
    });

    // 주둥이와 아래턱 (짧은 털)
    const muzzle = new THREE.SphereGeometry(1, 28, 18);
    muzzle.scale(0.125, 0.08, 0.1);
    paint(muzzle, (p) => FUR.clone().lerp(PALE, THREE.MathUtils.smoothstep(-p.y, -0.02, 0.06) * 0.85 + 0.15));
    const pads = mergeGeometries(
      [-1, 1].map((s) => {
        const g = new THREE.SphereGeometry(0.044, 18, 12);
        g.translate(0.043 * s, 0, 0);
        return g;
      }),
    )!;
    paint(pads, () => PALE.clone().multiplyScalar(0.95));

    // 꼬리: 뿌리는 굵고 끝은 가늘게, 땅을 따라 뒤로
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.26, -0.18),
      new THREE.Vector3(0, 0.12, -0.42),
      new THREE.Vector3(0.02, 0.06, -0.72),
      new THREE.Vector3(0.08, 0.05, -1.0),
    ]);
    const tail = new THREE.TubeGeometry(curve, 24, 1, 14, false);
    {
      const pos = tail.getAttribute("position");
      const uvs = tail.getAttribute("uv");
      const v = new THREE.Vector3();
      const c = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        const t = uvs.getX(i);
        curve.getPointAt(t, c);
        v.fromBufferAttribute(pos, i).sub(c);
        const rad = THREE.MathUtils.lerp(0.13, 0.025, Math.pow(t, 0.8));
        v.multiplyScalar(rad).add(c);
        pos.setXYZ(i, v.x, v.y, v.z);
      }
      tail.computeVertexNormals();
      paint(tail, (p) => FUR.clone().lerp(DARK, THREE.MathUtils.smoothstep(-p.z, 0.5, 1.0) * 0.6));
    }

    // 앞다리
    const arm = new THREE.CapsuleGeometry(0.052, 0.2, 6, 12);
    arm.translate(0, -0.14, 0);
    paint(arm, (p) => FUR.clone().lerp(DARK, THREE.MathUtils.smoothstep(-p.y, 0.12, 0.26) * 0.7));

    const ear = new THREE.SphereGeometry(0.035, 14, 10);
    paint(ear, () => FUR.clone().multiplyScalar(0.85));

    return {
      ear: furry(ear, 6),
      torso: furry(torso, SHELLS),
      skull: furry(skull, SHELLS),
      muzzle: furry(muzzle, 6),
      pads: furry(pads, 5),
      tail: furry(tail, SHELLS),
      arm: furry(arm, 8),
    };
  }, []);
}

// 얼굴의 단단한 부분
const NOSE = new THREE.MeshPhysicalMaterial({ color: "#1d1512", roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.3 });
const EYE = new THREE.MeshPhysicalMaterial({ color: "#0c0807", roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.02 });
const PAW = new THREE.MeshStandardMaterial({ color: "#3a281c", roughness: 0.7 });
const WHISKER = new THREE.LineBasicMaterial({ color: "#efe9df", transparent: true, opacity: 0.75 });

function Whiskers() {
  const geo = useMemo(() => {
    const pts: number[] = [];
    for (const s of [-1, 1])
      for (let i = 0; i < 7; i++) {
        const y = -0.01 - i * 0.008;
        const z = 0.05 - (i % 3) * 0.01;
        pts.push(0.07 * s, y, z, (0.2 + (i % 2) * 0.04) * s, y - 0.03 + i * 0.006, z - 0.08);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);
  return <lineSegments geometry={geo} material={WHISKER} />;
}

// ---------- 소품 (실제 옷감·금속) ----------

/** 머리에 쓰는 것 (머리 기준 좌표, 머리 반지름 약 0.21) */
function HeadGear({ gear }: { gear: Gear }) {
  switch (gear) {
    case "beretBag":
      return (
        <group position={[0.03, 0.15, -0.02]} rotation={[0.1, 0, -0.3]}>
          <mesh castShadow material={fabricMat("#8e2f2b", 3)} scale={[1, 0.3, 1]}>
            <sphereGeometry args={[0.19, 28, 16]} />
          </mesh>
          <mesh position={[0, 0.06, 0]} material={fabricMat("#7a2724", 3)}>
            <cylinderGeometry args={[0.008, 0.008, 0.03, 6]} />
          </mesh>
        </group>
      );
    case "headset":
      return (
        <group>
          <mesh position={[0, 0.02, -0.02]} material={pbr("#1c1d1f", 0.4)}>
            <torusGeometry args={[0.215, 0.012, 8, 32, Math.PI]} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[0.215 * s, 0, -0.02]} rotation={[0, 0, Math.PI / 2]} castShadow material={pbr("#1c1d1f", 0.45)}>
              <cylinderGeometry args={[0.06, 0.06, 0.04, 20]} />
            </mesh>
          ))}
          <mesh position={[0.17, -0.09, 0.09]} rotation={[0.9, 0.5, 0]} material={pbr("#1c1d1f", 0.4)}>
            <cylinderGeometry args={[0.006, 0.006, 0.18, 6]} />
          </mesh>
        </group>
      );
    case "glasses":
      return (
        <group position={[0, 0.03, 0.195]}>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[0.075 * s, 0, 0]} material={metal("#a68a55", 0.3)}>
              <torusGeometry args={[0.045, 0.005, 8, 24]} />
            </mesh>
          ))}
          <mesh material={metal("#a68a55", 0.3)}>
            <boxGeometry args={[0.06, 0.005, 0.005]} />
          </mesh>
        </group>
      );
    case "captainHat":
      return (
        <group position={[0, 0.14, -0.01]} rotation={[0.08, 0, 0]}>
          <mesh castShadow material={fabricMat("#f3f2ee", 2)}>
            <cylinderGeometry args={[0.15, 0.16, 0.1, 28]} />
          </mesh>
          <mesh position={[0, -0.03, 0]} material={fabricMat("#1f2a3c", 2)}>
            <cylinderGeometry args={[0.162, 0.162, 0.03, 28]} />
          </mesh>
          <mesh position={[0, -0.045, 0.11]} rotation={[0.3, 0, 0]} scale={[1, 0.15, 0.6]} material={pbr("#111418", 0.25)}>
            <sphereGeometry args={[0.14, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
          <mesh position={[0, 0.0, 0.16]} material={metal("#c9a24f", 0.3)}>
            <sphereGeometry args={[0.016, 10, 8]} />
          </mesh>
        </group>
      );
    default:
      return null;
  }
}

/** 몸에 걸치는 것 (몸통 기준 좌표) */
function BodyGear({ gear }: { gear: Gear }) {
  switch (gear) {
    case "beretBag":
      return (
        <group>
          {/* 가죽 크로스백 */}
          <mesh position={[0, 0.72, 0]} rotation={[0, 0, 0.8]} scale={[1, 1, 0.82]} material={pbr("#5a3a24", 0.5)}>
            <torusGeometry args={[0.29, 0.012, 8, 40]} />
          </mesh>
          <group position={[0.27, 0.4, 0.15]} rotation={[0, 0.6, 0.12]}>
            <mesh castShadow material={pbr("#6b442a", 0.5)}>
              <boxGeometry args={[0.2, 0.17, 0.07]} />
            </mesh>
            <mesh position={[0, 0.04, 0.038]} material={pbr("#5a3a24", 0.45)}>
              <boxGeometry args={[0.2, 0.09, 0.01]} />
            </mesh>
            <mesh position={[0, 0.0, 0.045]} material={metal("#c9a24f", 0.3)}>
              <boxGeometry args={[0.03, 0.02, 0.008]} />
            </mesh>
          </group>
        </group>
      );
    case "apron":
      return (
        <group>
          <mesh position={[0, 0.5, 0.035]} scale={[0.335, 0.46, 0.265]} castShadow material={fabricMat("#56636b", 3)}>
            <sphereGeometry args={[1, 24, 16, 0.55, Math.PI - 1.1, Math.PI * 0.2, Math.PI * 0.6]} />
          </mesh>
          <mesh position={[0.08, 0.42, 0.3]} rotation={[0.1, 0, 0]} material={fabricMat("#36424b", 3)}>
            <boxGeometry args={[0.12, 0.08, 0.01]} />
          </mesh>
          <mesh position={[0, 0.95, 0.03]} rotation={[Math.PI / 2 - 0.15, 0, 0]} material={fabricMat("#3f4d57", 3)}>
            <torusGeometry args={[0.175, 0.01, 6, 28]} />
          </mesh>
        </group>
      );
    case "cardigan":
      return (
        <mesh castShadow scale={[1, 1, 0.9]} material={fabricMat("#8a7f9e", 4)}>
          <latheGeometry
            args={[
              [
                [0.3, 0.22],
                [0.335, 0.4],
                [0.31, 0.6],
                [0.27, 0.78],
                [0.22, 0.95],
                [0.2, 1.04],
              ].map(([r, y]) => new THREE.Vector2(r * 1, y)),
              32,
              Math.PI * 0.12,
              Math.PI * 1.76,
            ]}
          />
        </mesh>
      );
    case "scarf":
      return (
        <group>
          <mesh position={[0, 1.0, 0.0]} rotation={[Math.PI / 2 - 0.1, 0, 0]} scale={[1, 0.86, 1]} castShadow material={fabricMat("#c79a3e", 4)}>
            <torusGeometry args={[0.21, 0.05, 12, 32]} />
          </mesh>
          <mesh position={[0.1, 0.84, 0.2]} rotation={[0.25, 0, 0.15]} castShadow material={fabricMat("#c79a3e", 4)}>
            <boxGeometry args={[0.1, 0.26, 0.03]} />
          </mesh>
        </group>
      );
    case "nametag":
      return (
        <group position={[-0.1, 0.8, 0.235]} rotation={[-0.25, -0.25, 0]}>
          <mesh material={pbr("#fbfbf9", 0.4)}>
            <boxGeometry args={[0.11, 0.07, 0.006]} />
          </mesh>
          <mesh position={[0, 0.022, 0.004]} material={pbr("#3d6b54", 0.5)}>
            <boxGeometry args={[0.11, 0.022, 0.002]} />
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
  const geo = useOtterGeometry();
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

  const fur = furMat(0.02, 260, 150);
  const fineFur = furMat(0.008, 140, 90);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed * 1.7;
    const a = animRef?.current ?? anim;
    if (!body.current || !head.current || !armL.current || !armR.current || !footL.current || !footR.current || !tail.current) return;

    // 숨쉬기와 두리번거림
    let bob = Math.sin(t * 2.2) * 0.008;
    let roll = 0;
    let lean = 0.05;
    let headNod = Math.sin(t * 1.1) * 0.05;
    let headTurn = Math.sin(t * 0.5) * 0.25 + Math.sin(t * 1.7) * 0.05;
    let aL = 0.18;
    let aR = -0.18;
    let aLx = -0.35;
    let aRx = -0.35;
    let fL = 0;
    let fR = 0;

    if (a === "walk") {
      const w = t * 10;
      bob = Math.abs(Math.sin(w)) * 0.05;
      roll = Math.sin(w) * 0.06;
      lean = 0.16;
      headNod = 0.05;
      headTurn = 0;
      aLx = -0.4 + Math.sin(w) * 0.6;
      aRx = -0.4 - Math.sin(w) * 0.6;
      fL = Math.sin(w) * 0.1;
      fR = -Math.sin(w) * 0.1;
    } else if (a === "work") {
      lean = 0.14;
      headNod = 0.22 + Math.sin(t * 3) * 0.04;
      headTurn = Math.sin(t * 0.7) * 0.18;
      aLx = -1.15 + Math.sin(t * 14) * 0.12;
      aRx = -1.15 + Math.sin(t * 14 + 1.4) * 0.12;
      aL = 0.1;
      aR = -0.1;
    } else if (a === "wave") {
      aR = -2.3 + Math.sin(t * 9) * 0.35;
      aRx = -0.2;
      headTurn = 0.15;
      bob = Math.abs(Math.sin(t * 4)) * 0.02;
    }

    body.current.position.y = bob;
    body.current.rotation.z = roll;
    body.current.rotation.x = lean;
    head.current.rotation.x = headNod;
    head.current.rotation.y = headTurn;
    armL.current.rotation.set(aLx, 0, aL);
    armR.current.rotation.set(aRx, 0, aR);
    footL.current.position.z = 0.1 + fL;
    footR.current.position.z = 0.1 + fR;
    tail.current.rotation.y = Math.sin(t * (a === "walk" ? 10 : 1.2)) * (a === "walk" ? 0.18 : 0.08);

    // 눈 깜빡임
    if (eyes.current) {
      const since = clock.elapsedTime - blinkAt.current;
      eyes.current.scale.y = since > 0 && since < 0.12 ? 0.15 : 1;
      if (since > 0.12) blinkAt.current = clock.elapsedTime + 2.5 + Math.random() * 3;
    }
  });

  return (
    <group ref={root} scale={scale}>
      {/* 물갈퀴 달린 뒷발 (몸이 흔들려도 땅에 붙어 있어요) */}
      <mesh ref={footL} castShadow position={[-0.14, 0.03, 0.1]} scale={[0.085, 0.035, 0.15]} material={PAW}>
        <sphereGeometry args={[1, 16, 10]} />
      </mesh>
      <mesh ref={footR} castShadow position={[0.14, 0.03, 0.1]} scale={[0.085, 0.035, 0.15]} material={PAW}>
        <sphereGeometry args={[1, 16, 10]} />
      </mesh>

      {/* 꼬리 (몸통 뿌리에서 땅으로) */}
      <group ref={tail} position={[0, 0, 0]}>
        <mesh geometry={geo.tail} material={fur} castShadow receiveShadow />
      </group>

      <group ref={body}>
        <mesh geometry={geo.torso} material={fur} castShadow receiveShadow />

        {/* 앞다리 (어깨 기준으로 돌아가요) */}
        <group ref={armL} position={[-0.2, 0.86, 0.1]}>
          <mesh geometry={geo.arm} material={fur} castShadow />
          <mesh position={[0, -0.29, 0.01]} scale={[1, 0.7, 1.15]} material={PAW}>
            <sphereGeometry args={[0.048, 12, 8]} />
          </mesh>
        </group>
        <group ref={armR} position={[0.2, 0.86, 0.1]}>
          <mesh geometry={geo.arm} material={fur} castShadow />
          <mesh position={[0, -0.29, 0.01]} scale={[1, 0.7, 1.15]} material={PAW}>
            <sphereGeometry args={[0.048, 12, 8]} />
          </mesh>
        </group>

        {/* 머리 */}
        <group ref={head} position={[0, 1.3, 0.04]}>
          <mesh geometry={geo.skull} material={fur} castShadow />
          {/* 작은 귀 */}
          {[-1, 1].map((s) => (
            <mesh key={s} geometry={geo.ear} position={[0.175 * s, 0.075, -0.06]} rotation={[0, 0, -0.5 * s]} scale={[1, 0.8, 0.45]} material={fineFur} />
          ))}
          <group position={[0, -0.045, 0.14]}>
            <mesh geometry={geo.muzzle} material={fineFur} castShadow />
            <group position={[0, -0.012, 0.072]}>
              <mesh geometry={geo.pads} material={fineFur} />
              <Whiskers />
            </group>
            {/* 코 */}
            <mesh position={[0, 0.026, 0.092]} scale={[1.3, 0.72, 0.7]} material={NOSE}>
              <sphereGeometry args={[0.026, 16, 10]} />
            </mesh>
          </group>
          {/* 눈: 작고 까맣고 반짝 */}
          <group ref={eyes} position={[0, 0.035, 0]}>
            {[-1, 1].map((s) => (
              <mesh key={s} position={[0.1 * s, 0, 0.178]} material={EYE}>
                <sphereGeometry args={[0.021, 16, 12]} />
              </mesh>
            ))}
          </group>
          <HeadGear gear={gear} />
        </group>

        <BodyGear gear={gear} />
      </group>
    </group>
  );
}
