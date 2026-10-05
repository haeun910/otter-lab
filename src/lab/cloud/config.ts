// 브라우저에 공개돼도 되는 Supabase 주소와 anon 키. 둘 다 없으면 지금처럼 이 브라우저에만 저장해요.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
export const GOOGLE_LOGIN = process.env.NEXT_PUBLIC_LOGIN_GOOGLE === "1";
export const cloudConfigured = () => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
