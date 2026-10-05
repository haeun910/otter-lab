// 카드뉴스를 1080×1350 PNG로 그려요. 화면의 CardPreview(lab.css .cardnews)와 같은 치수를 써요.
import type { Card, Draft } from "../data/demo";
import { otterSvgMarkup } from "../ui/otterSvg";

export const CARD_W = 1080;
export const CARD_H = 1350;

const PAD = CARD_W * 0.05; // .cardnews padding 5%
const U = (CARD_W - PAD * 2) / 100; // 1cqw

const C = {
  ink: "#2a2e5e",
  inkSoft: "#626891",
  paper: "#ffffff",
  sky: "#8ccbff",
  mint: "#7fe3c6",
  coral: "#ff9a8a",
  bg: "#e3f3ff",
  bgDeep: "#dcf8ef",
  pillLight: "#eaf6ff",
  cta: "#fff1ee",
};
const DISPLAY = `"Jua", "Gowun Dodum", sans-serif`;
const BODY = `"Gowun Dodum", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
const CTA_TEXT = "저장해 두고 내일 소식도 받아보세요";

export interface CardLook {
  page: number;
  total: number;
  handle: string;
  series: string;
  deep?: boolean;
}

type Ctx = CanvasRenderingContext2D;
type Radii = number | [number, number, number, number];

/** CSS처럼 테두리가 안쪽으로 들어가는 둥근 상자 */
function box(ctx: Ctx, x: number, y: number, w: number, h: number, r: Radii, fill: string, bw: number, noBottom = false) {
  const rs = (Array.isArray(r) ? r : [r, r, r, r]) as [number, number, number, number];
  ctx.fillStyle = C.ink;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, rs);
  ctx.fill();
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x + bw, y + bw, w - bw * 2, h - bw * (noBottom ? 1 : 2), rs.map((v) => Math.max(0, v - bw)));
  ctx.fill();
}

/** 낱말 단위 줄바꿈 (한글은 띄어쓰기 기준, 너무 긴 낱말만 글자 단위로) */
export function wrap(ctx: Ctx, text: string, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width <= maxW) {
        line = next;
        continue;
      }
      if (line) out.push(line);
      line = "";
      if (ctx.measureText(word).width <= maxW) {
        line = word;
        continue;
      }
      for (const ch of word) {
        if (ctx.measureText(line + ch).width > maxW && line) {
          out.push(line);
          line = "";
        }
        line += ch;
      }
    }
    out.push(line);
  }
  return out;
}

/** 줄들을 쓰고, 다 쓴 아래쪽 y를 돌려줘요 */
function lines(ctx: Ctx, ls: string[], x: number, y: number, size: number, lh: number) {
  const step = size * lh;
  ctx.textBaseline = "middle";
  ls.forEach((l, i) => ctx.fillText(l, x, y + step * i + step / 2));
  return y + step * ls.length;
}

function pill(ctx: Ctx, text: string, x: number, midY: number, fill: string) {
  ctx.font = `${3.2 * U}px ${DISPLAY}`;
  const bw = 0.4 * U;
  const h = 3.2 * U * 1.2 + 1.2 * U + bw * 2;
  const w = ctx.measureText(text).width + 5.2 * U + bw * 2;
  box(ctx, x, midY - h / 2, w, h, h / 2, fill, bw);
  ctx.fillStyle = C.ink;
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + bw + 2.6 * U, midY + 1);
  return { w, h };
}

let mascot: Promise<HTMLImageElement> | null = null;
function mascotImage() {
  mascot ??= new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(otterSvgMarkup(512))}`;
  });
  return mascot;
}

async function fontsReady(text: string) {
  if (!("fonts" in document)) return;
  await Promise.all([document.fonts.load(`40px "Jua"`, text), document.fonts.load(`40px "Gowun Dodum"`, text)]).catch(() => undefined);
}

