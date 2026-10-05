// 서버에서만 써요. GROQ_API_KEY는 브라우저로 내려가지 않아요.
import type { Blog, Deck } from "../data/demo";
import { normalizeBlog, normalizeDeck, parseJsonLoose } from "./normalize";
import { blogMessages, cardsMessages, type DraftRequest } from "./prompt";
import { templateBlog, templateDeck } from "./template";

export const groqModel = () => process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
export const groqReady = () => Boolean(process.env.GROQ_API_KEY);

async function chat(messages: { role: string; content: string }[]): Promise<unknown> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify({ model: groqModel(), messages, temperature: 0.6, response_format: { type: "json_object" } }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return parseJsonLoose(data.choices?.[0]?.message?.content ?? "");
}

/** 카드(모모)와 블로그(테오)를 나란히 써요 */
export async function writeWithGroq(r: DraftRequest): Promise<{ deck: Deck; blog: Blog }> {
  const [deckRaw, blogRaw] = await Promise.all([chat(cardsMessages(r)), chat(blogMessages(r))]);
  return {
    deck: normalizeDeck(deckRaw, templateDeck(r.type, r.items, r.brand)),
    blog: normalizeBlog(blogRaw, templateBlog(r.type, r.items)),
  };
}
