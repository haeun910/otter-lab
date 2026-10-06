// 초안 쓰기에 쓰는 지시문. 연구원 명부에서 고친 지시문이 여기 기본값 대신 들어가요.
import type { Blog, Deck, DraftType, NewsItem } from "../data/demo";

export type CardTheme = "pastel" | "newsroom" | "magazine";
export type TitleFont = "jua" | "noto" | "blackhan" | "gowun";

/** 카드뉴스 겉모습 (소장 책상에서 골라요) */
export interface CardDesign {
  theme: CardTheme;
  accent: string; // 포인트 색
  font: TitleFont; // 제목 글꼴
  size: "portrait" | "square"; // 1080×1350 또는 1080×1080
}

/** 글 분량 (소장 책상에서 골라요) */
export interface WritingPlan {
  bundleCount: number; // 묶음 카드뉴스에 담을 소식 수 (2~6)
  deepCards: number; // 심층 카드뉴스 본문 장수 (3~6)
  bundleLength: number; // 묶음 블로그 글자 수 (공백 포함)
  deepLength: number; // 심층 블로그 글자 수
  photos: boolean; // 블로그에 사진 자리 표시
}

export interface BrandVoice {
  handle: string;
  series: string;
  tone: string;
  deepTone: string;
  design?: Partial<CardDesign>;
  writing?: Partial<WritingPlan>;
}

export const DEFAULT_DESIGN: CardDesign = { theme: "pastel", accent: "#8CCBFF", font: "jua", size: "portrait" };
export const DEFAULT_WRITING: WritingPlan = { bundleCount: 5, deepCards: 4, bundleLength: 2500, deepLength: 4000, photos: true };
export const LENGTHS = [
  { label: "짧게", chars: 1500 },
  { label: "보통", chars: 2500 },
  { label: "길게", chars: 4000 },
  { label: "아주 길게", chars: 6000 },
] as const;

const clamp = (v: unknown, lo: number, hi: number, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : d);
export const designOf = (b: BrandVoice): CardDesign => ({ ...DEFAULT_DESIGN, ...(b.design ?? {}) });
export function writingOf(b: BrandVoice): WritingPlan {
  const w = { ...DEFAULT_WRITING, ...(b.writing ?? {}) };
  return {
    bundleCount: clamp(w.bundleCount, 2, 6, DEFAULT_WRITING.bundleCount),
    deepCards: clamp(w.deepCards, 3, 6, DEFAULT_WRITING.deepCards),
    bundleLength: clamp(w.bundleLength, 800, 8000, DEFAULT_WRITING.bundleLength),
    deepLength: clamp(w.deepLength, 800, 8000, DEFAULT_WRITING.deepLength),
    photos: w.photos !== false,
  };
}

export const DEFAULT_BRAND: BrandVoice = {
  handle: "@otterlab.ai",
  series: "오터랩 데일리",
  tone: "친근한 존댓말, 어려운 용어는 한 번 풀어서",
  deepTone: "차분하게, 배경과 의미까지 짚어서",
  design: DEFAULT_DESIGN,
  writing: DEFAULT_WRITING,
};

export const DEFAULT_PROMPTS: Record<string, string> = {
  cards:
    "인스타그램 카드뉴스 문구를 써요. 카드 한 장에는 제목 한 줄(20자 안쪽)과 본문 두 줄(한 줄 40자 안쪽)만 넣어요. 숫자·날짜·고유명사는 원문 그대로 쓰고, 원문에 없는 사실은 지어내지 않아요.",
  blog:
    "네이버 블로그 글을 써요. 문단은 두세 문장으로 짧게 끊고, 어려운 용어는 한 번 풀어 줘요. 원문에 없는 사실·숫자는 지어내지 않고, 모르는 부분은 '원문에서 확인해 보세요'라고 써요. '제 생각에는'으로 시작하는 짧은 의견을 글 끝 쪽에 붙여요.",
};

export interface DraftRequest {
  type: DraftType;
  items: NewsItem[];
  brand: BrandVoice;
  prompts: { cards?: string; blog?: string };
}

export type Msg = { role: "system" | "user" | "assistant"; content: string };

const newsBlock = (items: NewsItem[]) =>
  items.map((n, i) => `[${i + 1}] ${n.title}\n매체: ${n.source} (${n.region})\n링크: ${n.link}\n요약: ${n.excerpt || "(요약 없음)"}`).join("\n\n");

