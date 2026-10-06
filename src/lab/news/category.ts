// 소식 분야 다섯 가지와, 분야를 가리는 규칙.
// 피드 하나가 한 분야면 그대로 쓰고, 여러 분야가 섞인 피드는 링크·낱말로 가려요
// (Groq 키가 있으면 애매한 것만 한 번 더 AI에게 물어봐요: classifyLLM.ts).

export const CATEGORIES = ["AI", "Tech", "Dev", "Paper", "Tools"] as const;
export type Category = (typeof CATEGORIES)[number];

/** 묶음 카드뉴스에 분야별로 몇 개씩 담을지의 비율 (0이면 그 분야는 빼요) */
export type Mix = Record<Category, number>;
export const DEFAULT_MIX: Mix = { AI: 1, Tech: 1, Dev: 1, Paper: 1, Tools: 1 };

export interface CategoryInfo {
  desc: string; // 화면에 보이는 설명
  guide: string; // 글 쓸 때 이 분야는 무엇을 중심으로 쓸지
  deepTags: string[]; // 심층 카드뉴스 본문 꼬리표 차례 (최대 6)
  deepFlow: string; // 심층 블로그 소제목 흐름
}

export const CATEGORY_INFO: Record<Category, CategoryInfo> = {
  AI: {
    desc: "새 모델, 생성형 AI, Agent, AI 서비스, AI 산업",
    guide: "새 모델·AI 서비스는 무엇이 새로워졌는지, 누가 언제부터 쓸 수 있는지 중심으로. 성능 숫자는 원문 그대로.",
    deepTags: ["무슨 일이야?", "뭐가 새로워?", "어떻게 써?", "왜 중요해?", "앞으로는?", "한 가지 더"],
    deepFlow: "무슨 일 → 무엇이 새로워졌나 → 어떻게 쓰나 → 의미 → 앞으로",
  },
  Tech: {
    desc: "빅테크, 주요 기술, 새로운 기술, IT 이슈",
    guide: "회사·시장·사용자에게 어떤 영향이 있는지 중심으로. 배경을 한 줄 짚어 줘.",
    deepTags: ["무슨 일이야?", "배경은?", "어떻게?", "왜 중요해?", "앞으로는?", "한 가지 더"],
    deepFlow: "배경 → 무슨 일 → 어떻게 → 의미 → 앞으로",
  },
  Dev: {
    desc: "개발 기술, 오픈 소스, GitHub, Hugging Face, 개발 트렌드",
    guide: "무엇을 하는 도구·라이브러리·모델인지, 어떻게 써 볼 수 있는지(설치·링크) 중심으로. 별 수·라이선스·지원 언어는 원문에 있을 때만.",
    deepTags: ["이게 뭐야?", "어떻게 동작해?", "써 보려면?", "왜 주목받아?", "아쉬운 점은?", "한 가지 더"],
    deepFlow: "무엇인가 → 어떻게 동작하나 → 시작하는 법 → 왜 주목받나 → 아쉬운 점",
  },
  Paper: {
    desc: "흥미로운 AI·컴퓨터 분야 논문",
    guide:
      "논문은 '무슨 문제를 → 어떻게 풀었고 → 결과가 어떤지 → 왜 중요한지' 순서로, 전문 용어는 쉬운 말로 한 번 풀어 줘. 저자·기관은 원문에 있을 때만 밝혀. 원문에 없는 실험 숫자는 지어내지 마.",
    deepTags: ["무슨 연구야?", "어떻게 풀었어?", "결과는?", "왜 중요해?", "한계는?", "한 가지 더"],
    deepFlow: "연구 배경과 문제 → 방법 → 결과 → 의미 → 한계와 남은 질문",
  },
  Tools: {
    desc: "직접 써 볼 만한 AI·IT 서비스",
    guide: "직접 써 볼 수 있는 서비스는 '무엇을 해 주는지 → 어떻게 시작하는지 → 누구에게 좋은지' 중심으로. 가격·무료 여부는 원문에 있을 때만.",
    deepTags: ["뭐 하는 서비스야?", "어떻게 써?", "좋은 점", "아쉬운 점", "누구에게 추천?", "한 가지 더"],
    deepFlow: "어떤 서비스인가 → 써 보는 법 → 좋은 점 → 아쉬운 점 → 누구에게 추천하나",
  },
};

