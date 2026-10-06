// 카드뉴스 그리기. 화면 미리보기(CardPreview)와 저장하는 PNG가 같은 함수로 그려서 생김새가 똑같아요.
// 숲속 소식지의 역할별 일러스트 10종. 모든 카드는 1080×1080으로 저장해요.
import type { Card, Draft } from "../data/demo";
import { designOf, type BrandVoice, type CardDesign, type TitleFont } from "../gen/prompt";
import mainArt from "../assets/card-main.webp";
import reporterArt from "../assets/card-reporter.webp";
import explainerArt from "../assets/card-explainer.webp";
import summaryArt from "../assets/card-summary.webp";
import researcherArt from "../assets/card-researcher.webp";
import productArt from "../assets/card-product.webp";
import analystArt from "../assets/card-analyst.webp";
import contextArt from "../assets/card-context.webp";
import checklistArt from "../assets/card-checklist.webp";
import cautionArt from "../assets/card-caution.webp";
import dialogueArt from "../assets/card-dialogue.webp";
import { chooseCardTemplate, type CardTemplate } from "../data/cardTemplates";
import { CARD_HANDLE } from "../gen/editorial";
import { otterSvgMarkup } from "../ui/otterSvg";

export const CARD_W = 1080;
export const cardHeight = (_d: CardDesign) => 1080;

export interface CardLook {
  page: number;
  total: number;
  handle: string;
  series: string;
  deep?: boolean;
  design: CardDesign;
}

export const THEMES: { id: CardDesign["theme"]; name: string; about: string }[] = [
  { id: "pastel", name: "숲속 소식지", about: "정보 중심의 정사각형 소식지와 작은 수달 일러스트" },
  { id: "newsroom", name: "뉴스룸", about: "흰 바탕에 검은 머리띠, 큰 제목의 신문 느낌" },
  { id: "magazine", name: "매거진", about: "포인트 색 바탕에 큰 숫자, 잡지 표지 느낌" },
];
export const FONTS: { id: TitleFont; name: string }[] = [
  { id: "jua", name: "주아 (동글)" },
  { id: "noto", name: "본고딕 굵게" },
  { id: "blackhan", name: "검은고딕 (강하게)" },
  { id: "gowun", name: "고운돋움 (부드럽게)" },
];
export const ACCENTS = ["#56734C", "#8CCBFF", "#7FE3C6", "#FF9A8A", "#FFD36E", "#B9A6F2", "#2A2E5E", "#111111", "#E8505B"];

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

const ART = {
  main: mainArt, reporter: reporterArt, explainer: explainerArt, courier: summaryArt,
  researcher: researcherArt, product: productArt, analyst: analystArt, context: contextArt,
  checklist: checklistArt, caution: cautionArt, dialogue: dialogueArt,
};
const illustrations: Partial<Record<CardTemplate, HTMLImageElement>> = {};
const illustrationLoads: Partial<Record<CardTemplate, Promise<void>>> = {};
function loadIllustration(template: CardTemplate) {
  illustrationLoads[template] ??= new Promise<void>((resolve, reject) => {
    const img = new Image();
    img.onload = () => { illustrations[template] = img; resolve(); };
    img.onerror = () => { delete illustrationLoads[template]; reject(new Error("카드 일러스트를 불러오지 못했어요. 다시 시도해 주세요.")); };
    const asset = ART[template];
    img.src = typeof asset === "string" ? asset : asset.src;
  });
  return illustrationLoads[template]!;
}

/** 이 카드를 그리는 데 필요한 글꼴과 마스코트를 불러와요 */
export async function prepare(text: string, design: CardDesign, template: CardTemplate = "reporter") {
  const all = `${text}${CTA_TEXT}정리오늘의 한 가지0123456789/`;
  const loads: Promise<unknown>[] = [loadMascot()];
  if ("fonts" in document) {
    loads.push(document.fonts.load(`${WEIGHT[design.font]} 40px ${FAMILY[design.font].split(",")[0]}`, all));
    loads.push(document.fonts.load(`40px "Gowun Dodum"`, all), document.fonts.load(`40px "Jua"`, all));
    loads.push(document.fonts.load(`400 40px "Noto Sans KR"`, all), document.fonts.load(`700 40px "Noto Sans KR"`, all));
    if (design.theme === "magazine") loads.push(document.fonts.load(`40px "Black Han Sans"`, "0123456789"));
  }
  await Promise.all(loads.map((p) => p.catch(() => undefined)));
  if (design.theme === "pastel" || template === "main") await loadIllustration(template);
}

function drawMascot(ctx: Ctx, cx: number, cy: number, size: number) {
  if (mascot) ctx.drawImage(mascot, cx - size / 2, cy - size / 2, size, size);
}

