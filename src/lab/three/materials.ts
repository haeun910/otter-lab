// 실제 재료처럼 보이는 물리 기반(PBR) 재질. 질감은 이미지 파일 없이 노이즈로 직접 만들어요.
// 색 지도는 대부분 밝은 회색조라서, 재질 색(color)을 곱해 여러 색으로 같이 써요.
import * as THREE from "three";

// ---------- 노이즈 ----------
function mulberry(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 이어 붙여도 이음매가 없는 값 노이즈 (period 칸마다 반복) */
class Tile {
  private v: Float32Array;
  constructor(
    private p: number,
    seed: number,
  ) {
    const r = mulberry(seed);
    this.v = new Float32Array(p * p).map(() => r());
  }
  at(x: number, y: number) {
    const p = this.p;
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = x - xi;
    const fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const x0 = ((xi % p) + p) % p;
    const y0 = ((yi % p) + p) % p;
    const x1 = (x0 + 1) % p;
    const y1 = (y0 + 1) % p;
    const v = this.v;
    const a = v[y0 * p + x0] + (v[y0 * p + x1] - v[y0 * p + x0]) * sx;
    const b = v[y1 * p + x0] + (v[y1 * p + x1] - v[y1 * p + x0]) * sx;
    return a + (b - a) * sy;
  }
}

/** 여러 크기의 노이즈를 겹친 값 (u, v는 0~1, 결과는 대략 0~1) */
function fbm(period: number, octaves: number, seed: number) {
  const tiles = Array.from({ length: octaves }, (_, o) => new Tile(period << o, seed + o * 101));
  return (u: number, v: number, sx = 1, sy = 1) => {
    let s = 0;
    let amp = 0.5;
    let norm = 0;
    for (let o = 0; o < octaves; o++) {
      const p = period << o;
      s += tiles[o].at(u * p * sx, v * p * sy) * amp;
      norm += amp;
      amp *= 0.5;
    }
    return s / norm;
  };
}

// ---------- 지도 만들기 ----------
interface Maps {
  map: THREE.DataTexture;
  normalMap: THREE.DataTexture;
  roughnessMap: THREE.DataTexture;
}

function dataTexture(data: Uint8Array, size: number, srgb: boolean) {
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/**
 * 한 칸마다 (밝기 rgb, 높이, 거칠기)를 정하면 색·법선·거칠기 지도를 만들어요.
 * fn은 u, v (0~1)를 받아 [r, g, b, height, rough]를 돌려줘요 (모두 0~1).
 */
function bake(size: number, strength: number, fn: (u: number, v: number) => [number, number, number, number, number]): Maps {
  const n = size * size;
  const col = new Uint8Array(n * 4);
  const rough = new Uint8Array(n * 4);
  const h = new Float32Array(n);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const k = j * size + i;
      const [r, g, b, hh, ro] = fn((i + 0.5) / size, (j + 0.5) / size);
      col[k * 4] = Math.min(255, r * 255);
      col[k * 4 + 1] = Math.min(255, g * 255);
      col[k * 4 + 2] = Math.min(255, b * 255);
      col[k * 4 + 3] = 255;
      // three.js 거칠기 지도는 초록 채널을 읽어요
      rough[k * 4 + 1] = Math.min(255, ro * 255);
      rough[k * 4 + 3] = 255;
      h[k] = hh;
    }
  }
  const nor = new Uint8Array(n * 4);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const l = h[j * size + ((i - 1 + size) % size)];
      const r = h[j * size + ((i + 1) % size)];
      const d = h[((j - 1 + size) % size) * size + i];
      const u = h[((j + 1) % size) * size + i];
      let nx = (l - r) * strength;
      let ny = (d - u) * strength;
      let nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len;
      ny /= len;
      nz /= len;
      const k = (j * size + i) * 4;
      nor[k] = (nx * 0.5 + 0.5) * 255;
      nor[k + 1] = (ny * 0.5 + 0.5) * 255;
      nor[k + 2] = (nz * 0.5 + 0.5) * 255;
      nor[k + 3] = 255;
    }
  }
  return { map: dataTexture(col, size, true), normalMap: dataTexture(nor, size, false), roughnessMap: dataTexture(rough, size, false) };
}

