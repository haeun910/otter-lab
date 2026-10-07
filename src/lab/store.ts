import type { TopicProject } from "./research/types";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { BUILDINGS, type RoomObject } from "./data/buildings";
import { NEWS, SEED_DRAFTS, SEED_POSTS, type Blog, type Card, type Draft, type Meeting, type NewsItem, type Post } from "./data/demo";
import { DEFAULT_BRAND, DEFAULT_PROMPTS, type BrandVoice } from "./gen/prompt";
import { CATEGORIES, normCategory } from "./news/category";
import { mergeNews } from "./news/rss";

export type SceneId = "overview" | string; // 본관 전체 또는 방 id

/** 연구소의 하루: 각자 방에서 일하다가, 회의 시간이 되면 마당 나무 아래 모여요 */
export type Phase = "work" | "gathering" | "meeting" | "returning";

export interface StaffEdit {
  title: string;
  name: string;
  prompt?: string; // 글 쓰는 연구원(모모·테오)의 역할 지시문
}

/** 브랜드 설정 (계정·시리즈 이름·말투 + 카드 디자인·글 분량) */
export type Brand = BrandVoice;

const LIBRARY_MAX = 3000;

interface LabState {
  scene: SceneId;
  focus: RoomObject | null; // 카메라가 다가간 사물
  panelOpen: boolean;
  hint: boolean; // 처음 안내 문구
  toast: string;
  mapOpen: boolean;
  speech: { key: string; text: string } | null; // 말풍선
  hover: string | null; // 마우스를 올린 것
  busy: "news" | "draft" | "print" | "research" | null; // 시간이 걸리는 일
  phase: Phase;
  writing: string[]; // 지금 초안을 쓰고 있는 직원 (cards, blog)
  cloud: "off" | "saving" | "saved" | "error"; // Supabase에 저장 상태

  // ---- 저장되는 연구소 데이터 ----
  staff: Record<string, StaffEdit>;
  brand: Brand;
  library: NewsItem[]; // 지금까지 받은 모든 소식 (최신순)
  inbox: string[]; // 가장 최근에 받은 소식 링크 (수신 모니터)
  lastFetch: number | null;
  basket: string[]; // 담은 소식 링크
  drafts: Draft[]; // 최신순
  current: string | null; // 공방·서재·선착장에서 보고 있는 초안
  posts: Post[];
  schedule: { meetingAt: string }; // 매일 회의 시간 (한국 시간 "10:00")
  meetings: Meeting[]; // 회의록 (최신순)

  openFocus: (o: RoomObject) => void;
  closeFocus: () => void;
  say: (msg: string) => void;
  setMapOpen: (v: boolean) => void;
  setSpeech: (s: LabState["speech"]) => void;
  dismissHint: () => void;
  setHover: (h: string | null) => void;
  setBusy: (b: LabState["busy"]) => void;
  setPhase: (p: Phase) => void;
  setCloud: (c: LabState["cloud"]) => void;
  setWriting: (who: string, on: boolean) => void;
  travel: (scene: SceneId) => void;
  setSchedule: (s: LabState["schedule"]) => void;
  addMeeting: (m: Meeting) => void;

  editStaff: (id: string, e: StaffEdit) => void;
  setBrand: (b: Brand) => void;
  receiveNews: (items: NewsItem[], fetchedAt: number) => void;
  toggleBasket: (link: string) => void;
  clearBasket: () => void;
  projects: TopicProject[];
  currentProject: string | null;
  addProject: (p: TopicProject) => void;
  patchProject: (id: string, patch: Partial<TopicProject>) => void;
  setCurrentProject: (id: string) => void;
  addDraft: (d: Draft) => void;
  patchDraft: (id: string, patch: Partial<Draft>) => void;
  removeDraft: (id: string) => void;
  setCurrent: (id: string) => void;
  editCard: (draftId: string, index: number, patch: Partial<Card>) => void;
  addCard: (draftId: string, after: number) => void;
  removeCard: (draftId: string, index: number) => void;
  moveCard: (draftId: string, index: number, dir: -1 | 1) => void;
  editDeck: (draftId: string, patch: Partial<Draft["deck"]>) => void;
  editBlog: (draftId: string, patch: Partial<Blog>) => void;
  publish: (draftId: string) => void;
  editPost: (id: string, patch: Partial<Pick<Post, "likes" | "saves" | "reach">>) => void;
  importData: (data: Partial<SavedData>) => void;
  resetData: () => void;
}

