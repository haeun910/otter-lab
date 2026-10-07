// 로그인한 브라우저와 Supabase 사이 동기화 (처음 올리기, 바뀐 것만 올리기, 지우기, 자동 회의 결과 받기)
import assert from "node:assert/strict";
const listeners: Record<string, () => void> = {};
(globalThis as any).document = { visibilityState: "visible", addEventListener: (k: string, f: () => void) => (listeners[k] = f), removeEventListener: () => {} };
const mem = new Map<string, string>();
(globalThis as any).localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, v), removeItem: (k: string) => mem.delete(k) };
const { db, install } = await import("./fake.ts");
install();
const { useLab } = await import("../src/lab/store");
const { startSync, flush, pull, stopSync } = await import("../src/lab/cloud/sync");
const { fromRows } = await import("../src/lab/cloud/mapping");
const cloud = { url: "https://x.supabase.co", key: "sb_publishable_test", token: async () => "owner-token" };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 1) 빈 클라우드에 처음 연결 → 이 브라우저 데이터를 올려요
useLab.getState().setBrand({ ...useLab.getState().brand, handle: "@local" });
await startSync(cloud);
const kinds = [...db.values()].reduce((m, r) => ((m[r.kind] = (m[r.kind] ?? 0) + 1), m), {} as Record<string, number>);
console.log("first upload:", kinds);
assert.equal(kinds.draft, 2);
assert.equal(kinds.news, 40);
assert.equal(useLab.getState().cloud, "saved");

// 2) 고치면 바뀐 것만 올려요
const before = (await import("./fake.ts")).calls.length;
useLab.getState().editCard("sample-bundle", 0, { title: "고친 표지" });
await wait(1400);
await flush();
const posts = (await import("./fake.ts")).calls.slice(before).filter((c) => c.startsWith("POST"));
assert.equal(posts.length, 1);
assert.equal((db.get("draft|sample-bundle")!.data as any).deck.cards[0].title, "고친 표지");

// 3) 지우기도 반영
useLab.getState().removeDraft("sample-deep");
await wait(1400);
await flush();
assert.ok(!db.has("draft|sample-deep"));

// 4) 자동 회의가 클라우드에 초안을 넣으면 pull로 받아요
db.set("draft|auto1", { kind: "draft", id: "auto1", data: { ...(db.get("draft|sample-bundle")!.data as object), id: "auto1", createdAt: Date.now() + 1000 } });
db.set("meeting|m1", { kind: "meeting", id: "m1", data: { id: "m1", day: "2026-10-06", at: Date.now(), notes: ["자동 회의"], drafts: ["auto1"] } });
listeners.visibilitychange();
await wait(50);
await pull();
assert.equal(useLab.getState().drafts[0].id, "auto1");
assert.equal(useLab.getState().meetings.length, 1);
assert.equal(useLab.getState().brand.handle, "@local");

// 5) 다시 시작하면 클라우드 것을 불러와요 (이 브라우저 것을 덮지 않고)
stopSync();
useLab.getState().resetData();
await startSync(cloud);
assert.equal(useLab.getState().drafts.length, 2);
assert.equal(useLab.getState().brand.handle, "@local");
assert.deepEqual(fromRows([...db.values()] as never).drafts!.map((d) => d.id).sort(), ["auto1", "sample-bundle"]);
stopSync();
const { newTopicProject } = await import("../src/lab/research/types");
await startSync(cloud);
const project = newTopicProject([useLab.getState().library[0]]);
useLab.getState().addProject(project);
await flush();
assert.equal((db.get("setting|projects")!.data as {value:unknown[]}).value.length,1);
useLab.getState().patchProject(project.id,{topic:{title:"주제",focus:"범위",questions:["질문"],seedLinks:[project.seeds[0].link]},stage:"research"});
await flush();
assert.equal((db.get("setting|projects")!.data as {value:any[]}).value[0].stage,"research");
stopSync();
console.log("SYNC OK: topic projects persist through cloud mapping and updates");
process.exit(0);
