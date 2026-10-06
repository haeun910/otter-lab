// 소식 분야 나누기·출처 읽기·회의 추천 비율 시험 (네트워크 없이)
import assert from "node:assert/strict";
import { quotas, recommend } from "../src/lab/agenda";
import type { NewsItem } from "../src/lab/data/demo";
import { classify, normCategory } from "../src/lab/news/category";
import { refineCategories } from "../src/lab/news/classifyLLM";
import type { Feed } from "../src/lab/news/feeds";
import { FEEDS } from "../src/lab/news/feeds";
import { parseFeedDetailed } from "../src/lab/news/rss";
import { githubSearchUrl, parseGithub, parseHfModels, parseHfPapers } from "../src/lab/news/sources";

// ---- 분야 규칙 ----
assert.equal(classify("Some title", "", "https://arxiv.org/abs/2410.00001").category, "Paper");
assert.equal(classify("Show HN: I built a tiny editor", "", "https://example.com").category, "Tools");
assert.equal(classify("Show GN: 할 일 앱을 만들었어요", "", "https://x.kr").category, "Tools");
assert.equal(classify("새 라이브러리 공개", "", "https://github.com/a/b").category, "Dev");
assert.equal(classify("오픈소스 데이터베이스 v2.0 릴리스", "", "https://blog.example").category, "Dev");
assert.equal(classify("OpenAI, 새 추론 모델 공개", "", "https://news.example").category, "AI");
assert.equal(classify("삼성전자 3분기 실적 발표", "", "https://news.example", "Tech").category, "Tech");
assert.equal(classify("A new paper on sparse attention", "", "https://blog.example").category, "Paper");
assert.equal(classify("x", "", "https://arxiv.org/abs/1").sure, true);
assert.equal(normCategory("개발"), "Dev");
assert.equal(normCategory("업계"), "Tech");
assert.equal(normCategory("Paper"), "Paper");
assert.equal(normCategory(undefined), "Tech");

// 섞인 피드: 규칙으로 가르고, 애매한 건 따로 알려 줘요
const mixed: Feed = { source: "섞인 피드", url: "https://x", region: "해외", category: "mixed", fallback: "Tech" };
const xml = `<rss><channel>
<item><title>Show HN: Pocket notes</title><link>https://pocket.example</link><pubDate>${new Date().toUTCString()}</pubDate></item>
<item><title>Sparse attention trick</title><link>https://arxiv.org/abs/2410.1</link></item>
<item><title>빅테크 클라우드 매출 경쟁</title><link>https://news.example/1</link><description>클라우드 시장</description></item>
</channel></rss>`;
const parsed = parseFeedDetailed(xml, mixed);
assert.deepEqual(
  parsed.items.map((n) => n.category),
  ["Tools", "Paper", "Tech"],
);
assert.deepEqual(parsed.unsure, ["https://news.example/1"]);

// ---- 출처 목록 ----
const cats = new Set(FEEDS.map((f) => (f.category === "mixed" ? f.fallback : f.category)));
for (const c of ["AI", "Tech", "Dev", "Paper", "Tools"]) assert.ok(cats.has(c as never), `${c} 출처가 있어야 해요`);
assert.ok(FEEDS.some((f) => f.region === "국내") && FEEDS.some((f) => f.region === "해외"));
assert.equal(new Set(FEEDS.map((f) => f.source)).size, FEEDS.length, "출처 이름은 겹치지 않게");

// ---- JSON 출처 ----
const hfFeed = FEEDS.find((f) => f.kind === "hf-papers")!;
const papers = parseHfPapers(
  [
    {
      paper: { id: "2410.00002", title: "B", summary: "요약 B", upvotes: 3, authors: [{ name: "Kim" }] },
      publishedAt: "2026-10-05T00:00:00Z",
      title: "Paper B",
    },
    { paper: { id: "2410.00001", summary: "요약 A", upvotes: 40 }, title: "Paper A" },
    { nonsense: true },
  ],
  hfFeed,
);
assert.deepEqual(
  papers.map((p) => [p.title, p.link, p.category, p.score]),
  [
    ["Paper A", "https://huggingface.co/papers/2410.00001", "Paper", 40],
    ["Paper B", "https://huggingface.co/papers/2410.00002", "Paper", 3],
  ],
);
assert.match(papers[1].excerpt, /^Kim\. 요약 B/);

const models = parseHfModels(
  [{ id: "org/model-7b", likes: 1200, downloads: 50000, pipeline_tag: "text-generation", createdAt: "2026-09-30T00:00:00Z" }],
  FEEDS.find((f) => f.kind === "hf-models")!,
);
assert.equal(models[0].link, "https://huggingface.co/org/model-7b");
assert.match(models[0].excerpt, /글 생성 모델 · 좋아요 1,200 · 내려받기 50,000/);

