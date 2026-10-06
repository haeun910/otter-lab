import type { Card } from "./demo";

export const MAIN_COVER_TEMPLATE = { id: "main", name: "메인 수달 · 첫 페이지 고정" } as const;

/** Ten scenes share the same readable square layout and footer. */
export const CARD_TEMPLATES = [
  { id: "reporter", name: "기자 · 주요 소식", about: "표지와 발표 소식" },
  { id: "explainer", name: "칠판 · 용어 설명", about: "용어와 기술 설명" },
  { id: "researcher", name: "연구원 · 작동 원리", about: "연구와 작동 원리" },
  { id: "product", name: "노트북 · 제품", about: "제품과 서비스" },
  { id: "analyst", name: "돋보기 · 비교", about: "수치와 비교" },
  { id: "context", name: "지도 · 배경", about: "배경과 흐름" },
  { id: "checklist", name: "메모 · 기능 정리", about: "기능과 확인 사항" },
  { id: "caution", name: "표지판 · 한계", about: "한계와 주의점" },
  { id: "dialogue", name: "대화 · 여러 관점", about: "여러 관점과 논의" },
  { id: "courier", name: "우편배달 · 요약", about: "마지막 핵심 정리" },
] as const;
export type CardTemplate = (typeof CARD_TEMPLATES)[number]["id"] | typeof MAIN_COVER_TEMPLATE.id;
export const isCardTemplate = (value: unknown): value is CardTemplate => value === MAIN_COVER_TEMPLATE.id || CARD_TEMPLATES.some((t) => t.id === value);
const BODY_SEQUENCE: CardTemplate[] = ["context", "product", "researcher", "analyst", "caution", "dialogue", "checklist", "explainer"];

/** The first page always uses the main mascot; body choices remain editable. */
export function chooseCardTemplate(card: Card, page: number): CardTemplate {
  if (page === 1) return MAIN_COVER_TEMPLATE.id;
  if (isCardTemplate(card.template) && card.template !== MAIN_COVER_TEMPLATE.id) return card.template;
  if (card.kind === "cover") return "reporter";
  if (card.kind === "outro") return "courier";
  const subject = [card.tag, card.title, ...(card.sections ?? []).map((s) => s.heading)].join(" ");
  const rules: [RegExp, CardTemplate][] = [
    [/한계|주의|아쉬운|위험|제약/, "caution"],
    [/비교|수치|성능|결과|통계/, "analyst"],
    [/배경|흐름|역사|맥락/, "context"],
    [/용어|개념|뜻|정의/, "explainer"],
    [/작동|원리|연구|실험|방법/, "researcher"],
    [/기능|확인 사항|체크/, "checklist"],
    [/관점|논의|반응|쟁점/, "dialogue"],
    [/제품|서비스|도구|출시/, "product"],
  ];
  return rules.find(([pattern]) => pattern.test(subject))?.[1] ?? BODY_SEQUENCE[Math.max(0, page - 2) % BODY_SEQUENCE.length];
}