function drawCoverMascot(ctx: Ctx, look: CardLook, cx: number, cy: number, size: number) {
  const main = illustrations.main;
  if (look.page === 1) {
    if (main) ctx.drawImage(main, cx - size / 2, cy - size / 2, size, size);
  } else drawMascot(ctx, cx, cy, size);
}

// ---------- 테마 1: 오터 파스텔 ----------
function pastel(ctx: Ctx, card: Card, look: CardLook, H: number) {
  const X = 64, width = 952, ink = "#28382d", accent = shade(look.design.accent, 0.25);
  ctx.fillStyle = "#fbf8ee"; ctx.fillRect(0, 0, CARD_W, H);
  ctx.strokeStyle = "#d5dccb"; ctx.lineWidth = 2; ctx.strokeRect(28, 28, 1024, 1024);
  ctx.textBaseline = "middle"; ctx.font = `700 27px ${BODY_SANS}`; ctx.fillStyle = accent;
  ctx.fillText(card.kind === "cover" ? "오터랩 · 오늘의 소식" : card.kind === "outro" ? "핵심 정리" : card.tag || "소식 자세히 보기", X, 88);
  ctx.fillStyle = "#d5dccb"; ctx.fillRect(X, 119, width, 2);
  ctx.fillStyle = ink;
  const title = fitTitle(ctx, card.title, FAMILY[look.design.font], WEIGHT[look.design.font], card.kind === "cover" ? 84 : 72, width, 3);
  let y = lines(ctx, title.ls, X, 153, title.size, 1.22) + 32;
  const start = y;
  const blocks = [{ heading: "", body: card.body }, ...(card.sections ?? [])];
  let chosen = 0;
  // Reserve the lower-right corner for illustration; shrink text only within readable bounds.
  for (let size = 40; size >= 32; size -= 2) {
    y = start; ctx.font = `400 ${size}px ${BODY_SANS}`;
    for (const block of blocks) {
      if (block.heading) y += 54;
      const w = block.heading || y > 470 ? 520 : width;
      const ls = wrap(ctx, block.body, w);
      // A wide paragraph crossing into the illustration area is measured narrowly instead.
      const actual = !block.heading && y + ls.length * size * 1.5 > 570 ? wrap(ctx, block.body, 520) : ls;
      y += actual.length * size * 1.5 + 28;
    }
    if (y <= 972) { chosen = size; break; }
  }
  if (!chosen) throw new Error(`${look.page}번째 카드의 내용이 길어요. 제목·본문을 줄이거나 카드를 나눠 주세요.`);
  y = start;
  for (const block of blocks) {
    if (block.heading) {
      ctx.font = `700 32px ${BODY_SANS}`; ctx.fillStyle = accent;
      const heading = wrap(ctx, block.heading, 520);
      if (heading.length > 1) throw new Error(`${look.page}번째 카드의 소제목을 짧게 다듬어 주세요.`);
      lines(ctx, heading, X, y, 32, 1.3); y += 54;
    }
    ctx.font = `400 ${chosen}px ${BODY_SANS}`; ctx.fillStyle = ink;
    let w = block.heading || y > 470 ? 520 : width;
    let ls = wrap(ctx, block.body, w);
    if (!block.heading && y + ls.length * chosen * 1.5 > 570) { w = 520; ls = wrap(ctx, block.body, w); }
    y = lines(ctx, ls, X, y, chosen, 1.5) + 28;
  }
  const art = illustrations[chooseCardTemplate(card, look.page)];
  if (art) ctx.drawImage(art, 603, 550, 425, 425);
}

function footer(ctx: Ctx, look: CardLook) {
  ctx.fillStyle = "#fbf8ee"; ctx.fillRect(30, 985, 1020, 64);
  ctx.textBaseline = "middle"; ctx.textAlign = "left"; ctx.fillStyle = "#56734c";
  ctx.font = `500 27px ${BODY_SANS}`;
  ctx.fillText(String(look.page).padStart(2, "0"), 64, 1020);
  // Small vector paw follows the page number, then the fixed account handle.
  for (const [x, y, rx, ry] of [[131,1024,11,8],[117,1013,4,5],[126,1007,4,5],[137,1007,4,5],[146,1013,4,5]]) {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillText(CARD_HANDLE, 163, 1020);
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
    drawCoverMascot(ctx, look, W - 230, 330 * (H / 1350), 300);
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
    drawCoverMascot(ctx, look, W - r - 40, H - r - 50, r * 1.5);
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
  (DRAW[look.design.theme] ?? pastel)(ctx, look.page === 1 ? { ...card, kind: "cover" } : card, look, H);
  footer(ctx, look);
}

export async function renderCard(card: Card, look: CardLook): Promise<HTMLCanvasElement> {
  await prepare(`${card.title}${card.body}${card.tag ?? ""}${look.handle}${look.series}${(card.sections ?? []).map((s) => s.heading + s.body).join("")}`, look.design, chooseCardTemplate(card, look.page));
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
