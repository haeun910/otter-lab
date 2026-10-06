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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 429(분당 사용량 초과)면 Groq가 알려 준 만큼 기다렸다가 다시 (최대 3번, 한 번에 60초까지) */
export function retryAfterMs(res: Response, body: string): number {
  const header = Number(res.headers.get("retry-after"));
  const inText = body.match(/try again in\s+(?:(\d+)m)?([\d.]+)s/i);
  const sec = Number.isFinite(header) && header > 0 ? header : inText ? Number(inText[1] ?? 0) * 60 + Number(inText[2]) : 5;
  return Math.min(60, Math.max(0.2, sec)) * 1000 + 250;
}

async function call(model: string, messages: { role: string; content: string }[]) {
  // Vercel 서버는 한 번에 60초까지만 일해서, 거기서는 기다리는 시간을 짧게 잡아요
  let budget = process.env.VERCEL ? 20_000 : 180_000;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      body: JSON.stringify({ model, messages, temperature: 0.6, response_format: { type: "json_object" } }),
      signal: AbortSignal.timeout(60_000),
    });
    if (res.status !== 429 || attempt >= 3) return res;
    const wait = retryAfterMs(res, await res.clone().text());
    if (wait > budget) return res;
    budget -= wait;
    await sleep(wait);
  }
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

/** 카드(모모) 다음에 블로그(테오)를 써요. 무료 등급은 분당 사용량이 작아서 한꺼번에 보내지 않아요 */
export async function writeWithGroq(r: DraftRequest): Promise<{ deck: Deck; blog: Blog }> {
  const deckRaw = await chat(cardsMessages(r));
  const blogRaw = await chat(blogMessages(r));
  return {
    deck: normalizeDeck(deckRaw, templateDeck(r.type, r.items, r.brand)),
    blog: normalizeBlog(blogRaw, templateBlog(r.type, r.items)),
  };
}