const mapCache = new Map<string, Maps>();
function maps(key: string, make: () => Maps) {
  let m = mapCache.get(key);
  if (!m) {
    m = make();
    mapCache.set(key, m);
  }
  return m;
}
/** 같은 그림을 반복 횟수만 다르게 써요 (그림 데이터는 같이 써요) */
function repeated(m: Maps, rx: number, ry: number): Maps {
  const c = (t: THREE.DataTexture) => {
    const x = t.clone();
    x.repeat.set(rx, ry);
    x.needsUpdate = true;
    return x;
  };
  return { map: c(m.map), normalMap: c(m.normalMap), roughnessMap: c(m.roughnessMap) };
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const gray = (g: number): [number, number, number] => [g, g, g];

// ---------- 질감들 ----------

/** 원목 결 (가구용, 이음매 없음). 결은 u 방향으로 길게 */
const woodGrain = () =>
  maps("woodGrain", () => {
    const n = fbm(4, 5, 11);
    const fine = fbm(32, 2, 12);
    return bake(512, 3, (u, v) => {
      const warp = n(u, v, 0.25, 2) * 9;
      const ring = Math.sin((v * 40 + warp) * Math.PI);
      const streak = fine(u, v, 0.1, 4);
      const g = 0.8 + ring * 0.035 + (streak - 0.5) * 0.1;
      return [...gray(clamp01(g)), ring * 0.15 + streak * 0.1, 0.5 + streak * 0.15] as [number, number, number, number, number];
    });
  });

/** 마루 널 (한 장이 2.4m 네모, 널 폭 20cm) */
const planks = () =>
  maps("planks", () => {
    const rows = 12;
    const r = mulberry(5);
    // 줄마다 널 이음 위치와 색 차이
    const joints = Array.from({ length: rows }, () => {
      const off = r();
      const lens: number[] = [];
      let x = 0;
      while (x < 1) {
        const l = 0.35 + r() * 0.45;
        lens.push(x);
        x += l;
      }
      return { off, starts: lens, tints: lens.map(() => 0.9 + r() * 0.16) };
    });
    const n = fbm(4, 5, 21);
    const fine = fbm(32, 2, 22);
    return bake(1024, 4, (u, v) => {
      const row = Math.min(rows - 1, Math.floor(v * rows));
      const lv = v * rows - row; // 널 안에서 0~1
      const jr = joints[row];
      const x = (u + jr.off) % 1;
      let idx = 0;
      for (let i = 0; i < jr.starts.length; i++) if (x >= jr.starts[i]) idx = i;
      const nextStart = jr.starts[idx + 1] ?? 1 + jr.starts[0];
      const distJoint = Math.min(x - jr.starts[idx], nextStart - x) * 2.4; // m 단위
      const distEdge = Math.min(lv, 1 - lv) * (2.4 / rows);
      const gap = Math.min(distJoint, distEdge);
      const warp = n(u + idx * 0.37, v, 0.5, 3) * 7;
      const ring = Math.sin((lv * 6 + warp + idx) * Math.PI);
      const streak = fine(u, v, 0.15, 3);
      const tint = jr.tints[idx];
      let g = (0.82 + ring * 0.025 + (streak - 0.5) * 0.08) * tint;
      let hh = 1 - Math.exp(-gap / 0.004) * 0.9 + ring * 0.02;
      let ro = 0.38 + streak * 0.12;
      if (gap < 0.0025) {
        g *= 0.45;
        ro = 0.9;
        hh = 0;
      }
      return [...gray(clamp01(g)), hh, ro] as [number, number, number, number, number];
    });
  });

/** 큰 돌 타일 (한 장이 1.2m, 60cm 타일 2×2) */
const stoneTiles = () =>
  maps("stoneTiles", () => {
    const n = fbm(4, 5, 31);
    const r = mulberry(32);
    const tints = Array.from({ length: 4 }, () => 0.92 + r() * 0.1);
    return bake(512, 3, (u, v) => {
      const tu = (u * 2) % 1;
      const tv = (v * 2) % 1;
      const ti = Math.floor(u * 2) + Math.floor(v * 2) * 2;
      const edge = Math.min(tu, 1 - tu, tv, 1 - tv) * 0.6;
      const grout = edge < 0.004;
      const s = n(u, v);
      const g = grout ? 0.62 : (0.86 + (s - 0.5) * 0.12) * tints[ti];
      return [...gray(clamp01(g)), grout ? 0 : 1 - Math.exp(-edge / 0.003) * 0.6 + s * 0.05, grout ? 0.95 : 0.3 + s * 0.15] as [
        number,
        number,
        number,
        number,
        number,
      ];
    });
  });

/** 테라조 (복도 바닥, 반들반들한 돌가루 바닥) */
const terrazzo = () =>
  maps("terrazzo", () => {
    const n = fbm(8, 3, 41);
    const r = mulberry(42);
    const chips = Array.from({ length: 1400 }, () => ({ x: r(), y: r(), s: 0.002 + r() ** 3 * 0.008, g: 0.74 + r() * 0.24 }));
    const size = 512;
    // 칸마다 걸치는 돌 조각 목록
    const grid: number[][] = Array.from({ length: 32 * 32 }, () => []);
    chips.forEach((c, i) => {
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++) grid[((Math.floor(c.y * 32) + dy + 32) % 32) * 32 + ((Math.floor(c.x * 32) + dx + 32) % 32)].push(i);
    });
    return bake(size, 1.5, (u, v) => {
      const cell = grid[Math.floor(v * 32) * 32 + Math.floor(u * 32)];
      let g = 0.86 + (n(u, v) - 0.5) * 0.05;
      let hh = 0.5;
      for (const i of cell) {
        const c = chips[i];
        let dx = Math.abs(u - c.x);
        let dy = Math.abs(v - c.y);
        dx = Math.min(dx, 1 - dx);
        dy = Math.min(dy, 1 - dy);
        if (dx + dy * 0.8 < c.s) {
          g = c.g;
          hh = 0.52;
        }
      }
      return [...gray(clamp01(g)), hh, 0.22] as [number, number, number, number, number];
    });
  });

