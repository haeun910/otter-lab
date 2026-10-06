"use client";
// 실제 오후 햇살: 하늘빛(환경광), 해(그림자), 그리고 사진처럼 다듬는 후처리
import { Environment, Lightformer } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { useMemo } from "react";
import * as THREE from "three";
import { SITE } from "../data/buildings";

export const HAZE = "#c9d6dc"; // 먼 곳 공기 색 (지평선)

/** 위는 파란 하늘, 지평선은 옅은 안개, 아래는 풀빛 땅. 환경광으로만 써요 */
function SkyDome() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          top: { value: new THREE.Color("#4f86c6") },
          horizon: { value: new THREE.Color("#dfe8ec") },
          ground: { value: new THREE.Color("#5d6b45") },
        },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 top; uniform vec3 horizon; uniform vec3 ground;
          varying vec3 vDir;
          void main() {
            float y = vDir.y;
            vec3 c = y > 0.0 ? mix(horizon, top, pow(y, 0.6)) : mix(horizon, ground, pow(-y, 0.35));
            gl_FragColor = vec4(c, 1.0);
          }
        `,
      }),
    [],
  );
  return (
    <mesh material={mat} scale={100}>
      <sphereGeometry args={[1, 32, 16]} />
    </mesh>
  );
}

export const SUN_DIR = new THREE.Vector3(-0.55, 0.72, 0.42).normalize();

export function Sky() {
  return (
    <Environment resolution={256} frames={1} environmentIntensity={0.6}>
      <SkyDome />
      {/* 해: 반사에 맺히는 밝은 점 */}
      <Lightformer form="circle" intensity={30} color="#fff1d6" position={SUN_DIR.clone().multiplyScalar(60).toArray()} scale={8} target={[0, 0, 0]} />
      {/* 넓은 하늘 쪽 부드러운 빛 */}
      <Lightformer form="rect" intensity={1.2} color="#e8f1ff" position={[0, 60, 0]} rotation-x={Math.PI / 2} scale={[80, 80, 1]} />
    </Environment>
  );
}

/** 해: 따뜻한 오후 햇살과 부드러운 그림자 */
export function Sun() {
  const r = Math.max(SITE.maxX - SITE.minX, SITE.riverZ - SITE.minZ) * 0.72;
  const pos = SUN_DIR.clone().multiplyScalar(50);
  const cz = (SITE.minZ + SITE.riverZ) / 2;
  const target = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(0, 0, cz);
    return o;
  }, [cz]);
  return (
    <>
      <primitive object={target} />
      <directionalLight
        position={[pos.x, pos.y, pos.z + cz]}
        target={target}
        intensity={4.6}
        color="#fff0dc"
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-bias={-0.0002}
        shadow-normalBias={0.03}
        shadow-radius={4}
        shadow-camera-left={-r}
        shadow-camera-right={r}
        shadow-camera-top={r}
        shadow-camera-bottom={-r}
        shadow-camera-near={1}
        shadow-camera-far={120}
      />
      {/* 그늘이 새까맣지 않게: 하늘에서 오는 아주 옅은 빛 */}
      <hemisphereLight args={["#dbe8ff", "#6b6448", 0.25]} />
    </>
  );
}

/** 사진처럼: 구석 그늘(AO) → 밝은 곳 번짐 → 필름 같은 톤 → 가장자리 정리 */
export function Effects() {
  const small = useThree((s) => s.size.width < 720);
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <N8AO aoRadius={0.9} distanceFalloff={0.6} intensity={2.2} quality={small ? "low" : "medium"} halfRes={small} color="#1b1712" />
      <Bloom mipmapBlur luminanceThreshold={1.1} intensity={0.35} radius={0.6} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette offset={0.35} darkness={0.35} />
      <SMAA />
    </EffectComposer>
  );
}
