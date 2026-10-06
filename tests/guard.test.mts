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

// 붙여 넣다 섞인 줄바꿈·공백·따옴표 (화면에 'Failed to execute fetch: Invalid value'가 뜨던 원인)
const { cleanKey, cleanUrl } = await import("../src/lab/cloud/rest");
assert.throws(() => new Headers({ apikey: "sb_publishable_ab\ncd" }));
assert.equal(cleanKey(' "sb_publishable_ab\r\ncd "\n'), "sb_publishable_abcd");
assert.equal(cleanUrl(" https://abc.supabase.co/rest/v1/\n"), "https://abc.supabase.co");
assert.equal(cleanUrl("https://abc.supabase.co/"), "https://abc.supabase.co");
// Connect 창의 여러 줄을 통째로 붙여 넣어도 키·주소만 골라요
const pasted = "NEXT_PUBLIC_SUPABASE_URL=https://abc.supabase.co\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_AbC-12_x\n";
assert.equal(cleanKey(pasted), "sb_publishable_AbC-12_x");
assert.equal(cleanUrl(pasted), "https://abc.supabase.co");
assert.equal(cleanKey("sb_publishable_AbC\nNEXT_PUBLIC_SUPABASE_URL=https://abc.supabase.co"), "sb_publishable_AbC");
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co\n";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test\n";
assert.equal(await guard(req("owner-token")), null, "줄바꿈이 섞여도 통과");
console.log("CLEAN OK");
