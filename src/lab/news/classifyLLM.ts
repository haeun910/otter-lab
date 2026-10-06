// 규칙만으로 애매한 소식은 AI에게 분야를 한 번 더 물어봐요 (제목만 보내서 짧고 싸게).
import type { NewsItem } from "../data/demo";
import type { LLM } from "../gen/pipeline";
import { CATEGORIES, CATEGORY_INFO, type Category } from "./category";

export async function refineCategories(items: NewsItem[], unsure: string[], llm: LLM, max = 60): Promise<{ items: NewsItem[]; changed: number }> {
  const want = new Set(unsure);
  const targets = items.filter((n) => want.has(n.link)).slice(0, max);
  if (!targets.length) return { items, changed: 0 };
  const defs = CATEGORIES.map((c) => `- ${c}: ${CATEGORY_INFO[c].desc}`).join("\n");
  const lines = targets.map((n, i) => `${i + 1}. ${n.title} (${n.source})`).join("\n");
  const res = (await llm(
    [
      { role: "system", content: `너는 IT 뉴스 편집자야. 소식마다 분야를 하나씩 골라.\n${defs}\n반드시 JSON 하나만 답해.` },
      {
        role: "user",
        content: `아래 ${targets.length}개 소식의 분야를 차례대로 골라 줘.\n형식: {"c":["AI","Dev",...]} (모두 ${targets.length}개)\n\n${lines}`,
      },
    ],
    { maxTokens: 900 },
  )) as { c?: unknown };
  const picks = Array.isArray(res?.c) ? res.c : [];
  const next = new Map<string, Category>();
  targets.forEach((n, i) => {
    const c = picks[i];
    if (typeof c === "string" && (CATEGORIES as readonly string[]).includes(c)) next.set(n.link, c as Category);
  });
  let changed = 0;
  const out = items.map((n) => {
    const c = next.get(n.link);
    if (!c || c === n.category) return n;
    changed++;
    return { ...n, category: c };
  });
  return { items: out, changed };
}
