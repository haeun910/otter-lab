import type { Card, Draft } from "../data/demo";
import type { BrandVoice } from "../gen/prompt";
import { authHeaders, AIError } from "../gen/client";
import { CARD_PRODUCTION, imageFingerprint, productionOf, validateVisualCopy, type CardProduction } from "../gen/production";
import type { GeneratedCardImage, ImageResult } from "./imageTypes";
import { readImage, saveImage } from "./imageCache";

export interface ImageCache { read:(id:string)=>Promise<Blob|undefined>; save:(id:string,blob:Blob)=>Promise<void> }
export type ImageGenerator=(card:Card,page:number,total:number,production:CardProduction)=>Promise<ImageResult>;
export const remoteImage:ImageGenerator=async(card,page,total,production)=>{
  let response:Response;
  try {response=await fetch("/api/card-image",{method:"POST",headers:{"content-type":"application/json",...await authHeaders()},body:JSON.stringify({card:{...card,image:undefined},page,total,production}),signal:AbortSignal.timeout(180_000)});}
  catch {throw new AIError("이미지 서버 연결이 끊겼거나 시간이 초과됐어요. 완성한 장은 보존됩니다.",0);}
  const result=await response.json().catch(()=>({})) as Partial<ImageResult>&{error?:string};
  if (!response.ok) throw new AIError(result.error??"카드 이미지를 생성하지 못했어요.",response.status);
  if (typeof result.png!=="string" || !result.png || !Number.isInteger(result.width) || result.width!==result.height || result.width!<1024) throw new Error("정사각형 이미지 결과를 읽지 못했어요.");
  return result as ImageResult;
};
function blobFromPNG(png:string):Blob {
  const bytes=Uint8Array.from(atob(png),c=>c.charCodeAt(0));
  if (bytes.length<24 || bytes[0]!==137 || bytes[1]!==80 || bytes[2]!==78 || bytes[3]!==71) throw new Error("PNG 이미지 데이터를 읽지 못했어요.");
  return new Blob([bytes],{type:"image/png"});
}
export function imageIsCurrent(card:Card,page:number,total:number,production:CardProduction):boolean {
  return Boolean(card.image && card.image.fingerprint===imageFingerprint(card,page,total,production));
}

/** Sequential requests save each page immediately. A retry skips every still-valid cached image. */
export async function generateCardImages(draft:Draft,brand:BrandVoice,options:{
  only?:number; force?:boolean;
  onProgress?:(page:number,total:number)=>void;
  onImage?:(index:number,image:GeneratedCardImage)=>void;
  generate?:ImageGenerator;cache?:ImageCache;
}={}):Promise<void> {
  const production=productionOf(brand),total=draft.deck.cards.length;
  if (production.mode!=="generated") throw new Error("카드 전체 이미지 생성 모드를 선택해 주세요.");
  const cache=options.cache??{read:readImage,save:saveImage};
  const generate=options.generate??remoteImage;
  if (total<3 || total>10) throw new Error("카드는 3~10장으로 준비해 주세요. 기본 제작은 7장이에요.");
  if (options.only!==undefined && (!Number.isInteger(options.only)||options.only<0||options.only>=total)) throw new Error("생성할 카드 페이지를 확인해 주세요.");
  // Validate all requested pages before incurring any generation costs.
  for (const [i,c] of draft.deck.cards.entries()) {
    if (options.only!==undefined && options.only!==i) continue;
    if (c.kind!==(i===0?"cover":i===total-1?"outro":"body")) throw new Error(`${i+1}장 구성을 확인해 주세요. 표지 → 설명 → 정리 순서로 준비합니다.`);
    validateVisualCopy(c,i+1);
    if (c.kind==="body" && (c.body.length<CARD_PRODUCTION.bodyCharacters.min || c.body.length>CARD_PRODUCTION.bodyCharacters.max)) throw new Error(`${i+1}장 설명을 90~260자로 준비해 주세요.`);
  }
  for (const [i,c] of draft.deck.cards.entries()) {
    if (options.only!==undefined && options.only!==i) continue;
    if (!options.force && imageIsCurrent(c,i+1,total,production) && await cache.read(c.image!.id)) continue;
    options.onProgress?.(i+1,total);
    const result=await generate(c,i+1,total,production);
    const image:GeneratedCardImage={id:crypto.randomUUID(),fingerprint:imageFingerprint(c,i+1,total,production),width:result.width,height:result.height,createdAt:Date.now()};
    await cache.save(image.id,blobFromPNG(result.png));
    options.onImage?.(i,image);
  }
}

/** Export never calls a paid service or silently substitutes the old background-text layout. */
export async function generatedImageFiles(draft:Draft,brand:BrandVoice,base:string,only?:number,cache:ImageCache={read:readImage,save:saveImage}):Promise<File[]> {
  const files:File[]=[],production=productionOf(brand),total=draft.deck.cards.length;
  for (const [i,c] of draft.deck.cards.entries()) {
    if (only!==undefined && only!==i) continue;
    if (!imageIsCurrent(c,i+1,total,production)) throw new Error(`${i+1}장 이미지를 먼저 생성해 주세요. 문구나 페이지 순서가 바뀌면 다시 생성해야 해요.`);
    const blob=await cache.read(c.image!.id);
    if (!blob) throw new Error(`${i+1}장 원본이 이 브라우저에 없어요. 이미지를 만든 기기에서 저장하거나 이 장을 다시 생성해 주세요.`);
    files.push(new File([blob],`${base}-${String(i+1).padStart(2,"0")}.png`,{type:"image/png"}));
  }
  return files;
}
