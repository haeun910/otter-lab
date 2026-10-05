// 브라우저에 공개돼도 되는 Supabase 주소와 publishable 키. 둘 다 없으면 지금처럼 이 브라우저에만 저장해요.
import { cleanKey, cleanUrl } from "./rest";

export const SUPABASE_URL = cleanUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
// 새 이름은 publishable 키, 예전 프로젝트는 anon 키 (둘 중 있는 것)
export const SUPABASE_ANON_KEY = cleanKey(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
export const GOOGLE_LOGIN = process.env.NEXT_PUBLIC_LOGIN_GOOGLE === "1";
export const cloudConfigured = () => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/** Vercel 환경변수에 잘못 들어간 값이 있으면 무엇을 고칠지 알려줘요 */
export function configProblem(): string | null {
  if (!/^https:\/\/[^/\s]+$/.test(SUPABASE_URL)) return "NEXT_PUBLIC_SUPABASE_URL 값이 https://로 시작하는 Supabase 프로젝트 주소가 아니에요.";
  if (!/^[\x21-\x7e]+$/.test(SUPABASE_ANON_KEY)) return "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY 값에 키가 아닌 글자(한글 등)가 섞여 있어요.";
  if (!/^(sb_publishable_|eyJ)/.test(SUPABASE_ANON_KEY))
    return SUPABASE_ANON_KEY.startsWith("sb_secret_")
      ? "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY에 secret 키가 들어가 있어요. 바로 Supabase에서 secret 키를 새로 만들고(예전 것은 삭제), 이 칸에는 sb_publishable_ 키를 넣어 주세요."
      : "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY 값은 sb_publishable_(예전 프로젝트는 eyJ)로 시작해야 해요.";
  return null;
}
