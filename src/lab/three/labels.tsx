"use client";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";

// 3D 위에 띄우는 한글 라벨은 캔버스 밖의 DOM으로 그리고, 위치만 매 프레임 맞춰요.
// (캔버스 안에서 DOM을 만들었다 지우는 방식보다 장면 전환에 안전해요)
export const anchors = new Map<string, THREE.Object3D>();
export const labelEls = new Map<string, HTMLElement>();

export function Anchor({ id, position }: { id: string; position: [number, number, number] }) {
  const ref = useRef<THREE.Object3D>(null);
  useEffect(() => {
    const o = ref.current!;
    anchors.set(id, o);
    return () => {
      if (anchors.get(id) === o) anchors.delete(id);
    };
  }, [id]);
  return <object3D ref={ref} position={position} />;
}

const v = new THREE.Vector3();

/** 캔버스 맨 끝에 두면, 카메라가 움직인 뒤 라벨 위치를 맞춰요 */
export function Projector() {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  useFrame(() => {
    labelEls.forEach((el, id) => {
      const a = anchors.get(id);
      if (!a) {
        el.style.visibility = "hidden";
        return;
      }
      a.getWorldPosition(v);
      v.project(camera);
      if (v.z > 1 || v.x < -1.3 || v.x > 1.3 || v.y < -1.3 || v.y > 1.3) {
        el.style.visibility = "hidden";
        return;
      }
      const x = (v.x * 0.5 + 0.5) * size.width;
      const y = (-v.y * 0.5 + 0.5) * size.height;
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -100%)`;
      el.style.visibility = "visible";
    });
  });
  return null;
}

/** DOM 쪽 라벨: 같은 id의 Anchor 위치를 따라다녀요 */
const refCache = new Map<string, (el: HTMLElement | null) => void>();
export function useLabelRef(id: string) {
  let fn = refCache.get(id);
  if (!fn) {
    fn = (el: HTMLElement | null) => {
      if (el) {
        if (labelEls.get(id) !== el) el.style.visibility = "hidden";
        labelEls.set(id, el);
      } else labelEls.delete(id);
    };
    refCache.set(id, fn);
  }
  return fn;
}