export async function renderCard(card: Card, look: CardLook): Promise<HTMLCanvasElement> {
  await fontsReady(`${card.title}${card.body}${card.tag ?? ""}${look.handle}${look.series}${CTA_TEXT}정리오늘의 한 가지0123456789/`);
  const img = await mascotImage().catch(() => null);
  const cv = document.createElement("canvas");
  cv.width = CARD_W;
  cv.height = CARD_H;
  const ctx = cv.getContext("2d")!;

  // 바탕 물방울 무늬
  ctx.fillStyle = look.deep ? C.bgDeep : C.bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.fillStyle = "#ffffff";
  for (let y = 20; y < CARD_H; y += 40) for (let x = 20; x < CARD_W; x += 40) {
    ctx.beginPath();
    ctx.arc(x, y, 4.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // 종이 (아래로 떨어지는 납작한 그림자)
  const x0 = PAD;
  const y0 = PAD;
  const w = CARD_W - PAD * 2;
  const h = CARD_H - PAD * 2;
  const bw = 0.6 * U;
  const r = 6 * U;
  ctx.fillStyle = C.ink;
  ctx.beginPath();
  ctx.roundRect(x0, y0 + 1.4 * U, w, h, r);
  ctx.fill();
  box(ctx, x0, y0, w, h, r, C.paper, bw);

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x0 + bw, y0 + bw, w - bw * 2, h - bw * 2, r - bw);
  ctx.clip();

  const cx = x0 + bw + 7 * U;
  const cw = w - bw * 2 - 14 * U;
  let y = y0 + bw + 7 * U;
  const accent = look.deep ? C.mint : C.sky;

  // 윗줄: 꼬리표 알약, 쪽수, 계정
  const top = card.kind === "cover" ? (look.deep ? "오늘의 한 가지" : look.series) : card.kind === "outro" ? "정리" : `${look.page} / ${look.total}`;
  const rowMid = y + (3.2 * U * 1.2 + 2 * U) / 2;
  const p = pill(ctx, top, cx, rowMid, card.kind === "body" ? C.pillLight : accent);
  ctx.font = `${3 * U}px ${BODY}`;
  ctx.fillStyle = C.inkSoft;
  ctx.textBaseline = "middle";
  const handleW = ctx.measureText(look.handle).width;
  if (card.kind === "body" && card.tag) {
    const tagMax = cw - p.w - handleW - 4 * U;
    const tag = wrap(ctx, card.tag, Math.max(tagMax, 0))[0] ?? "";
    ctx.fillText(tag, cx + p.w + 2 * U, rowMid);
  }
  ctx.textAlign = "right";
  ctx.fillText(look.handle, cx + cw, rowMid);
  ctx.textAlign = "left";
  y += p.h;

  // 제목
  const cover = card.kind === "cover";
  const ts = (cover ? 10 : 7.6) * U;
  y += (cover ? 14 : 8) * U;
  ctx.font = `${ts}px ${DISPLAY}`;
  ctx.fillStyle = C.ink;
  y = lines(ctx, wrap(ctx, card.title, cw), cx, y, ts, 1.25);

  // 본문
  if (cover) {
    const s = 4 * U;
    ctx.font = `${s}px ${BODY}`;
    ctx.fillStyle = C.inkSoft;
    lines(ctx, wrap(ctx, card.body, cw * 0.62), cx, y + 4 * U, s, 1.55);
  } else {
    const s = 4.2 * U;
    const outro = card.kind === "outro";
    const indent = outro ? 5 * U : 0;
    y += 5 * U;
    ctx.font = `${s}px ${BODY}`;
    for (const para of card.body.split(/\n+/).filter(Boolean)) {
      const text = para.replace(/^[-•]\s*/, "");
      if (outro) {
        const d = 2.4 * U;
        ctx.fillStyle = C.ink;
        ctx.beginPath();
        ctx.arc(cx + d / 2, y + 1.9 * U + d / 2, d / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = C.coral;
        ctx.beginPath();
        ctx.arc(cx + d / 2, y + 1.9 * U + d / 2, d / 2 - 0.4 * U, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = C.ink;
      y = lines(ctx, wrap(ctx, text, cw * 0.88 - indent), cx + indent, y, s, 1.6) + 2.4 * U;
    }
  }

  // 마스코트 창문
  const mw = (cover ? 34 : 22) * U;
  const mh = (cover ? 40 : 26) * U;
  const mx = x0 + w - bw - 5 * U - mw;
  const my = y0 + h - bw - mh;
  box(ctx, mx, my, mw, mh, [mw / 2, mw / 2, 0, 0], accent, 0.5 * U, true);
  if (img) {
    const s = mw * 0.74;
    ctx.drawImage(img, mx + (mw - s) / 2, my + (mh - s) / 2, s, s);
  }

  // 마지막 장: 저장 권유
  if (card.kind === "outro") {
    const s = 3.6 * U;
    const cbw = 0.4 * U;
    ctx.font = `${s}px ${DISPLAY}`;
    const maxW = (w - bw * 2) * 0.56 - 6.8 * U - cbw * 2;
    const ls = wrap(ctx, CTA_TEXT, maxW);
    const tw = Math.max(...ls.map((l) => ctx.measureText(l).width));
    const bh = ls.length * s * 1.3 + 4.8 * U + cbw * 2;
    const bx = x0 + bw + 7 * U;
    const by = y0 + h - bw - 7 * U - bh;
    box(ctx, bx, by, tw + 6.8 * U + cbw * 2, bh, 4 * U, C.cta, cbw);
    ctx.fillStyle = C.ink;
    lines(ctx, ls, bx + cbw + 3.4 * U, by + cbw + 2.4 * U, s, 1.3);
  }

  ctx.restore();
  return cv;
}

const toBlob = (cv: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => cv.toBlob((b) => (b ? resolve(b) : reject(new Error("이미지를 만들지 못했어요"))), "image/png"));

export function fileBase(d: Draft) {
  const day = new Date(d.createdAt + 9 * 3600_000).toISOString().slice(0, 10).replace(/-/g, "");
  return `otterlab-${day}-${d.type === "심층" ? "deep" : "bundle"}`;
}

export async function draftImages(d: Draft, look: Omit<CardLook, "page" | "total">, only?: number): Promise<File[]> {
  const files: File[] = [];
  for (const [i, c] of d.deck.cards.entries()) {
    if (only !== undefined && only !== i) continue;
    const cv = await renderCard(c, { ...look, page: i + 1, total: d.deck.cards.length, deep: d.type === "심층" });
    files.push(new File([await toBlob(cv)], `${fileBase(d)}-${String(i + 1).padStart(2, "0")}.png`, { type: "image/png" }));
  }
  return files;
}

/** 휴대폰이면 공유 시트(사진 저장·인스타그램)로, 아니면 파일로 내려받아요 */
export async function saveFiles(files: File[], text?: string): Promise<"shared" | "downloaded" | "cancelled"> {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  const touch = matchMedia("(pointer: coarse)").matches;
  if (touch && nav.canShare?.({ files })) {
    try {
      await nav.share({ files, ...(text ? { text } : {}) });
      return "shared";
    } catch (e) {
      if ((e as DOMException)?.name === "AbortError") return "cancelled";
    }
  }
  for (const f of files) {
    const url = URL.createObjectURL(f);
    const a = Object.assign(document.createElement("a"), { href: url, download: f.name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    // 여러 장을 한꺼번에 받으면 브라우저가 막는 경우가 있어서 조금씩 띄워요
    if (files.length > 1) await new Promise((r) => setTimeout(r, 250));
  }
  return "downloaded";
}