/** 회벽 (아주 옅은 울퉁불퉁) */
const plaster = () =>
  maps("plaster", () => {
    const n = fbm(8, 5, 51);
    return bake(256, 2, (u, v) => {
      const s = n(u, v);
      return [...gray(0.93 + (s - 0.5) * 0.06), s, 0.85] as [number, number, number, number, number];
    });
  });

/** 카펫·천 (촘촘한 짜임) */
const fabric = () =>
  maps("fabric", () => {
    const n = fbm(64, 2, 61);
    return bake(256, 3, (u, v) => {
      const weave = Math.sin(u * 256 * Math.PI) * Math.sin(v * 256 * Math.PI);
      const s = n(u, v);
      return [...gray(0.84 + weave * 0.05 + (s - 0.5) * 0.14), 0.5 + weave * 0.2 + s * 0.3, 0.95] as [number, number, number, number, number];
    });
  });

/** 잔디밭 (멀리서 보는 잔디: 얼룩과 결) */
const lawn = () =>
  maps("lawn", () => {
    const big = fbm(4, 4, 71);
    const fine = fbm(64, 3, 72);
    return bake(1024, 6, (u, v) => {
      const b = big(u, v);
      const f = fine(u, v);
      const dry = clamp01((b - 0.55) * 3);
      // 초록 잔디와 마른 잔디를 섞어요 (색은 여기서 정해요)
      const r = 0.24 + dry * 0.18 + (f - 0.5) * 0.12;
      const g = 0.4 + dry * 0.1 + (f - 0.5) * 0.18;
      const bl = 0.14 + dry * 0.06 + (f - 0.5) * 0.06;
      return [clamp01(r), clamp01(g), clamp01(bl), f * 0.8 + b * 0.2, 0.9] as [number, number, number, number, number];
    });
  });

/** 모래·자갈 */
const sand = () =>
  maps("sand", () => {
    const n = fbm(16, 4, 81);
    const r = mulberry(82);
    const pebbles = Array.from({ length: 160 }, () => ({ x: r(), y: r(), s: 0.006 + r() * 0.012, g: 0.6 + r() * 0.35 }));
    return bake(512, 4, (u, v) => {
      const s = n(u, v);
      let g = 0.84 + (s - 0.5) * 0.2;
      let hh = s * 0.4;
      for (const p of pebbles) {
        const d = Math.hypot(u - p.x, v - p.y);
        if (d < p.s) {
          g = p.g;
          hh = 0.5 + (1 - d / p.s) * 0.5;
        }
      }
      return [...gray(clamp01(g)), hh, 0.95] as [number, number, number, number, number];
    });
  });

/** 나무껍질 (세로 결) */
const bark = () =>
  maps("bark", () => {
    const n = fbm(8, 4, 91);
    return bake(256, 6, (u, v) => {
      const s = n(u, v, 1, 0.25);
      const ridge = Math.abs(Math.sin((u * 12 + s * 3) * Math.PI));
      return [...gray(0.65 + ridge * 0.25), ridge * 0.7 + s * 0.3, 0.95] as [number, number, number, number, number];
    });
  });

