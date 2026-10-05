// 1단계 확인용 예시 데이터.
// 소식 목록은 10월 5일에 실제 RSS에서 모은 기사 제목·요약이고,
// 카드뉴스·블로그 글은 그 요약만 바탕으로 손으로 쓴 예시예요. (실제 글쓰기는 3단계에서 Groq가 맡아요)
import snapshot from "./news-snapshot.json";

export interface NewsItem {
  title: string;
  link: string;
  source: string;
  region: "국내" | "해외";
  category: "AI" | "개발" | "업계";
  publishedAt: number;
  excerpt: string;
}

export const NEWS = snapshot as NewsItem[];

export interface Card {
  kind: "cover" | "body" | "outro";
  tag?: string;
  title: string;
  body: string;
}

export interface Deck {
  id: string;
  type: "묶음" | "심층";
  cards: Card[];
  caption: string;
  hashtags: string[];
}

export const DECKS: Deck[] = [
  {
    id: "bundle",
    type: "묶음",
    cards: [
      { kind: "cover", title: "오늘의 AI 소식 5가지", body: "논문 쓰는 AI부터 뇌 데이터 모델까지, 수달이 골라 왔어요" },
      {
        kind: "body",
        tag: "AI타임스",
        title: "AI와 함께 쓰는 과학 논문",
        body: "앤트로픽이 하버드 물리학 교수의 기고문을 소개했어요.\nAI가 잘 푸는 문제를 골라 맡기는 연구 방식이에요.",
      },
      {
        kind: "body",
        tag: "AI타임스",
        title: "구글 AI 프로 40% 할인",
        body: "10월 31일까지 국내 신규 연간 구독자 대상이에요.\n연간 29만 원에서 17만 4천 원이 돼요.",
      },
      {
        kind: "body",
        tag: "AI타임스",
        title: "뇌 데이터로 배운 AI 모델",
        body: "뉴럴링크가 5만 시간 분량의 신경 데이터로 모델을 사전학습했어요.\n언어 AI에 쓰던 방식을 뇌-컴퓨터 연결에 가져왔어요.",
      },
      {
        kind: "body",
        tag: "AI타임스",
        title: "스스로 나아지는 AI 에이전트",
        body: "MIT와 사카나가 'SIFT'를 발표했어요.\n후보를 하나하나 검증하는 비용 문제를 줄이는 게 목표예요.",
      },
      {
        kind: "body",
        tag: "AI타임스",
        title: "AI 엉터리 제보에 멈춘 포상금",
        body: "AI가 쓴 부정확한 버그 제보가 몰렸어요.\n구글이 오픈소스 버그 바운티 일부를 잠시 멈췄어요.",
      },
      {
        kind: "outro",
        title: "오늘의 정리",
        body: "- AI는 과학 연구의 조수로\n- 구글 AI 프로 10월 말까지 할인\n- 뇌 데이터에도 사전학습\n- 에이전트 검증 비용 줄이기\n- AI 제보 홍수에 포상금 중단",
      },
    ],
    caption:
      "오늘 강을 타고 떠내려온 AI 소식 다섯 가지를 골라 왔어요.\n\n- 앤트로픽, AI와 함께하는 과학 연구 방식 소개\n- 구글 AI 프로 연간 구독 40% 할인 (10/31까지)\n- 뉴럴링크, 5만 시간 뇌 데이터로 모델 사전학습\n- MIT·사카나, 자가 개선 에이전트 SIFT 발표\n- 구글, AI 엉터리 제보에 버그 바운티 일부 중단\n\n출처: AI타임스",
    hashtags: ["#AI뉴스", "#인공지능", "#오터랩", "#OtterLab", "#IT뉴스", "#카드뉴스", "#생성형AI", "#AI에이전트", "#테크뉴스", "#오늘의AI"],
  },
  {
    id: "deep",
    type: "심층",
    cards: [
      { kind: "cover", title: "217년 된 암호를 6시간 만에", body: "GPT-6 아스트라가 나폴레옹 시대 암호를 풀었대요" },
      {
        kind: "body",
        tag: "무슨 일이야?",
        title: "나폴레옹 시대 군사 암호",
        body: "217년 동안 풀리지 않던 암호였어요.\n오픈AI의 GPT-6 아스트라가 6시간 만에 해독했어요.",
      },
      {
        kind: "body",
        tag: "어떻게?",
        title: "이미지 한 장, 프롬프트 한 번",
        body: "암호가 담긴 이미지 한 장과 프롬프트 한 번이 전부였대요.\n보안 기업 센티넬원의 엔지니어가 시도했어요.",
      },
      {
        kind: "body",
        tag: "왜 중요해?",
        title: "역사 연구의 새 도구",
        body: "오래된 기록을 읽는 일에 AI가 쓰일 수 있다는 사례예요.\n자세한 검증 과정은 원문에서 확인해 보세요.",
      },
      { kind: "outro", title: "한 줄 정리", body: "- 217년 된 암호, 6시간 만에 해독\n- 이미지 한 장과 프롬프트 한 번\n- 역사 기록 연구에 쓰일 가능성" },
    ],
    caption:
      "217년 동안 아무도 못 푼 나폴레옹 시대 암호, AI가 6시간 만에 풀었다고 해요.\n\n이미지 한 장과 프롬프트 한 번으로 해독했다는 이야기, 카드로 정리해 봤어요.\n\n출처: AI타임스",
    hashtags: ["#GPT6", "#AI", "#암호해독", "#오터랩", "#OtterLab", "#AI뉴스", "#인공지능", "#역사", "#테크뉴스"],
  },
];

