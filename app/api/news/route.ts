import { guard } from "@/src/lab/cloud/guard";
import { groqLLM, groqReady } from "@/src/lab/gen/groq";
import { refineCategories } from "@/src/lab/news/classifyLLM";
import { FEEDS } from "@/src/lab/news/feeds";
import { collectNews } from "@/src/lab/news/rss";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// 수신소: 피드를 모두 받아 최근 48시간 소식을 돌려줘요.
// 분야가 애매한 소식은 Groq 키가 있으면 한 번 더 물어봐요 (실패하면 규칙으로 가린 분야 그대로).
export async function GET(req: Request) {
  const denied = await guard(req);
  if (denied) return denied;
  const news = await collectNews(FEEDS);
  if (groqReady() && news.unsure.length) {
    try {
      news.items = (await refineCategories(news.items, news.unsure, groqLLM)).items;
    } catch {
      // 규칙으로 가린 분야를 그대로 써요
    }
  }
  return Response.json(news);
}
