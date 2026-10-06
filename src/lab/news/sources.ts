// RSS가 아닌 소식 출처: Hugging Face 오늘의 논문·인기 모델, GitHub 인기 저장소.
// 응답 모양이 조금 바뀌어도 버티도록, 필요한 칸만 조심해서 꺼내요.
import type { NewsItem } from "../data/demo";
import type { Category } from "./category";
import type { Feed } from "./feeds";
import { excerptOf } from "./rss";

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" ? (v as Obj) : {});
const str = (v: unknown) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const time = (v: unknown, d: number) => {
  const t = typeof v === "string" ? Date.parse(v) : NaN;
  return Number.isFinite(t) ? t : d;
};
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : Array.isArray(obj(v).items) ? (obj(v).items as unknown[]) : []);

function item(feed: Feed, category: Category, x: Omit<NewsItem, "source" | "region" | "category">): NewsItem {
  return { ...x, source: feed.source, region: feed.region, category };
}

/** Hugging Face 오늘의 논문: 사람들이 추천(upvote)한 논문 */
export function parseHfPapers(json: unknown, feed: Feed, now = Date.now()): NewsItem[] {
  const out: NewsItem[] = [];
  for (const raw of list(json)) {
    const r = obj(raw);
    const p = obj(r.paper);
    const id = str(p.id) || str(r.id);
    const title = str(r.title) || str(p.title);
    if (!id || !title) continue;
    const authors = Array.isArray(p.authors) ? (p.authors as unknown[]).map((a) => str(obj(a).name)).filter(Boolean) : [];
    const summary = str(p.summary) || str(r.summary);
    const who = authors.length ? `${authors.slice(0, 3).join(", ")}${authors.length > 3 ? " 외" : ""}. ` : "";
    out.push(
      item(feed, "Paper", {
        title,
        link: `https://huggingface.co/papers/${id}`,
        publishedAt: time(r.publishedAt, time(p.publishedAt, now)),
        excerpt: excerptOf(`${who}${summary}`, 280),
        score: num(p.upvotes) || num(r.upvotes),
      }),
    );
  }
  return out.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

const TASKS: Record<string, string> = {
  "text-generation": "글 생성",
  "image-text-to-text": "이미지+글 이해",
  "text-to-image": "그림 생성",
  "image-to-image": "그림 변환",
  "text-to-video": "영상 생성",
  "image-to-video": "영상 생성",
  "text-to-speech": "음성 합성",
  "automatic-speech-recognition": "음성 인식",
  "feature-extraction": "임베딩",
  "sentence-similarity": "문장 유사도",
  "any-to-any": "멀티모달",
  translation: "번역",
};

/** Hugging Face 인기 모델: 지금 많이 내려받고 좋아요를 받는 모델 */
export function parseHfModels(json: unknown, feed: Feed, now = Date.now()): NewsItem[] {
  const out: NewsItem[] = [];
  for (const raw of list(json)) {
    const r = obj(raw);
    const id = str(r.id) || str(r.modelId);
    if (!id) continue;
    const task = str(r.pipeline_tag);
    const likes = num(r.likes);
    const downloads = num(r.downloads);
    const facts = [
      task ? `${TASKS[task] ?? task} 모델` : "모델",
      `좋아요 ${likes.toLocaleString("en-US")}`,
      downloads ? `내려받기 ${downloads.toLocaleString("en-US")}` : "",
    ].filter(Boolean);
    out.push(
      item(feed, "Dev", {
        title: `Hugging Face 인기 모델: ${id}`,
        link: `https://huggingface.co/${id}`,
        // 지금 인기 있는 모델이라 받은 시각을 써요 (만든 날짜는 요약에)
        publishedAt: now,
        excerpt: excerptOf(`${facts.join(" · ")}${r.createdAt ? ` · 공개 ${str(r.createdAt).slice(0, 10)}` : ""}`, 200),
        score: likes,
      }),
    );
  }
  return out;
}

/** GitHub 인기 저장소: 최근 일주일 사이 만들어져 별을 많이 받은 저장소 */
export function parseGithub(json: unknown, feed: Feed, now = Date.now()): NewsItem[] {
  const out: NewsItem[] = [];
  for (const raw of list(json)) {
    const r = obj(raw);
    const name = str(r.full_name);
    const link = str(r.html_url);
    if (!name || !/^https:\/\/github\.com\//.test(link)) continue;
    const stars = num(r.stargazers_count);
    const desc = str(r.description);
    const lang = str(r.language);
    out.push(
      item(feed, "Dev", {
        title: desc ? `${name}: ${excerptOf(desc, 80)}` : name,
        link,
        publishedAt: now,
        excerpt: excerptOf(
          `${desc}${desc ? " " : ""}(별 ${stars.toLocaleString("en-US")}${lang ? ` · ${lang}` : ""} · 만든 날 ${str(r.created_at).slice(0, 10)})`,
          240,
        ),
        score: stars,
      }),
    );
  }
  return out;
}

/** GitHub 검색 주소: 최근 7일 안에 만든 저장소를 별 많은 순으로 */
export function githubSearchUrl(base: string, perPage: number, now = Date.now()) {
  const since = new Date(now - 7 * 86400_000).toISOString().slice(0, 10);
  return `${base}?q=${encodeURIComponent(`created:>${since}`)}&sort=stars&order=desc&per_page=${perPage}`;
}
