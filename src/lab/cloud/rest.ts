// Supabase(PostgREST)에 lab_items를 읽고 쓰는 얇은 도우미. 브라우저(로그인 토큰)와 자동 회의 스크립트(서비스 키)가 같이 써요.

export type Kind = "news" | "draft" | "post" | "meeting" | "setting";
export interface Row {
  kind: Kind;
  id: string;
  data: unknown;
}

export interface Cloud {
  url: string; // https://xxxx.supabase.co
  key: string; // anon 키 또는 서비스 키
  token: () => Promise<string>; // Authorization에 넣을 토큰 (로그인 토큰 또는 서비스 키)
}

const PAGE = 1000;
const CHUNK = 400;

async function call(c: Cloud, path: string, init: RequestInit = {}) {
  const res = await fetch(`${c.url.replace(/\/$/, "")}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: c.key, authorization: `Bearer ${await c.token()}`, "content-type": "application/json", ...(init.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res;
}

/** 전부 (또는 한 종류만) 읽어요. 1000줄씩 나눠 받아요 */
export async function selectRows(c: Cloud, kind?: Kind): Promise<Row[]> {
  const out: Row[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const q = `lab_items?select=kind,id,data&order=kind,id${kind ? `&kind=eq.${kind}` : ""}&limit=${PAGE}&offset=${offset}`;
    const page = (await (await call(c, q)).json()) as Row[];
    out.push(...page);
    if (page.length < PAGE) return out;
  }
}

export async function upsertRows(c: Cloud, rows: Row[]) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const now = new Date().toISOString();
    await call(c, "lab_items?on_conflict=kind,id", {
      method: "POST",
      headers: { prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(rows.slice(i, i + CHUNK).map((r) => ({ ...r, updated_at: now }))),
    });
  }
}

/** PostgREST in.(...) 목록: 쉼표·괄호가 든 링크도 안전하게 큰따옴표로 감싸요 */
export const inList = (ids: string[]) => `(${ids.map((id) => `"${id.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(",")})`;

export async function deleteRows(c: Cloud, kind: Kind, ids: string[]) {
  for (let i = 0; i < ids.length; i += 100) {
    await call(c, `lab_items?kind=eq.${kind}&id=in.${encodeURIComponent(inList(ids.slice(i, i + 100)))}`, { method: "DELETE" });
  }
}

/** 지금 로그인한 사람이 연구소 주인인지 */
export async function isOwner(c: Cloud): Promise<boolean> {
  const res = await call(c, "rpc/is_lab_owner", { method: "POST", body: "{}" });
  return (await res.json()) === true;
}
