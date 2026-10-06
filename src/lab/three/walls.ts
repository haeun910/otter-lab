import { ROOM, type Side } from "../data/buildings";

// 인형의 집처럼 앞쪽 벽은 낮게, 뒤쪽 벽은 높게 잘라서 방 안이 다 보여요
export const WALL_H: Record<Side, number> = { n: 1.9, e: 1.15, w: 1.15, s: 0.45 };
export const WALL_T = 0.22;
export const DOOR_W = 1.5;

/** 벽 한 면을 문 자리만 비우고 조각으로 나눠요 (방 기준 좌표) */
export function wallPieces(side: Side, door: boolean): { x: number; z: number; w: number; d: number }[] {
  const { w, d } = ROOM;
  const horiz = side === "n" || side === "s";
  const len = (horiz ? w : d) + WALL_T;
  const off = side === "n" ? -d / 2 : side === "s" ? d / 2 : side === "e" ? w / 2 : -w / 2;
  const segs = door
    ? [
        [-len / 2, -DOOR_W / 2],
        [DOOR_W / 2, len / 2],
      ]
    : [[-len / 2, len / 2]];
  return segs.map(([a, b]) => {
    const mid = (a + b) / 2;
    const l = b - a;
    return horiz ? { x: mid, z: off, w: l, d: WALL_T } : { x: off, z: mid, w: WALL_T, d: l };
  });
}