/** 예전 분야 이름(개발·업계)이나 이상한 값을 지금 분야로 */
export function normCategory(c: unknown): Category {
  if (typeof c === "string") {
    if ((CATEGORIES as readonly string[]).includes(c)) return c as Category;
    if (c === "개발") return "Dev";
    if (c === "업계") return "Tech";
  }
  return "Tech";
}

// ---------- 규칙 ----------
const PAPER_LINK =
  /(?:arxiv\.org|openreview\.net|aclanthology\.org|huggingface\.co\/papers|paperswithcode\.com|dl\.acm\.org|ieeexplore\.ieee\.org|proceedings\.|biorxiv\.org)/i;
const PAPER_WORDS = /(?:논문|\bpaper\b|arXiv|preprint|프리프린트|학회 발표|NeurIPS|ICML|ICLR|CVPR|ACL\b|EMNLP)/i;
const TOOL_HEAD = /^(?:Show HN|Show GN|Launch HN)\b/i;
const TOOL_WORDS =
  /(?:써 ?볼 ?만한|써보니|사용 후기|무료로 (?:쓸|써)|크롬 확장|Chrome extension|앱 출시|서비스 (?:출시|공개|오픈)|베타 (?:출시|공개|오픈)|open beta|now available|launch(?:es|ed)? (?:a |an |its )?(?:new )?(?:app|tool|service))/i;
const DEV_LINK = /(?:github\.com|gitlab\.com|huggingface\.co\/(?!papers)|npmjs\.com|pypi\.org|crates\.io)/i;
const DEV_STRONG =
  /(?:오픈 ?소스|open[- ]source|깃허브|GitHub|허깅페이스|Hugging ?Face|라이브러리|library|프레임워크|framework|SDK|\bCLI\b|컴파일러|compiler|릴리스|release notes|버전 \d|v\d+\.\d+)/i;
const DEV_WEAK =
  /(?:개발자|developer|코딩|coding|프로그래밍|programming|Rust|Python|파이썬|TypeScript|JavaScript|자바스크립트|Kubernetes|쿠버네티스|Docker|도커|데이터베이스|database|Postgres|SQLite|Linux|리눅스|API\b|백엔드|프론트엔드|backend|frontend|DevOps)/i;
export const AI_WORDS =
  /(?:\bAI\b|A\.I\.|인공지능|생성형|LLM|GPT|챗GPT|ChatGPT|Claude|클로드|Gemini|제미나이|라마|Llama|오픈AI|OpenAI|앤트로픽|Anthropic|딥마인드|DeepMind|에이전트|\bagents?\b|머신러닝|machine learning|딥러닝|deep learning|neural|신경망|transformer|파운데이션 모델|foundation model|Copilot|코파일럿|NPU|HBM|AGI|멀티모달|multimodal|추론 모델|reasoning model)/i;

export interface Verdict {
  category: Category;
  sure: boolean; // 링크·머리말처럼 확실한 근거가 있었는지 (아니면 AI에게 한 번 더 물어볼 만해요)
}

/** 여러 분야가 섞인 피드의 소식 하나를 가려요 */
export function classify(title: string, body: string, link: string, fallback: Category = "Tech"): Verdict {
  const text = `${title} ${body}`;
  if (PAPER_LINK.test(link)) return { category: "Paper", sure: true };
  if (TOOL_HEAD.test(title.trim())) return { category: "Tools", sure: true };
  if (PAPER_WORDS.test(title)) return { category: "Paper", sure: false };
  if (DEV_LINK.test(link) || DEV_STRONG.test(title)) return { category: "Dev", sure: DEV_LINK.test(link) };
  if (TOOL_WORDS.test(text)) return { category: "Tools", sure: false };
  if (AI_WORDS.test(text)) return { category: "AI", sure: false };
  if (DEV_WEAK.test(title)) return { category: "Dev", sure: false };
  return { category: fallback, sure: false };
}
