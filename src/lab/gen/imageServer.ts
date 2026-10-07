import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Card } from "../data/demo";
import { CARD_PRODUCTION, cardImagePrompt, validateVisualCopy, type CardProduction } from "./production";
import type { ImageResult } from "../render/imageTypes";

export const imageReady = () => Boolean(process.env.OPENAI_API_KEY?.trim());
export const imageModel = () => process.env.OPENAI_IMAGE_MODEL?.trim() || CARD_PRODUCTION.imageModel;
export const imageQuality = () => ["low","medium","high"].includes(process.env.OPENAI_IMAGE_QUALITY ?? "") ? process.env.OPENAI_IMAGE_QUALITY! : CARD_PRODUCTION.imageQuality;

export interface CardImageRequest { card: Card; page: number; total: number; production: CardProduction }
export function validateImageRequest(raw: unknown): CardImageRequest {
  const r=raw as CardImageRequest | null;
  if (!r || !Number.isInteger(r.page) || !Number.isInteger(r.total) || r.total<3 || r.total>10 || r.page<1 || r.page>r.total || !r.card || !["cover","body","outro"].includes(r.card.kind) || typeof r.card.title!=="string" || !r.card.title.trim() || r.card.title.length>80 || typeof r.card.body!=="string" || !r.card.body.trim() || r.card.body.length>500 || !r.production || r.production.mode!=="generated" || typeof r.production.imagePrompt!=="string" || r.production.imagePrompt.length>4000) throw new Error("카드의 페이지·제목·설명·디자인 설정을 확인해 주세요.");
  const kind=r.page===1?"cover":r.page===r.total?"outro":"body";
  if (r.card.kind!==kind) throw new Error("카드 순서는 표지 → 설명 → 정리여야 해요.");
  if (r.card.tag!==undefined && (typeof r.card.tag!=="string" || r.card.tag.length>60)) throw new Error("카드 꼬리표가 너무 길어요.");
  if (r.card.sections!==undefined && (!Array.isArray(r.card.sections) || r.card.sections.length>2 || r.card.sections.some(s=>!s || typeof s.heading!=="string" || s.heading.length>40 || typeof s.body!=="string" || s.body.length>180))) throw new Error("추가 설명을 확인해 주세요.");
  validateVisualCopy(r.card,r.page);
  if (r.card.kind==="body" && (r.card.body.trim().length<CARD_PRODUCTION.bodyCharacters.min || r.card.body.length>CARD_PRODUCTION.bodyCharacters.max)) throw new Error("설명 본문은 90~260자로 준비해 주세요. 설명글과 도식을 함께 읽을 수 있어야 해요.");
  // Remove client image URLs/metadata; references are trusted local assets only.
  return {page:r.page,total:r.total,production:r.production,card:{kind:r.card.kind,title:r.card.title,body:r.card.body,tag:r.card.tag,sections:r.card.sections,diagram:r.card.diagram,glossary:r.card.glossary,template:r.card.template}};
}

export class ImageAPIError extends Error {
  constructor(message:string,readonly status:number) {super(message);}
}
/** PNG signature + IHDR prevent treating URLs, HTML or portrait images as finished cards. */
export function decodePNG(png: string): ImageResult {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(png) || png.length>32_000_000) throw new Error("생성된 PNG 데이터를 읽지 못했어요.");
  const bytes=Buffer.from(png,"base64");
  if (bytes.length<24 || !bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) || bytes.toString("ascii",12,16)!=="IHDR") throw new Error("생성 결과가 PNG 이미지가 아니에요.");
  const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
  if (width!==height || width<1024 || width>4096) throw new Error("생성된 카드가 정사각형 원본이 아니에요. 다시 생성해 주세요.");
  return {png,width,height};
}

/** One paid request per explicit page action; never retries invisibly or falls back to a poster. */
export async function createCardImage(request:CardImageRequest, fetcher:typeof fetch=fetch, signal?:AbortSignal):Promise<ImageResult> {
  if (!imageReady()) throw new ImageAPIError("이미지 생성 연결이 없어요. 서버 환경변수에 OPENAI_API_KEY를 등록해 주세요.",501);
  const model=imageModel();
  if (!/^gpt-image-[\w.-]+$/.test(model)) throw new ImageAPIError("OPENAI_IMAGE_MODEL에 GPT Image 모델을 설정해 주세요.",501);
  const form=new FormData();
  form.set("model",model);form.set("n","1");form.set("size",CARD_PRODUCTION.imageSize);form.set("quality",imageQuality());
  form.set("prompt",cardImagePrompt(request.card,request.page,request.total,request.production));
  for (const reference of CARD_PRODUCTION.references) {
    const bytes=await readFile(join(process.cwd(),"public",reference));
    form.append("image[]",new Blob([new Uint8Array(bytes)],{type:"image/png"}),reference.split("/").pop()!);
  }
  let response:Response;
  try { response=await fetcher("https://api.openai.com/v1/images/edits",{method:"POST",headers:{authorization:`Bearer ${process.env.OPENAI_API_KEY!.trim()}`},body:form,signal:signal?AbortSignal.any([signal,AbortSignal.timeout(165_000)]):AbortSignal.timeout(165_000)}); }
  catch {throw new ImageAPIError("이미지 생성 연결이 끊겼거나 시간이 초과됐어요. 완성한 장은 보존됩니다. 잠시 후 필요한 장만 다시 시도해 주세요.",504);}
  if (!response.ok) {
    const messages:Record<number,string>={401:"이미지 API 키를 확인해 주세요.",403:"이미지 모델의 이용 권한 또는 조직 인증을 확인해 주세요.",429:"이미지 생성 사용량 한도에 도달했어요. 잠시 후 다시 시도해 주세요."};
    throw new ImageAPIError(messages[response.status]??"이미지 생성 서비스에서 요청을 처리하지 못했어요.",response.status===429?429:502);
  }
  const data=await response.json() as {data?:{b64_json?:unknown}[]};
  if (typeof data.data?.[0]?.b64_json!=="string") throw new ImageAPIError("이미지 생성 결과를 읽지 못했어요. 다시 시도해 주세요.",502);
  return decodePNG(data.data[0].b64_json);
}
