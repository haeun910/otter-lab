// 가짜 Supabase·RSS·Groq·텔레그램으로 자동 회의를 처음부터 끝까지 돌려 봐요
import assert from "node:assert/strict";
import { db, sent, discord, fail, install, feedTime } from "./fake.ts";
import { runDaily } from "../scripts/daily.ts";
import { diffRows, fromRows, pickCloud, toRows } from "../src/lab/cloud/mapping";
import { inList } from "../src/lab/cloud/rest";
import { SEED_DRAFTS, SEED_POSTS, NEWS } from "../src/lab/data/demo";

install();
const KST = (h: number, m = 0, d = 6) => Date.UTC(2026, 9, d, h - 9, m);
const env = { supabaseUrl: "https://x.supabase.co", serviceKey: "sb_secret_test", telegramToken: "tok", telegramChat: "42", labUrl: "https://lab.example" };

// 클라우드에 기존 데이터: 예시 초안·게시물·소식, 회의 시간 10:00
for (const r of toRows({ drafts: SEED_DRAFTS, posts: SEED_POSTS, library: NEWS.slice(0, 5), schedule: { meetingAt: "10:00" }, meetings: [] })) db.set(`${r.kind}|${r.id}`, r as never);

feedTime.t = KST(9, 50);
let r = await runDaily(env, KST(9, 7));
assert.equal(r.ran, false);
assert.match(r.reason, /회의 시간\(10:00\) 전/);

// Groq 키 없이 10:07
delete process.env.GROQ_API_KEY;
r = await runDaily(env, KST(10, 7));
assert.equal(r.ran, true);
assert.equal(r.drafts.length, 2);
assert.deepEqual(r.drafts.map((d) => d.type), ["묶음", "심층"]);
assert.ok(r.drafts.every((d) => d.engine === "template"));
const bundleSources = r.drafts[0].sources;
assert.ok(bundleSources.length >= 2 && bundleSources.length <= 5);
assert.ok(!bundleSources.includes(r.drafts[1].sources[0]), "심층 소식은 묶음과 겹치지 않아요");
const data = fromRows([...db.values()] as never);
assert.equal(data.meetings!.length, 1);
assert.equal(data.meetings![0].day, "2026-10-06");
assert.ok(data.meetings![0].notes[0].includes("자동 회의"));
assert.ok(data.meetings![0].notes.some((n) => n.includes("GROQ_API_KEY가 없어서")));
assert.equal(data.drafts!.length, 4);
assert.equal((data.inbox as string[]).length, 11);
assert.ok(data.library!.some((n) => n.link === "https://ex.com/geek/0?a=1,2"));
assert.equal(sent.length, 1);
assert.match(sent[0], /\[오터랩\] 10\/06 오전 10:07 회의 끝/);
assert.match(sent[0], /초안 2개/);
assert.match(sent[0], /검토 대기 4개/);
assert.match(sent[0], /https:\/\/lab.example/);
console.log("---- 텔레그램 메시지 ----\n" + sent[0] + "\n------------------------");

// 같은 날 다시 → 건너뛰기
r = await runDaily(env, KST(11, 7));
assert.equal(r.ran, false);
assert.match(r.reason, /이미/);

// 다음 날, Groq 키 있음 → Groq 초안, 이미 쓴 소식은 다시 안 골라요
process.env.GROQ_API_KEY = "k";
feedTime.t = KST(9, 50, 7);
r = await runDaily(env, KST(10, 7, 7));
assert.equal(r.ran, true);
assert.ok(r.drafts.every((d) => d.engine === "groq"));
const used = new Set(fromRows([...db.values()] as never).drafts!.filter((d) => d.createdAt < KST(10, 0, 7)).flatMap((d) => d.sources));
assert.ok(r.drafts.flatMap((d) => d.sources).every((l) => !used.has(l)), "어제 쓴 소식은 빼요");

// 예전 service_role 키(JWT)도 돼요
r = await runDaily({ ...env, serviceKey: "eyJ-legacy-service", force: true }, KST(9, 0, 7));
assert.equal(r.ran, true);

// FORCE는 시간·중복 상관없이
r = await runDaily({ ...env, force: true }, KST(8, 0, 7));
assert.equal(r.ran, true);

// 디스코드 웹후크: 임베드로 보내요. 텔레그램이 실패해도 디스코드는 가고, 실행은 실패로 알려요
fail.telegram = true;
const before = db.size;
await assert.rejects(
  runDaily({ ...env, discordWebhook: "https://discord.com/api/webhooks/1/abc", force: true }, KST(12, 0, 7)),
  /알림을 못 보냈어요: Telegram 400/,
);
assert.ok(db.size > before, "회의 결과는 저장돼요");
assert.equal(discord.length, 1);
assert.match(discord[0].title, /\[오터랩\] 10\/07 오후 12:00 회의 끝/);
assert.match(discord[0].description, /검토 대기 \d+개/);
assert.equal(discord[0].url, "https://lab.example");
fail.telegram = false;
await runDaily({ supabaseUrl: env.supabaseUrl, serviceKey: env.serviceKey, discordWebhook: "https://discord.com/api/webhooks/1/abc", force: true }, KST(13, 0, 7));
assert.equal(discord.length, 2, "디스코드만 써도 돼요");

// 매핑·비교
const s0 = { library: NEWS.slice(0, 3), drafts: SEED_DRAFTS, posts: SEED_POSTS, meetings: [], brand: { a: 1 }, staff: {}, schedule: { meetingAt: "10:00" }, inbox: ["x"], lastFetch: null };
const s1 = { ...s0, drafts: [{ ...SEED_DRAFTS[0], status: "게시함" as const }], schedule: { meetingAt: "09:30" } };
const dif = diffRows(pickCloud(s0 as never), pickCloud(s1 as never));
assert.deepEqual(dif.upserts.map((u) => `${u.kind}:${u.id}`), ["draft:sample-bundle", "setting:schedule"]);
assert.deepEqual(dif.deletes, [{ kind: "draft", ids: ["sample-deep"] }]);
assert.equal(inList(['a"b', "c,d"]), '("a\\"b","c,d")');
console.log("DAILY OK");
