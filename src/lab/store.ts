import { create } from "zustand";
import { BUILDINGS, type RoomObject } from "./data/buildings";
import { DECKS, type Card, type Deck } from "./data/demo";

export type SceneId = "outside" | string; // 건물 id

export type Pending = { type: "enter"; id: string } | { type: "use"; object: RoomObject } | { type: "exit" } | null;

export interface StaffEdit {
  title: string;
  name: string;
}

interface LabState {
  scene: SceneId;
  fading: boolean;
  pending: Pending;
  focus: RoomObject | null; // 카메라가 다가간 사물
  panelOpen: boolean;
  spawnAt: string | null; // 바깥으로 나올 때 이 건물 문 앞에 서요
  hint: boolean; // 처음 안내 문구
  toast: string;
  mapOpen: boolean;
  speech: { key: string; text: string } | null; // 말풍선
  nearDoor: string | null; // 문 앞에 서 있으면 그 건물 id
  marker: [number, number] | null; // 목적지 표시
  hover: string | null; // 마우스를 올린 것
  // 3D 장면이 등록해 두는 동작 (라벨을 눌러도 똑같이 움직이게)
  actions: { enter?: (id: string) => void; use?: (o: RoomObject) => void; exit?: () => void; talk?: (key: string) => void };
  staff: Record<string, StaffEdit>;
  brand: { handle: string; series: string; tone: string; deepTone: string };
  decks: Deck[];
  basket: string[]; // 담은 소식 링크


  go: (scene: SceneId, spawnAt?: string | null) => void;
  setPending: (p: Pending) => void;
  openFocus: (o: RoomObject) => void;
  closeFocus: () => void;
  say: (msg: string) => void;
  setMapOpen: (v: boolean) => void;
  setSpeech: (s: LabState["speech"]) => void;
  dismissHint: () => void;
  setNearDoor: (id: string | null) => void;
  setMarker: (m: [number, number] | null) => void;
  setHover: (h: string | null) => void;
  setActions: (a: LabState["actions"]) => void;
  editStaff: (id: string, e: StaffEdit) => void;
  setBrand: (b: LabState["brand"]) => void;
  editCard: (deckId: string, index: number, patch: Partial<Card>) => void;
  editCaption: (deckId: string, caption: string) => void;
  toggleBasket: (link: string) => void;
  travel: (scene: SceneId) => void;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
let speechTimer: ReturnType<typeof setTimeout> | undefined;

export const useLab = create<LabState>((set, get) => ({
  scene: "outside",
  fading: false,
  pending: null,
  focus: null,
  panelOpen: false,
  spawnAt: null,
  hint: true,
  toast: "",
  mapOpen: false,
  speech: null,
  nearDoor: null,
  marker: null,
  hover: null,
  actions: {},
  staff: Object.fromEntries(BUILDINGS.filter((b) => b.staff).map((b) => [b.id, { title: b.staff!.title, name: b.staff!.name }])),
  brand: {
    handle: "@otterlab.ai",
    series: "오터랩 데일리",
    tone: "친근한 존댓말, 어려운 용어는 한 번 풀어서",
    deepTone: "차분하게, 배경과 의미까지 짚어서",
  },
  decks: DECKS,
  basket: [],

  go: (scene, spawnAt = null) => {
    if (get().fading) return;
    set({ fading: true, pending: null, focus: null, panelOpen: false, mapOpen: false, marker: null, nearDoor: null });
    live.path = [];
    // 화면이 덮인 뒤 장면을 바꾸고 다시 걷어내요
    setTimeout(() => set({ scene, spawnAt }), 380);
    setTimeout(() => set({ fading: false }), 760);
  },
  setPending: (pending) => set({ pending }),
  openFocus: (o) => {
    set({ focus: o, pending: null });
    setTimeout(() => {
      if (get().focus?.id === o.id) set({ panelOpen: true });
    }, 650);
  },
  closeFocus: () => set({ focus: null, panelOpen: false }),
  say: (msg) => {
    clearTimeout(toastTimer);
    set({ toast: msg });
    toastTimer = setTimeout(() => set({ toast: "" }), 2600);
  },
  setMapOpen: (mapOpen) => set({ mapOpen }),
  setSpeech: (speech) => {
    clearTimeout(speechTimer);
    set({ speech });
    if (speech) speechTimer = setTimeout(() => set({ speech: null }), 4200);
  },
  dismissHint: () => set({ hint: false }),
  setNearDoor: (nearDoor) => {
    if (get().nearDoor !== nearDoor) set({ nearDoor });
  },
  setMarker: (marker) => set({ marker }),
  setActions: (actions) => set({ actions }),
  setHover: (hover) => {
    if (get().hover !== hover) set({ hover });
    document.body.style.cursor = hover ? "pointer" : "";
  },
  editStaff: (id, e) => set((s) => ({ staff: { ...s.staff, [id]: e } })),
  setBrand: (brand) => set({ brand }),
  editCard: (deckId, index, patch) =>
    set((s) => ({
      decks: s.decks.map((d) => (d.id === deckId ? { ...d, cards: d.cards.map((c, i) => (i === index ? { ...c, ...patch } : c)) } : d)),
    })),
  editCaption: (deckId, caption) => set((s) => ({ decks: s.decks.map((d) => (d.id === deckId ? { ...d, caption } : d)) })),
  toggleBasket: (link) =>
    set((s) => ({ basket: s.basket.includes(link) ? s.basket.filter((l) => l !== link) : [...s.basket, link] })),
  travel: (scene) => {
    const cur = get().scene;
    if (scene === cur) {
      set({ mapOpen: false });
      return;
    }
    get().go(scene, scene === "outside" ? cur : null);
  },
}));

// 매 프레임 바뀌는 값은 리렌더 없이 공유해요
export const live = {
  player: { x: 0, z: 0.6, heading: 0.4, moving: false },
  path: [] as [number, number][],
  camAzimuth: Math.PI / 4, // 바깥 카메라 회전
  camZoom: 1,
  keys: new Set<string>(),
};
