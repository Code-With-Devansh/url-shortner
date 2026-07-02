import { useState } from "react";
import { Link } from "@tanstack/react-router";
import UserSchema from "../schema/auth.schema";
import { forgotPassword } from "../api/user.api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) return setError("Please enter your email.");
    const validated = UserSchema.pick({email:true}).safeParse({email});
    if(validated.error){
        return setError(validated.error);
    }

    setLoading(true);
    setError("");

    await forgotPassword(email);

    setLoading(false);
    setSent(true);
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4 font-mono">
      {/* Glow */}
      <div className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-lime-400/5 rounded-full blur-3xl" />

      <div className="w-full max-w-sm relative z-10">

        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-extrabold tracking-tight" style={{ fontFamily: "'Syne', sans-serif" }}>
            <span className="text-lime-400">[</span>
            <span className="text-zinc-100">snip</span>
            <span className="text-lime-400">]</span>
          </h1>
        </div>

        {/* Card */}
        <div className="relative bg-zinc-900 border border-zinc-800 rounded overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-lime-400" />

          <div className="px-8 py-8">
            {!sent ? (
              <div className="flex flex-col gap-5">

                {/* Header */}
                <div>
                  <h2 className="text-lg font-extrabold text-zinc-100 tracking-tight" style={{ fontFamily: "'Syne', sans-serif" }}>
                    Forgot password?
                  </h2>
                  <p className="mt-1.5 text-xs text-zinc-400 tracking-wide leading-relaxed">
                    No worries. Enter your email and we'll send you a reset link.
                  </p>
                </div>

                <div className="h-px bg-zinc-800" />

                {/* Email input */}
                <div>
                  <label className="block text-[10px] tracking-[0.2em] uppercase text-zinc-400 mb-2">
                    Email address
                  </label>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(""); }}
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-4 py-3.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-lime-400 focus:ring-2 focus:ring-lime-400/10 transition-all duration-200"
                  />
                  {error && (
                    <p className="mt-2 text-xs text-red-400 tracking-wide">⚠ {error}</p>
                  )}
                </div>

                {/* Submit */}
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-lime-400 hover:bg-lime-300 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-950 font-bold text-xs tracking-widest uppercase rounded py-3.5 transition-all duration-200 hover:-translate-y-px active:translate-y-0 cursor-pointer"
                >
                  {loading
                    ? <span className="w-4 h-4 border-2 border-zinc-950/30 border-t-zinc-950 rounded-full animate-spin" />
                    : "Send reset link →"
                  }
                </button>

                {/* Back */}
                <Link
                  to="/login"
                  className="text-center text-[11px] tracking-widest uppercase text-zinc-400 hover:text-zinc-200 transition-colors duration-200 no-underline"
                >
                  ← Back to sign in
                </Link>

              </div>
            ) : (
              /* Success state */
              <div className="flex flex-col items-center text-center gap-5">

                {/* Icon */}
                <div className="relative w-16 h-16 mt-2">
                  <div className="absolute inset-0 rounded-full bg-lime-400/10 border border-lime-400/20 animate-ping opacity-25" />
                  <div className="relative w-16 h-16 rounded-full bg-lime-400/10 border border-lime-400/20 flex items-center justify-center">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                      <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                        stroke="#aaff00" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>

                <div>
                  <h2 className="text-lg font-extrabold text-zinc-100 tracking-tight" style={{ fontFamily: "'Syne', sans-serif" }}>
                    Check your inbox
                  </h2>
                  <p className="mt-2 text-xs text-zinc-400 leading-relaxed tracking-wide">
                    We sent a password reset link to
                  </p>
                  <p className="mt-1 text-sm text-lime-400 font-medium">{email}</p>
                </div>

                <div className="w-full bg-zinc-950 border border-zinc-800 rounded p-4 text-left flex flex-col gap-3">
                  {[
                    "Open the reset email we sent you",
                    "Click the reset link inside",
                    "Choose a new password",
                  ].map((step, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-lime-400/10 border border-lime-400/20 text-lime-400 text-[10px] font-bold flex items-center justify-center mt-0.5">
                        {i + 1}
                      </span>
                      <span className="text-[11px] tracking-wide text-zinc-400 leading-relaxed">{step}</span>
                    </div>
                  ))}
                </div>

                <div className="w-full flex flex-col gap-2.5">
                  <button
                    onClick={() => { setSent(false); setEmail(""); }}
                    className="w-full border border-zinc-700 text-zinc-400 hover:border-lime-400 hover:text-lime-400 font-bold text-[11px] tracking-widest uppercase rounded py-3 transition-all duration-200 cursor-pointer"
                  >
                    Try a different email
                  </button>
                  <Link
                    to="/login"
                    className="text-center text-[11px] tracking-widest uppercase text-zinc-400 hover:text-zinc-200 transition-colors duration-200 py-1 no-underline"
                  >
                    ← Back to sign in
                  </Link>
                </div>

                <p className="text-[10px] tracking-wider text-zinc-500">
                  Didn't get it? Check your spam folder.
                </p>

              </div>
            )}
          </div>
        </div>

      </div>

      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&display=swap" />
    </div>
  );
}