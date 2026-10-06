"use client";
// 다 그린 장면 위에 세피아 잉크 외곽선과 종이 결을 얹어서 그림책처럼 보이게 해요.
// 장면을 한 번 그림판(렌더 타깃)에 그리고, 깊이가 갑자기 달라지는 곳에 선을 그어요.
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { INK } from "./style";

const vert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const frag = /* glsl */ `
  uniform sampler2D tColor;
  uniform sampler2D tDepth;
  uniform vec2 texel;
  uniform float cameraNear;
  uniform float cameraFar;
  uniform float pxWorld;   // 화면 한 칸이 세상에서 몇 칸인지 (정사영)
  uniform vec3 ink;
  uniform float grain;
  varying vec2 vUv;

  float depthAt(vec2 uv) { return cameraNear + texture2D(tDepth, uv).x * (cameraFar - cameraNear); }
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

  void main() {
    vec4 c = texture2D(tColor, vUv);
    float d = depthAt(vUv);
    vec2 o = texel * 1.5;
    float dl = depthAt(vUv - vec2(o.x, 0.0));
    float dr = depthAt(vUv + vec2(o.x, 0.0));
    float du = depthAt(vUv + vec2(0.0, o.y));
    float dd = depthAt(vUv - vec2(0.0, o.y));
    // 평평한 면은 기울어져 있어도 깊이가 고르게 변해서 양옆 평균과 같아요.
    // 물체 테두리처럼 깊이가 툭 끊기는 곳만 평균에서 벗어나요 (2차 미분)
    float lap = max(abs(dl + dr - 2.0 * d), abs(du + dd - 2.0 * d));
    float lo = pxWorld * 1.5 + 0.02;
    float edge = smoothstep(lo, lo * 2.5, lap);
    vec3 col = mix(c.rgb, ink, edge * 0.85);
    // 종이 결: 아주 옅은 얼룩과 알갱이
    float g = hash(floor(gl_FragCoord.xy * 0.5)) - 0.5;
    col *= 1.0 + g * grain;
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

export default function Illustrate() {
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);

  const target = useMemo(() => {
    const rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: 4 });
    rt.depthTexture = new THREE.DepthTexture(2, 2, THREE.FloatType);
    return rt;
  }, []);
  const quad = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: {
        tColor: { value: target.texture },
        tDepth: { value: target.depthTexture },
        texel: { value: new THREE.Vector2() },
        cameraNear: { value: 1 },
        cameraFar: { value: 200 },
        pxWorld: { value: 0.03 },
        ink: { value: new THREE.Color(INK) },
        grain: { value: 0.035 },
      },
      depthTest: false,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    mesh.frustumCulled = false;
    const scene = new THREE.Scene();
    scene.add(mesh);
    return { scene, mat, cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1) };
  }, [target]);

  useEffect(() => {
    const w = Math.max(2, Math.floor(size.width * dpr));
    const h = Math.max(2, Math.floor(size.height * dpr));
    target.setSize(w, h);
    quad.mat.uniforms.texel.value.set(1 / w, 1 / h);
  }, [size, dpr, target, quad]);

  useEffect(
    () => () => {
      target.dispose();
      quad.mat.dispose();
    },
    [target, quad],
  );

  // 우선순위 1: 기본 그리기를 대신해요
  useFrame(({ scene, camera }) => {
    const u = quad.mat.uniforms;
    u.cameraNear.value = camera.near;
    u.cameraFar.value = camera.far;
    if ((camera as THREE.OrthographicCamera).isOrthographicCamera) {
      const oc = camera as THREE.OrthographicCamera;
      u.pxWorld.value = (oc.right - oc.left) / oc.zoom / Math.max(1, size.width * dpr);
    }
    gl.setRenderTarget(target);
    gl.render(scene, camera);
    gl.setRenderTarget(null);
    gl.render(quad.scene, quad.cam);
  }, 1);

  return null;
}
