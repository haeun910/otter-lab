"use client";
import { useEffect, useState } from "react";
import { GOOGLE_LOGIN, cloudConfigured, configProblem, connectionInfo } from "../cloud/config";
import { sendLoginLink, signInWithGoogle, signInWithPassword, signOut, watchSession, type Gate } from "../cloud/session";
import { OtterFace } from "./Hud";

/** Supabase 오류를 무엇을 하면 되는지로 바꿔 말해요 */
function explain(x: unknown): string {
  const m = x instanceof Error ? x.message : String(x);
  if (/Invalid login credentials/i.test(m)) return "이메일이나 비밀번호가 맞지 않아요. 아직 비밀번호를 만들지 않았다면 SETUP.md의 '비밀번호 만들기'를 봐 주세요.";
  if (/Email not confirmed/i.test(m)) return "이메일 확인이 안 된 계정이에요. Supabase에서 사용자를 만들 때 'Auto Confirm User'를 체크해 주세요.";
  if (/Invalid API key/i.test(m)) return "Supabase가 이 키를 모른대요 (Invalid API key). 아래 연결 정보가 Supabase 화면의 주소·publishable 키와 같은지 확인해 주세요.";
  if (/fetch|network|Invalid value/i.test(m)) return `Supabase에 연결하지 못했어요. Vercel의 Supabase 주소·키 값을 확인해 주세요. (${m})`;
  if (/rate|limit|seconds/i.test(m)) return `너무 자주 시도했어요. 잠시 뒤 다시 해 주세요. (${m})`;
  return m;
}

/** 로그인 링크가 실패해서 돌아왔을 때 그 이유를 한국어로 */
export function linkError(part: string): string | null {
  const q = new URLSearchParams(part.replace(/^[#?]/, ""));
  const code = q.get("error_code") ?? q.get("error");
  if (!code) return null;
  const desc = q.get("error_description")?.replace(/\+/g, " ") ?? code;
  if (/otp_expired|expired|invalid/i.test(code + desc))
    return "이 로그인 링크는 이미 쓰였거나 만료됐어요. 메일 링크는 한 번만 쓸 수 있어요. 아래에서 새 링크를 받아 주세요.";
  return `로그인 링크가 실패했어요: ${desc}`;
}

/** Supabase를 쓰는 배포에서만: 연구소 주인으로 로그인해야 연구소가 열려요 */
export default function LoginGate() {
  const [gate, setGate] = useState<Gate>({
    state: cloudConfigured() ? "checking" : "ready",
    email: "",
  } as Gate);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  const problem = cloudConfigured() ? configProblem() : null;
  useEffect(() => {
    if (!cloudConfigured() || configProblem()) return;
    // 메일 링크가 실패하면 Supabase가 주소 끝(#error=…)에 이유를 붙여 돌려보내요
    const why = linkError(location.hash) ?? linkError(location.search);
    if (why) {
      setErr(why);
      history.replaceState(null, "", location.pathname);
    }
    let off: (() => void) | undefined;
    watchSession(setGate).then((f) => (off = f));
    return () => off?.();
  }, []);

  if (gate.state === "ready") return null;
  return (
    <div className="gate" role="dialog" aria-modal="true" aria-labelledby="gate-title">
      <div className="gate__card">
        <OtterFace size={64} />
        <h1 id="gate-title">Otter Lab</h1>
        {problem ? (
          <>
            <p>연구소 설정값을 확인해 주세요.</p>
            <p className="gate__err">{problem}</p>
            <p className="muted">Vercel → Settings → Environment Variables에서 고친 뒤, Deployments에서 다시 배포해 주세요.</p>
          </>
        ) : (
          <>
            {gate.state === "checking" && <p>연구소 문을 여는 중이에요…</p>}
            {gate.state === "error" && (
              <>
                <p>연구소 데이터에 연결하지 못했어요.</p>
                <p className="muted">{gate.message}</p>
                <button className="btn btn--primary" onClick={() => location.reload()}>
                  다시 시도
                </button>
              </>
            )}
            {gate.state === "notOwner" && (
              <>
                <p>{gate.email} 계정은 이 연구소의 주인으로 등록돼 있지 않아요.</p>
                <p className="muted">Supabase의 lab_owner 표에 등록한 이메일로 로그인해 주세요.</p>
                <button className="btn btn--light" onClick={() => void signOut()}>
                  다른 계정으로 로그인
                </button>
              </>
            )}
            {gate.state === "signedOut" &&
              (sent ? (
                <p>{email}로 로그인 링크를 보냈어요. 메일함에서 링크를 누르면 이 화면이 열려요.</p>
              ) : (
                <form
                  className="gate__form"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setErr("");
                    try {
                      await signInWithPassword(email.trim(), password);
                    } catch (x) {
                      setErr(explain(x));
                    }
                  }}
                >
                  <label className="field">
                    <span>소장님 이메일</span>
                    <input id="gate-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </label>
                  <label className="field">
                    <span>비밀번호</span>
                    <input id="gate-password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                  </label>
                  <button className="btn btn--primary" type="submit">
                    로그인
                  </button>
                  <button
                    className="link-btn"
                    type="button"
                    onClick={async () => {
                      setErr("");
                      if (!email.trim()) return setErr("이메일을 먼저 넣어 주세요.");
                      try {
                        await sendLoginLink(email.trim());
                        setSent(true);
                      } catch (x) {
                        setErr(explain(x));
                      }
                    }}
                  >
                    비밀번호 없이 메일 링크로 로그인
                  </button>
                  {GOOGLE_LOGIN && (
                    <button className="btn btn--light" type="button" onClick={() => void signInWithGoogle().catch((x) => setErr(String(x?.message ?? x)))}>
                      구글로 로그인
                    </button>
                  )}
                  {err && <p className="gate__err">{err}</p>}
                  {err && /Supabase/.test(err) && (
                    <p className="muted gate__info">
                      지금 연결 정보
                      <br />
                      주소: {connectionInfo().url}
                      <br />
                      키: {connectionInfo().key}
                    </p>
                  )}
                </form>
              ))}
          </>
        )}
      </div>
    </div>
  );
}
