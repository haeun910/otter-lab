// 카드뉴스 그리기. 화면 미리보기(CardPreview)와 저장하는 PNG가 같은 함수로 그려서 생김새가 똑같아요.
// 테마 3가지: 오터 파스텔 · 뉴스룸 · 매거진. 포인트 색·제목 글꼴·크기(세로/정사각)는 소장 책상에서 골라요.
import type { Card, Draft } from "../data/demo";
import { designOf, type BrandVoice, type CardDesign, type TitleFont } from "../gen/prompt";
import { otterSvgMarkup } from "../ui/otterSvg";

export const CARD_W = 1080;
export const cardHeight = (d: CardDesign) => (d.size === "square" ? 1080 : 1350);

export interface CardLook {
  page: number;
  total: number;
  handle: string;
  series: string;
  deep?: boolean;
  design: CardDesign;
}

export const THEMES: { id: CardDesign["theme"]; name: string; about: string }[] = [
  { id: "pastel", name: "오터 파스텔", about: "물방울 무늬 바탕에 종이 카드, 수달 창문" },
  { id: "newsroom", name: "뉴스룸", about: "흰 바탕에 검은 머리띠, 큰 제목의 신문 느낌" },
  { id: "magazine", name: "매거진", about: "포인트 색 바탕에 큰 숫자, 잡지 표지 느낌" },
];
export const FONTS: { id: TitleFont; name: string }[] = [
  { id: "jua", name: "주아 (동글)" },
  { id: "noto", name: "본고딕 굵게" },
  { id: "blackhan", name: "검은고딕 (강하게)" },
  { id: "gowun", name: "고운돋움 (부드럽게)" },
];
export const ACCENTS = ["#8CCBFF", "#7FE3C6", "#FF9A8A", "#FFD36E", "#B9A6F2", "#2A2E5E", "#111111", "#E8505B"];

const FAMILY: Record<TitleFont, string> = {
  jua: `"Jua", "Gowun Dodum", sans-serif`,
  noto: `"Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`,
  blackhan: `"Black Han Sans", "Noto Sans KR", sans-serif`,
  gowun: `"Gowun Dodum", "Apple SD Gothic Neo", sans-serif`,
};
const WEIGHT: Record<TitleFont, number> = { jua: 400, noto: 900, blackhan: 400, gowun: 400 };
const BODY_SOFT = `"Gowun Dodum", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
const BODY_SANS = `"Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
const CTA_TEXT = "저장해 두고 내일 소식도 받아보세요";

type Ctx = CanvasRenderingContext2D;
type Radii = number | [number, number, number, number];

