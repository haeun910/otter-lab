// 서버 API 문지기: Supabase를 쓰는 배포에서는 연구소 주인으로 로그인한 요청만 통과시켜요.
import { isOwner } from "./rest";

export async function guard(req: Request): Promise<Response | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null; // 로그인 없이 쓰는 모드 (내 컴퓨터에서 npm run dev)
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return Response.json({ error: "로그인이 필요해요" }, { status: 401 });
  try {
    if (await isOwner({ url, key, token: async () => token })) return null;
    return Response.json({ error: "연구소 주인만 쓸 수 있어요" }, { status: 403 });
  } catch {
    return Response.json({ error: "로그인을 확인하지 못했어요" }, { status: 401 });
  }
}
