// 소식 출처 점검: 출처마다 실제로 받아지는지, 몇 개가 어느 분야로 들어오는지 보여 줘요.
// npm run feeds:check  (GitHub Actions의 "소식 출처 점검"에서도 돌려요)
import { CATEGORIES } from "../src/lab/news/category";
import { FEEDS } from "../src/lab/news/feeds";
import { collectNews } from "../src/lab/news/rss";

async function main() {
  const rows: string[] = [];
  let ok = 0;
  for (const f of FEEDS) {
    // 하나씩 받아서 어느 출처가 문제인지 바로 보이게 (점검이라 최근 7일까지 봐요)
    const res = await collectNews([f], { maxAgeHours: 24 * 7, timeoutMs: 15000 });
    const n = res.items.length;
    if (n) ok++;
    const cats = CATEGORIES.map((c) => [c, res.items.filter((x) => x.category === c).length] as const)
      .filter(([, k]) => k)
      .map(([c, k]) => `${c} ${k}`)
      .join(", ");
    const status = res.failed.length ? "실패" : n ? "OK" : "비어 있음";
    rows.push(
      `${status.padEnd(5)} ${f.source} (${f.region}, ${f.kind ?? "rss"}) → ${n}개${cats ? ` [${cats}]` : ""}${res.unsure.length ? `, 애매 ${res.unsure.length}` : ""}`,
    );
    if (n) rows.push(`        예: ${res.items[0].title.slice(0, 90)}`);
  }
  console.log(rows.join("\n"));

  // 실제 회의처럼 한꺼번에 (최근 48시간)
  const all = await collectNews(FEEDS);
  const per = CATEGORIES.map((c) => `${c} ${all.items.filter((n) => n.category === c).length}`).join(" · ");
  const region = ["국내", "해외"].map((r) => `${r} ${all.items.filter((n) => n.region === r).length}`).join(" · ");
  console.log(
    `\n출처 ${FEEDS.length}곳 중 ${ok}곳에서 받았어요. 최근 48시간 소식 ${all.items.length}개: ${per} / ${region}. 애매해서 AI에게 물어볼 소식 ${all.unsure.length}개.`,
  );
  if (all.failed.length) console.log(`못 받은 곳: ${all.failed.join(", ")}`);
}

void main();
