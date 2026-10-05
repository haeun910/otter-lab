"use client";
import type { Card } from "../data/demo";
import { OtterFace } from "./Hud";

/** 카드뉴스 한 장 미리보기 (1080×1350 비율). 실제 이미지는 3단계에서 서버가 같은 디자인으로 그려요. */
export default function CardPreview({
  card,
  page,
  total,
  handle,
  series,
  deep,
}: {
  card: Card;
  page: number;
  total: number;
  handle: string;
  series: string;
  deep?: boolean;
}) {
  const lines = card.body.split(/\n+/).filter(Boolean);
  return (
    <div className={`cardnews cardnews--${card.kind} ${deep ? "cardnews--deep" : ""}`}>
      <div className="cardnews__inner">
        <div className="cardnews__top">
          {card.kind === "cover" ? (
            <span className="cardnews__pill">{deep ? "오늘의 한 가지" : series}</span>
          ) : card.kind === "outro" ? (
            <span className="cardnews__pill">정리</span>
          ) : (
            <span className="cardnews__pill cardnews__pill--light">
              {page} / {total}
            </span>
          )}
          {card.kind === "body" && card.tag && <span className="cardnews__tag">{card.tag}</span>}
          <span className="cardnews__handle">{handle}</span>
        </div>
        <h4 className="cardnews__title">{card.title}</h4>
        {card.kind === "cover" ? (
          <p className="cardnews__sub">{card.body}</p>
        ) : (
          <div className="cardnews__body">
            {lines.map((l, i) => (
              <p key={i} className={card.kind === "outro" ? "cardnews__li" : ""}>
                {l.replace(/^[-•]\s*/, "")}
              </p>
            ))}
          </div>
        )}
        <div className="cardnews__mascot">
          <OtterFace size={card.kind === "cover" ? 64 : 36} />
        </div>
        {card.kind === "outro" && <div className="cardnews__cta">저장해 두고 내일 소식도 받아보세요</div>}
      </div>
    </div>
  );
}
