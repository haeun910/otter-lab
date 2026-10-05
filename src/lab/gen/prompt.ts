// 초안 쓰기에 쓰는 지시문. 연구원 명부에서 고친 지시문이 여기 기본값 대신 들어가요.
import type { DraftType, NewsItem } from "../data/demo";

export interface BrandVoice {
  handle: string;
  series: string;
  tone: string;
  deepTone: string;
}

export const DEFAULT_PROMPTS: Record<string, string> = {
  cards:
    "인스타그램 카드뉴스 문구를 써요. 카드 한 장에는 제목 한 줄(20자 안쪽)과 본문 두 줄(한 줄 40자 안쪽)만 넣어요. 숫자·날짜·고유명사는 원문 그대로 쓰고, 원문에 없는 사실은 지어내지 않아요.",
  blog:
    "네이버 블로그 글을 써요. 소제목마다 두세 문단으로 쓰고, 마지막 문단은 '제 생각에는'으로 시작하는 짧은 의견을 붙여요. 각 소제목 끝에 '출처: 매체 (링크)'를 적어요. 원문에 없는 사실은 지어내지 않아요.",
};

export interface DraftRequest {
  type: DraftType;
  items: NewsItem[];
  brand: BrandVoice;
  prompts: { cards?: string; blog?: string };
}

const newsBlock = (items: NewsItem[]) =>
  items.map((n, i) => `[${i + 1}] ${n.title}\n매체: ${n.source} (${n.region})\n링크: ${n.link}\n요약: ${n.excerpt || "(요약 없음)"}`).join("\n\n");

export function cardsMessages(r: DraftRequest) {
  const deep = r.type === "심층";
  const shape = deep
    ? "cover 1장(제목=후킹 문장, body=한 줄 부제) → body 3장(tag는 '무슨 일이야?', '어떻게?', '왜 중요해?') → outro 1장(제목 '한 줄 정리', body는 '- '로 시작하는 줄 3개)"
    : `cover 1장(제목 '오늘의 AI 소식 N가지' 꼴, body=한 줄 부제) → 소식마다 body 1장(tag=매체 이름) → outro 1장(제목 '오늘의 정리', body는 소식마다 '- '로 시작하는 줄)`;
  return [
    {
      role: "system",
      content: `너는 '${r.brand.series}' 카드뉴스를 만드는 디자이너 수달이야. 계정은 ${r.brand.handle}.\n말투: ${deep ? r.brand.deepTone : r.brand.tone}\n${r.prompts.cards || DEFAULT_PROMPTS.cards}\n반드시 JSON 하나만 답해.`,
    },
    {
      role: "user",
      content: `아래 소식으로 ${deep ? "심층(소식 하나를 깊게)" : "묶음(여러 소식을 한 장씩)"} 카드뉴스를 만들어 줘.\n카드 구성: ${shape}\n본문 줄바꿈은 \\n으로.\n\n형식:\n{"cards":[{"kind":"cover|body|outro","tag":"","title":"","body":""}],"caption":"인스타그램 캡션(마지막 줄에 '출처: 매체')","hashtags":["#태그", ...10개 안쪽]}\n\n소식:\n${newsBlock(r.items)}`,
    },
  ];
}

export function blogMessages(r: DraftRequest) {
  const deep = r.type === "심층";
  return [
    {
      role: "system",
      content: `너는 오터랩 네이버 블로그를 쓰는 작가 수달이야.\n말투: ${deep ? r.brand.deepTone : r.brand.tone}\n${r.prompts.blog || DEFAULT_PROMPTS.blog}\n반드시 JSON 하나만 답해.`,
    },
    {
      role: "user",
      content: `아래 소식으로 ${deep ? "한 가지 소식을 깊게 풀어 주는" : "소식을 하나씩 정리하는"} 블로그 글을 써 줘.\n제목은 검색에 잘 걸리게 핵심 낱말을 앞에.\n${deep ? "소제목 3~4개(배경, 무슨 일, 의미 등)." : "소식마다 소제목 하나."}\n문단 구분은 \\n\\n으로.\n\n형식:\n{"title":"","intro":"","sections":[{"heading":"","body":""}],"outro":"","tags":["# 없이", ...10개 안쪽]}\n\n소식:\n${newsBlock(r.items)}`,
    },
  ];
}
