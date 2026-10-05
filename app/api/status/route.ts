import { groqModel, groqReady } from "@/src/lab/gen/groq";

export const dynamic = "force-dynamic";

// 소장 책상의 운영 설정이 서버 연결 상태를 확인할 때 써요
export async function GET() {
  return Response.json({ groq: groqReady(), model: groqReady() ? groqModel() : null });
}