/** 심층 카드 본문 장수에 맞는 꼬리표 차례 */
export const DEEP_TAGS = ["무슨 일이야?", "배경은?", "어떻게?", "왜 중요해?", "앞으로는?", "한 가지 더"];
export const deepTags = (n: number) => (n <= 3 ? ["무슨 일이야?", "어떻게?", "왜 중요해?"] : DEEP_TAGS.slice(0, n));

const DECK_FORMAT = `형식:\n{"cards":[{"kind":"cover|body|outro","tag":"","title":"","body":""}],"caption":"인스타그램 캡션(마지막 줄에 '출처: 매체')","hashtags":["#태그", ...10개 안쪽]}`;

function cardsSystem(r: DraftRequest) {
  const deep = r.type === "심층";
  return `너는 '${r.brand.series}' 카드뉴스를 만드는 디자이너 수달이야. 계정은 ${r.brand.handle}.\n말투: ${deep ? r.brand.deepTone : r.brand.tone}\n${r.prompts.cards || DEFAULT_PROMPTS.cards}\n반드시 JSON 하나만 답해.`;
}

export function cardsMessages(r: DraftRequest): Msg[] {
  const deep = r.type === "심층";
  const w = writingOf(r.brand);
  const tags = deepTags(w.deepCards);
  const shape = deep
    ? `cover 1장(제목=후킹 문장, body=한 줄 부제) → body ${tags.length}장(tag는 차례대로 ${tags.map((t) => `'${t}'`).join(", ")}) → outro 1장(제목 '한 줄 정리', body는 '- '로 시작하는 줄 3개)`
    : `cover 1장(제목 '오늘의 AI 소식 ${r.items.length}가지' 꼴, body=한 줄 부제) → 소식마다 body 1장(tag=매체 이름, 모두 ${r.items.length}장) → outro 1장(제목 '오늘의 정리', body는 소식마다 '- '로 시작하는 줄)`;
  return [
    { role: "system", content: cardsSystem(r) },
    {
      role: "user",
      content: `아래 소식으로 ${deep ? "심층(소식 하나를 깊게)" : "묶음(여러 소식을 한 장씩)"} 카드뉴스를 만들어 줘.\n카드 구성: ${shape}\n본문 줄바꿈은 \\n으로.\n\n${DECK_FORMAT}\n\n소식:\n${newsBlock(r.items)}`,
    },
  ];
}

export function rewriteDeckMessages(r: DraftRequest, deck: Deck, instruction: string): Msg[] {
  return [
    { role: "system", content: cardsSystem(r) },
    {
      role: "user",
      content: `지금 카드뉴스를 소장님 요청대로 다시 써 줘. 카드 장수와 순서(kind)는 그대로 두고 문구만 고쳐.\n소장님 요청: ${instruction}\n\n지금 카드뉴스:\n${JSON.stringify(deck)}\n\n${DECK_FORMAT}\n\n바탕 소식:\n${newsBlock(r.items)}`,
    },
  ];
}

// ---------- 블로그 ----------
function blogSystem(r: DraftRequest) {
  const deep = r.type === "심층";
  return `너는 오터랩 네이버 블로그를 쓰는 작가 수달이야.\n말투: ${deep ? r.brand.deepTone : r.brand.tone}\n${r.prompts.blog || DEFAULT_PROMPTS.blog}\n반드시 JSON 하나만 답해.`;
}

export const blogTarget = (r: DraftRequest) => {
  const w = writingOf(r.brand);
  return r.type === "심층" ? w.deepLength : w.bundleLength;
};

/** 소제목 수: 묶음은 소식마다 하나, 심층은 길이에 맞춰 (소제목 하나에 700자쯤) */
export const sectionCount = (r: DraftRequest) => (r.type === "심층" ? Math.min(8, Math.max(3, Math.round(blogTarget(r) / 700))) : r.items.length);

const photoRule = (r: DraftRequest) =>
  writingOf(r.brand).photos ? `소제목마다 "photo"에 그 자리에 넣으면 좋을 사진을 한 줄로 설명해 줘 (예: "발표 현장 사진", "서비스 화면 캡처"). 사진 설명은 대체 텍스트로도 써.` : `"photo"는 빈 문자열로 둬.`;

