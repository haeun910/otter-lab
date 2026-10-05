"use client";
import { useEffect, useState } from "react";
import { GOOGLE_LOGIN, cloudConfigured, configProblem, connectionInfo } from "../cloud/config";
import { sendLoginLink, signInWithGoogle, signOut, watchSession, type Gate } from "../cloud/session";
import { OtterFace } from "./Hud";

/** Supabase를 쓰는 배포에서만: 연구소 주인으로 로그인해야 연구소가 열려요 */
export default function LoginGate() {
  const [gate, setGate] = useState<Gate>({
    state: cloudConfigured() ? "checking" : "ready",
    email: "",
  } as Gate);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");

  const problem = cloudConfigured() ? configProblem() : null;
  useEffect(() => {
    if (!cloudConfigured() || configProblem()) return;
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
                      await sendLoginLink(email.trim());
                      setSent(true);
                    } catch (x) {
                      const m = x instanceof Error ? x.message : String(x);
                      setErr(
                        /Invalid API key/i.test(m)
                          ? `Supabase가 이 키를 모른대요 (Invalid API key). 아래 연결 정보가 Supabase 화면의 주소·publishable 키와 같은지 확인해 주세요.`
                          : /fetch|network|Invalid value/i.test(m)
                            ? `Supabase에 연결하지 못했어요. Vercel의 Supabase 주소·키 값을 확인해 주세요. (${m})`
                            : /rate|limit|seconds/i.test(m)
                              ? `메일을 너무 자주 보냈어요. 잠시 뒤 다시 해 주세요. (${m})`
                              : m,
                      );
                    }
                  }}
                >
                  <label className="field">
                    <span>소장님 이메일</span>
                    <input id="gate-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </label>
                  <button className="btn btn--primary" type="submit">
                    로그인 링크 받기
                  </button>
                  {GOOGLE_LOGIN && (
                    <button className="btn btn--light" type="button" onClick={() => void signInWithGoogle().catch((x) => setErr(String(x?.message ?? x)))}>
                      구글로 로그인
                    </button>
                  )}
                  {err && <p className="gate__err">{err}</p>}
                  {err && (
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
