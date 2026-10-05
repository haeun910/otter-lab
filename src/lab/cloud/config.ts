// 브라우저에 공개돼도 되는 Supabase 주소와 publishable 키. 둘 다 없으면 지금처럼 이 브라우저에만 저장해요.
import { cleanKey, cleanUrl } from "./rest";

export const SUPABASE_URL = cleanUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
// 새 이름은 publishable 키, 예전 프로젝트는 anon 키 (둘 중 있는 것)
export const SUPABASE_ANON_KEY = cleanKey(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
export const GOOGLE_LOGIN = process.env.NEXT_PUBLIC_LOGIN_GOOGLE === "1";
export const cloudConfigured = () => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/** 화면에 보여 줄 연결 정보 (publishable 키는 공개용이라 앞부분을 보여 줘도 괜찮아요) */
export const connectionInfo = () => ({
  url: SUPABASE_URL,
  key: `${SUPABASE_ANON_KEY.slice(0, SUPABASE_ANON_KEY.startsWith("eyJ") ? 12 : 22)}… (${SUPABASE_ANON_KEY.length}자)`,
});

/** 예전 키(JWT)는 안에 프로젝트 이름과 권한이 적혀 있어요 */
function jwtClaims(key: string): { ref?: string; role?: string } | null {
  try {
    const part = key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(part + "=".repeat((4 - (part.length % 4)) % 4)));
  } catch {
    return null;
  }
}

/** Vercel 환경변수에 잘못 들어간 값이 있으면 무엇을 고칠지 알려줘요 */
export function configProblem(): string | null {
  if (!/^https:\/\/[^/\s]+$/.test(SUPABASE_URL)) return "NEXT_PUBLIC_SUPABASE_URL 값이 https://로 시작하는 Supabase 프로젝트 주소가 아니에요.";
  if (!/^[\x21-\x7e]+$/.test(SUPABASE_ANON_KEY)) return "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY 값에 키가 아닌 글자(한글 등)가 섞여 있어요.";
  if (!/^(sb_publishable_|eyJ)/.test(SUPABASE_ANON_KEY))
    return SUPABASE_ANON_KEY.startsWith("sb_secret_")
      ? "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY에 secret 키가 들어가 있어요. 바로 Supabase에서 secret 키를 새로 만들고(예전 것은 삭제), 이 칸에는 sb_publishable_ 키를 넣어 주세요."
      : "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY 값은 sb_publishable_(예전 프로젝트는 eyJ)로 시작해야 해요.";
  if (SUPABASE_ANON_KEY.startsWith("eyJ")) {
    const c = jwtClaims(SUPABASE_ANON_KEY);
    if (c?.role === "service_role") return "공개용 칸에 service_role(비밀) 키가 들어가 있어요. 바로 anon 키로 바꾸고, Supabase에서 비밀 키를 새로 만들어 주세요.";
    const host = SUPABASE_URL.replace(/^https:\/\//, "").split(".")[0];
    if (c?.ref && host && c.ref !== host) return `키는 '${c.ref}' 프로젝트 것인데 주소는 '${host}' 프로젝트예요. 같은 프로젝트의 주소와 키를 넣어 주세요.`;
  }
  return null;
}
