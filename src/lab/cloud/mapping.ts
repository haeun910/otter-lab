// 연구소 상태(SavedData) ↔ lab_items 줄. 바뀐 것만 골라 올리는 비교도 여기서 해요.
import type { Draft, Meeting, NewsItem, Post } from "../data/demo";
import type { Kind, Row } from "./rest";

/** 클라우드에 올리는 부분 (담기·보고 있는 초안 같은 화면 상태는 이 기기에만) */
export interface CloudData {
  library: NewsItem[];
  drafts: Draft[];
  posts: Post[];
  meetings: Meeting[];
  brand: unknown;
  staff: unknown;
  schedule: unknown;
  inbox: string[];
  lastFetch: number | null;
}

const SETTINGS = ["brand", "staff", "schedule", "inbox", "lastFetch"] as const;
type Coll = { key: "library" | "drafts" | "posts" | "meetings"; kind: Kind; id: (x: never) => string };
const COLLS: Coll[] = [
  { key: "library", kind: "news", id: (n: NewsItem) => n.link },
  { key: "drafts", kind: "draft", id: (d: Draft) => d.id },
  { key: "posts", kind: "post", id: (p: Post) => p.id },
  { key: "meetings", kind: "meeting", id: (m: Meeting) => m.id },
] as Coll[];

export function toRows(d: Partial<CloudData>): Row[] {
  const rows: Row[] = [];
  for (const c of COLLS) for (const x of (d[c.key] ?? []) as never[]) rows.push({ kind: c.kind, id: c.id(x), data: x });
  for (const k of SETTINGS) if (k in d) rows.push({ kind: "setting", id: k, data: { value: d[k] } });
  return rows;
}

export function fromRows(rows: Row[]): Partial<CloudData> {
  const out: Partial<CloudData> = { library: [], drafts: [], posts: [], meetings: [] };
  for (const r of rows) {
    if (r.kind === "setting") {
      if ((SETTINGS as readonly string[]).includes(r.id)) (out as Record<string, unknown>)[r.id] = (r.data as { value: unknown }).value;
      continue;
    }
    const c = COLLS.find((x) => x.kind === r.kind);
    if (c) (out[c.key] as unknown[]).push(r.data);
  }
  out.library!.sort((a, b) => b.publishedAt - a.publishedAt);
  out.drafts!.sort((a, b) => b.createdAt - a.createdAt);
  out.meetings!.sort((a, b) => b.at - a.at);
  out.posts!.sort((a, b) => a.postedAt - b.postedAt);
  return out;
}

/** 지난번에 올린 상태와 비교해서 바뀐 줄·지울 줄만 (바뀐 항목은 새 객체라 참조로 비교해요) */
export function diffRows(prev: CloudData, next: CloudData): { upserts: Row[]; deletes: { kind: Kind; ids: string[] }[] } {
  const upserts: Row[] = [];
  const deletes: { kind: Kind; ids: string[] }[] = [];
  for (const c of COLLS) {
    const a = prev[c.key] as never[];
    const b = next[c.key] as never[];
    if (a === b) continue;
    const before = new Map(a.map((x) => [c.id(x), x]));
    const now = new Set<string>();
    for (const x of b) {
      const id = c.id(x);
      now.add(id);
      if (before.get(id) !== x) upserts.push({ kind: c.kind, id, data: x });
    }
    const gone = [...before.keys()].filter((id) => !now.has(id));
    if (gone.length) deletes.push({ kind: c.kind, ids: gone });
  }
  for (const k of SETTINGS) if (prev[k] !== next[k]) upserts.push({ kind: "setting", id: k, data: { value: next[k] } });
  return { upserts, deletes };
}

export const pickCloud = (s: CloudData): CloudData => ({
  library: s.library,
  drafts: s.drafts,
  posts: s.posts,
  meetings: s.meetings,
  brand: s.brand,
  staff: s.staff,
  schedule: s.schedule,
  inbox: s.inbox,
  lastFetch: s.lastFetch,
});
