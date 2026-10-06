// RSS 2.0·Atom 피드를 소식 목록으로 바꿔요. 서버(API)와 자동화 스크립트가 같이 써요.
import type { NewsItem } from "../data/demo";
import { classify, type Verdict } from "./category";
import type { Feed } from "./feeds";
import { githubSearchUrl, parseGithub, parseHfModels, parseHfPapers } from "./sources";

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  middot: "·",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  ndash: "–",
  mdash: "—",
};

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

/** 피드가 한 분야면 그대로, 섞인 피드면 링크·낱말 규칙으로 가려요 */
export function categorize(feed: Feed, title: string, body: string, link: string): Verdict {
  if (feed.category !== "mixed") return { category: feed.category, sure: true };
  return classify(title, body, link, feed.fallback ?? "Tech");
}

/** 피드 XML 하나를 소식 목록으로 */
export function parseFeed(xml: string, feed: Feed): NewsItem[] {
  return parseFeedDetailed(xml, feed).items;
}

/** 소식 목록과, 규칙만으로는 분야가 애매한 소식 링크 */
export function parseFeedDetailed(xml: string, feed: Feed): { items: NewsItem[]; unsure: string[] } {
  const blocks = [...xml.matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)].map((m) => m[0]);
  const out: NewsItem[] = [];
  const unsure: string[] = [];
  for (const b of blocks) {
    const title = plainText(tag(b, ["title"]) ?? "");
    const rssLink = tag(b, ["link"]);
    const link = decodeEntities((rssLink && plainText(rssLink)) || atomLink(b) || plainText(tag(b, ["guid", "id"]) ?? "")).trim();
    if (!title || !/^https?:\/\//.test(link)) continue;
    const date = plainText(tag(b, ["pubDate", "published", "updated", "dc:date"]) ?? "");
    const parsed = Date.parse(date);
    const body = plainText(tag(b, ["description", "summary", "content:encoded", "content"]) ?? "");
    const v = categorize(feed, title, body, link);
    if (!v.sure) unsure.push(link);
    out.push({
      title,
      link,
      source: feed.source,
      region: feed.region,
      category: v.category,
      publishedAt: Number.isFinite(parsed) ? parsed : Date.now(),
      excerpt: excerptOf(body === title ? "" : body),
    });
  }
  return { items: out, unsure };
}

/** 같은 링크는 한 번만, 최신순 */
export function mergeNews(...lists: NewsItem[][]): NewsItem[] {
  const seen = new Map<string, NewsItem>();
  for (const list of lists) for (const n of list) if (!seen.has(n.link)) seen.set(n.link, n);
  return [...seen.values()].sort((a, b) => b.publishedAt - a.publishedAt);
}

const ACCEPT_XML = "application/rss+xml, application/atom+xml, application/xml, text/xml, */*";

/** 피드 하나 받기 (종류에 따라 RSS·JSON) */
async function fetchFeed(f: Feed, perFeed: number, timeoutMs: number): Promise<{ items: NewsItem[]; unsure: string[] }> {
  const kind = f.kind ?? "rss";
  const headers: Record<string, string> = { "user-agent": "OtterLab/0.3 (+news reader)", accept: kind === "rss" ? ACCEPT_XML : "application/json" };
  let url = f.url;
  if (kind === "github") {
    url = githubSearchUrl(f.url, perFeed);
    headers.accept = "application/vnd.github+json";
    // GitHub Actions에서는 토큰이 있어서 검색 한도가 넉넉해요
    const token = typeof process !== "undefined" ? process.env.GITHUB_TOKEN : undefined;
    if (token) headers.authorization = `Bearer ${token}`;
  }
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(String(res.status));
  if (kind === "rss") return parseFeedDetailed(await res.text(), f);
  const json: unknown = await res.json();
  const items = kind === "hf-papers" ? parseHfPapers(json, f) : kind === "hf-models" ? parseHfModels(json, f) : parseGithub(json, f);
  return { items, unsure: [] };
}

/** 모든 피드를 받아요. 실패한 피드는 이름만 알려 주고 나머지는 그대로 써요.
 *  unsure: 규칙만으로는 분야가 애매한 소식 (AI에게 한 번 더 물어볼 수 있어요) */
export async function collectNews(feeds: Feed[], opts: { perFeed?: number; maxAgeHours?: number; timeoutMs?: number } = {}) {
  const { perFeed = 12, maxAgeHours = 48, timeoutMs = 9000 } = opts;
  const since = Date.now() - maxAgeHours * 3600_000;
  const failed: string[] = [];
  const unsure: string[] = [];
  const counts: Record<string, number> = {};
  const lists = await Promise.all(
    feeds.map(async (f) => {
      try {
        const got = await fetchFeed(f, f.perFeed ?? perFeed, timeoutMs);
        const items = got.items.filter((n) => n.publishedAt >= since).slice(0, f.perFeed ?? perFeed);
        const keep = new Set(items.map((n) => n.link));
        unsure.push(...got.unsure.filter((l) => keep.has(l)));
        counts[f.source] = items.length;
        return items;
      } catch {
        failed.push(f.source);
        return [];
      }
    }),
  );
  return { items: mergeNews(...lists), failed, unsure, counts, fetchedAt: Date.now() };
}