export interface Blog {
  id: string;
  type: "묶음" | "심층";
  title: string;
  intro: string;
  sections: { heading: string; body: string }[];
  outro: string;
  tags: string[];
}

export const BLOGS: Blog[] = [
  {
    id: "bundle",
    type: "묶음",
    title: "AI 뉴스 정리 10월 5일, 논문 쓰는 AI부터 뇌 데이터 모델까지",
    intro: "오늘도 오터랩 수달들이 강가에서 건져 올린 AI 소식을 정리했어요. 바쁜 분들을 위해 다섯 가지만 골랐어요.",
    sections: [
      {
        heading: "앤트로픽이 소개한 AI 과학 연구",
        body: "앤트로픽이 하버드대 물리학 교수의 기고문을 공식 블로그에 실었어요. 큰 난제를 통째로 AI에 던지기보다, AI가 잘 풀 수 있는 문제를 찾아 맡기는 방식이 핵심이에요.\n\n제 생각에는 AI를 '연구 조수'로 쓰는 구체적인 방법을 보여준 사례라 연구하시는 분들께 참고가 될 것 같아요.\n출처: AI타임스 (https://www.aitimes.com/news/articleView.html?idxno=215979)",
      },
      {
        heading: "구글 AI 프로 연간 구독 40% 할인",
        body: "10월 31일까지 국내 신규 연간 구독자는 구글 AI 프로를 40% 할인된 17만 4천 원에 이용할 수 있어요. 월로 따지면 1만 4,500원이에요.\n\n제 생각에는 유료 AI를 고민하던 분이라면 이번 기간에 비교해 볼 만해요.\n출처: AI타임스 (https://www.aitimes.com/news/articleView.html?idxno=215976)",
      },
    ],
    outro: "오늘 소식은 여기까지예요. 궁금한 소식이 있으면 댓글로 알려 주세요. 이웃 추가하시면 매일 아침 정리를 받아볼 수 있어요.",
    tags: ["AI뉴스", "인공지능", "오터랩", "앤트로픽", "구글AI프로", "뉴럴링크", "AI에이전트", "IT뉴스", "테크뉴스", "생성형AI"],
  },
  {
    id: "deep",
    type: "심층",
    title: "GPT-6 아스트라, 217년 된 나폴레옹 암호를 6시간 만에 해독",
    intro: "217년 동안 풀리지 않던 나폴레옹 시대 군사 암호를 AI가 6시간 만에 풀었다는 소식이에요. 어떻게 된 일인지 정리해 봤어요.",
    sections: [
      {
        heading: "어떤 암호였나요",
        body: "나폴레옹 시대에 쓰인 군사 암호로, 217년 동안 해독되지 않았다고 해요.\n\n오픈AI의 GPT-6 아스트라가 이 암호를 6시간 만에 풀었어요.",
      },
      {
        heading: "어떻게 풀었나요",
        body: "보안 기업 센티넬원의 엔지니어가 암호가 담긴 이미지 한 장과 프롬프트 한 번으로 시도했다고 해요.\n\n제 생각에는 오래된 기록을 다루는 연구에 AI가 쓰일 수 있다는 걸 보여준 사례 같아요.\n출처: AI타임스 (https://www.aitimes.com/news/articleView.html?idxno=215961)",
      },
    ],
    outro: "자세한 해독 과정은 원문에서 확인해 보세요. 이런 심층 정리가 도움이 되셨다면 공감과 댓글 부탁드려요.",
    tags: ["GPT6", "아스트라", "암호해독", "나폴레옹", "오픈AI", "AI뉴스", "인공지능", "오터랩", "IT뉴스", "테크"],
  },
];

// 성과 게시판 예시 수치 (실제 수치는 5단계에서 인스타그램에서 가져와요)
export const STATS = [
  { date: "9/29", title: "이번 주 AI 소식 5가지", type: "묶음", likes: 42, saves: 18, reach: 640 },
  { date: "9/30", title: "에이전트가 뭐길래", type: "심층", likes: 61, saves: 47, reach: 910 },
  { date: "10/1", title: "오늘의 AI 소식 5가지", type: "묶음", likes: 38, saves: 15, reach: 580 },
  { date: "10/2", title: "무료 AI 도구 비교", type: "심층", likes: 77, saves: 66, reach: 1240 },
  { date: "10/3", title: "오늘의 AI 소식 5가지", type: "묶음", likes: 45, saves: 20, reach: 700 },
  { date: "10/4", title: "AI 반도체 한눈에", type: "심층", likes: 53, saves: 39, reach: 860 },
];

export const DRAFTS = [
  { id: "d1", date: "10월 5일", label: "오늘의 AI 소식 5가지", kinds: ["카드 7장", "블로그"], status: "검토 대기" },
  { id: "d2", date: "10월 5일", label: "217년 된 암호를 6시간 만에", kinds: ["카드 5장", "블로그"], status: "검토 대기" },
  { id: "d3", date: "10월 4일", label: "AI 반도체 한눈에", kinds: ["카드 6장", "블로그"], status: "게시함" },
  { id: "d4", date: "10월 4일", label: "오늘의 AI 소식 5가지", kinds: ["카드 7장"], status: "게시함" },
];
