// 서버 API 문지기: 주인만 통과
import assert from "node:assert/strict";
const { install } = await import("./fake.ts");
install();
const { guard } = await import("../src/lab/cloud/guard");
const req = (t?: string) => new Request("http://x/api/news", { headers: t ? { authorization: `Bearer ${t}` } : {} });
assert.equal(await guard(req("owner-token")), null, "설정 없으면 통과");
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
assert.equal((await guard(req()))!.status, 401);
assert.equal((await guard(req("stranger")))!.status, 403);
assert.equal(await guard(req("owner-token")), null);
console.log("GUARD OK");
