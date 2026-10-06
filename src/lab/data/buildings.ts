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
  | "drafts" // 보관함
  | "meeting" // 오늘 회의
  | "minutes"; // 회의록: 지난 회의, 회의 시간

export type Furniture =
  | "monitorDesk"
  | "printer"
  | "writingDesk"
  | "boat"
  | "bookshelf"
  | "board"
  | "rosterBook"
  | "bigDesk"
  | "drawer"
  | "roundTable"
  | "chalkboard";

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

export type Side = "n" | "s" | "e" | "w";

/** 오터랩 본관의 방 하나 (예전 이름 그대로 Building이라고 불러요) */
export interface Building {
  id: string;
  name: string;
  pos: [number, number]; // 본관 안에서 방 가운데 (x, z)
  doors: Side[]; // 복도로 난 문
  roof: string; // 방 대표 색 (간판·명부 색)
  wall: string;
  accent: string;
  staff?: Staff; // 소장실은 직원 없이 나만
  floor: string; // 바닥 색
  objects: RoomObject[];
  open?: boolean; // 벽 없는 곳 (선착장)
  deco?: boolean; // 눌러볼 사물이 없는 곳 (현관)
}

// 그림책 팔레트: 따뜻한 나무와 이끼, 맑은 강, 세피아 잉크
export const COLORS = {
  sky: "#8EC5E6",
  skyDeep: "#5A9CC4",
  mint: "#93D3B5",
  mintDeep: "#4FA88A",
  coral: "#F09A86",
  coralDeep: "#D9715E",
  navy: "#4B4038",
  cream: "#FBF1DE",
  butter: "#F6D98B",
  wood: "#C99A6B",
  woodDark: "#8E6040",
  otter: "#9C6B45",
  otterDark: "#6E4A30",
  otterCream: "#F6E3C8",
  grass: "#A9CF8E",
  grassDeep: "#8DBA78",
  leaf: "#7FAE6E",
  leafDeep: "#5E8C5A",
  water: "#7CC7D6",
  stone: "#D9D2C3",
  bg: "#E4EDD7",
};

// 본관은 방 3×3칸, 사이사이 복도가 있어요. 앞(+z)으로 강이 흐르고, 선착장은 강 위 잔교예요.
export const ROOM = { w: 7, d: 5.5 };
const COL = ROOM.w + 1.8;
const ROW = ROOM.d + 1.8;
const at = (c: number, r: number): [number, number] => [c * COL, r * ROW];

export const BUILDINGS: Building[] = [
  {
    id: "library",
    name: "자료 도서관",
    pos: at(-1, -1),
    doors: ["e", "s"],
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
    pos: at(0, -1),
    doors: ["s"],
    roof: COLORS.butter,
    wall: COLORS.cream,
    accent: "#E3B341",
    floor: "#E8D4BA",
    staff: { title: "분석가", name: "나래", gear: "scarf", line: "게시물 반응은 제가 모아 둘게요. 회의 때 보고드릴게요." },
    objects: [{ id: "stats-board", label: "성과 게시판", panel: "stats", furniture: "board", pos: [0, -1.6] }],
  },
  {
    id: "dorm",
    name: "연구원 숙소",
    pos: at(1, -1),
    doors: ["w", "s"],
    roof: COLORS.leaf,
    wall: COLORS.cream,
    accent: COLORS.leafDeep,
    floor: "#E9D6BC",
    staff: { title: "매니저", name: "하리", gear: "nametag", line: "연구원들 역할을 바꾸거나 새 식구를 들일 수 있어요." },
    objects: [{ id: "dorm-roster", label: "연구원 명부", panel: "roster", furniture: "rosterBook", pos: [0, -1.4] }],
  },
  {
    id: "cards",
    name: "카드뉴스 공방",
    pos: at(-1, 0),
    doors: ["e"],
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
    id: "meeting",
    name: "회의 마당",
    pos: at(0, 0),
    doors: ["n", "s", "e", "w"],
    roof: "#9ED9C8",
    wall: COLORS.cream,
    accent: COLORS.mintDeep,
    floor: "#EADCC6",
    objects: [
      { id: "meeting-table", label: "오늘 회의", panel: "meeting", furniture: "roundTable", pos: [0, 0.2] },
      { id: "meeting-board", label: "회의록", panel: "minutes", furniture: "chalkboard", pos: [-3.05, -1.55], rot: Math.PI / 2 },
    ],
  },
  {
    id: "office",
    name: "소장실",
    pos: at(1, 0),
    doors: ["w"],
    roof: COLORS.navy,
    wall: COLORS.cream,
    accent: COLORS.coral,
    floor: "#E2C9A8",
    objects: [
      { id: "office-desk", label: "소장 책상", panel: "brand", furniture: "bigDesk", pos: [-1, -1.2] },
      { id: "office-drawer", label: "보관함 서랍장", panel: "drafts", furniture: "drawer", pos: [2, -1.9] },
    ],
  },
  {
    id: "receiver",
    name: "수신소",
    pos: at(-1, 1),
    doors: ["e", "n"],
    roof: COLORS.sky,
    wall: COLORS.cream,
    accent: COLORS.skyDeep,
    floor: "#E9D6BC",
    staff: { title: "통신원", name: "루미", gear: "headset", line: "소장님, 오늘도 소식이 강을 타고 잔뜩 떠내려왔어요!" },
    objects: [{ id: "receiver-monitor", label: "수신 모니터", panel: "inbox", furniture: "monitorDesk", pos: [0, -1.6] }],
  },
  {
    id: "lobby",
    name: "현관",
    pos: at(0, 1),
    doors: ["n", "s"],
    roof: COLORS.butter,
    wall: COLORS.cream,
    accent: COLORS.wood,
    floor: "#EFE2CC",
    objects: [],
    deco: true,
  },
  {
    id: "blog",
    name: "블로그 서재",
    pos: at(1, 1),
    doors: ["w", "n"],
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
    pos: [COL * 1.55, ROW * 2.05],
    doors: [],
    roof: COLORS.skyDeep,
    wall: COLORS.wood,
    accent: COLORS.navy,
    floor: "#D9B48C",
    open: true,
    staff: { title: "선장", name: "바다", gear: "captainHat", line: "확인만 해 주시면 바로 우편선 띄울게요!" },
    objects: [{ id: "dock-boat", label: "우편선", panel: "mailboat", furniture: "boat", pos: [0, -1.2] }],
  },
];

export const byId = (id: string) => BUILDINGS.find((b) => b.id === id)!;

/** 방 안 좌표 → 본관 좌표 */
export const toWorld = (b: Building, [x, z]: [number, number]): [number, number] => [b.pos[0] + x, b.pos[1] + z];

/** 문 가운데 (본관 좌표). 문 밖 복도 쪽으로 out만큼 나가요 */
export function doorPoint(b: Building, side: Side, out = 0): [number, number] {
  const hw = ROOM.w / 2 + out;
  const hd = ROOM.d / 2 + out;
  const [x, z] = b.pos;
  return side === "n" ? [x, z - hd] : side === "s" ? [x, z + hd] : side === "e" ? [x + hw, z] : [x - hw, z];
}

/** 본관 바깥 테두리와 강 */
export const SITE = {
  minX: -COL * 1.5 - 0.4,
  maxX: COL * 1.5 + 0.4,
  minZ: -ROW * 1.5 - 0.4,
  maxZ: ROW * 1.5 + 0.4,
  riverZ: ROW * 2.25,
  riverWidth: 6,
};
