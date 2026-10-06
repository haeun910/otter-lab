import { configProblem, connectionInfo, cloudConfigured } from "@/src/lab/cloud/config";
import { groqModel, groqReady } from "@/src/lab/gen/groq";

export const dynamic = "force-dynamic";

// 연결 상태 확인용 (비밀값은 보여 주지 않아요). 브라우저에서 /api/status 를 열어 볼 수 있어요
export async function GET() {
  const cloud = cloudConfigured();
  return Response.json({
    groq: groqReady(),
    model: groqReady() ? groqModel() : null,
    supabase: cloud ? { ...connectionInfo(), problem: configProblem() } : "이 배포에는 Supabase 주소·키가 없어요 (브라우저에만 저장하는 모드)",
  });
}
