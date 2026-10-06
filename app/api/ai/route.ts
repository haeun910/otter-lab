import { guard } from "@/src/lab/cloud/guard";
import { groqLLM, groqReady } from "@/src/lab/gen/groq";
import type { Msg } from "@/src/lab/gen/prompt";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// 연구소 화면이 AI를 한 번씩 부르는 곳 (초안 쓰기·다시 쓰기). 순서는 화면 쪽 pipeline.ts가 정해요.
// 키가 없으면 501을 돌려주고, 화면이 뼈대 초안으로 대신 만들어요.
export async function POST(req: Request) {
  const denied = await guard(req);
  if (denied) return denied;
  if (!groqReady()) return Response.json({ error: "GROQ_API_KEY가 없어요" }, { status: 501 });
  const body = (await req.json().catch(() => null)) as { messages?: Msg[]; maxTokens?: number } | null;
  const messages = (body?.messages ?? []).filter((m) => ["system", "user", "assistant"].includes(m?.role) && typeof m.content === "string");
  const size = messages.reduce((a, m) => a + m.content.length, 0);
  if (!messages.length || size > 40_000) return Response.json({ error: "보낼 내용이 없거나 너무 길어요" }, { status: 400 });
  try {
    const data = await groqLLM(messages, { maxTokens: Math.min(6000, Math.max(200, Number(body?.maxTokens) || 3000)) });
    return Response.json({ data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Groq 호출에 실패했어요";
    return Response.json({ error: msg }, { status: /429/.test(msg) ? 429 : 502 });
  }
}
