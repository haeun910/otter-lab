// 가짜 Supabase(PostgREST 일부) + 가짜 RSS·Groq·텔레그램
export const db = new Map<string, { kind: string; id: string; data: unknown }>();
export const sent: string[] = [];
export const discord: { title: string; description: string; url?: string }[] = [];
export const fail = { telegram: false };
export const calls: string[] = [];
export let groqCalls = 0;
export const feedTime = { t: Date.now() };

const rss = (prefix: string, n: number) => `<rss><channel>${Array.from({ length: n }, (_, i) => `<item><title>${prefix} AI 소식 ${i}</title><link>https://ex.com/${prefix}/${i}?a=1,2</link><pubDate>${new Date(feedTime.t - i * 3600_000).toUTCString()}</pubDate><description>${prefix}의 ${i}번째 에이전트 소식이에요. 두 번째 문장이에요.</description></item>`).join("")}</channel></rss>`;

export function install() {
  globalThis.fetch = (async (input: string | URL, init: RequestInit = {}) => {
    const url = String(input);
    const method = init.method ?? "GET";
    calls.push(`${method} ${url}`);
    const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
    if (url.includes("/rest/v1/")) {
      const auth = (init.headers as Record<string, string>).authorization;
      if (!auth?.startsWith("Bearer ")) return json({ message: "no auth" }, 401);
      const u = new URL(url);
      if (u.pathname.endsWith("/rpc/is_lab_owner")) return json(auth === "Bearer owner-token" || auth === "Bearer service");
      if (method === "GET") {
        const kind = u.searchParams.get("kind")?.replace("eq.", "");
        const limit = +u.searchParams.get("limit")!;
        const offset = +u.searchParams.get("offset")!;
        const rows = [...db.values()].filter((r) => !kind || r.kind === kind).sort((a, b) => (a.kind + a.id < b.kind + b.id ? -1 : 1));
        return json(rows.slice(offset, offset + limit));
      }
      if (method === "POST") {
        for (const r of JSON.parse(String(init.body))) db.set(`${r.kind}|${r.id}`, { kind: r.kind, id: r.id, data: r.data });
        return new Response(null, { status: 201 });
      }
      if (method === "DELETE") {
        const kind = u.searchParams.get("kind")!.replace("eq.", "");
        const list = u.searchParams.get("id")!.replace(/^in\.\(/, "").replace(/\)$/, "");
        const ids = [...list.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1].replace(/\\(.)/g, "$1"));
        for (const id of ids) db.delete(`${kind}|${id}`);
        return new Response(null, { status: 204 });
      }
    }
    if (url.includes("api.groq.com")) {
      groqCalls++;
      const body = JSON.parse(String(init.body));
      const cards = body.messages[0].content.includes("카드뉴스");
      const content = cards
        ? JSON.stringify({ cards: [{ kind: "cover", title: "Groq 표지", body: "부제" }, { kind: "body", tag: "t", title: "본문", body: "줄" }, { kind: "outro", title: "정리", body: "- a" }], caption: "캡션", hashtags: ["AI"] })
        : JSON.stringify({ title: "Groq 블로그", intro: "i", sections: [{ heading: "h", body: "b" }], outro: "o", tags: ["AI"] });
      return json({ choices: [{ message: { content } }] });
    }
    if (url.startsWith("https://discord.com/api/webhooks/")) {
      if (!url.includes("wait=true")) return json({ message: "need wait" }, 400);
      discord.push(JSON.parse(String(init.body)).embeds[0]);
      return json({ id: "1" });
    }
    if (url.includes("api.telegram.org")) {
      if (fail.telegram) return json({ ok: false, description: "chat not found" }, 400);
      sent.push(JSON.parse(String(init.body)).text);
      return json({ ok: true });
    }
    if (url.includes("aitimes")) return new Response(rss("aitimes", 6));
    if (url.includes("hada.io")) return new Response(rss("geek", 5));
    return new Response("blocked", { status: 503 });
  }) as typeof fetch;
}
