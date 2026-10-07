"use client";
import { useEffect, useRef, useState } from "react";
import { chooseCardTemplate } from "../data/cardTemplates";
import type { Card } from "../data/demo";
import { designOf, type CardDesign } from "../gen/prompt";
import { CARD_W, cardHeight, drawCard, prepare } from "../render/cardImage";
import { useLab } from "../store";
import { productionOf } from "../gen/production";
import { imageIsCurrent } from "../render/generatedCards";
import { readImage } from "../render/imageCache";

type PreviewProps = { card: Card; page: number; total: number; deep?: boolean; design?: CardDesign; handle?: string; series?: string };

export default function CardPreview(props:PreviewProps) {
  const brand=useLab(s=>s.brand);
  return productionOf(brand).mode==="generated" && !props.design ? <GeneratedPreview {...props}/> : <TemplatePreview {...props}/>;
}

function GeneratedPreview({card,page,total}:PreviewProps) {
  const brand=useLab(s=>s.brand),production=productionOf(brand);
  const current=imageIsCurrent(card,page,total,production);
  const [image,setImage]=useState<{id:string;url:string}|null>(null),[error,setError]=useState("");
  const id=current?card.image!.id:"";
  useEffect(()=>{
    let alive=true,url="";setImage(null);setError("");
    if (id) readImage(id).then(blob=>{
      if (!alive) return;
      if (!blob) {setError("원본은 생성한 브라우저에 저장되어 있어요. 이 장을 다시 생성할 수 있어요.");return;}
      url=URL.createObjectURL(blob);setImage({id,url});
    }).catch(e=>{if(alive)setError(e instanceof Error?e.message:"이미지를 읽지 못했어요.");});
    return ()=>{alive=false;if(url)URL.revokeObjectURL(url);};
  },[id]);
  if (current && image?.id===id) return <img className="cardnews-canvas" src={image.url} alt={`${page}번째 카드: ${card.title}`}/>;
  return <div className="card-copy-preview" role="img" aria-label={`${page}번째 카드 문구 미리보기: ${card.title}`}>
    <small>{card.image?"수정한 문구 · 이미지 재생성 필요":"문구 미리보기 · 이미지 생성 전"}</small>
    <strong>{card.title}</strong><p>{card.body}</p>
    {card.diagram && <ul>{card.diagram.items.map((item,i)=><li key={i}><b>{item.label}</b>{item.detail && <span>{item.detail}</span>}</li>)}</ul>}
    {card.glossary && <p className="card-copy-preview__glossary"><b>{card.glossary.term}</b> · {card.glossary.meaning}</p>}
    {error && <p role="alert">{error}</p>}<footer>{String(page).padStart(2,"0")} · 🐾 · @otterlab.ai</footer>
  </div>;
}

/**
 * 카드뉴스 한 장 미리보기. 저장하는 PNG와 같은 그리기 함수로 그려서 생김새가 똑같아요.
 * 화면에는 절반 크기(540px 폭)로 그리고 CSS로 맞춰요.
 */
function TemplatePreview({ card, page, total, deep, design: override }: PreviewProps) {
  const brand = useLab((s) => s.brand);
  const design = override ?? designOf(brand);
  const [error, setError] = useState("");
  const ref = useRef<HTMLCanvasElement>(null);
  const H = cardHeight(design);
  const key = JSON.stringify([card, page, total, deep, design, brand.handle, brand.series]);

  useEffect(() => {
    let alive = true;
    const look = { page, total, deep, handle: brand.handle, series: brand.series, design };
    const draw = () => {
      const cv = ref.current;
      const ctx = cv?.getContext("2d");
      if (!cv || !ctx || !alive) return;
      ctx.setTransform(cv.width / CARD_W, 0, 0, cv.width / CARD_W, 0, 0);
      try { drawCard(ctx, card, look); setError(""); } catch (e) { setError(e instanceof Error ? e.message : "미리보기를 만들지 못했어요."); }
    };
    draw(); // 글꼴이 오기 전에도 바로 한 번
    prepare(`${card.title}${card.body}${card.tag ?? ""}${brand.handle}${brand.series}${(card.sections ?? []).map((s) => s.heading + s.body).join("")}`, design, chooseCardTemplate(card, page)).then(draw).catch((e) => { if (alive) setError(e.message); });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return <div>{error && <p role="alert">{error}</p>}<canvas ref={ref} className="cardnews-canvas" width={540} height={Math.round((540 * H) / CARD_W)} aria-label={`${page}번째 카드: ${card.title}`} role="img" /></div>;
}