const repos = parseGithub(
  {
    items: [
      {
        full_name: "me/tool",
        html_url: "https://github.com/me/tool",
        description: "Fast thing",
        stargazers_count: 812,
        language: "Rust",
        created_at: "2026-10-01T00:00:00Z",
      },
      { full_name: "bad", html_url: "javascript:x" },
    ],
  },
  FEEDS.find((f) => f.kind === "github")!,
);
assert.equal(repos.length, 1);
assert.equal(repos[0].title, "me/tool: Fast thing");
assert.match(repos[0].excerpt, /별 812 · Rust/);
assert.match(
  githubSearchUrl("https://api.github.com/search/repositories", 8, Date.parse("2026-10-06T00:00:00Z")),
  /q=created%3A%3E2026-09-29&sort=stars&order=desc&per_page=8$/,
);

// ---- 분야 비율 ----
assert.deepEqual(quotas(5), { AI: 1, Tech: 1, Dev: 1, Paper: 1, Tools: 1 });
assert.deepEqual(quotas(3, { AI: 2, Tech: 0, Dev: 1, Paper: 1, Tools: 0 }), { AI: 1, Tech: 0, Dev: 1, Paper: 1, Tools: 0 });
assert.deepEqual(quotas(4, { AI: 2, Tech: 0, Dev: 1, Paper: 1, Tools: 0 }), { AI: 2, Tech: 0, Dev: 1, Paper: 1, Tools: 0 });
assert.deepEqual(quotas(6, { AI: 0, Tech: 0, Dev: 0, Paper: 0, Tools: 0 }), { AI: 2, Tech: 1, Dev: 1, Paper: 1, Tools: 1 });
assert.equal(
  Object.values(quotas(4, { AI: 3, Tech: 1, Dev: 1, Paper: 1, Tools: 1 })).reduce((a, b) => a + b, 0),
  4,
);

// ---- 회의 추천: 분야를 고르게, 국내·해외 반반, 한 매체 2개까지 ----
const now = Date.now();
let k = 0;
const mk = (category: NewsItem["category"], region: NewsItem["region"], source: string, extra: Partial<NewsItem> = {}): NewsItem => ({
  title: `${category} ${region} ${k}`,
  link: `https://n.example/${k++}`,
  source,
  region,
  category,
  publishedAt: now - k * 60_000,
  excerpt: "요약 ".repeat(30),
  ...extra,
});
const lib: NewsItem[] = [
  ...Array.from({ length: 6 }, () => mk("AI", "해외", "AI해외")),
  ...Array.from({ length: 3 }, () => mk("AI", "국내", "AI국내")),
  ...Array.from({ length: 3 }, () => mk("Tech", "국내", "테크국내")),
  ...Array.from({ length: 3 }, () => mk("Dev", "해외", "데브해외")),
  ...Array.from({ length: 3 }, (_, i) => mk("Paper", "해외", "HF Daily Papers", { score: [5, 90, 20][i] })),
  ...Array.from({ length: 2 }, () => mk("Tools", "해외", "Product Hunt")),
];
const picks = recommend(
  lib,
  lib.map((n) => n.link),
  [],
  5,
);
const chosen = picks.bundle.map((l) => lib.find((n) => n.link === l)!);
assert.deepEqual(
  chosen.map((n) => n.category),
  ["AI", "Tech", "Dev", "Paper", "Tools"],
);
// AI는 국내를 먼저 (지금까지 국내가 덜 뽑혔으니까)
const region = chosen.reduce((a, n) => ({ ...a, [n.region]: (a[n.region] ?? 0) + 1 }), {} as Record<string, number>);
assert.ok(region["국내"] >= 2, JSON.stringify(region));
// 논문은 추천 수가 많은 것부터: 가장 인기 있는 논문은 심층으로, 그다음 논문이 묶음으로
assert.equal(lib.find((n) => n.link === picks.deep)!.score, 90);
assert.equal(chosen[3].score, 20);
assert.ok(picks.deep && !picks.bundle.includes(picks.deep));
assert.notEqual(lib.find((n) => n.link === picks.deep)!.category, "Tools");
// 후보는 분야 순서로, 다섯 분야가 다 있어요
assert.deepEqual([...new Set(picks.candidates.map((n) => n.category))], ["AI", "Tech", "Dev", "Paper", "Tools"]);
// 비율을 바꾸면 그만큼
const ai3 = recommend(
  lib,
  lib.map((n) => n.link),
  [],
  4,
  { AI: 3, Tech: 0, Dev: 1, Paper: 0, Tools: 0 },
);
assert.deepEqual(
  ai3.bundle.map((l) => lib.find((n) => n.link === l)!.category),
  ["AI", "AI", "AI", "Dev"],
);

// ---- AI에게 다시 묻기 ----
const items = [mk("Tech", "국내", "s1"), mk("Tech", "국내", "s2"), mk("AI", "해외", "s3")];
const refined = await refineCategories(items, [items[0].link, items[1].link], async (msgs) => {
  assert.match(msgs[1].content, /2개 소식/);
  return { c: ["AI", "엉뚱한값"] };
});
assert.equal(refined.changed, 1);
assert.deepEqual(
  refined.items.map((n) => n.category),
  ["AI", "Tech", "AI"],
);

console.log("NEWS OK");
