import assert from "node:assert/strict";
import { generate } from "../src/lab/gen/generate.ts";
import { writeAll } from "../src/lab/gen/pipeline.ts";
import { DEFAULT_BRAND, type DraftRequest } from "../src/lab/gen/prompt.ts";
import { NEWS } from "../src/lab/data/demo.ts";

const r: DraftRequest = { type: "심층", items: NEWS.slice(0, 1), brand: { ...DEFAULT_BRAND, writing: { deepCards: 3, deepLength: 1500 } }, prompts: {} };
const deck = { cards: ["cover", "body", "body", "body", "outro"].map((kind, i) => ({ kind, title: `카드 ${i}`, body: `서로 다른 내용 ${i}` })), caption: "출처", hashtags: ["AI"] };
let calls = 0;
const cardOnly = await generate(async () => { calls++; return deck; }, r, { target: "cards" });
assert.equal(calls, 1, "card-only must not call the blog model");
assert.equal(cardOnly.cards.status, "complete");
assert.equal(cardOnly.blogState.status, "skipped");
assert.equal(cardOnly.blog.title, "", "unrequested blog is not presented as a draft");

const transitions: string[] = [];
const mixed = await generate(async (messages) => {
  if (messages[0].content.includes("카드뉴스")) return deck;
  throw new Error("Groq 429");
}, r, { onUpdate: (v) => transitions.push(`${v.cards.status}/${v.blogState.status}`) });
assert.equal(mixed.cards.status, "complete");
assert.equal(mixed.blogState.status, "failed");
assert.match(mixed.blogState.error!, /429/);
assert.deepEqual(mixed.deck, cardOnly.deck, "blog failure preserves actual AI cards");
assert.ok(transitions.indexOf("complete/pending") < transitions.indexOf("complete/running"), "publish completed cards before starting blog");

const repaired = await generate(async (messages) => {
  assert.ok(!messages[0].content.includes("카드뉴스"));
  return { title: "원고", intro: "도입", sections: [{ heading: "본문", body: "내용" }], outro: "끝", tags: ["AI"] };
}, r, { target: "blog", previous: mixed });
assert.equal(repaired.blogState.status, "complete");
assert.strictEqual(repaired.deck, mixed.deck, "blog retry never touches cards");

const badCount = await generate(async () => ({ ...deck, cards: deck.cards.slice(0, 3) }), r, { target: "cards" });
assert.equal(badCount.cards.status, "failed");
assert.equal(badCount.cards.engine, "template", "invalid model output cannot claim AI success");
assert.match(badCount.cards.error!, /장수/);
const emptyCard = await generate(async () => ({ ...deck, cards: deck.cards.map((c, i) => i === 2 ? { ...c, body: "" } : c) }), r, { target: "cards" });
assert.equal(emptyCard.cards.status, "failed");
const failedRetry = await generate(async () => { throw new Error("서버 오류"); }, r, { target: "cards", previous: repaired });
assert.strictEqual(failedRetry.deck, repaired.deck, "a failed regeneration retains the previous cards");
assert.strictEqual(failedRetry.blog, repaired.blog, "card retry retains the blog");
assert.equal(failedRetry.cards.engine, "groq");
await assert.rejects(generate(async () => deck, { ...r, items: [] }), /바탕 소식/);

const daily = await writeAll(async (messages) => {
  if (messages[0].content.includes("카드뉴스")) return deck;
  throw new Error("블로그 응답 실패");
}, r);
assert.deepEqual(daily.deck, cardOnly.deck);
assert.equal(daily.blogState.status, "failed");
assert.match(daily.notes[0], /카드 결과는 보존/);
console.log("GENERATE OK: card-only, partial success, retry isolation, validation, daily preservation");
