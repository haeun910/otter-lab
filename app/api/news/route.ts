import { guard } from "@/src/lab/cloud/guard";
import { FEEDS } from "@/src/lab/news/feeds";
import { collectNews } from "@/src/lab/news/rss";

export const dynamic = "force-dynamic";

// 수신소: 피드를 모두 받아 최근 48시간 소식을 돌려줘요
export async function GET(req: Request) {
  const denied = await guard(req);
  if (denied) return denied;
  return Response.json(await collectNews(FEEDS));
}
