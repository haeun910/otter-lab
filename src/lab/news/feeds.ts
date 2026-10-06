// 수신소가 매일 소식을 받아 오는 곳. 주소가 바뀌면 여기만 고치면 돼요.
// 분야: AI · Tech · Dev · Paper · Tools (news/category.ts). 국내와 해외를 반반쯤 고르게 받아요.
import type { NewsItem } from "../data/demo";
import type { Category } from "./category";

export interface Feed {
  source: string;
  url: string;
  region: NewsItem["region"];
  /** 피드 전체가 한 분야인지, 글마다 분야를 가려야 하는지(mixed) */
  category: Category | "mixed";
  /** mixed 피드에서 아무 규칙에도 안 걸릴 때 붙일 분야 */
  fallback?: Category;
  /** RSS·Atom이 아닌 곳: Hugging Face 논문·모델, GitHub 인기 저장소 */
  kind?: "rss" | "hf-papers" | "hf-models" | "github";
  /** 이 피드에서 받을 최대 개수 (기본 12) */
  perFeed?: number;
}

export const FEEDS: Feed[] = [
  // ---- AI ----
  { source: "AI타임스", url: "https://www.aitimes.com/rss/allArticle.xml", region: "국내", category: "AI" },
  { source: "인공지능신문", url: "https://www.aitimes.kr/rss/allArticle.xml", region: "국내", category: "mixed", fallback: "AI" },
  { source: "TechCrunch AI", url: "https://techcrunch.com/category/artificial-intelligence/feed/", region: "해외", category: "AI" },
  { source: "OpenAI News", url: "https://openai.com/news/rss.xml", region: "해외", category: "AI", perFeed: 6 },
  { source: "Google AI", url: "https://blog.google/technology/ai/rss/", region: "해외", category: "AI", perFeed: 6 },
  { source: "The Decoder", url: "https://the-decoder.com/feed/", region: "해외", category: "mixed", fallback: "AI" },

  // ---- Tech ----
  { source: "전자신문", url: "https://rss.etnews.com/Section901.xml", region: "국내", category: "mixed", fallback: "Tech" },
  { source: "ZDNet Korea", url: "https://feeds.feedburner.com/zdkorea", region: "국내", category: "mixed", fallback: "Tech" },
  { source: "블로터", url: "https://www.bloter.net/rss/allArticle.xml", region: "국내", category: "mixed", fallback: "Tech" },
  { source: "IT조선", url: "https://it.chosun.com/rss/allArticle.xml", region: "국내", category: "mixed", fallback: "Tech" },
  { source: "The Verge", url: "https://www.theverge.com/rss/index.xml", region: "해외", category: "mixed", fallback: "Tech" },
  { source: "MIT Technology Review", url: "https://www.technologyreview.com/feed/", region: "해외", category: "mixed", fallback: "Tech" },

  // ---- Dev ----
  { source: "GeekNews", url: "https://news.hada.io/rss/news", region: "국내", category: "mixed", fallback: "Dev" },
  { source: "토스 기술 블로그", url: "https://toss.tech/rss.xml", region: "국내", category: "Dev", perFeed: 4 },
  { source: "우아한형제들 기술블로그", url: "https://techblog.woowahan.com/feed/", region: "국내", category: "Dev", perFeed: 4 },
  { source: "카카오 기술 블로그", url: "https://tech.kakao.com/feed/", region: "국내", category: "Dev", perFeed: 4 },
  { source: "네이버 D2", url: "https://d2.naver.com/d2.atom", region: "국내", category: "Dev", perFeed: 4 },
  { source: "Hacker News", url: "https://hnrss.org/frontpage?points=150", region: "해외", category: "mixed", fallback: "Dev" },
  { source: "GitHub 블로그", url: "https://github.blog/feed/", region: "해외", category: "Dev", perFeed: 6 },
  { source: "GitHub 인기 저장소", url: "https://api.github.com/search/repositories", region: "해외", category: "Dev", kind: "github", perFeed: 8 },
  {
    source: "Hugging Face 인기 모델",
    url: "https://huggingface.co/api/models?sort=trendingScore&limit=20",
    region: "해외",
    category: "Dev",
    kind: "hf-models",
    perFeed: 8,
  },
  { source: "Hugging Face 블로그", url: "https://huggingface.co/blog/feed.xml", region: "해외", category: "mixed", fallback: "Dev", perFeed: 6 },

  // ---- Paper ----
  { source: "HF Daily Papers", url: "https://huggingface.co/api/daily_papers?limit=40", region: "해외", category: "Paper", kind: "hf-papers", perFeed: 15 },
  { source: "arXiv cs.AI", url: "https://rss.arxiv.org/rss/cs.AI", region: "해외", category: "Paper", perFeed: 6 },

  // ---- Tools ----
  { source: "Product Hunt", url: "https://www.producthunt.com/feed", region: "해외", category: "Tools", perFeed: 10 },
  // Show HN·Show GN은 Hacker News·GeekNews 피드에서 머리말로 가려서 Tools로 받아요
  { source: "Show HN", url: "https://hnrss.org/show?points=40&count=30", region: "해외", category: "Tools", perFeed: 8 },
];