const defaultStaff = (): Record<string, StaffEdit> =>
  Object.fromEntries(
    BUILDINGS.filter((b) => b.staff).map((b) => [
      b.id,
      { title: b.staff!.title, name: b.staff!.name, ...(DEFAULT_PROMPTS[b.id] ? { prompt: DEFAULT_PROMPTS[b.id] } : {}) },
    ]),
  );

const initialData = () => ({
  staff: defaultStaff(),
  brand: { ...DEFAULT_BRAND },
  library: NEWS,
  inbox: NEWS.map((n) => n.link),
  lastFetch: null as number | null,
  basket: [] as string[],
  projects: [] as TopicProject[],
  currentProject: null as string | null,
  drafts: SEED_DRAFTS,
  current: SEED_DRAFTS[0]?.id ?? null,
  posts: SEED_POSTS,
  schedule: { meetingAt: "10:00" },
  meetings: [] as Meeting[],
});

export type SavedData = ReturnType<typeof initialData>;
const SAVED_KEYS = Object.keys(initialData()) as (keyof SavedData)[];

let toastTimer: ReturnType<typeof setTimeout> | undefined;
let speechTimer: ReturnType<typeof setTimeout> | undefined;

export const useLab = create<LabState>()(
  persist(
    (set, get) => {
      const patchDraft = (id: string, fn: (d: Draft) => Draft) => set((s) => ({ drafts: s.drafts.map((d) => (d.id === id ? fn(d) : d)) }));
      const patchCards = (id: string, fn: (cards: Card[]) => Card[]) => patchDraft(id, (d) => ({ ...d, deck: { ...d.deck, cards: fn(d.deck.cards) } }));
      return {
        scene: "overview",
        focus: null,
        panelOpen: false,
        hint: true,
        toast: "",
        mapOpen: false,
        speech: null,
        hover: null,
        busy: null,
        phase: "work",
        writing: [],
        cloud: "off",
        ...initialData(),

        openFocus: (o) => {
          set({ focus: o });
          setTimeout(() => {
            if (get().focus?.id === o.id) set({ panelOpen: true });
          }, 120);
        },
        closeFocus: () => set({ focus: null, panelOpen: false }),
        say: (msg) => {
          clearTimeout(toastTimer);
          set({ toast: msg });
          toastTimer = setTimeout(() => set({ toast: "" }), Math.max(2600, msg.length * 70));
        },
        setMapOpen: (mapOpen) => set({ mapOpen }),
        setSpeech: (speech) => {
          clearTimeout(speechTimer);
          set({ speech });
          if (speech) speechTimer = setTimeout(() => set({ speech: null }), 4200);
        },
        dismissHint: () => set({ hint: false }),
        setHover: (hover) => {
          if (get().hover !== hover) set({ hover });
          document.body.style.cursor = hover ? "pointer" : "";
        },
        setBusy: (busy) => set({ busy }),
        setPhase: (phase) => set({ phase }),
        setCloud: (cloud) => get().cloud !== cloud && set({ cloud }),
        setWriting: (who, on) => set((s) => ({ writing: on ? [...new Set([...s.writing, who])] : s.writing.filter((w) => w !== who) })),
        // 카메라가 그 방으로 날아가요 (본관 전체는 "overview")
        travel: (scene) => set({ scene, focus: null, panelOpen: false, mapOpen: false, hint: false }),
        setSchedule: (schedule) => set({ schedule }),
        addMeeting: (m) => set((s) => ({ meetings: [m, ...s.meetings].slice(0, 200) })),

        editStaff: (id, e) => set((s) => ({ staff: { ...s.staff, [id]: e } })),
        setBrand: (brand) => set({ brand }),
        receiveNews: (items, fetchedAt) =>
          set((s) => ({
            library: mergeNews(items, s.library).slice(0, LIBRARY_MAX),
            inbox: items.length ? items.map((n) => n.link) : s.inbox,
            lastFetch: fetchedAt,
          })),
        toggleBasket: (link) => set((s) => ({ basket: s.basket.includes(link) ? s.basket.filter((l) => l !== link) : [...s.basket, link] })),
        clearBasket: () => set({ basket: [] }),
        addProject: (p) => set((s) => ({ projects: [p, ...s.projects], currentProject: p.id })),
        patchProject: (id, patch) => set((s) => ({ projects: s.projects.map((p) => p.id === id ? { ...p, ...patch } : p) })),
        setCurrentProject: (id) => set({ currentProject: id }),
        addDraft: (d) => set((s) => ({ drafts: [d, ...s.drafts], current: d.id })),
        patchDraft: (id, patch) => patchDraft(id, (d) => ({ ...d, ...patch })),
        removeDraft: (id) =>
          set((s) => {
            const drafts = s.drafts.filter((d) => d.id !== id);
            return { drafts, current: s.current === id ? (drafts[0]?.id ?? null) : s.current };
          }),
        setCurrent: (current) => set({ current }),
        editCard: (id, index, patch) => patchCards(id, (cards) => cards.map((c, i) => (i === index ? { ...c, ...patch } : c))),
        addCard: (id, after) =>
          patchCards(id, (cards) => [...cards.slice(0, after + 1), { kind: "body", tag: "", title: "새 카드", body: "" }, ...cards.slice(after + 1)]),
        removeCard: (id, index) => patchCards(id, (cards) => (cards.length > 2 ? cards.filter((_, i) => i !== index) : cards)),
        moveCard: (id, index, dir) =>
          patchCards(id, (cards) => {
            const j = index + dir;
            if (j < 0 || j >= cards.length) return cards;
            const next = [...cards];
            [next[index], next[j]] = [next[j], next[index]];
            return next;
          }),
        editDeck: (id, patch) => patchDraft(id, (d) => ({ ...d, deck: { ...d.deck, ...patch } })),
        editBlog: (id, patch) => patchDraft(id, (d) => ({ ...d, blog: { ...d.blog, ...patch } })),
        publish: (id) => {
          const d = get().drafts.find((x) => x.id === id);
          if (!d || d.status === "게시함") return;
          const postedAt = Date.now();
          patchDraft(id, (x) => ({ ...x, status: "게시함", postedAt }));
          set((s) => ({
            posts: [
              ...s.posts,
              { id: `post-${id}`, draftId: id, postedAt, title: d.deck.cards[0]?.title ?? d.blog.title, type: d.type, likes: 0, saves: 0, reach: 0 },
            ],
          }));
        },
        editPost: (id, patch) => set((s) => ({ posts: s.posts.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
        importData: (data) => set(Object.fromEntries(SAVED_KEYS.filter((k) => k in data).map((k) => [k, data[k]]))),
        resetData: () => set(initialData()),
      };
    },
    {
      name: "otter-lab",
      version: 2,
      migrate: (saved, version) => {
        const data = saved as Partial<SavedData>;
        // Update the former default without changing other saved card counts or existing drafts.
        if (version < 2 && data.brand?.writing?.deepCards === 4) {
          return { ...data, brand: { ...data.brand, writing: { ...data.brand.writing, deepCards: 5 } } };
        }
        return data;
      },
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => Object.fromEntries(SAVED_KEYS.map((k) => [k, s[k]])) as SavedData,
      // 새로 생긴 기본값(예: 지시문)은 저장된 값 아래에 깔아 둬요
      merge: (saved, cur) => {
        const s = (saved ?? {}) as Partial<SavedData>;
        // 예전 분야 이름(개발·업계)으로 저장된 소식은 지금 분야로
        if (s.library) s.library = s.library.map((n) => (CATEGORIES.includes(n.category) ? n : { ...n, category: normCategory(n.category) }));
        return { ...cur, ...s, staff: { ...cur.staff, ...Object.fromEntries(Object.entries(s.staff ?? {}).map(([k, v]) => [k, { ...cur.staff[k], ...v }])) } };
      },
    },
  ),
);

/** 지금 보고 있는 초안 (없으면 검토 대기 중 가장 최근 것) */
export function pickCurrent(drafts: Draft[], current: string | null): Draft | undefined {
  return drafts.find((d) => d.id === current) ?? drafts.find((d) => d.status === "검토 대기") ?? drafts[0];
}

/** 초안 이름: 표지 카드 제목 */
export const draftLabel = (d: Draft) => d.deck.cards[0]?.title || d.blog.title || "제목 없는 초안";