// ---------- 색 ----------
function rgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h.padEnd(6, "0").slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const hex = (c: number[]) => `#${c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`;
/** 흰색과 섞기 (t=1이면 흰색) */
export const tint = (c: string, t: number) => hex(rgb(c).map((v) => v + (255 - v) * t));
export const shade = (c: string, t: number) => hex(rgb(c).map((v) => v * (1 - t)));
const luminance = (c: string) => {
  const [r, g, b] = rgb(c).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
/** 그 색 위에 올릴 글자색 (밝으면 남색, 어두우면 흰색) */
export const onColor = (c: string) => (luminance(c) > 0.45 ? "#1f2340" : "#ffffff");

// ---------- 그리기 도구 ----------
function rrect(ctx: Ctx, x: number, y: number, w: number, h: number, r: Radii) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}
/** CSS처럼 테두리가 안쪽으로 들어가는 둥근 상자 */
function box(ctx: Ctx, x: number, y: number, w: number, h: number, r: Radii, fill: string, bw: number, border: string, noBottom = false) {
  const rs = (Array.isArray(r) ? r : [r, r, r, r]) as [number, number, number, number];
  ctx.fillStyle = border;
  rrect(ctx, x, y, w, h, rs);
  ctx.fill();
  ctx.fillStyle = fill;
  rrect(ctx, x + bw, y + bw, w - bw * 2, h - bw * (noBottom ? 1 : 2), rs.map((v) => Math.max(0, v - bw)) as Radii);
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

/** 줄들을 쓰고 다 쓴 아래쪽 y를 돌려줘요 */
function lines(ctx: Ctx, ls: string[], x: number, y: number, size: number, lh: number) {
  const step = size * lh;
  ctx.textBaseline = "middle";
  ls.forEach((l, i) => ctx.fillText(l, x, y + step * i + step / 2));
  return y + step * ls.length;
}

/** 제목이 maxLines 안에 들어가도록 글자 크기를 줄여요 */
function fitTitle(ctx: Ctx, text: string, family: string, weight: number, size: number, maxW: number, maxLines: number) {
  let s = size;
  for (; s > size * 0.55; s -= 4) {
    ctx.font = `${weight} ${s}px ${family}`;
    if (wrap(ctx, text, maxW).length <= maxLines) break;
  }
  ctx.font = `${weight} ${s}px ${family}`;
  return { size: s, ls: wrap(ctx, text, maxW) };
}

const bodyLines = (card: Card) => card.body.split(/\n+/).filter(Boolean).map((l) => l.replace(/^[-•]\s*/, ""));
const pageText = (look: CardLook) => `${String(look.page).padStart(2, "0")} / ${String(look.total).padStart(2, "0")}`;
const topLabel = (card: Card, look: CardLook) => (card.kind === "cover" ? (look.deep ? "오늘의 한 가지" : look.series) : card.kind === "outro" ? "정리" : pageText(look));

// ---------- 그림 재료 (글꼴·마스코트) ----------
let mascot: HTMLImageElement | null = null;
let mascotLoad: Promise<void> | null = null;
function loadMascot() {
  mascotLoad ??= new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = () => {
      mascot = img;
      resolve();
    };
    img.onerror = () => resolve();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(otterSvgMarkup(512))}`;
  });
  return mascotLoad;
}

/** 이 카드를 그리는 데 필요한 글꼴과 마스코트를 불러와요 */
export async function prepare(text: string, design: CardDesign) {
  const all = `${text}${CTA_TEXT}정리오늘의 한 가지0123456789/`;
  const loads: Promise<unknown>[] = [loadMascot()];
  if ("fonts" in document) {
    loads.push(document.fonts.load(`${WEIGHT[design.font]} 40px ${FAMILY[design.font].split(",")[0]}`, all));
    loads.push(document.fonts.load(`40px "Gowun Dodum"`, all), document.fonts.load(`40px "Jua"`, all));
    if (design.theme !== "pastel") loads.push(document.fonts.load(`400 40px "Noto Sans KR"`, all), document.fonts.load(`700 40px "Noto Sans KR"`, all));
    if (design.theme === "magazine") loads.push(document.fonts.load(`40px "Black Han Sans"`, "0123456789"));
  }
  await Promise.all(loads.map((p) => p.catch(() => undefined)));
}

function drawMascot(ctx: Ctx, cx: number, cy: number, size: number) {
  if (mascot) ctx.drawImage(mascot, cx - size / 2, cy - size / 2, size, size);
}

// ---------- 테마 1: 오터 파스텔 ----------
function pastel(ctx: Ctx, card: Card, look: CardLook, H: number) {
  const W = CARD_W;
  const d = look.design;
  const PAD = W * 0.05;
  const U = (W - PAD * 2) / 100;
  const vs = H / 1350;
  const INK = "#2a2e5e";
  const accent = d.accent;
  ctx.fillStyle = tint(accent, 0.8);
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#ffffff";
  for (let y = 20; y < H; y += 40)
    for (let x = 20; x < W; x += 40) {
      ctx.beginPath();
      ctx.arc(x, y, 4.4, 0, Math.PI * 2);
      ctx.fill();
    }
  const x0 = PAD;
  const y0 = PAD;
  const w = W - PAD * 2;
  const h = H - PAD * 2;
  const bw = 0.6 * U;
  const r = 6 * U;
  ctx.fillStyle = INK;
  rrect(ctx, x0, y0 + 1.4 * U, w, h, r);
  ctx.fill();
  box(ctx, x0, y0, w, h, r, "#ffffff", bw, INK);
  ctx.save();
  rrect(ctx, x0 + bw, y0 + bw, w - bw * 2, h - bw * 2, r - bw);
  ctx.clip();

  const cx = x0 + bw + 7 * U;
  const cw = w - bw * 2 - 14 * U;
  let y = y0 + bw + 7 * U;
  // 윗줄: 알약, 꼬리표, 계정
  ctx.font = `${3.2 * U}px ${FAMILY.jua}`;
  const label = topLabel(card, look);
  const pbw = 0.4 * U;
  const ph = 3.2 * U * 1.2 + 1.2 * U + pbw * 2;
  const pw = ctx.measureText(label).width + 5.2 * U + pbw * 2;
  const mid = y + ph / 2;
  box(ctx, cx, y, pw, ph, ph / 2, card.kind === "body" ? tint(accent, 0.85) : accent, pbw, INK);
  ctx.fillStyle = card.kind === "body" ? INK : onColor(accent) === "#ffffff" ? "#ffffff" : INK;
  ctx.textBaseline = "middle";
  ctx.fillText(label, cx + pbw + 2.6 * U, mid + 1);
  ctx.font = `${3 * U}px ${BODY_SOFT}`;
  ctx.fillStyle = "#626891";
  const handleW = ctx.measureText(look.handle).width;
  if (card.kind === "body" && card.tag) ctx.fillText(wrap(ctx, card.tag, Math.max(0, cw - pw - handleW - 4 * U))[0] ?? "", cx + pw + 2 * U, mid);
  ctx.textAlign = "right";
  ctx.fillText(look.handle, cx + cw, mid);
  ctx.textAlign = "left";
  y += ph;

  const cover = card.kind === "cover";
  y += (cover ? 14 : 8) * U * vs;
  ctx.fillStyle = INK;
  const t = fitTitle(ctx, card.title, FAMILY[d.font], WEIGHT[d.font], (cover ? 10 : 7.6) * U, cw, cover ? 4 : 3);
  y = lines(ctx, t.ls, cx, y, t.size, 1.25);
  if (cover) {
    const s = 4 * U;
    ctx.font = `${s}px ${BODY_SOFT}`;
    ctx.fillStyle = "#626891";
    lines(ctx, wrap(ctx, card.body, cw * 0.62), cx, y + 4 * U, s, 1.55);
  } else {
    const s = 4.2 * U;
    const outro = card.kind === "outro";
    const indent = outro ? 5 * U : 0;
    y += 5 * U * vs;
    ctx.font = `${s}px ${BODY_SOFT}`;
    for (const text of bodyLines(card)) {
      if (outro) {
        const dd = 2.4 * U;
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.arc(cx + dd / 2, y + 1.9 * U + dd / 2, dd / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = tint(accent, 0.2);
        ctx.beginPath();
        ctx.arc(cx + dd / 2, y + 1.9 * U + dd / 2, dd / 2 - 0.4 * U, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = INK;
      y = lines(ctx, wrap(ctx, text, cw * 0.88 - indent), cx + indent, y, s, 1.6) + 2.4 * U;
    }
  }
  // 수달 창문
  const mw = (cover ? 34 : 22) * U;
  const mh = (cover ? 40 : 26) * U * Math.max(0.8, vs);
  const mx = x0 + w - bw - 5 * U - mw;
  const my = y0 + h - bw - mh;
  box(ctx, mx, my, mw, mh, [mw / 2, mw / 2, 0, 0], accent, 0.5 * U, INK, true);
  drawMascot(ctx, mx + mw / 2, my + mh / 2, mw * 0.74);
  if (card.kind === "outro") {
    const s = 3.6 * U;
    const cbw = 0.4 * U;
    ctx.font = `${s}px ${FAMILY.jua}`;
    const ls = wrap(ctx, CTA_TEXT, (w - bw * 2) * 0.56 - 6.8 * U - cbw * 2);
    const tw = Math.max(...ls.map((l) => ctx.measureText(l).width));
    const bh = ls.length * s * 1.3 + 4.8 * U + cbw * 2;
    const bx = x0 + bw + 7 * U;
    const by = y0 + h - bw - 7 * U - bh;
    box(ctx, bx, by, tw + 6.8 * U + cbw * 2, bh, 4 * U, tint(accent, 0.88), cbw, INK);
    ctx.fillStyle = INK;
    lines(ctx, ls, bx + cbw + 3.4 * U, by + cbw + 2.4 * U, s, 1.3);
  }
  ctx.restore();
}

// ---------- 테마 2: 뉴스룸 ----------
function newsroom(ctx: Ctx, card: Card, look: CardLook, H: number) {
  const W = CARD_W;
  const d = look.design;
  const X = 84;
  const cw = W - X * 2;
  const INK = "#141414";
  const accent = d.accent;
  const cover = card.kind === "cover";
  const bg = cover ? accent : "#ffffff";
  const fg = cover ? onColor(accent) : INK;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 머리띠
  const band = 112;
  if (!cover) {
    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, W, band);
    ctx.fillStyle = accent;
    ctx.fillRect(0, band, W, 12);
  }
  ctx.textBaseline = "middle";
  ctx.font = `700 34px ${BODY_SANS}`;
  ctx.fillStyle = cover ? fg : "#ffffff";
  ctx.fillText(cover ? look.series : card.kind === "outro" ? "정리" : look.series, X, band / 2 + 6);
  ctx.textAlign = "right";
  ctx.font = `500 30px ${BODY_SANS}`;
  ctx.fillText(cover ? (look.deep ? "오늘의 한 가지" : pageText(look)) : pageText(look), W - X, band / 2 + 6);
  ctx.textAlign = "left";

  if (cover) {
    // 큰 제목을 아래쪽에
    const t = fitTitle(ctx, card.title, FAMILY[d.font], WEIGHT[d.font], 124, cw, 4);
    const sub = card.body;
    ctx.font = `500 42px ${BODY_SANS}`;
    const subLs = wrap(ctx, sub, cw * 0.85);
    const subH = subLs.length * 42 * 1.5;
    const titleH = t.ls.length * t.size * 1.15;
    let y = H - 170 - subH - 40 - titleH;
    ctx.fillStyle = fg;
    ctx.fillRect(X, y - 46, 120, 14);
    ctx.font = `${WEIGHT[d.font]} ${t.size}px ${FAMILY[d.font]}`;
    y = lines(ctx, t.ls, X, y, t.size, 1.15) + 40;
    ctx.font = `500 42px ${BODY_SANS}`;
    ctx.globalAlpha = 0.85;
    lines(ctx, subLs, X, y, 42, 1.5);
    ctx.globalAlpha = 1;
    // 위쪽 큰 수달
    drawMascot(ctx, W - 230, 330 * (H / 1350), 300);
  } else {
    let y = band + 12 + 90 * (H / 1350);
    if (card.kind === "body" && card.tag) {
      ctx.font = `700 34px ${BODY_SANS}`;
      ctx.fillStyle = shade(accent, luminance(accent) > 0.45 ? 0.45 : 0);
      ctx.fillText(card.tag, X, y);
      y += 56;
    }
    ctx.fillStyle = INK;
    const t = fitTitle(ctx, card.title, FAMILY[d.font], WEIGHT[d.font], 96, cw, 3);
    y = lines(ctx, t.ls, X, y, t.size, 1.22) + 34;
    ctx.fillStyle = accent;
    ctx.fillRect(X, y, 96, 10);
    y += 58;
    ctx.font = `400 47px ${BODY_SANS}`;
    for (const text of bodyLines(card)) {
      const indent = card.kind === "outro" ? 46 : 0;
      if (indent) {
        ctx.fillStyle = accent;
        ctx.fillRect(X, y + 26, 24, 24);
      }
      ctx.fillStyle = "#2b2b2b";
      y = lines(ctx, wrap(ctx, text, cw - indent), X + indent, y, 47, 1.6) + 24;
    }
    if (card.kind === "outro") {
      ctx.font = `700 36px ${BODY_SANS}`;
      ctx.fillStyle = INK;
      ctx.fillText(`→ ${CTA_TEXT}`, X, H - 190);
    }
  }
  // 바닥줄
  ctx.fillStyle = cover ? fg : "#d9d9d9";
  ctx.globalAlpha = cover ? 0.35 : 1;
  ctx.fillRect(X, H - 120, cw, 2);
  ctx.globalAlpha = 1;
  ctx.font = `500 30px ${BODY_SANS}`;
  ctx.fillStyle = cover ? fg : "#555555";
  ctx.fillText(look.handle, X, H - 66);
  if (!cover) {
    ctx.fillStyle = tint(accent, 0.6);
    ctx.beginPath();
    ctx.arc(W - X - 34, H - 66, 40, 0, Math.PI * 2);
    ctx.fill();
    drawMascot(ctx, W - X - 34, H - 64, 64);
  }
}

// ---------- 테마 3: 매거진 ----------
function magazine(ctx: Ctx, card: Card, look: CardLook, H: number) {
  const W = CARD_W;
  const d = look.design;
  const accent = d.accent;
  const fg = onColor(accent);
  const vs = H / 1350;
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, W, H);
  const X = 72;
  const cw = W - X * 2;
  ctx.textBaseline = "middle";
  ctx.font = `700 32px ${BODY_SANS}`;
  ctx.fillStyle = fg;
  ctx.fillText(card.kind === "body" && card.tag ? card.tag : topLabel(card, look), X, 96);

  if (card.kind === "cover") {
    const t = fitTitle(ctx, card.title, FAMILY[d.font], WEIGHT[d.font], 132, cw, 4);
    let y = 250 * vs;
    ctx.fillStyle = fg;
    y = lines(ctx, t.ls, X, y, t.size, 1.12) + 36;
    ctx.font = `500 44px ${BODY_SANS}`;
    lines(ctx, wrap(ctx, card.body, cw * 0.7), X, y, 44, 1.5);
    // 큰 수달 도장
    const r = 230 * Math.min(1, vs * 1.05);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(W - r - 40, H - r - 60, r, 0, Math.PI * 2);
    ctx.fill();
    drawMascot(ctx, W - r - 40, H - r - 50, r * 1.5);
    ctx.font = `500 32px ${BODY_SANS}`;
    ctx.fillStyle = fg;
    ctx.fillText(look.handle, X, H - 80);
    return;
  }

  // 제목은 색 바탕 위에, 본문은 흰 종이 위에
  ctx.fillStyle = fg;
  const t = fitTitle(ctx, card.title, FAMILY[d.font], WEIGHT[d.font], 100, cw, 2);
  let y = lines(ctx, t.ls, X, 160, t.size, 1.15) + 44;
  const panelX = 48;
  const panelW = W - panelX * 2;
  const panelY = Math.max(y, 360 * vs);
  const panelH = H - panelY - 48;
  ctx.fillStyle = "#ffffff";
  rrect(ctx, panelX, panelY, panelW, panelH, 44);
  ctx.fill();
  // 종이 오른쪽 아래의 큰 쪽수 (잡지 느낌, 글자는 위쪽에 있어서 안 겹쳐요)
  ctx.save();
  rrect(ctx, panelX, panelY, panelW, panelH, 44);
  ctx.clip();
  ctx.fillStyle = tint(accent, 0.86);
  ctx.font = `${Math.round(380 * vs)}px ${FAMILY.blackhan}`;
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(card.kind === "outro" ? "✓" : String(look.page).padStart(2, "0"), panelX + panelW - 40, panelY + panelH - 150);
  ctx.restore();
  ctx.textBaseline = "middle";
  y = panelY + 64;
  const ix = panelX + 56;
  const iw = panelW - 112;
  ctx.font = `400 47px ${BODY_SANS}`;
  for (const text of bodyLines(card)) {
    const outro = card.kind === "outro";
    if (outro) {
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(ix + 12, y + 34, 12, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#1f2340";
    y = lines(ctx, wrap(ctx, text, iw - (outro ? 44 : 0)), ix + (outro ? 44 : 0), y, 47, 1.6) + 26;
  }
  // 종이 바닥: 계정과 수달 도장
  ctx.font = `500 30px ${BODY_SANS}`;
  ctx.fillStyle = "#7a7f99";
  ctx.fillText(card.kind === "outro" ? CTA_TEXT : look.handle, ix, panelY + panelH - 64);
  ctx.fillStyle = tint(accent, 0.7);
  ctx.beginPath();
  ctx.arc(panelX + panelW - 96, panelY + panelH - 84, 52, 0, Math.PI * 2);
  ctx.fill();
  drawMascot(ctx, panelX + panelW - 96, panelY + panelH - 82, 84);
}

const DRAW = { pastel, newsroom, magazine };

/** 이미 불러온 재료로 바로 그려요 (미리보기용). ctx는 1080 기준 좌표 */
export function drawCard(ctx: Ctx, card: Card, look: CardLook) {
  const H = cardHeight(look.design);
  ctx.clearRect(0, 0, CARD_W, H);
  (DRAW[look.design.theme] ?? pastel)(ctx, card, look, H);
}

export async function renderCard(card: Card, look: CardLook): Promise<HTMLCanvasElement> {
  await prepare(`${card.title}${card.body}${card.tag ?? ""}${look.handle}${look.series}`, look.design);
  const cv = document.createElement("canvas");
  cv.width = CARD_W;
  cv.height = cardHeight(look.design);
  drawCard(cv.getContext("2d")!, card, look);
  return cv;
}

const toBlob = (cv: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => cv.toBlob((b) => (b ? resolve(b) : reject(new Error("이미지를 만들지 못했어요"))), "image/png"));

export function fileBase(d: Draft) {
  const day = new Date(d.createdAt + 9 * 3600_000).toISOString().slice(0, 10).replace(/-/g, "");
  return `otterlab-${day}-${d.type === "심층" ? "deep" : "bundle"}`;
}

/** 초안의 카드들을 PNG 파일로 (only를 주면 그 한 장만) */
export async function draftImages(d: Draft, brand: BrandVoice, only?: number): Promise<File[]> {
  const design = designOf(brand);
  const files: File[] = [];
  for (const [i, c] of d.deck.cards.entries()) {
    if (only !== undefined && only !== i) continue;
    const cv = await renderCard(c, { page: i + 1, total: d.deck.cards.length, handle: brand.handle, series: brand.series, deep: d.type === "심층", design });
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
    if (files.length > 1) await new Promise((r) => setTimeout(r, 250));
  }
  return "downloaded";
}
