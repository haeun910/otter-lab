// Supabase 로그인. 이메일 로그인 링크(기본)와 구글 로그인(설정했을 때)을 써요.
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { setTokenProvider } from "../gen/client";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";
import { isOwner, type Cloud } from "./rest";
import { startSync, stopSync } from "./sync";

let client: SupabaseClient | null = null;
async function sb() {
  if (!client) {
    const { createClient } = await import("@supabase/supabase-js");
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  }
  return client;
}

const token = async () => (await (await sb()).auth.getSession()).data.session?.access_token ?? "";
const cloud: Cloud = { url: SUPABASE_URL, key: SUPABASE_ANON_KEY, token };

export type Gate = { state: "checking" } | { state: "signedOut" } | { state: "notOwner"; email: string } | { state: "ready"; email: string } | { state: "error"; message: string };

/** 로그인 상태가 바뀔 때마다 알려줘요. 연구소 주인이면 동기화를 시작해요 */
export async function watchSession(onGate: (g: Gate) => void) {
  const s = await sb();
  let started = "";
  const check = async (session: Session | null) => {
    if (!session) {
      started = "";
      stopSync();
      setTokenProvider(null);
      return onGate({ state: "signedOut" });
    }
    const email = session.user.email ?? "";
    if (started === session.user.id) return;
    try {
      if (!(await isOwner(cloud))) return onGate({ state: "notOwner", email });
      started = session.user.id;
      setTokenProvider(async () => (await token()) || null);
      await startSync(cloud);
      onGate({ state: "ready", email });
    } catch (e) {
      onGate({ state: "error", message: e instanceof Error ? e.message : "연결하지 못했어요" });
    }
  };
  await check((await s.auth.getSession()).data.session);
  const { data } = s.auth.onAuthStateChange((_e, session) => void check(session));
  return () => data.subscription.unsubscribe();
}

export async function sendLoginLink(email: string) {
  const { error } = await (await sb()).auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
  if (error) throw error;
}

export async function signInWithGoogle() {
  const { error } = await (await sb()).auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin + location.pathname } });
  if (error) throw error;
}

export async function signOut() {
  await (await sb()).auth.signOut();
}
