import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { loginUser, sendVerificationMail } from "../api/user.api";
import { login, setVerified } from "../store/slice/authSlice";
import { clearPendingAuth, getPendingAuth } from "../utils/pendingAuth";

export default function EmailVerificationPage() {
  const auth = useSelector((state) => state.auth);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // The register flow already has a redux user (unverified); the login flow
  // (AUTH_EMAIL_NOT_VERIFIED) never got that far, so fall back to whatever
  // email we stashed in pendingAuth before redirecting here.
  const email = auth.user?.email ?? getPendingAuth()?.email ?? null;

  const [sessionToken, setSessionToken] = useState(
    () => getPendingAuth()?.sessionToken ?? null,
  );
  const [resent, setResent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  console.log(sessionToken)
  console.log(email)

  // If someone lands here already verified (e.g. navigated back), skip ahead.
  useEffect(() => {
    if (auth.user?.isVerified) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [navigate, auth.user]);

  // No email at all means there's nothing to verify (e.g. a hard refresh
  // wiped both redux state and in-memory pendingAuth) - send them back.
  useEffect(() => {
    if (!auth.user && !email) {
      navigate({ to: "/auth", replace: true });
    }
  }, [auth.user, email, navigate]);

  // If we land here without a sessionToken (memory got cleared, or this page
  // was opened directly), request a fresh one so the SSE stream has
  // something to connect with.
  useEffect(() => {
    if (sessionToken || !email) return;
    console.log("REtrying")
    let cancelled = false;
    (async () => {
      try {
        const res = await sendVerificationMail(email);
        if (!cancelled && res.success) {
          setSessionToken(res.data?.token ?? null);
        }
      } catch {
        // Swallow here - the "Resend email" button gives them another shot,
        // and the SSE effect below just won't run without a token.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [email, sessionToken]);

  const handleResend = async () => {
    if (!email) return;
    setLoading(true);
    try {
      const res = await sendVerificationMail(email);
      if (res.success) {
        setSessionToken(res.data?.token ?? null);
        setResent(true);
        setTimeout(() => setResent(false), 10000);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!sessionToken) return;

    const es = new EventSource(
      `${import.meta.env.VITE_API_URL}api/auth/verify-status?token=${sessionToken}`,
      { withCredentials: true },
    );

    es.addEventListener("verified", async (e) => {
      const data = JSON.parse(e.data);
      if (!data.success) return;

      es.close();
      dispatch(setVerified());

      // Auto-login: if we have credentials waiting from register/login,
      // use them now so the person lands straight in the dashboard instead
      // of having to sign in again.
      const pending = getPendingAuth();
      if (pending?.email && pending?.password) {
        try {
          const user = await loginUser(pending.email, pending.password);
          dispatch(login({ user }));
        } catch {
          // Verification itself succeeded; if the follow-up login call
          // fails for some reason, just fall through to /auth so they can
          // sign in manually rather than getting stuck here.
          clearPendingAuth();
          navigate({ to: "/auth" });
          return;
        }
      }

      clearPendingAuth();
      navigate({ to: "/dashboard" });
    });

    es.onerror = () => {
      console.warn("SSE connection lost, retrying...");
    };

    const timeout = setTimeout(
      () => {
        es.close();
        setTimedOut(true);
      },
      10 * 60 * 1000,
    );

    return () => {
      es.close();
      clearTimeout(timeout);
    };
  }, [sessionToken, navigate, dispatch]);

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4 font-mono">
      {/* Glow */}
      <div className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-lime-400/5 rounded-full blur-3xl" />

      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1
            className="text-5xl font-extrabold tracking-tight text-zinc-100"
            style={{ fontFamily: "'Syne', sans-serif" }}
          >
            <span className="text-lime-400">[</span>snip
            <span className="text-lime-400">]</span>
          </h1>
        </div>

        {/* Card */}
        <div className="relative bg-zinc-900 border border-zinc-800 rounded overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-lime-400" />

          <div className="px-8 py-8 flex flex-col items-center text-center gap-5">
            {/* Icon */}
            <div className="w-16 h-16 rounded-full bg-lime-400/10 border border-lime-400/20 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  stroke="#aaff00"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            {/* Heading */}
            <div>
              <h2
                className="text-lg font-extrabold text-zinc-100 tracking-tight"
                style={{ fontFamily: "'Syne', sans-serif" }}
              >
                Check your inbox
              </h2>
              <p className="mt-2 text-xs text-zinc-400 leading-relaxed tracking-wide">
                We sent a verification link to
              </p>
              <p className="mt-1 text-sm text-lime-400 font-medium tracking-wide">
                {email}
              </p>
            </div>

            {/* Steps */}
            <div className="w-full bg-zinc-950 border border-zinc-800 rounded p-4 text-left flex flex-col gap-3">
              {[
                "Open the email we just sent you",
                "Click the verification link inside",
                "You'll be redirected and signed in",
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-lime-400/10 border border-lime-400/20 text-lime-400 text-[10px] font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-[11px] tracking-wide text-zinc-400 leading-relaxed">
                    {step}
                  </span>
                </div>
              ))}
            </div>

            {timedOut && (
              <p className="text-[11px] tracking-wide text-yellow-400/80">
                Still waiting? The link may have expired — try resending.
              </p>
            )}

            {/* Resend */}
            <div className="w-full flex flex-col gap-2.5">
              <button
                onClick={handleResend}
                disabled={loading || resent}
                className={`w-full flex items-center justify-center gap-2 border rounded py-3 text-[11px] font-bold tracking-widest uppercase transition-all duration-200 cursor-pointer disabled:cursor-not-allowed
                  ${
                    resent
                      ? "border-lime-400 text-lime-400 bg-lime-400/10"
                      : "border-zinc-700 text-zinc-400 hover:border-lime-400 hover:text-lime-400"
                  }`}
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-zinc-700 border-t-lime-400 rounded-full animate-spin" />
                ) : resent ? (
                  "✓ Email resent"
                ) : (
                  "Resend email"
                )}
              </button>

              <a
                href="/auth"
                className="w-full text-center text-[11px] tracking-widest uppercase text-zinc-400 hover:text-zinc-200 transition-colors duration-200 py-2"
              >
                ← Back to sign in
              </a>
            </div>
          </div>
        </div>

        <p className="text-center mt-5 text-[10px] tracking-wider text-zinc-500">
          Didn't get it? Check your spam folder.
        </p>
      </div>

      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&display=swap"
      />
    </div>
  );
}
