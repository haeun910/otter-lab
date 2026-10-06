"use client";
import { useEffect, useRef } from "react";
import type { Card } from "../data/demo";
import { designOf, type CardDesign } from "../gen/prompt";
import { CARD_W, cardHeight, drawCard, prepare } from "../render/cardImage";
import { useLab } from "../store";

/**
 * 카드뉴스 한 장 미리보기. 저장하는 PNG와 같은 그리기 함수로 그려서 생김새가 똑같아요.
 * 화면에는 절반 크기(540px 폭)로 그리고 CSS로 맞춰요.
 */
export default function CardPreview({ card, page, total, deep, design: override }: { card: Card; page: number; total: number; deep?: boolean; design?: CardDesign; handle?: string; series?: string }) {
  const brand = useLab((s) => s.brand);
  const design = override ?? designOf(brand);
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
      drawCard(ctx, card, look);
    };
    draw(); // 글꼴이 오기 전에도 바로 한 번
    prepare(`${card.title}${card.body}${card.tag ?? ""}${brand.handle}${brand.series}`, design).then(draw);
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return <canvas ref={ref} className="cardnews-canvas" width={540} height={Math.round((540 * H) / CARD_W)} aria-label={`${page}번째 카드: ${card.title}`} role="img" />;
}
