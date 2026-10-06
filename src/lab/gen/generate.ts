import type { Blog, Deck, GenerationPart } from "../data/demo";
import { writeBlog, writeDeck, type LLM } from "./pipeline";
import type { DraftRequest } from "./prompt";
import { templateDeck } from "./template";

export type GenerationTarget = "cards" | "both" | "blog";
export interface Generated {
  deck: Deck;
  blog: Blog;
  cards: GenerationPart;
  blogState: GenerationPart;
}
export interface GenerateOptions {
  target?: GenerationTarget;
  previous?: Generated;
  onUpdate?: (value: Generated) => void;
}

/** Save each completed part before starting another; failures never erase it. */
export async function generate(llm: LLM, r: DraftRequest, options: GenerateOptions = {}): Promise<Generated> {
  if (!r.items.length) throw new Error("바탕 소식이 없어요. 소식을 다시 선택해 주세요.");
  const target = options.target ?? "both";
  let value: Generated = options.previous ?? {
    deck: templateDeck(r.type, r.items, r.brand),
    blog: { title: "", intro: "", sections: [], outro: "", tags: [] },
    cards: { status: target === "blog" ? "skipped" : "pending", engine: "template" },
    blogState: { status: target === "cards" ? "skipped" : "pending" },
  };
  const update = (patch: Partial<Generated>) => { value = { ...value, ...patch }; options.onUpdate?.(value); };
  if (target !== "blog") {
    update({ cards: { ...value.cards, status: "running", error: undefined } });
    try {
      const deck = await writeDeck(llm, r);
      update({ deck, cards: { status: "complete", engine: "groq" } });
    } catch (e) {
      update({ cards: { ...value.cards, status: "failed", error: e instanceof Error ? e.message.slice(0, 240) : "카드 생성 실패" } });
    }
  }
  if (target !== "cards") {
    update({ blogState: { ...value.blogState, status: "running", error: undefined } });
    try {
      const out = await writeBlog(llm, r);
      update({ blog: out.blog, blogState: { status: out.notes.length ? "partial" : "complete", engine: "groq", ...(out.notes.length ? { error: out.notes.join("\n").slice(0, 1000) } : {}) } });
    } catch (e) {
      update({ blogState: { ...value.blogState, status: "failed", error: e instanceof Error ? e.message.slice(0, 240) : "블로그 생성 실패" } });
    }
  }
  return value;
}
