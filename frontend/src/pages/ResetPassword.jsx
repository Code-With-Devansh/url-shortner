import { useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { changePassword } from "../api/user.api";

export default function ResetPassword() {
  const { token } = useParams({ strict: false });
  const [form, setForm] = useState({ password: "", confirm: "" });
  const [show, setShow] = useState({ password: false, confirm: false });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const strength = (() => {
    const p = form.password;
    if (!p) return null;
    if (p.length < 6) return { label: "Weak", color: "bg-red-500", width: "w-1/3", text: "text-red-500" };
    if (p.length < 10 || !/[^a-zA-Z0-9]/.test(p)) return { label: "Fair", color: "bg-yellow-400", width: "w-2/3", text: "text-yellow-400" };
    return { label: "Strong", color: "bg-lime-400", width: "w-full", text: "text-lime-400" };
  })();

  const handleSubmit = async () => {
    if (!form.password) return setError("Please enter a new password.");
    if (form.password.length < 6) return setError("Password must be at least 6 characters.");
    if (!form.confirm) return setError("Please confirm your new password.");
    if (form.password !== form.confirm) return setError("Passwords do not match.");

    setLoading(true);
    setError("");
    try{
      const data = await changePassword(token, form.password);
      setLoading(false);
      setDone(true);
    }catch{
      setError("Invalid Token")
    }finally{
      setLoading(false)
    }
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
            {!done ? (
              <div className="flex flex-col gap-5">

                {/* Header */}
                <div>
                  <h2 className="text-lg font-extrabold text-zinc-100 tracking-tight" style={{ fontFamily: "'Syne', sans-serif" }}>
                    Set new password
                  </h2>
                  <p className="mt-1.5 text-xs text-zinc-400 tracking-wide leading-relaxed">
                    Choose a strong password for your account.
                  </p>
                </div>

                <div className="h-px bg-zinc-800" />

                {/* New password */}
                <div>
                  <label className="block text-[10px] tracking-[0.2em] uppercase text-zinc-400 mb-2">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={show.password ? "text" : "password"}
                      placeholder="••••••••"
                      value={form.password}
                      onChange={(e) => { setForm({ ...form, password: e.target.value }); setError(""); }}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-4 py-3.5 pr-14 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-lime-400 focus:ring-2 focus:ring-lime-400/10 transition-all duration-200"
                    />
                    <button
                      type="button"
                      onClick={() => setShow((s) => ({ ...s, password: !s.password }))}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] tracking-widest uppercase text-zinc-400 hover:text-zinc-200 transition-colors duration-200 cursor-pointer"
                    >
                      {show.password ? "Hide" : "Show"}
                    </button>
                  </div>

                  {/* Strength meter */}
                  {strength && (
                    <div className="mt-2.5">
                      <div className="h-[3px] w-full bg-zinc-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-300 ${strength.color} ${strength.width}`} />
                      </div>
                      <p className={`mt-1.5 text-[10px] tracking-widest uppercase ${strength.text}`}>
                        {strength.label} password
                      </p>
                    </div>
                  )}
                </div>

                {/* Confirm password */}
                <div>
                  <label className="block text-[10px] tracking-[0.2em] uppercase text-zinc-400 mb-2">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      type={show.confirm ? "text" : "password"}
                      placeholder="••••••••"
                      value={form.confirm}
                      onChange={(e) => { setForm({ ...form, confirm: e.target.value }); setError(""); }}
                      onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                      className={`w-full bg-zinc-950 border rounded px-4 py-3.5 pr-14 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-all duration-200
                        ${form.confirm && form.password !== form.confirm
                          ? "border-red-500/50 focus:border-red-500 focus:ring-2 focus:ring-red-500/10"
                          : form.confirm && form.password === form.confirm
                          ? "border-lime-400/50 focus:border-lime-400 focus:ring-2 focus:ring-lime-400/10"
                          : "border-zinc-800 focus:border-lime-400 focus:ring-2 focus:ring-lime-400/10"
                        }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShow((s) => ({ ...s, confirm: !s.confirm }))}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] tracking-widest uppercase text-zinc-400 hover:text-zinc-200 transition-colors duration-200 cursor-pointer"
                    >
                      {show.confirm ? "Hide" : "Show"}
                    </button>

                    {/* Match indicator */}
                    {form.confirm && (
                      <div className="absolute right-12 top-1/2 -translate-y-1/2">
                        {form.password === form.confirm
                          ? <span className="text-lime-400 text-sm">✓</span>
                          : <span className="text-red-500 text-sm">✕</span>
                        }
                      </div>
                    )}
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <p className="text-xs text-red-400 tracking-wide -mt-1">⚠ {error}</p>
                )}

                {/* Submit */}
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-lime-400 hover:bg-lime-300 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-950 font-bold text-xs tracking-widest uppercase rounded py-3.5 transition-all duration-200 hover:-translate-y-px active:translate-y-0 cursor-pointer"
                >
                  {loading
                    ? <span className="w-4 h-4 border-2 border-zinc-950/30 border-t-zinc-950 rounded-full animate-spin" />
                    : "Update password →"
                  }
                </button>

                <Link
                  to="/auth"
                  className="text-center text-[11px] tracking-widest uppercase text-zinc-400 hover:text-zinc-200 transition-colors duration-200 no-underline"
                >
                  ← Back to sign in
                </Link>

              </div>
            ) : (
              /* Success state */
              <div className="flex flex-col items-center text-center gap-5">

                <div className="relative w-16 h-16 mt-2">
                  <div className="absolute inset-0 rounded-full bg-lime-400/10 border border-lime-400/20 animate-ping opacity-25" />
                  <div className="relative w-16 h-16 rounded-full bg-lime-400/10 border border-lime-400/20 flex items-center justify-center">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
                        stroke="#aaff00" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M9 12l2 2 4-4"
                        stroke="#aaff00" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>

                <div>
                  <h2 className="text-lg font-extrabold text-zinc-100 tracking-tight" style={{ fontFamily: "'Syne', sans-serif" }}>
                    Password updated!
                  </h2>
                  <p className="mt-2 text-xs text-zinc-400 leading-relaxed tracking-wide">
                    Your password has been changed successfully.<br />You can now sign in with your new password.
                  </p>
                </div>

                <div className="w-full h-px bg-zinc-800" />

                <Link
                  to="/auth"
                  className="w-full flex items-center justify-center bg-lime-400 hover:bg-lime-300 text-zinc-950 font-bold text-xs tracking-widest uppercase rounded py-3.5 transition-all duration-200 hover:-translate-y-px no-underline"
                >
                  Sign in →
                </Link>

              </div>
            )}
          </div>
        </div>

      </div>

      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&display=swap" />
    </div>
  );
}