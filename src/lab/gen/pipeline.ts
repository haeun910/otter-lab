// 초안 쓰는 순서. AI를 부르는 방법(llm)만 바꿔 끼우면 자동 회의(서버에서 Groq 직접)와
// 연구소 화면(/api/ai를 한 번씩)이 같은 순서로 써요. 긴 블로그는 설계도 → 소제목별로 나눠 써서
// Groq 분당 한도와 Vercel 60초 제한에 덜 걸려요.
import type { Blog, Deck, GenerationPart } from "../data/demo";
import { finalizeDeck } from "./editorial";
import { normalizeBlog, normalizeDeck } from "./normalize";
import {
  blogMessages,
  blogOutlineMessages,
  blogSectionMessages,
  blogTarget,
  cardsMessages,
  rewriteDeckMessages,
  rewriteSectionMessages,
  writingOf,
  type DraftRequest,
  type Msg,
} from "./prompt";
import { templateBlog, templateDeck } from "./template";

/** AI 한 번 부르기: 답은 JSON으로 */
export type LLM = (messages: Msg[], opts?: { maxTokens?: number }) => Promise<unknown>;

const str = (v: unknown) => (typeof v === "string" ? v.trim().replace(/\\n/g, "\n") : "");

/** 긴 글로 나눠 쓰는 기준 (이보다 길면 소제목별로) */
export const SPLIT_FROM = 2000;

export async function writeDeck(llm: LLM, r: DraftRequest): Promise<Deck> {
  const raw = await llm(cardsMessages(r), { maxTokens: 4000 });
  const cards = (raw as { cards?: unknown[] } | null)?.cards;
  const expected = templateDeck(r.type, r.items, r.brand).cards.length;
  if (!Array.isArray(cards) || cards.length !== expected) throw new Error(`카드 장수가 요청과 달라요 (요청 ${expected}장). 다시 생성해 주세요.`);
  for (const [i, value] of cards.entries()) {
    const c = value as { kind?: string; title?: string; body?: string } | null;
    const kind = i === 0 ? "cover" : i === cards.length - 1 ? "outro" : "body";
    if (c?.kind !== kind || typeof c.title !== "string" || !c.title.trim() || typeof c.body !== "string" || !c.body.trim()) throw new Error(`${i + 1}번째 카드의 구성이나 내용이 비어 있어요. 다시 생성해 주세요.`);
  }
  const deck = raw as Deck;
  if (typeof deck.caption !== "string" || !deck.caption.trim() || !Array.isArray(deck.hashtags) || !deck.hashtags.some((t) => typeof t === "string" && t.trim())) throw new Error("AI가 캡션이나 해시태그를 빠뜨렸어요. 다시 생성해 주세요.");
  return finalizeDeck(normalizeDeck(raw, templateDeck(r.type, r.items, r.brand)), r.items);
}

export interface BlogResult {
  blog: Blog;
  notes: string[]; // 일부를 AI가 못 썼을 때
}

export async function writeBlog(llm: LLM, r: DraftRequest, onProgress?: (done: number, total: number) => void): Promise<BlogResult> {
  const fallback = templateBlog(r.type, r.items, Date.now(), r.brand);
  const target = blogTarget(r);
  if (target < SPLIT_FROM) {
    return { blog: normalizeBlog(await llm(blogMessages(r), { maxTokens: 4000 }), fallback), notes: [] };
  }
  // 1) 설계도
  const raw = (await llm(blogOutlineMessages(r), { maxTokens: 2000 })) as Record<string, unknown>;
  const outline = normalizeBlog(
    {
      ...raw,
      sections: (Array.isArray(raw?.sections) ? raw.sections : []).map((s: Record<string, unknown>) => ({ ...s, body: str(s?.points) || "(내용)" })),
    },
    fallback,
  );
  const plan = { title: outline.title, sections: outline.sections.map((s) => ({ heading: s.heading, points: s.body })) };
  // 2) 소제목마다 본문 (도입·맺음 몫을 빼고 나눠요)
  const per = Math.max(350, Math.round((target - outline.intro.length - outline.outro.length) / Math.max(1, plan.sections.length)));
  const notes: string[] = [];
  const sections: Blog["sections"] = [];
  for (const [i, s] of outline.sections.entries()) {
    onProgress?.(i, outline.sections.length);
    try {
      const out = (await llm(blogSectionMessages(r, plan, i, per), { maxTokens: Math.round(per * 1.6) + 300 })) as Record<string, unknown>;
      const body = str(out?.body);
      if (!body) throw new Error("빈 답");
      sections.push({ ...s, body });
    } catch (e) {
      notes.push(`'${s.heading}' 소제목은 AI가 쓰지 못해서 다룰 내용만 적어 뒀어요 (${e instanceof Error ? e.message.slice(0, 60) : "오류"})`);
      sections.push({ ...s, body: `(이 부분은 직접 채워 주세요) ${s.body}` });
    }
  }
  onProgress?.(outline.sections.length, outline.sections.length);
  return { blog: { ...outline, sections }, notes };
}

/** 카드(모모) 다음에 블로그(테오) */
export async function writeAll(llm: LLM, r: DraftRequest, onProgress?: (step: string) => void): Promise<{ deck: Deck; blog: Blog; notes: string[]; blogState: GenerationPart }> {
  onProgress?.("카드 문구 쓰는 중");
  const deck = await writeDeck(llm, r);
  try {
    const { blog, notes } = await writeBlog(llm, r, (d, t) => onProgress?.(t > 1 ? `블로그 쓰는 중 (${d}/${t})` : "블로그 쓰는 중"));
    return { deck, blog, notes, blogState: { status: notes.length ? "partial" : "complete", engine: "groq", ...(notes.length ? { error: notes.join("\n") } : {}) } };
  } catch (e) {
    const error = e instanceof Error ? e.message.slice(0, 120) : "오류";
    return { deck, blog: templateBlog(r.type, r.items, Date.now(), r.brand), notes: [`블로그 생성 실패 · 카드 결과는 보존했어요 (${error})`], blogState: { status: "failed", engine: "template", error } };
  }
}

export async function rewriteDeck(llm: LLM, r: DraftRequest, deck: Deck, instruction: string): Promise<Deck> {
  const out = normalizeDeck(await llm(rewriteDeckMessages(r, deck, instruction), { maxTokens: 4000 }), deck);
  // 장수가 달라졌으면 원래 모양을 지켜요
  return finalizeDeck(out.cards.length === deck.cards.length ? out : { ...out, cards: deck.cards }, r.items);
}

export async function rewriteSection(llm: LLM, r: DraftRequest, blog: Blog, i: number, instruction: string): Promise<Blog["sections"][number]> {
  const old = blog.sections[i];
  const out = (await llm(rewriteSectionMessages(r, blog, i, instruction), { maxTokens: 3000 })) as Record<string, unknown>;
  const body = str(out?.body);
  if (!body) throw new Error("AI가 빈 답을 줬어요");
  const photo = writingOf(r.brand).photos ? str(out?.photo) || old.photo : undefined;
  return { heading: str(out?.heading) || old.heading, body, ...(photo ? { photo } : {}) };
}

/** 블로그 글자 수 (공백 포함, 네이버 기준과 같게 제목은 빼고) */
export const blogLength = (b: Blog) => [b.intro, ...b.sections.flatMap((s) => [s.heading, s.body]), b.outro].join("\n").length;
