// 수신소가 매일 소식을 받아 오는 곳. 주소가 바뀌면 여기만 고치면 돼요.
import type { NewsItem } from "../data/demo";

export interface Feed {
  source: string;
  url: string;
  region: NewsItem["region"];
  /** 글마다 분야를 따로 가릴지(mixed), 피드 전체가 한 분야인지 */
  category: NewsItem["category"] | "mixed";
  /** mixed 피드에서 AI 낱말이 없을 때 붙일 분야 */
  fallback?: NewsItem["category"];
}

export const FEEDS: Feed[] = [
  { source: "AI타임스", url: "https://www.aitimes.com/rss/allArticle.xml", region: "국내", category: "AI" },
  { source: "GeekNews", url: "https://news.hada.io/rss/news", region: "국내", category: "mixed", fallback: "개발" },
  { source: "전자신문", url: "https://rss.etnews.com/Section901.xml", region: "국내", category: "mixed", fallback: "업계" },
  { source: "ZDNet Korea", url: "https://feeds.feedburner.com/zdkorea", region: "국내", category: "mixed", fallback: "업계" },
  { source: "블로터", url: "https://www.bloter.net/rss/allArticle.xml", region: "국내", category: "mixed", fallback: "업계" },
  { source: "MIT Technology Review", url: "https://www.technologyreview.com/feed/", region: "해외", category: "mixed", fallback: "업계" },
  { source: "TechCrunch AI", url: "https://techcrunch.com/category/artificial-intelligence/feed/", region: "해외", category: "AI" },
  { source: "OpenAI News", url: "https://openai.com/news/rss.xml", region: "해외", category: "AI" },
  { source: "Hacker News", url: "https://hnrss.org/frontpage?points=150", region: "해외", category: "mixed", fallback: "개발" },
];
