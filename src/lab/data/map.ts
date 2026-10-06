// 손그림 강가 지도(otter-map.webp, 1536×1024) 위에서 방마다 차지하는 자리.
// 좌표는 1536×1024 기준이에요. 같은 구도로 더 크게 뽑은 그림으로 바꿔도 좌표는 그대로 써요.

export const MAP_W = 1536;
export const MAP_H = 1024;

export interface Spot {
  poly: [number, number][]; // 누를 수 있는 방 테두리
  otter: [number, number]; // 그림 속 연구원 머리 위 (말풍선 자리)
  badge: [number, number]; // 지금 하는 일 표시 (그림 속 이름표 바로 아래)
}

export const SPOTS: Record<string, Spot> = {
  library: {
    poly: [
      [300, 125],
      [600, 125],
      [600, 365],
      [300, 365],
    ],
    otter: [470, 240],
    badge: [455, 214],
  },
  stats: {
    poly: [
      [615, 55],
      [945, 55],
      [945, 280],
      [615, 280],
    ],
    otter: [700, 182],
    badge: [782, 150],
  },
  dorm: {
    poly: [
      [950, 120],
      [1440, 120],
      [1440, 330],
      [1290, 330],
      [1290, 370],
      [950, 370],
    ],
    otter: [1110, 250],
    badge: [1110, 214],
  },
  cards: {
    poly: [
      [215, 365],
      [570, 365],
      [570, 560],
      [200, 560],
    ],
    otter: [415, 440],
    badge: [160, 490],
  },
  receiver: {
    poly: [
      [150, 560],
      [560, 560],
      [560, 775],
      [150, 775],
    ],
    otter: [405, 655],
    badge: [218, 694],
  },
  blog: {
    poly: [
      [995, 370],
      [1290, 370],
      [1290, 690],
      [1000, 690],
    ],
    otter: [1120, 450],
    badge: [1338, 694],
  },
  office: {
    poly: [
      [1290, 335],
      [1515, 335],
      [1515, 600],
      [1290, 600],
    ],
    otter: [1400, 452],
    badge: [1392, 434],
  },
  dock: {
    poly: [
      [955, 690],
      [1300, 690],
      [1300, 880],
      [1530, 880],
      [1530, 1010],
      [1150, 1010],
      [1150, 900],
      [955, 900],
    ],
    otter: [1175, 730],
    badge: [1384, 844],
  },
  // 가운데 마당의 큰 나무 아래 둥근 의자: 매일 회의하는 곳
  meeting: {
    poly: [
      [700, 480],
      [870, 480],
      [892, 590],
      [860, 662],
      [710, 662],
      [680, 590],
    ],
    otter: [785, 520],
    badge: [785, 668],
  },
};

/** 방 테두리를 감싸는 네모 [x0, y0, x1, y1] */
export function boxOf(id: string): [number, number, number, number] {
  const p = SPOTS[id].poly;
  const xs = p.map((q) => q[0]);
  const ys = p.map((q) => q[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

/** 소장(나)과 직원들. 말풍선은 그 방 연구원 자리에 떠요 */
export const CREW_IDS = ["me", "receiver", "cards", "blog", "dock", "library", "stats", "dorm"];
export const roomOfCrew = (id: string) => (id === "me" ? "office" : id);
