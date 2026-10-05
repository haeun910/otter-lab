import type { NewsItem } from "@/src/lab/data/demo";
import { groqReady, writeWithGroq } from "@/src/lab/gen/groq";
import type { DraftRequest } from "@/src/lab/gen/prompt";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// 카드뉴스 공방·블로그 서재: Groq로 초안을 써요. 키가 없으면 501을 돌려주고, 화면이 뼈대 초안으로 대신 만들어요.
export async function POST(req: Request) {
  if (!groqReady()) return Response.json({ error: "GROQ_API_KEY가 없어요" }, { status: 501 });
  const body = (await req.json().catch(() => null)) as Partial<DraftRequest> | null;
  const items = (body?.items ?? []).filter((n): n is NewsItem => Boolean(n?.title && n?.link)).slice(0, 8);
  if (!body?.brand || !items.length || (body.type !== "묶음" && body.type !== "심층")) {
    return Response.json({ error: "소식과 초안 종류가 필요해요" }, { status: 400 });
  }
  try {
    const out = await writeWithGroq({ type: body.type, items, brand: body.brand, prompts: body.prompts ?? {} });
    return Response.json({ ...out, engine: "groq" });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Groq 호출에 실패했어요" }, { status: 502 });
  }
}
