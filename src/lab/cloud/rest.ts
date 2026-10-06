// Supabase(PostgREST)에 lab_items를 읽고 쓰는 얇은 도우미. 브라우저(로그인 토큰)와 자동 회의 스크립트(secret 키)가 같이 써요.

export type Kind = "news" | "draft" | "post" | "meeting" | "setting";
export interface Row {
  kind: Kind;
  id: string;
  data: unknown;
}

export interface Cloud {
  url: string; // https://xxxx.supabase.co
  key: string; // publishable 키(브라우저) 또는 secret 키(자동 회의). 예전 이름은 anon / service_role
  token: () => Promise<string>; // 로그인한 사람의 토큰 (자동 회의는 빈 값)
}

/**
 * 새 키(sb_publishable_·sb_secret_)는 apikey 헤더에만 넣어야 해요 (Bearer로 보내면 401).
 * 예전 키(eyJ로 시작하는 JWT)는 둘 다 넣어야 해요. 로그인한 사람의 토큰은 언제나 Bearer로.
 */
export async function headersFor(c: Cloud): Promise<Record<string, string>> {
  const t = await c.token();
  const bearer = t || (c.key.startsWith("eyJ") ? c.key : "");
  return { apikey: c.key, ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) };
}

/**
 * 붙여 넣은 값에서 키만 골라내요. 여러 줄(예: "NEXT_PUBLIC_...=값" 묶음)을 통째로 붙여 넣었거나
 * 공백·따옴표가 섞여도, sb_publishable_ / sb_secret_ / eyJ 로 시작하는 조각을 찾아 써요.
 */
export function cleanKey(v: string | undefined): string {
  const parts = (v ?? "").split(/[\s"'`=,;]+/).filter(Boolean);
  const i = parts.findIndex((p) => /^(sb_publishable_|sb_secret_|eyJ)/.test(p));
  if (i < 0) return parts.join("");
  // 키가 여러 줄로 끊겨 들어왔으면 이어 붙이고, 다른 설정 이름(NEXT_PUBLIC_… 등)이나 주소가 나오면 멈춰요
  let key = parts[i];
  for (const p of parts.slice(i + 1)) {
    if (!/^[A-Za-z0-9_.-]+$/.test(p) || /^(NEXT_PUBLIC|SUPABASE|GROQ|DISCORD|TELEGRAM|LAB_URL|sb_|eyJ)/.test(p)) break;
    key += p;
  }
  return key;
}
/** 주소도 https://로 시작하는 조각만, 끝의 / 나 /rest/v1 같은 꼬리는 떼요 */
export function cleanUrl(v: string | undefined): string {
  const parts = (v ?? "").split(/[\s"'`=,;]+/).filter(Boolean);
  return (parts.find((p) => /^https?:\/\//.test(p)) ?? parts.join("")).replace(/\/(rest\/v1|auth\/v1)?\/?$/, "");
}

const PAGE = 1000;
const CHUNK = 400;

async function call(c: Cloud, path: string, init: RequestInit = {}) {
  const res = await fetch(`${c.url.replace(/\/$/, "")}/rest/v1/${path}`, {
    ...init,
    headers: { ...(await headersFor(c)), "content-type": "application/json", ...(init.headers ?? {}) },
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
