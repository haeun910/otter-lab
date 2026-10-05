// AI가 돌려준 JSON을 카드·블로그 모양으로 다듬어요. 빠진 곳은 뼈대 초안으로 채워요.
import type { Blog, Card, Deck } from "../data/demo";

const str = (v: unknown, fallback = "") => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : fallback);
const list = (v: unknown) => (Array.isArray(v) ? v : []);

/** ```json 울타리나 앞뒤 말이 붙어 와도 JSON만 꺼내요 */
export function parseJsonLoose(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try {
    return JSON.parse(t);
  } catch {
    const a = t.indexOf("{");
    const b = t.lastIndexOf("}");
    if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1));
    throw new Error("JSON이 아니에요");
  }
}

export function normalizeDeck(raw: unknown, fallback: Deck): Deck {
  const o = (raw ?? {}) as Record<string, unknown>;
  const cards: Card[] = list(o.cards)
    .map((c) => (c ?? {}) as Record<string, unknown>)
    .map((c, i, all): Card => {
      const kind = c.kind === "cover" || c.kind === "body" || c.kind === "outro" ? c.kind : i === 0 ? "cover" : i === all.length - 1 ? "outro" : "body";
      const tag = str(c.tag);
      return { kind, title: str(c.title), body: str(c.body).replace(/\\n/g, "\n"), ...(kind === "body" && tag ? { tag } : {}) };
    })
    .filter((c) => c.title || c.body);
  const ok = cards.length >= 3 && cards[0].kind === "cover";
  const tags = list(o.hashtags)
    .map((t) => str(t).replace(/^#*/, "#").replace(/\s+/g, ""))
    .filter((t) => t.length > 1);
  return {
    cards: ok ? cards : fallback.cards,
    caption: str(o.caption) || fallback.caption,
    hashtags: tags.length ? [...new Set(tags)].slice(0, 15) : fallback.hashtags,
  };
}

export function normalizeBlog(raw: unknown, fallback: Blog): Blog {
  const o = (raw ?? {}) as Record<string, unknown>;
  const sections = list(o.sections)
    .map((s) => (s ?? {}) as Record<string, unknown>)
    .map((s) => ({ heading: str(s.heading), body: str(s.body).replace(/\\n/g, "\n") }))
    .filter((s) => s.heading && s.body);
  const tags = list(o.tags)
    .map((t) => str(t).replace(/^#+/, "").trim())
    .filter(Boolean);
  return {
    title: str(o.title) || fallback.title,
    intro: str(o.intro) || fallback.intro,
    sections: sections.length ? sections : fallback.sections,
    outro: str(o.outro) || fallback.outro,
    tags: tags.length ? [...new Set(tags)].slice(0, 15) : fallback.tags,
  };
}
