import { guard } from "@/src/lab/cloud/guard";
import { createCardImage, validateImageRequest, ImageAPIError, imageReady } from "@/src/lab/gen/imageServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

export async function POST(req:Request) {
  const denied=await guard(req);if (denied) return denied;
  if (!imageReady()) return Response.json({error:"이미지 생성용 OPENAI_API_KEY를 서버 환경변수에 등록해 주세요."},{status:501});
  const text=await req.text();
  if (text.length>16_000) return Response.json({error:"카드 요청이 너무 길어요."},{status:400});
  let request;
  try {request=validateImageRequest(JSON.parse(text));}
  catch(e) {return Response.json({error:e instanceof Error?e.message:"카드 요청을 확인해 주세요."},{status:400});}
  try {return Response.json(await createCardImage(request,fetch,req.signal),{headers:{"cache-control":"no-store"}});}
  catch(e) {return Response.json({error:e instanceof Error?e.message:"이미지 생성에 실패했어요."},{status:e instanceof ImageAPIError?e.status:502});}
}
