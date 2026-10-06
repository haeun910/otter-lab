// 글쓰기 순서: 설정한 장수·길이·사진 자리, 긴 글 나눠 쓰기, 다시 쓰기
import assert from "node:assert/strict";
import { writeAll, writeBlog, rewriteDeck, rewriteSection, blogLength, SPLIT_FROM, type LLM } from "../src/lab/gen/pipeline.ts";
import { cardsMessages, blogOutlineMessages, sectionCount, writingOf, DEFAULT_BRAND, type DraftRequest } from "../src/lab/gen/prompt.ts";
import { templateDeck } from "../src/lab/gen/template.ts";
import { NEWS } from "../src/lab/data/demo.ts";

const calls: string[] = [];
let failSection = -1;
const fake: LLM = async (messages, opts) => {
  const ask = messages[1].content;
  if (ask.includes("다시 써 줘")) {
    calls.push("rewrite");
    return ask.includes("소제목 하나")
      ? { heading: "새 소제목", body: "새 본문", photo: "새 사진" }
      : { cards: [{ kind: "cover", title: "하나", body: "" }], caption: "새 캡션", hashtags: [] };
  }
  if (messages[0].content.includes("카드뉴스")) {
    calls.push("cards");
    const n = ask.includes("심층") ? writingOf(brand).deepCards + 2 : 7;
    return {
      cards: Array.from({ length: n }, (_, i) => ({ kind: i === 0 ? "cover" : i === n - 1 ? "outro" : "body", title: `카드 ${i}`, body: "줄" })),
      caption: "c",
      hashtags: ["a"],
    };
  }
  if (ask.includes("설계도")) {
    calls.push("outline");
    const k = Number(ask.match(/소제목 (\d+)개/)![1]);
    return {
      title: "제목",
      intro: "도입".repeat(50),
      sections: Array.from({ length: k }, (_, i) => ({ heading: `소제목 ${i + 1}`, points: `다룰 내용 ${i + 1}`, photo: `사진 ${i + 1}` })),
      outro: "맺음".repeat(30),
      tags: ["AI"],
    };
  }
  if (ask.includes("소제목 하나를 써 줘")) {
    const i = calls.filter((c) => c.startsWith("section")).length;
    calls.push(`section${i}`);
    if (i === failSection) throw new Error("Groq 429");
    const n = Number(ask.match(/약 (\d+)자/)![1]);
    assert.ok(opts?.maxTokens && opts.maxTokens > n, "글자 수보다 넉넉한 토큰");
    return { body: "나".repeat(n) };
  }
  calls.push("single");
  return { title: "짧은 글", intro: "i", sections: [{ heading: "h", body: "b", photo: "p" }], outro: "o", tags: ["t"] };
};

let brand = { ...DEFAULT_BRAND };
const req = (type: "묶음" | "심층", w = {}): DraftRequest => {
  brand = { ...DEFAULT_BRAND, writing: { ...DEFAULT_BRAND.writing, ...w } };
  // 심층은 논문 하나로: 분야에 맞는 꼬리표·흐름을 쓰는지 봐요
  return { type, items: type === "심층" ? [{ ...NEWS[0], category: "Paper" as const }] : NEWS.slice(0, 5), brand, prompts: {} };
};

// 심층 4000자: 카드 1번 + 설계도 1번 + 소제목 6번 (4000/700≈6)
let r = req("심층", { deepLength: 4000, deepCards: 5 });
assert.equal(sectionCount(r), 6);
assert.match(cardsMessages(r)[1].content, /body 5장\(tag는 차례대로 '무슨 연구야\?', '어떻게 풀었어\?', '결과는\?', '왜 중요해\?', '한계는\?'\)/);
assert.match(cardsMessages(r)[1].content, /Paper: 논문은/);
assert.match(blogOutlineMessages(r)[1].content, /연구 배경과 문제 → 방법 → 결과/);
assert.match(blogOutlineMessages(r)[1].content, /약 4000자/);
const out = await writeAll(fake, r);
assert.deepEqual(calls, ["cards", "outline", ...Array.from({ length: 6 }, (_, i) => `section${i}`)]);
assert.equal(out.blog.sections.length, 6);
assert.ok(out.blog.sections.every((s) => s.photo?.startsWith("사진")));
assert.ok(Math.abs(blogLength(out.blog) - 4000) < 400, `길이 ${blogLength(out.blog)}`);
assert.equal(out.deck.cards.length, 7);
assert.deepEqual(out.notes, []);

// 템플릿도 설정한 장수만큼
assert.equal(templateDeck("심층", NEWS.slice(0, 1), brand).cards.length, 7);
assert.equal(templateDeck("심층", [{ ...NEWS[0], category: "Tools" }], brand).cards[1].tag, "뭐 하는 서비스야?");

// 소제목 하나가 실패해도 나머지는 써요
calls.length = 0;
failSection = 2;
const part = await writeBlog(fake, req("심층", { deepLength: 3000 }));
assert.equal(part.blog.sections.length, 4);
assert.equal(part.notes.length, 1);
assert.match(part.blog.sections[2].body, /직접 채워 주세요/);
failSection = -1;

// 짧은 묶음 글(1500자)은 한 번에, 사진 자리 끄기
calls.length = 0;
r = req("묶음", { bundleLength: 1500, photos: false });
assert.ok(1500 < SPLIT_FROM);
const short = await writeBlog(fake, r);
assert.deepEqual(calls, ["single"]);
assert.match((await import("../src/lab/gen/prompt.ts")).blogMessages(r)[1].content, /"photo"는 빈 문자열/);
assert.equal(short.blog.sections.length, 1);

// 다시 쓰기: 카드 장수가 바뀌면 원래 카드를 지키고, 소제목은 바꿔 끼워요
const deck = out.deck;
const rd = await rewriteDeck(fake, req("심층"), deck, "더 쉽게");
assert.equal(rd.cards.length, deck.cards.length);
assert.ok(rd.caption.startsWith("새 캡션\n\n다음 소식에서도 만나요. 🦦"));
assert.ok(rd.caption.includes(r.items[0].link));
assert.equal(rd.hashtags.length, 5);
const rs = await rewriteSection(fake, req("심층"), out.blog, 1, "더 길게");
assert.deepEqual(rs, { heading: "새 소제목", body: "새 본문", photo: "새 사진" });
console.log("PIPELINE OK");
