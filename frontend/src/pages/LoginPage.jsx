import React, { useState } from "react";
import { loginUser, sendVerificationMail } from "../api/user.api";
import { useDispatch, useSelector } from "react-redux";
import { login } from "../store/slice/authSlice.js";
import { Link, useNavigate } from "@tanstack/react-router";
import UserSchema from "../schema/auth.schema.js";
import { setAccessToken } from "../utils/axiosInstance.js";
import { ErrorCodes, parseApiError } from "../utils/errorCodes.js";
import { setPendingAuth } from "../utils/pendingAuth.js";
import { useFieldErrorFlash } from "../hooks/useFieldErrorFlash.js";
const LoginPage = ({ setLogin }) => {
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { isErrored, flash: flashFieldError, clear: clearFieldError } = useFieldErrorFlash();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    clearFieldError();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const validationResult = UserSchema.pick({
        email: true,
        password: true,
      }).safeParse(form);
      if (!validationResult.success) {
        const issue = validationResult.error.issues[0];
        setError(issue.message);
        flashFieldError(issue.path[0]);
        setLoading(false);
        return;
      }
      const data = await loginUser(form.email, form.password);
      dispatch(login({ user: data }));
      setLoading(false);
      navigate({
        to: "/dashboard",
      });

      setError(null);
      setLoading(false);
    } catch (err) {
      setLoading(false);

      const { code, message } = parseApiError(err);

      // Unverified accounts get routed to the verification flow instead of
      // just seeing an error banner.
      if (code === ErrorCodes.AUTH_EMAIL_NOT_VERIFIED) {
        try {
          const resendResult = await sendVerificationMail(form.email);
          if (resendResult.success) {
            // Same auto-login-after-verification flow as registration: stash
            // the credentials in memory so EmailVerificationPage can log the
            // user in the instant verify-status reports success.
            setPendingAuth({
              email: form.email,
              password: form.password,
              sessionToken: resendResult.data?.token,
            });
            navigate({ to: "/auth/verify-email" });
            return;
          }
          setError(resendResult.message || message);
        } catch (resendErr) {
          setError(parseApiError(resendErr).message);
        }
        return;
      }

      // Wrong email or wrong password both come back as this one code (by
      // design, so a login form can't be used to enumerate accounts) - so
      // highlight both fields rather than guessing which one was at fault.
      if (code === ErrorCodes.AUTH_INVALID_CREDENTIALS) {
        flashFieldError(["email", "password"]);
      }

      setError(message);
    }
  };

  return (
    <div className="min-h-screen  bg-zinc-950 flex items-center justify-center px-4 font-mono">
      {/* Glow */}
      <div className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-lime-400/5 rounded-full blur-3xl" />

      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1
            className="text-5xl font-extrabold tracking-tight text-zinc-100"
            style={{ fontFamily: "'Syne', sans-serif" }}
          >
            <span className="text-lime-400">[</span>
            snip
            <span className="text-lime-400">]</span>
          </h1>
          <p className="mt-2 text-[11px] tracking-widest uppercase text-zinc-400">
            sign in to your account
          </p>
        </div>

        {/* Card */}
        <div className="relative bg-zinc-900 border border-zinc-800 rounded overflow-hidden">
          {/* Accent bar */}
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-lime-400" />

          <div className="px-8 py-8">
            <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
              {/* Email */}
              <div>
                <label className="block text-[10px] tracking-[0.2em] uppercase text-zinc-400 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={handleChange}
                  className={`w-full bg-zinc-950 border rounded px-4 py-3.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:ring-2 transition-all duration-200 ${
                    isErrored("email")
                      ? "border-red-500 ring-2 ring-red-500/20 animate-pulse"
                      : "border-zinc-800 focus:border-lime-400 focus:ring-lime-400/10"
                  }`}
                />
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-[10px] tracking-[0.2em] uppercase text-zinc-400">
                    Password
                  </label>
                  <Link
                    href="/auth/forgot-password"
                    className="text-[10px] tracking-wider text-zinc-400 hover:text-lime-400 transition-colors duration-200 uppercase"
                  >
                    Forgot?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={handleChange}
                    className={`w-full bg-zinc-950 border rounded px-4 py-3.5 pr-12 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:ring-2 transition-all duration-200 ${
                      isErrored("password")
                        ? "border-red-500 ring-2 ring-red-500/20 animate-pulse"
                        : "border-zinc-800 focus:border-lime-400 focus:ring-lime-400/10"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 transition-colors duration-200 cursor-pointer text-xs"
                  >
                    {showPassword ? "HIDE" : "SHOW"}
                  </button>
                </div>
              </div>

              {/* Submit */}

              {error && (
                <p className="text-red-500 text-[10px] tracking-widest uppercase text-center">
                  {error}
                </p>
              )}
              <button
                type="submit"
                className="w-full bg-lime-400 hover:bg-lime-300 text-zinc-950 font-bold text-xs tracking-widest uppercase rounded py-3.5 transition-all duration-200 hover:-translate-y-px active:translate-y-0 cursor-pointer mt-1"
              >
                {loading ? "Signing In..." : "Sign In →"}
              </button>
            </form>
          </div>
        </div>

        {/* Sign up link */}
        <p className="text-center mt-5 text-[11px] tracking-wider text-zinc-400">
          Don't have an account?{" "}
          <span
            onClick={() => setLogin(false)}
            className="text-lime-400 cursor-pointer hover:text-lime-300 uppercase font-bold transition-colors duration-200"
          >
            Sign up
          </span>
        </p>
      </div>

      {/* Google Font */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&display=swap"
      />
    </div>
  );
};

function GoogleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 48 48" fill="none">
      <path
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 2.9l5.7-5.7C34.5 6.5 29.5 4 24 4 12.95 4 4 12.95 4 24s8.95 20 20 20 20-8.95 20-20c0-1.2-.1-2.4-.4-3.5z"
        fill="#FFC107"
      />
      <path
        d="M6.3 14.7l6.6 4.8C14.6 16 19 12 24 12c3.1 0 5.8 1.1 8 2.9l5.7-5.7C34.5 6.5 29.5 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"
        fill="#FF3D00"
      />
      <path
        d="M24 44c5.4 0 10.3-2 14-5.2l-6.5-5.5C29.6 35 26.9 36 24 36c-5.3 0-9.7-3.3-11.3-8H6.1C9.4 35.7 16.2 44 24 44z"
        fill="#4CAF50"
      />
      <path
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4-4 5.3l6.5 5.5C42.2 35.1 44 29.9 44 24c0-1.2-.1-2.4-.4-3.5z"
        fill="#1976D2"
      />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

export default LoginPage;