/** 짧은 글: 한 번에 */
export function blogMessages(r: DraftRequest): Msg[] {
  const deep = r.type === "심층";
  return [
    { role: "system", content: blogSystem(r) },
    {
      role: "user",
      content: `아래 소식으로 ${deep ? "한 가지 소식을 깊게 풀어 주는" : "소식을 하나씩 정리하는"} 블로그 글을 써 줘.\n전체 길이는 공백 포함 약 ${blogTarget(r)}자.\n제목은 검색에 잘 걸리게 핵심 낱말을 앞에.\n소제목 ${sectionCount(r)}개${deep ? " (배경, 무슨 일, 의미 등)" : " (소식마다 하나)"}. 소제목마다 끝에 '출처: 매체 (링크)'.\n${photoRule(r)}\n문단 구분은 \\n\\n으로.\n\n형식:\n{"title":"","intro":"","sections":[{"heading":"","body":"","photo":""}],"outro":"","tags":["# 없이", ...10개 안쪽]}\n\n소식:\n${newsBlock(r.items)}`,
    },
  ];
}

/** 긴 글 1단계: 뼈대(제목·도입·소제목별 다룰 내용·맺음) */
export function blogOutlineMessages(r: DraftRequest): Msg[] {
  const deep = r.type === "심층";
  const n = sectionCount(r);
  return [
    { role: "system", content: blogSystem(r) },
    {
      role: "user",
      content: `아래 소식으로 공백 포함 약 ${blogTarget(r)}자짜리 ${deep ? "심층" : "묶음"} 블로그 글의 설계도를 만들어 줘. 본문은 다음 단계에서 소제목마다 따로 써.\n- title: 검색에 잘 걸리게 핵심 낱말을 앞에\n- intro: 도입 문단 (300자 안쪽)\n- sections: 소제목 ${n}개${deep ? ". 배경 → 무슨 일 → 어떻게 → 의미 → 앞으로 같은 흐름으로, 서로 겹치지 않게" : ". 소식마다 하나"}. points에 그 소제목에서 다룰 내용을 두세 줄로\n- ${photoRule(r)}\n- outro: 맺음 문단 (200자 안쪽)\n\n형식:\n{"title":"","intro":"","sections":[{"heading":"","points":"","photo":""}],"outro":"","tags":["# 없이", ...10개 안쪽]}\n\n소식:\n${newsBlock(r.items)}`,
    },
  ];
}

/** 긴 글 2단계: 소제목 하나의 본문 */
export function blogSectionMessages(r: DraftRequest, outline: { title: string; sections: { heading: string; points?: string }[] }, i: number, chars: number): Msg[] {
  const deep = r.type === "심층";
  const s = outline.sections[i];
  const last = i === outline.sections.length - 1;
  const others = outline.sections.map((x, k) => `${k + 1}. ${x.heading}${k === i ? "  ← 지금 쓸 곳" : ""}`).join("\n");
  const source = deep ? (last ? "이 소제목 끝에 '출처: 매체 (링크)'를 적어." : "출처는 적지 마 (마지막 소제목에만 적어).") : "끝에 '출처: 매체 (링크)'를 적어.";
  return [
    { role: "system", content: blogSystem(r) },
    {
      role: "user",
      content: `블로그 글 '${outline.title}'의 소제목 하나를 써 줘.\n전체 차례:\n${others}\n\n지금 쓸 소제목: ${s.heading}\n다룰 내용: ${s.points || "(소제목에 맞게)"}\n길이: 공백 포함 약 ${chars}자, 문단 구분은 \\n\\n.\n다른 소제목에서 다룰 내용은 되풀이하지 마. ${source}${last ? " 의견('제 생각에는…')은 여기에 붙여." : ""}\n\n형식:\n{"body":""}\n\n소식:\n${newsBlock(r.items)}`,
    },
  ];
}

export function rewriteSectionMessages(r: DraftRequest, blog: Blog, i: number, instruction: string): Msg[] {
  const s = blog.sections[i];
  return [
    { role: "system", content: blogSystem(r) },
    {
      role: "user",
      content: `블로그 글 '${blog.title}'의 소제목 하나를 소장님 요청대로 다시 써 줘.\n소장님 요청: ${instruction}\n\n지금 소제목: ${s.heading}\n지금 본문:\n${s.body}\n\n출처 줄이 있었으면 그대로 남겨. 문단 구분은 \\n\\n.\n${photoRule(r)}\n\n형식:\n{"heading":"","body":"","photo":""}\n\n바탕 소식:\n${newsBlock(r.items)}`,
    },
  ];
}
