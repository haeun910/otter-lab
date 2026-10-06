import { chooseCardTemplate } from "../data/cardTemplates";
import type { Deck, NewsItem } from "../data/demo";

export const SIGN_OFF = "다음 소식에서도 만나요. 🦦";
export const SOURCE_HEADING = "원문을 보고 싶다면? 👇";
export const CARD_HANDLE = "@otterlab.ai";

const cleanTag = (value: unknown) => typeof value === "string" ? `#${value.replace(/#/g, "").replace(/[^\p{L}\p{N}_]/gu, "")}` : "#";
const categoryTags: Record<string, string[]> = {
  AI: ["#인공지능", "#AI뉴스", "#AI기술"], Tech: ["#테크뉴스", "#IT뉴스", "#기술동향"],
  Dev: ["#개발자", "#소프트웨어", "#개발뉴스"], Paper: ["#AI논문", "#연구동향", "#인공지능"],
  Tools: ["#업무도구", "#생산성", "#AI서비스"],
};

/** Keep model-selected topic tags first and fill missing slots from source topics. */
export function selectHashtags(values: unknown[], items: NewsItem[]): string[] {
  const candidates = [...values, ...items.flatMap((n) => categoryTags[n.category] ?? []), "#기술뉴스", "#IT트렌드", "#디지털기술", "#오터랩", "#뉴스읽기"];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of candidates) {
    const tag = cleanTag(value);
    if (tag.length < 2 || seen.has(tag.toLowerCase())) continue;
    seen.add(tag.toLowerCase()); out.push(tag);
    if (out.length === 5) break;
  }
  return out;
}

/** Source labels and links come from selected news, never model-invented URLs. */
export function captionWithSources(summary: string, items: NewsItem[]): string {
  const cleaned = summary.split(/원문을 보고 싶다면\?|출처\s*:/)[0]
    .replace(/다음 소식에서도 만나요\.?\s*🦦?/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/(^|\s)#[\p{L}\p{N}_]+/gu, "$1").trim();
  const seen = new Set<string>();
  const sources = items.filter((n) => {
    try { const url = new URL(n.link); if (!["http:", "https:"].includes(url.protocol) || seen.has(url.href)) return false; seen.add(url.href); return true; } catch { return false; }
  }).map((n) => `· ${n.source.replace(/\s+/g, " ")} — ${n.title.replace(/\s+/g, " ")}\n  ${n.link}`);
  return [cleaned, SIGN_OFF, ...(sources.length ? [SOURCE_HEADING, sources.join("\n")] : [])].filter(Boolean).join("\n\n");
}

export function finalizeDeck(deck: Deck, items: NewsItem[]): Deck {
  return { ...deck, cards: deck.cards.map((card, i) => ({ ...card, template: chooseCardTemplate(card, i + 1) })), caption: captionWithSources(deck.caption, items), hashtags: selectHashtags(deck.hashtags, items) };
}
