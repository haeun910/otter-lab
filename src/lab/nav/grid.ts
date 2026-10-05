// 아주 작은 A* 길찾기. 지도를 격자로 나누고 막힌 칸을 피해 길을 찾아요.

export type Blocker =
  | { kind: "circle"; x: number; z: number; r: number }
  | { kind: "rect"; x: number; z: number; w: number; d: number; rot: number };

export interface Bounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export class NavGrid {
  readonly cols: number;
  readonly rows: number;
  private blocked: Uint8Array;

  constructor(
    readonly bounds: Bounds,
    readonly cell: number,
    blockers: Blocker[],
    readonly margin = 0.35,
  ) {
    this.cols = Math.ceil((bounds.maxX - bounds.minX) / cell);
    this.rows = Math.ceil((bounds.maxZ - bounds.minZ) / cell);
    this.blocked = new Uint8Array(this.cols * this.rows);
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++) {
        const [x, z] = this.center(c, r);
        if (blockers.some((b) => hits(b, x, z, margin))) this.blocked[r * this.cols + c] = 1;
      }
  }

  center(c: number, r: number): [number, number] {
    return [this.bounds.minX + (c + 0.5) * this.cell, this.bounds.minZ + (r + 0.5) * this.cell];
  }
  cellOf(x: number, z: number): [number, number] {
    const c = Math.min(this.cols - 1, Math.max(0, Math.floor((x - this.bounds.minX) / this.cell)));
    const r = Math.min(this.rows - 1, Math.max(0, Math.floor((z - this.bounds.minZ) / this.cell)));
    return [c, r];
  }
  isFree(x: number, z: number) {
    if (x < this.bounds.minX || x > this.bounds.maxX || z < this.bounds.minZ || z > this.bounds.maxZ) return false;
    const [c, r] = this.cellOf(x, z);
    return !this.blocked[r * this.cols + c];
  }

  /** 막힌 곳을 눌렀으면 가장 가까운 빈 칸으로 바꿔요 */
  nearestFree(x: number, z: number): [number, number] {
    if (this.isFree(x, z)) return [x, z];
    const [c0, r0] = this.cellOf(x, z);
    for (let rad = 1; rad < Math.max(this.cols, this.rows); rad++)
      for (let dr = -rad; dr <= rad; dr++)
        for (let dc = -rad; dc <= rad; dc++) {
          if (Math.abs(dr) !== rad && Math.abs(dc) !== rad) continue;
          const c = c0 + dc;
          const r = r0 + dr;
          if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) continue;
          if (!this.blocked[r * this.cols + c]) return this.center(c, r);
        }
    return [x, z];
  }

  /** 두 점 사이가 막힘 없이 이어지는지 */
  clear(ax: number, az: number, bx: number, bz: number) {
    const dist = Math.hypot(bx - ax, bz - az);
    const steps = Math.ceil(dist / (this.cell * 0.5));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      if (!this.isFree(ax + (bx - ax) * t, az + (bz - az) * t)) return false;
    }
    return true;
  }

  findPath(from: [number, number], to: [number, number]): [number, number][] {
    const goal = this.nearestFree(to[0], to[1]);
    const start = this.nearestFree(from[0], from[1]);
    if (this.clear(start[0], start[1], goal[0], goal[1])) return [goal];

    const [sc, sr] = this.cellOf(start[0], start[1]);
    const [gc, gr] = this.cellOf(goal[0], goal[1]);
    const N = this.cols * this.rows;
    const g = new Float32Array(N).fill(Infinity);
    const came = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const open: { i: number; f: number }[] = [];
    const si = sr * this.cols + sc;
    const gi = gr * this.cols + gc;
    g[si] = 0;
    open.push({ i: si, f: 0 });
    const h = (i: number) => {
      const c = i % this.cols;
      const r = (i / this.cols) | 0;
      return Math.hypot(c - gc, r - gr);
    };
    let found = false;
    while (open.length) {
      let best = 0;
      for (let k = 1; k < open.length; k++) if (open[k].f < open[best].f) best = k;
      const { i } = open.splice(best, 1)[0];
      if (i === gi) {
        found = true;
        break;
      }
      if (closed[i]) continue;
      closed[i] = 1;
      const c = i % this.cols;
      const r = (i / this.cols) | 0;
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const nc = c + dc;
          const nr = r + dr;
          if (nc < 0 || nr < 0 || nc >= this.cols || nr >= this.rows) continue;
          const ni = nr * this.cols + nc;
          if (this.blocked[ni] || closed[ni]) continue;
          // 대각선은 양옆이 모두 비어 있을 때만
          if (dr && dc && (this.blocked[r * this.cols + nc] || this.blocked[nr * this.cols + c])) continue;
          const ng = g[i] + (dr && dc ? Math.SQRT2 : 1);
          if (ng < g[ni]) {
            g[ni] = ng;
            came[ni] = i;
            open.push({ i: ni, f: ng + h(ni) });
          }
        }
    }
    if (!found) return [];

    const cells: [number, number][] = [];
    for (let i = gi; i !== -1 && i !== si; i = came[i]) cells.push(this.center(i % this.cols, (i / this.cols) | 0));
    cells.reverse();
    cells[cells.length - 1] = goal;

    // 보이는 곳까지는 곧장 가도록 길을 펴요
    const out: [number, number][] = [];
    let cur = start;
    let k = 0;
    while (k < cells.length) {
      let far = k;
      for (let j = cells.length - 1; j > k; j--)
        if (this.clear(cur[0], cur[1], cells[j][0], cells[j][1])) {
          far = j;
          break;
        }
      out.push(cells[far]);
      cur = cells[far];
      k = far + 1;
    }
    return out;
  }
}

function hits(b: Blocker, x: number, z: number, m: number) {
  if (b.kind === "circle") return Math.hypot(x - b.x, z - b.z) < b.r + m;
  const dx = x - b.x;
  const dz = z - b.z;
  const c = Math.cos(b.rot);
  const s = Math.sin(b.rot);
  const lx = dx * c - dz * s;
  const lz = dx * s + dz * c;
  return Math.abs(lx) < b.w / 2 + m && Math.abs(lz) < b.d / 2 + m;
}
