// 화면에서 서버 API를 부르는 곳. 서버가 없거나(미리보기 파일) 키가 없으면 브라우저 안에서 대신 처리해요.
import type { Blog, Deck, DraftType, NewsItem } from "../data/demo";
import { writeAll, type LLM } from "./pipeline";
import type { DraftRequest } from "./prompt";
import { templateBlog, templateDeck } from "./template";

// 로그인한 배포에서는 서버 API에 로그인 토큰을 같이 보내요 (cloud/sync.ts가 채워 줘요)
let tokenProvider: (() => Promise<string | null>) | null = null;
export const setTokenProvider = (fn: typeof tokenProvider) => (tokenProvider = fn);
async function authHeaders(): Promise<Record<string, string>> {
  const t = tokenProvider ? await tokenProvider() : null;
  return t ? { authorization: `Bearer ${t}` } : {};
}

export interface Written {
  deck: Deck;
  blog: Blog;
  engine: "groq" | "template";
  /** 뼈대 초안으로 대신한 까닭 */
  why?: "nokey" | "offline" | "error";
  notes?: string[];
}

/** 서버의 /api/ai를 한 번 부르기 (pipeline에 끼워요) */
export class AIError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
export const remoteLLM: LLM = async (messages, opts) => {
  let res: Response;
  try {
    res = await fetch("/api/ai", { method: "POST", headers: { "content-type": "application/json", ...(await authHeaders()) }, body: JSON.stringify({ messages, maxTokens: opts?.maxTokens }) });
  } catch {
    throw new AIError("서버에 연결하지 못했어요", 0);
  }
  const out = (await res.json().catch(() => ({}))) as { data?: unknown; error?: string };
  if (!res.ok) throw new AIError(out.error ?? `서버 오류 ${res.status}`, res.status);
  return out.data;
};

const whyOf = (e: unknown): Written["why"] => (e instanceof AIError ? (e.status === 501 ? "nokey" : e.status === 0 || e.status === 404 ? "offline" : "error") : "error");

export async function writeDraft(r: DraftRequest, onProgress?: (step: string) => void): Promise<Written> {
  try {
    const out = await writeAll(remoteLLM, r, onProgress);
    return { ...out, engine: "groq" };
  } catch (e) {
    return { deck: templateDeck(r.type, r.items, r.brand), blog: templateBlog(r.type, r.items, Date.now(), r.brand), engine: "template", why: whyOf(e) };
  }
}

/** 다시 쓰기: 실패하면 이유를 한국어로 */
export function aiFailText(e: unknown): string {
  const why = whyOf(e);
  if (why === "nokey") return "Groq 키가 없어서 다시 쓰지 못했어요.";
  if (why === "offline") return "서버에 연결되지 않아 다시 쓰지 못했어요.";
  return `다시 쓰지 못했어요: ${e instanceof Error ? e.message.slice(0, 120) : "오류"}`;
}

export async function fetchNews(): Promise<{ items: NewsItem[]; failed: string[]; fetchedAt: number } | null> {
  try {
    const res = await fetch("/api/news", { cache: "no-store", headers: await authHeaders() });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchStatus(): Promise<{ groq: boolean; model: string | null } | null> {
  try {
    const res = await fetch("/api/status", { cache: "no-store" });
    if (!res.ok || !res.headers.get("content-type")?.includes("json")) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export const draftTypeFor = (n: number): DraftType | null => (n === 1 ? "심층" : n >= 2 ? "묶음" : null);