/** 물결 법선 (강물) */
export const ripples = () =>
  maps("ripples", () => {
    const n = fbm(8, 4, 101);
    return bake(512, 10, (u, v) => {
      const s = n(u, v, 1, 1);
      return [1, 1, 1, s, 0.05];
    });
  });

// ---------- 재질 ----------
const matCache = new Map<string, THREE.Material>();
function cached<T extends THREE.Material>(key: string, make: () => T): T {
  let m = matCache.get(key) as T | undefined;
  if (!m) {
    m = make();
    matCache.set(key, m);
  }
  return m;
}

/** 무늬 없는 기본 재질 (플라스틱·페인트 등) */
export function pbr(color: string, roughness = 0.6, metalness = 0) {
  return cached(`pbr:${color}:${roughness}:${metalness}`, () => new THREE.MeshStandardMaterial({ color, roughness, metalness }));
}

/** 원목 (가구) */
export function wood(color: string, repeat = 1) {
  return cached(`wood:${color}:${repeat}`, () => new THREE.MeshStandardMaterial({ color, ...repeated(woodGrain(), repeat, repeat), roughness: 1 }));
}

/** 바닥재. 크기(m)를 주면 실제 크기에 맞게 반복해요 */
export type FloorKind = "oak" | "walnut" | "stone" | "carpet" | "terrazzo";
export function floor(kind: FloorKind, color: string, w: number, d: number) {
  return cached(`floor:${kind}:${color}:${w}x${d}`, () => {
    const src = kind === "stone" ? stoneTiles() : kind === "carpet" ? fabric() : kind === "terrazzo" ? terrazzo() : planks();
    const tile = kind === "stone" ? 1.2 : kind === "carpet" ? 0.5 : kind === "terrazzo" ? 3 : 2.4;
    const m = new THREE.MeshStandardMaterial({ color, ...repeated(src, w / tile, d / tile), roughness: 1 });
    m.normalScale.set(kind === "carpet" ? 0.6 : 1, kind === "carpet" ? 0.6 : 1);
    return m;
  });
}

export function plasterMat(color: string, rx = 2, ry = 1) {
  return cached(`plaster:${color}:${rx}:${ry}`, () => {
    const m = new THREE.MeshStandardMaterial({ color, ...repeated(plaster(), rx, ry), roughness: 1 });
    m.normalScale.set(0.4, 0.4);
    return m;
  });
}

export function fabricMat(color: string, repeat = 2) {
  return cached(`fabric:${color}:${repeat}`, () => new THREE.MeshStandardMaterial({ color, ...repeated(fabric(), repeat, repeat), roughness: 1 }));
}

export function lawnMat(w: number, d: number) {
  return cached(`lawn:${w}x${d}`, () => {
    const m = new THREE.MeshStandardMaterial({ ...repeated(lawn(), w / 9, d / 9), roughness: 1 });
    m.normalScale.set(0.8, 0.8);
    return m;
  });
}

export function sandMat(color: string, w: number, d: number) {
  return cached(`sand:${color}:${w}x${d}`, () => new THREE.MeshStandardMaterial({ color, ...repeated(sand(), w / 2, d / 2), roughness: 1 }));
}

export function barkMat(color: string) {
  return cached(`bark:${color}`, () => new THREE.MeshStandardMaterial({ color, ...repeated(bark(), 2, 2), roughness: 1 }));
}

/** 유리 (창문): 하늘을 비추는 반투명 */
export const glass = () =>
  cached(
    "glass",
    () =>
      new THREE.MeshPhysicalMaterial({ color: "#d8ecf2", roughness: 0.05, metalness: 0, transparent: true, opacity: 0.35, envMapIntensity: 1.5, clearcoat: 1 }),
  );

/** 화면 (스스로 빛나는 모니터) */
export function screen(color: string, glow = 0.9) {
  return cached(
    `screen:${color}:${glow}`,
    () => new THREE.MeshStandardMaterial({ color: "#0b0f14", emissive: color, emissiveIntensity: glow, roughness: 0.15 }),
  );
}

/** 금속 (스탠드·손잡이) */
export function metal(color: string, roughness = 0.35) {
  return cached(`metal:${color}:${roughness}`, () => new THREE.MeshStandardMaterial({ color, roughness, metalness: 1 }));
}
