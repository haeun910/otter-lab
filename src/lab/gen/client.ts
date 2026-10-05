// 화면에서 서버 API를 부르는 곳. 서버가 없거나(미리보기 파일) 키가 없으면 브라우저 안에서 대신 처리해요.
import type { Blog, Deck, DraftType, NewsItem } from "../data/demo";
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
}

export async function writeDraft(r: DraftRequest): Promise<Written> {
  let why: Written["why"] = "offline";
  try {
    const res = await fetch("/api/draft", { method: "POST", headers: { "content-type": "application/json", ...(await authHeaders()) }, body: JSON.stringify(r) });
    if (res.ok) {
      const out = (await res.json()) as { deck: Deck; blog: Blog };
      return { deck: out.deck, blog: out.blog, engine: "groq" };
    }
    why = res.status === 501 ? "nokey" : res.status === 404 ? "offline" : "error";
  } catch {
    why = "offline";
  }
  return { deck: templateDeck(r.type, r.items, r.brand), blog: templateBlog(r.type, r.items), engine: "template", why };
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
