// AI 없이 소식 제목·요약만으로 뼈대 초안을 만들어요.
// Groq 키가 없거나 연결이 안 될 때 대신 쓰고, 소장님이 다듬는 걸 전제로 해요.
import type { Blog, Card, Deck, DraftType, NewsItem } from "../data/demo";
import { deepTags, writingOf, type BrandVoice } from "./prompt";

/** 문장 단위로 자르고, 글자 수를 넘지 않게 묶어요 */
export function sentences(text: string): string[] {
  // "Ceramic.ai"·"1.5"처럼 마침표 뒤에 띄어쓰기가 없으면 문장 끝이 아니에요
  return text.split(/(?<=[.!?。…])\s+/).map((s) => s.trim()).filter(Boolean);
}

/** 낱말 경계에서 자르고 말줄임표를 붙여요 */
export function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  return `${(sp > max * 0.5 ? cut.slice(0, sp) : cut).replace(/[\s,·\-–—:]+$/, "")}…`;
}

// 제목 앞뒤의 [단독]·(종합)·" - 매체" 같은 군더더기를 걷어내요
export const tidyTitle = (t: string) =>
  t
    .replace(/^\s*(\[[^\]]{1,10}\]|【[^】]{1,10}】)\s*/g, "")
    .replace(/\s*\((종합|상보|영상|포토)\)\s*/g, " ")
    .replace(/\s+[-|]\s+[^-|]{1,20}$/, "")
    .trim();

/** 글을 한 줄 width자 안쪽으로 낱말 단위로 나눠 rows줄까지만, 넘치면 말줄임표 */
export function toLines(text: string, width: number, rows: number): string[] {
  const out: string[] = [];
  let line = "";
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  for (const [i, w] of words.entries()) {
    if (!line || (line + " " + w).length <= width) {
      line = line ? `${line} ${w}` : w;
      continue;
    }
    out.push(line);
    line = w;
    if (out.length === rows) return [...out.slice(0, -1), clip(`${out[rows - 1]} ${words.slice(i).join(" ")}`, width)];
  }
  if (line) out.push(line);
  return out;
}

function bodyLines(n: NewsItem): string {
  // 문장마다 한 줄씩, 문장 부호가 없는 요약은 길이로 나눠 두 줄
  const ss = sentences(n.excerpt);
  const ls = ss.length >= 2 ? ss.slice(0, 2).map((s) => clip(s, 46)) : toLines(ss[0] ?? "", 40, 2);
  return ls.length ? ls.join("\n") : "자세한 내용은 원문에서 확인해 보세요.";
}

const BASE_TAGS = ["#AI뉴스", "#인공지능", "#오터랩", "#OtterLab", "#IT뉴스", "#카드뉴스", "#테크뉴스"];
const sourcesLine = (items: NewsItem[]) => `출처: ${[...new Set(items.map((n) => n.source))].join(", ")}`;

export function templateDeck(type: DraftType, items: NewsItem[], brand: BrandVoice): Deck {
  const short = items.map((n) => clip(tidyTitle(n.title), 22));
  if (type === "심층") {
    const n = items[0];
    const ss = sentences(n.excerpt);
    // 설정한 장수만큼, 꼬리표 차례에 맞춰 (요약 문장은 앞 카드부터 두 문장씩)
    const tags = deepTags(writingOf(brand).deepCards);
    const body = tags.map((tag, i): Card => {
      const part = ss.slice(i * 2, i * 2 + 2).map((s) => clip(s, 46)).join("\n");
      return { kind: "body", tag, title: i === 0 ? short[0] : tag.replace(/\?$/, ""), body: part || "원문에서 이 부분에 맞는 내용을 골라 넣어 주세요." };
    });
    const cards: Card[] = [
      { kind: "cover", title: clip(tidyTitle(n.title), 30), body: `${n.source} 소식을 한 장씩 풀어 봤어요` },
      ...body,
      { kind: "outro", title: "한 줄 정리", body: `- ${short[0]}\n- 자세한 내용은 ${n.source} 원문에서` },
    ];
    return {
      cards,
      caption: `${tidyTitle(n.title)}\n\n${ss.slice(0, 2).join(" ") || "카드로 정리해 봤어요."}\n\n${sourcesLine(items)}`,
      hashtags: [...BASE_TAGS, `#${n.source.replace(/\s+/g, "")}`],
    };
  }
  const cards: Card[] = [
    { kind: "cover", title: `오늘의 AI 소식 ${items.length}가지`, body: `${short.slice(0, 2).join(", ")}까지, 수달이 골라 왔어요` },
    ...items.map((n, i): Card => ({ kind: "body", tag: n.source, title: short[i], body: bodyLines(n) })),
    { kind: "outro", title: "오늘의 정리", body: short.map((t) => `- ${t}`).join("\n") },
  ];
  return {
    cards,
    caption: `오늘 강을 타고 떠내려온 소식 ${items.length}가지를 골라 왔어요.\n\n${items.map((n) => `- ${tidyTitle(n.title)}`).join("\n")}\n\n${sourcesLine(items)}`,
    hashtags: [...BASE_TAGS, `#${brand.series.replace(/\s+/g, "")}`],
  };
}

export function templateBlog(type: DraftType, items: NewsItem[], now = Date.now(), brand?: BrandVoice): Blog {
  const day = new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", timeZone: "Asia/Seoul" }).format(now);
  const photos = brand ? writingOf(brand).photos : false;
  const section = (n: NewsItem) => ({
    heading: tidyTitle(n.title),
    body: `${sentences(n.excerpt).join(" ") || "원문 요약을 넣어 주세요."}\n\n제 생각에는 (의견을 한두 문장 적어 주세요)\n출처: ${n.source} (${n.link})`,
    ...(photos ? { photo: `${n.source} 기사 대표 사진 또는 관련 화면` } : {}),
  });
  if (type === "심층") {
    const n = items[0];
    return {
      title: tidyTitle(n.title),
      intro: `${n.source}에 실린 소식을 조금 더 깊게 정리해 봤어요.`,
      sections: [section(n), { heading: "왜 중요한가요", body: "이 소식의 배경과 의미를 적어 주세요." }],
      outro: "자세한 내용은 원문에서 확인해 보세요. 도움이 되셨다면 공감과 댓글 부탁드려요.",
      tags: ["AI뉴스", "인공지능", "오터랩", "IT뉴스", n.source.replace(/\s+/g, "")],
    };
  }
  return {
    title: `AI 뉴스 정리 ${day}, ${clip(tidyTitle(items[0].title), 24)} 외 ${items.length - 1}건`,
    intro: `오늘도 오터랩 수달들이 강가에서 건져 올린 소식을 정리했어요. ${items.length}가지만 골랐어요.`,
    sections: items.map(section),
    outro: "오늘 소식은 여기까지예요. 궁금한 소식이 있으면 댓글로 알려 주세요. 이웃 추가하시면 매일 아침 정리를 받아볼 수 있어요.",
    tags: ["AI뉴스", "인공지능", "오터랩", "IT뉴스", "테크뉴스", ...new Set(items.map((n) => n.source.replace(/\s+/g, "")))],
  };
}
