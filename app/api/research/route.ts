import { guard } from "@/src/lab/cloud/guard";
import { collectResearch } from "@/src/lab/research/reader";
import type { NewsItem } from "@/src/lab/data/demo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(req:Request) {
  const denied = await guard(req);if (denied) return denied;
  const raw = await req.text();
  if (raw.length>40_000) return Response.json({error:"조사 요청이 너무 커요."},{status:400});
  let body:{items?:NewsItem[];links?:string[]};
  try {body=JSON.parse(raw);} catch {return Response.json({error:"조사 요청을 읽지 못했어요."},{status:400});}
  if (!body || !Array.isArray(body.items) || body.items.length>6 || body.items.some((n)=>typeof n?.link!=="string"||typeof n.title!=="string"||typeof n.source!=="string") || (body.links!==undefined && (!Array.isArray(body.links)||body.links.length>4||body.links.some((url)=>typeof url!=="string"))) || !body.items.length) return Response.json({error:"출발 뉴스와 참고 링크를 확인해 주세요."},{status:400});
  const result = await collectResearch(body.items,body.links);
  return Response.json(result);
}
