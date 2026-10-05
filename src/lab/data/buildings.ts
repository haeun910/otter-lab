// 오터랩 강가 지도에 있는 건물 8채와, 방마다 눌러볼 수 있는 사물 정의

export type Gear = "beretBag" | "headset" | "apron" | "glasses" | "captainHat" | "cardigan" | "scarf" | "nametag";

export type PanelKind =
  | "inbox" // 수신 모니터: 오늘 소식
  | "cardEditor" // 카드 편집
  | "printer" // 카드 이미지 저장
  | "blogDesk" // 블로그 원고
  | "mailboat" // 게시 확인
  | "library" // 지난 소식 검색
  | "stats" // 성과
  | "roster" // 직원 명부
  | "brand" // 브랜드 설정
  | "drafts"; // 보관함

export type Furniture =
  | "monitorDesk"
  | "printer"
  | "writingDesk"
  | "boat"
  | "bookshelf"
  | "board"
  | "rosterBook"
  | "bigDesk"
  | "drawer";

export interface RoomObject {
  id: string;
  label: string; // 사물 이름 (말풍선)
  panel: PanelKind;
  furniture: Furniture;
  pos: [number, number]; // 방 안 x, z
  rot?: number;
}

export interface Staff {
  title: string;
  name: string;
  gear: Gear;
  line: string; // 방에 들어가면 하는 말
}

export interface Building {
  id: string;
  name: string;
  pos: [number, number]; // 지도 x, z
  rot: number; // y축 회전 (라디안). 0이면 문이 +z(강 쪽)를 봐요
  size: [number, number]; // 폭(x), 깊이(z)
  height: number;
  roof: string;
  wall: string;
  accent: string;
  staff?: Staff; // 소장실은 직원 없이 나만
  floor: string; // 실내 바닥 색
  objects: RoomObject[];
}

export const COLORS = {
  sky: "#8CCBFF",
  skyDeep: "#4FA3E8",
  mint: "#7FE3C6",
  mintDeep: "#2FB894",
  coral: "#FF9A8A",
  coralDeep: "#EE6B57",
  navy: "#2A2E5E",
  cream: "#FFF6E8",
  butter: "#FFE3A3",
  wood: "#D9A877",
  woodDark: "#A9744B",
  otter: "#A8754F",
  otterDark: "#7A5136",
  otterCream: "#FCEBD5",
  grass: "#BFE8B0",
  grassDeep: "#93D19A",
  leaf: "#7CCB8C",
  leafDeep: "#56B072",
  water: "#8FD3F5",
  stone: "#D7DCE6",
  bg: "#F2FAFF",
};

