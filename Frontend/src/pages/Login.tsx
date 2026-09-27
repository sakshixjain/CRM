import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useTheme } from "../theme/ThemeContext";
import { Sun, Moon, Eye, EyeOff, ShieldCheck } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const { login, token, loading } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showPass, setShowPass] = useState(false);

  const cleanEmail = useMemo(() => email.trim().toLowerCase(), [email]);
  const emailOk = cleanEmail.includes("@");
  const canLogin = emailOk && password.length > 0;

  useEffect(() => {
    if (!loading && token) navigate("/dashboard", { replace: true });
  }, [loading, token, navigate]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);

    if (!canLogin) {
      setErr("Please enter a valid email and password.");
      return;
    }

    setBusy(true);
    try {
      await login(cleanEmail, password);
      navigate("/dashboard", { replace: true });
    } catch (e: any) {
      setErr(e?.message || "Login failed. Please check your credentials.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-50 dark:bg-[#080C14] text-slate-600 dark:text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-3 border-indigo-500/20 border-t-indigo-600 animate-spin" />
          <p className="text-sm font-medium">Checking session…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-50 dark:bg-[#080C14] flex flex-col justify-center items-center px-4 py-12 transition-colors duration-200">
      {/* Theme Toggle Top Right */}
      <button
        onClick={toggleTheme}
        type="button"
        className="absolute top-6 right-6 p-2.5 rounded-md border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition shadow-xs z-20"
        title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      >
        {isDark ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
      </button>

      {/* Dynamic Background Glow Elements */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 h-96 w-[600px] rounded-full bg-indigo-500/10 dark:bg-indigo-600/15 blur-3xl" />
        <div className="absolute bottom-[-100px] left-[-80px] h-[380px] w-[380px] rounded-full bg-blue-600/10 dark:bg-blue-600/10 blur-3xl" />
        <div className="absolute top-1/4 right-[-100px] h-[400px] w-[400px] rounded-full bg-violet-600/10 dark:bg-violet-600/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(99,102,241,0.06)_1px,transparent_0)] dark:bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.04)_1px,transparent_0)] [background-size:24px_24px]" />
      </div>

      <div className="w-full max-w-[420px] relative z-10">
        <div className="rounded-md border border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl shadow-2xl shadow-slate-900/5 dark:shadow-black/40 overflow-hidden">
          {/* Header */}
          <div className="p-8 pb-6 border-b border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-[#111C44] text-white grid place-items-center shadow-lg shadow-[#111C44]/25 shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>

              <div>
                <h1 className="text-2xl font-bold tracking-tight text-[#1B2559] dark:text-white">
                  Welcome back
                </h1>
                <p className="text-xs font-medium text-[#8F9CAE] dark:text-slate-400 mt-0.5">
                  Sign in to your CRM workspace
                </p>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={onSubmit} className="p-8 pt-6 space-y-5">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                required
                className="w-full px-4 py-3 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-[#111C44]/20 focus:border-[#111C44] dark:focus:ring-blue-400/30 dark:focus:border-blue-400 shadow-xs"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-semibold text-[#111C44] dark:text-blue-400 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>

              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 pr-11 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-[#111C44]/20 focus:border-[#111C44] dark:focus:ring-blue-400/30 dark:focus:border-blue-400 shadow-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((s) => !s)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                  aria-label={showPass ? "Hide password" : "Show password"}
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {err && (
              <div className="text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 px-4 py-3 rounded-md animate-fade-in">
                {err}
              </div>
            )}

            {/* Login Button */}
            <button
              type="submit"
              disabled={busy || !canLogin}
              className="w-full py-3 px-4 rounded-md bg-[#111C44] hover:bg-[#0A122E] text-white font-semibold text-sm shadow-lg shadow-[#111C44]/25 focus:outline-none focus:ring-2 focus:ring-[#111C44] focus:ring-offset-2 dark:focus:ring-offset-slate-900 transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? "Signing in…" : "Sign In"}
            </button>
          </form>

          {/* Footer */}
          <div className="px-8 py-5 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 text-center text-xs text-slate-500 dark:text-slate-400">
            Don’t have an account yet?{" "}
            <Link
              to="/signup"
              className="font-semibold text-[#111C44] dark:text-blue-400 hover:underline"
            >
              Create an account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
