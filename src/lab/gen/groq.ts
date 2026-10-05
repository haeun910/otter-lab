// 서버에서만 써요. GROQ_API_KEY는 브라우저로 내려가지 않아요.
import type { Blog, Deck } from "../data/demo";
import { normalizeBlog, normalizeDeck, parseJsonLoose } from "./normalize";
import { blogMessages, cardsMessages, type DraftRequest } from "./prompt";
import { templateBlog, templateDeck } from "./template";

export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";

/** 모델 이름 앞의 회사 이름을 빠뜨려도 알아들어요 (gpt-oss-120b → openai/gpt-oss-120b) */
export function fixModelName(name: string): string {
  const n = name.trim();
  if (/^gpt-oss-/i.test(n)) return `openai/${n}`;
  if (/^qwen[\d.]/i.test(n)) return `qwen/${n}`;
  return n;
}

export const groqModel = () => fixModelName(process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL);
export const groqReady = () => Boolean(process.env.GROQ_API_KEY);

/** 이번 실행에서 생긴 알림거리 (예: 모델 이름이 틀려서 기본 모델로 바꿔 씀). 자동 회의가 알림에 붙여요 */
export const groqNotes = new Set<string>();

async function call(model: string, messages: { role: string; content: string }[]) {
  return fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify({ model, messages, temperature: 0.6, response_format: { type: "json_object" } }),
    signal: AbortSignal.timeout(60_000),
  });
}

async function chat(messages: { role: string; content: string }[]): Promise<unknown> {
  const model = groqModel();
  let res = await call(model, messages);
  // 정한 모델이 없으면(은퇴·오타) 기본 모델로 한 번 더
  if (res.status === 404 && model !== DEFAULT_GROQ_MODEL) {
    const text = await res.text();
    if (/model/i.test(text)) {
      groqNotes.add(`GROQ_MODEL '${model}'을 Groq에서 찾지 못해서 기본 모델(${DEFAULT_GROQ_MODEL})로 썼어요. 모델 이름을 확인해 주세요.`);
      res = await call(DEFAULT_GROQ_MODEL, messages);
    } else {
      throw new Error(`Groq 404: ${text.slice(0, 200)}`);
    }
  }
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
