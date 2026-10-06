// 그림책 같은 겉모습의 재료: 3단 툰 그늘, 세피아 잉크, 손으로 칠한 듯한 질감(캔버스로 그려요)
import * as THREE from "three";

export const INK = "#3D3328"; // 외곽선·글자에 쓰는 세피아 잉크

/** 툰 그늘 단계: 그늘 · 반그늘 · 빛 (부드럽게 3단) */
let gradient: THREE.DataTexture | null = null;
export function toonGradient() {
  if (!gradient) {
    gradient = new THREE.DataTexture(new Uint8Array([168, 168, 168, 255, 218, 218, 218, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
    gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
    gradient.generateMipmaps = false;
    gradient.needsUpdate = true;
  }
  return gradient;
}

const cache = new Map<string, THREE.MeshToonMaterial>();
/** 질감 없는 툰 재질 (같은 색은 하나를 같이 써요) */
export function toon(color: string) {
  let m = cache.get(color);
  if (!m) {
    m = new THREE.MeshToonMaterial({ color, gradientMap: toonGradient() });
    cache.set(color, m);
  }
  return m;
}

/** 질감을 입힌 툰 재질 */
export function painted(key: string, make: () => THREE.Texture, tintColor = "#ffffff") {
  const k = `tex:${key}:${tintColor}`;
  let m = cache.get(k);
  if (!m) {
    m = new THREE.MeshToonMaterial({ color: tintColor, map: make(), gradientMap: toonGradient() });
    cache.set(k, m);
  }
  return m;
}

// ---------- 캔버스로 그리는 질감 ----------
function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}
function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D, r: () => number) => void, seed = 7) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!, rng(seed));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
const mix = (a: string, b: string, t: number) => {
  const pa = new THREE.Color(a);
  const pb = new THREE.Color(b);
  return `#${pa.lerp(pb, t).getHexString()}`;
};

const texCache = new Map<string, THREE.Texture>();
function cached(key: string, make: () => THREE.Texture) {
  let t = texCache.get(key);
  if (!t) {
    t = make();
    texCache.set(key, t);
  }
  return t;
}

/** 나무 마루: 결이 보이는 널빤지 */
export const woodFloor = (base: string) =>
  cached(`wood:${base}`, () =>
    canvasTexture(512, 512, (g, r) => {
      const rows = 8;
      const hgt = 512 / rows;
      for (let i = 0; i < rows; i++) {
        let x = -r() * 200;
        while (x < 512) {
          const len = 160 + r() * 200;
          g.fillStyle = mix(base, i % 2 ? "#ffffff" : "#6b4a2f", 0.04 + r() * 0.08);
          g.fillRect(x, i * hgt, len, hgt);
          // 나뭇결
          g.strokeStyle = mix(base, "#6b4a2f", 0.22);
          g.lineWidth = 1.2;
          g.globalAlpha = 0.5;
          for (let k = 0; k < 3; k++) {
            const y = i * hgt + 8 + r() * (hgt - 16);
            g.beginPath();
            g.moveTo(x + 6, y);
            g.bezierCurveTo(x + len * 0.3, y + (r() - 0.5) * 6, x + len * 0.6, y + (r() - 0.5) * 6, x + len - 6, y);
            g.stroke();
          }
          g.globalAlpha = 1;
          // 널빤지 이음매
          g.fillStyle = mix(base, "#4a3220", 0.35);
          g.fillRect(x, i * hgt, 2.5, hgt);
          x += len;
        }
        g.fillStyle = mix(base, "#4a3220", 0.3);
        g.fillRect(0, i * hgt, 512, 2.5);
      }
    }),
  );

/** 잔디: 붓으로 톡톡 찍은 얼룩과 풀잎 */
export const grassTexture = (base: string) =>
  cached(`grass:${base}`, () => {
    const t = canvasTexture(
      512,
      512,
      (g, r) => {
        g.fillStyle = base;
        g.fillRect(0, 0, 512, 512);
        for (let i = 0; i < 260; i++) {
          g.fillStyle = mix(base, r() > 0.5 ? "#ffffff" : "#2f5a2a", 0.06 + r() * 0.1);
          g.beginPath();
          g.ellipse(r() * 512, r() * 512, 10 + r() * 30, 6 + r() * 18, r() * Math.PI, 0, Math.PI * 2);
          g.fill();
        }
        g.strokeStyle = mix(base, "#2f5a2a", 0.35);
        g.lineWidth = 1.6;
        for (let i = 0; i < 220; i++) {
          const x = r() * 512;
          const y = r() * 512;
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x + (r() - 0.5) * 4, y - 5 - r() * 5);
          g.stroke();
        }
      },
      11,
    );
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  });

/** 동그란 러그: 테두리 무늬가 있는 */
export const rugTexture = (base: string) =>
  cached(`rug:${base}`, () =>
    canvasTexture(256, 256, (g) => {
      g.fillStyle = base;
      g.fillRect(0, 0, 256, 256);
      g.strokeStyle = mix(base, "#ffffff", 0.55);
      g.lineWidth = 7;
      g.beginPath();
      g.arc(128, 128, 104, 0, Math.PI * 2);
      g.stroke();
      g.setLineDash([6, 10]);
      g.lineWidth = 4;
      g.strokeStyle = mix(base, "#3d3328", 0.25);
      g.beginPath();
      g.arc(128, 128, 88, 0, Math.PI * 2);
      g.stroke();
      g.setLineDash([]);
      g.fillStyle = mix(base, "#ffffff", 0.3);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        g.beginPath();
        g.arc(128 + Math.cos(a) * 60, 128 + Math.sin(a) * 60, 6, 0, Math.PI * 2);
        g.fill();
      }
    }),
  );

/** 벽지: 아주 옅은 세로 줄과 꽃점 */
export const wallTexture = (base: string) =>
  cached(`wall:${base}`, () => {
    const t = canvasTexture(
      256,
      256,
      (g, r) => {
        g.fillStyle = base;
        g.fillRect(0, 0, 256, 256);
        g.fillStyle = mix(base, "#c9b28c", 0.18);
        for (let x = 0; x < 256; x += 32) g.fillRect(x, 0, 10, 256);
        g.fillStyle = mix(base, "#e08f7a", 0.35);
        for (let i = 0; i < 14; i++) {
          g.beginPath();
          g.arc(r() * 256, r() * 256, 2.2, 0, Math.PI * 2);
          g.fill();
        }
      },
      5,
    );
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  });