export const BUILDINGS: Building[] = [
  {
    id: "receiver",
    name: "수신소",
    pos: [-13.5, 4.4],
    rot: 0.25,
    size: [4.2, 3.6],
    height: 2.6,
    roof: COLORS.sky,
    wall: COLORS.cream,
    accent: COLORS.skyDeep,
    floor: "#E9D6BC",
    staff: { title: "통신원", name: "루미", gear: "headset", line: "소장님, 오늘도 소식이 강을 타고 잔뜩 떠내려왔어요!" },
    objects: [
      { id: "receiver-monitor", label: "수신 모니터", panel: "inbox", furniture: "monitorDesk", pos: [0, -1.6] },
    ],
  },
  {
    id: "cards",
    name: "카드뉴스 공방",
    pos: [-6, 1.2],
    rot: 0,
    size: [4.6, 3.8],
    height: 2.8,
    roof: COLORS.coral,
    wall: COLORS.cream,
    accent: COLORS.coralDeep,
    floor: "#EBD9C2",
    staff: { title: "디자이너", name: "모모", gear: "apron", line: "카드 문구 다듬어 뒀어요. 한번 봐 주실래요?" },
    objects: [
      { id: "cards-monitor", label: "작업 모니터", panel: "cardEditor", furniture: "monitorDesk", pos: [-1.2, -1.6] },
      { id: "cards-printer", label: "인쇄기", panel: "printer", furniture: "printer", pos: [1.8, -1.3] },
    ],
  },
  {
    id: "blog",
    name: "블로그 서재",
    pos: [6, 1.2],
    rot: 0,
    size: [4.6, 3.8],
    height: 2.8,
    roof: COLORS.mint,
    wall: COLORS.cream,
    accent: COLORS.mintDeep,
    floor: "#E6D3BA",
    staff: { title: "작가", name: "테오", gear: "glasses", line: "오늘 글은 소제목을 네 개로 나눠 봤어요." },
    objects: [{ id: "blog-desk", label: "원고 책상", panel: "blogDesk", furniture: "writingDesk", pos: [0, -1.5] }],
  },
  {
    id: "dock",
    name: "선착장",
    pos: [14, 4.6],
    rot: -0.25,
    size: [3.8, 3.2],
    height: 2.4,
    roof: COLORS.skyDeep,
    wall: COLORS.wood,
    accent: COLORS.navy,
    floor: "#D9B48C",
    staff: { title: "선장", name: "바다", gear: "captainHat", line: "확인만 해 주시면 바로 우편선 띄울게요!" },
    objects: [{ id: "dock-boat", label: "우편선", panel: "mailboat", furniture: "boat", pos: [0, -1.2] }],
  },
  {
    id: "library",
    name: "자료 도서관",
    pos: [-7, -9],
    rot: 0,
    size: [5.2, 4],
    height: 3.2,
    roof: "#B9A6F2",
    wall: COLORS.cream,
    accent: "#7E66D6",
    floor: "#E4CFB2",
    staff: { title: "사서", name: "다온", gear: "cardigan", line: "지난 소식은 전부 여기 정리돼 있어요. 찾으실 거 있으세요?" },
    objects: [{ id: "library-shelf", label: "책장", panel: "library", furniture: "bookshelf", pos: [0, -1.7] }],
  },
  {
    id: "stats",
    name: "성과 게시판",
    pos: [7, -9],
    rot: 0,
    size: [4.4, 3.6],
    height: 2.8,
    roof: COLORS.butter,
    wall: COLORS.cream,
    accent: "#E3B341",
    floor: "#E8D4BA",
    staff: { title: "분석가", name: "나래", gear: "scarf", line: "이번 주엔 심층 카드가 저장을 제일 많이 받았어요." },
    objects: [{ id: "stats-board", label: "성과 게시판", panel: "stats", furniture: "board", pos: [0, -1.6] }],
  },
  {
    id: "dorm",
    name: "연구원 숙소",
    pos: [-14, -3.2],
    rot: 0.35,
    size: [4.2, 3.6],
    height: 2.6,
    roof: COLORS.leaf,
    wall: COLORS.cream,
    accent: COLORS.leafDeep,
    floor: "#E9D6BC",
    staff: { title: "매니저", name: "하리", gear: "nametag", line: "연구원들 역할을 바꾸거나 새 식구를 들일 수 있어요." },
    objects: [{ id: "dorm-roster", label: "연구원 명부", panel: "roster", furniture: "rosterBook", pos: [0, -1.4] }],
  },
  {
    id: "office",
    name: "소장실",
    pos: [14, -3.2],
    rot: -0.35,
    size: [4.4, 3.8],
    height: 3,
    roof: COLORS.navy,
    wall: COLORS.cream,
    accent: COLORS.coral,
    floor: "#E2C9A8",
    objects: [
      { id: "office-desk", label: "소장 책상", panel: "brand", furniture: "bigDesk", pos: [-1, -1.5] },
      { id: "office-drawer", label: "보관함 서랍장", panel: "drafts", furniture: "drawer", pos: [1.9, -1.6] },
    ],
  },
];

export const byId = (id: string) => BUILDINGS.find((b) => b.id === id)!;

/** 건물 문 앞 지점 (지도 좌표) */
export function doorPoint(b: Building, extra = 1.1): [number, number] {
  const d = b.size[1] / 2 + extra;
  return [b.pos[0] + Math.sin(b.rot) * d, b.pos[1] + Math.cos(b.rot) * d];
}

// 지도 경계: 강이 남쪽(z ≈ 8.5 이후)을 가로질러 흘러요
export const MAP = { minX: -19, maxX: 19, minZ: -14, maxZ: 8.4, riverZ: 11.6, riverWidth: 5.4 };

// 방 크기 (모든 방 공통)
export const ROOM = { w: 7, d: 5.5 };
