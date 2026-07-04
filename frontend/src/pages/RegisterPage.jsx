import { useNavigate } from "@tanstack/react-router";
import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { registerUser, sendVerificationMail } from "../api/user.api";
import { login } from "../store/slice/authSlice";
import UserSchema from "../schema/auth.schema";
import { parseApiError } from "../utils/errorCodes";
import { setPendingAuth } from "../utils/pendingAuth";
import { useFieldErrorFlash } from "../hooks/useFieldErrorFlash";
const RegisterPage = ({ setLogin }) => {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
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
      const validationResult = UserSchema.safeParse(form);
      if (!validationResult.success) {
        const issue = validationResult.error.issues[0];
        setError(issue.message);
        flashFieldError(issue.path[0]);
        setLoading(false);
        return;
      }
      const data = await registerUser(form.name, form.email, form.password);
      dispatch(login({ user: data }));

      const verified = await sendVerificationMail(data.email);
      if (verified.success) {
        // Stash the credentials in memory (not redux/localStorage) so
        // EmailVerificationPage can auto-login the moment the SSE
        // verify-status stream reports success.
        setPendingAuth({
          email: form.email,
          password: form.password,
          sessionToken: verified.data?.token,
        });
        navigate({ to: '/auth/verify-email' });
      } else {
        throw new Error(verified.message);
      }
      setError(null);
    } catch (err) {
      if (!err.apiCode) {
        setError(err.message || "Registration failed");
      } else {
        const { code, fieldErrors, message } = parseApiError(err);
        setError(message);
        if (code === "AUTH_USER_ALREADY_EXISTS") {
          flashFieldError("email");
        } else if (fieldErrors && Object.keys(fieldErrors).length > 0) {
          // Backend field names (name/email/password) already match the
          // form's, so no mapping needed here (unlike the URL create form).
          flashFieldError(Object.keys(fieldErrors)[0]);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const strength = (() => {
    const p = form.password;
    if (!p) return null;
    if (p.length < 6)
      return { label: "Weak", color: "bg-red-500", width: "w-1/3" };
    if (p.length < 10 || !/[^a-zA-Z0-9]/.test(p))
      return { label: "Fair", color: "bg-yellow-400", width: "w-2/3" };
    return { label: "Strong", color: "bg-lime-400", width: "w-full" };
  })();
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
            create your account
          </p>
        </div>

        {/* Card */}
        <div className="relative bg-zinc-900 border border-zinc-800 rounded overflow-hidden">
          {/* Accent bar */}
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-lime-400" />

          <div className="px-8 py-8 flex flex-col gap-5">
            {/* Name */}
            <div>
              <label className="block text-[10px] tracking-[0.2em] uppercase text-zinc-400 mb-2">
                Full Name
              </label>
              <input
                type="text"
                name="name"
                placeholder="John Doe"
                value={form.name}
                onChange={handleChange}
                className={`w-full bg-zinc-950 border rounded px-4 py-3.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:ring-2 transition-all duration-200 ${
                  isErrored("name")
                    ? "border-red-500 ring-2 ring-red-500/20 animate-pulse"
                    : "border-zinc-800 focus:border-lime-400 focus:ring-lime-400/10"
                }`}
              />
            </div>

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
              <label className="block text-[10px] tracking-[0.2em] uppercase text-zinc-400 mb-2">
                Password
              </label>
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

              {/* Strength meter */}
              {strength && (
                <div className="mt-2.5">
                  <div className="h-[3px] w-full bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${strength.color} ${strength.width}`}
                    />
                  </div>
                  <p
                    className={`mt-1.5 text-[10px] tracking-widest uppercase ${
                      strength.label === "Weak"
                        ? "text-red-500"
                        : strength.label === "Fair"
                          ? "text-yellow-400"
                          : "text-lime-400"
                    }`}
                  >
                    {strength.label} password
                  </p>
                </div>
              )}
            </div>
            {error && (
              <p className="text-red-500 text-center text-sm">{error}</p>
            )}
            {/* Submit */}
            <button
              onClick={handleSubmit}
              className="w-full bg-lime-400 hover:bg-lime-300 text-zinc-950 font-bold text-xs tracking-widest uppercase rounded py-3.5 transition-all duration-200 hover:-translate-y-px active:translate-y-0 cursor-pointer"
            >
              {loading ? "Creating Account..." : "Create Account →"}
            </button>
          </div>
        </div>

        {/* Sign in link */}
        <p className="text-center mt-5 text-[11px] tracking-wider text-zinc-400">
          Already have an account?{" "}
          <span
            onClick={() => setLogin(true)}
            className="text-lime-400 cursor-pointer hover:text-lime-300 uppercase font-bold transition-colors duration-200"
          >
            Sign in
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

export default RegisterPage;