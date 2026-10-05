// RSS 2.0·Atom 피드를 소식 목록으로 바꿔요. 서버(API)와 자동화 스크립트가 같이 써요.
import type { NewsItem } from "../data/demo";
import type { Feed } from "./feeds";

const AI_WORDS =
  /(?:\bAI\b|A\.I\.|인공지능|생성형|LLM|GPT|챗GPT|ChatGPT|Claude|클로드|Gemini|제미나이|라마|Llama|오픈AI|OpenAI|앤트로픽|Anthropic|딥마인드|DeepMind|에이전트|agent|머신러닝|machine learning|딥러닝|deep learning|neural|신경망|transformer|파운데이션 모델|foundation model|Copilot|코파일럿|NPU|HBM|AGI)/i;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", middot: "·", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", ndash: "–", mdash: "—" };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** CDATA를 벗기고 태그를 지운 맨 글자 */
export function plainText(s: string): string {
  const raw = s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  // 피드에 따라 HTML이 한 번 더 이스케이프돼 있어서, 풀고 나서 태그를 지워요
  const html = /&lt;\/?[a-z]/i.test(raw) ? decodeEntities(raw) : raw;
  return decodeEntities(html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function tag(block: string, names: string[]): string | undefined {
  for (const n of names) {
    const m = block.match(new RegExp(`<${n}(?:\\s[^>]*)?>([\\s\\S]*?)</${n}>`, "i"));
    if (m) return m[1];
  }
  return undefined;
}

function atomLink(block: string): string | undefined {
  const links = [...block.matchAll(/<link\b([^>]*?)\/?>/gi)].map((m) => m[1]);
  const pick = links.find((a) => /rel=["']alternate["']/i.test(a)) ?? links.find((a) => !/rel=/i.test(a)) ?? links[0];
  return pick?.match(/href=["']([^"']+)["']/i)?.[1];
}

export function excerptOf(text: string, max = 140): string {
  return text.length > max ? text.slice(0, max).trimEnd() : text;
}

export function categorize(feed: Feed, text: string): NewsItem["category"] {
  if (feed.category !== "mixed") return feed.category;
  return AI_WORDS.test(text) ? "AI" : feed.fallback ?? "업계";
}

/** 피드 XML 하나를 소식 목록으로 */
export function parseFeed(xml: string, feed: Feed): NewsItem[] {
  const blocks = [...xml.matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)].map((m) => m[0]);
  const out: NewsItem[] = [];
  for (const b of blocks) {
    const title = plainText(tag(b, ["title"]) ?? "");
    const rssLink = tag(b, ["link"]);
    const link = decodeEntities((rssLink && plainText(rssLink)) || atomLink(b) || plainText(tag(b, ["guid", "id"]) ?? "")).trim();
    if (!title || !/^https?:\/\//.test(link)) continue;
    const date = plainText(tag(b, ["pubDate", "published", "updated", "dc:date"]) ?? "");
    const parsed = Date.parse(date);
    const body = plainText(tag(b, ["description", "summary", "content:encoded", "content"]) ?? "");
    out.push({
      title,
      link,
      source: feed.source,
      region: feed.region,
      category: categorize(feed, `${title} ${body}`),
      publishedAt: Number.isFinite(parsed) ? parsed : Date.now(),
      excerpt: excerptOf(body === title ? "" : body),
    });
  }
  return out;
}

/** 같은 링크는 한 번만, 최신순 */
export function mergeNews(...lists: NewsItem[][]): NewsItem[] {
  const seen = new Map<string, NewsItem>();
  for (const list of lists) for (const n of list) if (!seen.has(n.link)) seen.set(n.link, n);
  return [...seen.values()].sort((a, b) => b.publishedAt - a.publishedAt);
}

/** 모든 피드를 받아요. 실패한 피드는 이름만 알려 주고 나머지는 그대로 써요. */
export async function collectNews(feeds: Feed[], opts: { perFeed?: number; maxAgeHours?: number; timeoutMs?: number } = {}) {
  const { perFeed = 12, maxAgeHours = 48, timeoutMs = 9000 } = opts;
  const since = Date.now() - maxAgeHours * 3600_000;
  const failed: string[] = [];
  const lists = await Promise.all(
    feeds.map(async (f) => {
      try {
        const res = await fetch(f.url, {
          headers: { "user-agent": "OtterLab/0.2 (+news reader)", accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*" },
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!res.ok) throw new Error(String(res.status));
        return parseFeed(await res.text(), f)
          .filter((n) => n.publishedAt >= since)
          .slice(0, perFeed);
      } catch {
        failed.push(f.source);
        return [];
      }
    }),
  );
  return { items: mergeNews(...lists), failed, fetchedAt: Date.now() };
}
