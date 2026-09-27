import React, { useMemo, useRef, useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useTheme } from "../theme/ThemeContext";
import { Sun, Moon, KeyRound, ArrowLeft, MailCheck } from "lucide-react";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();

  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<number | null>(null);

  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const cleanEmail = useMemo(() => email.trim().toLowerCase(), [email]);

  const canSend = useMemo(() => {
    const okEmail = cleanEmail.includes("@");
    return okEmail && !sending && cooldown === 0;
  }, [cleanEmail, sending, cooldown]);

  useEffect(() => {
    if (cooldown <= 0) {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }
    if (!timerRef.current) {
      timerRef.current = window.setInterval(() => {
        setCooldown((c) => (c > 0 ? c - 1 : 0));
      }, 1000);
    }
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [cooldown]);

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(null);

    if (!canSend) return;

    setSending(true);
    try {
      await api.forgotPassword({ email: cleanEmail });
      setSent(true);
      setCooldown(30);
      setOk("Password reset instructions or OTP have been generated.");
    } catch (e: any) {
      setErr(e?.message || "Failed to send reset OTP");
    } finally {
      setSending(false);
    }
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

      {/* Dynamic Background Glow */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 h-96 w-[600px] rounded-full bg-indigo-500/10 dark:bg-indigo-600/15 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-80 w-80 rounded-full bg-blue-600/10 dark:bg-blue-600/10 blur-3xl" />
        <div className="absolute top-24 right-0 h-80 w-80 rounded-full bg-violet-600/10 dark:bg-violet-600/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(99,102,241,0.06)_1px,transparent_0)] dark:bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.04)_1px,transparent_0)] [background-size:24px_24px]" />
      </div>

      <div className="w-full max-w-[420px] relative z-10">
        <div className="rounded-md border border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl shadow-2xl shadow-slate-900/5 dark:shadow-black/40 overflow-hidden">
          {/* Header */}
          <div className="p-8 pb-6 border-b border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white grid place-items-center shadow-lg shadow-indigo-500/25 shrink-0">
                <KeyRound className="w-6 h-6" />
              </div>

              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Reset Password
                </h1>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                  Enter your email to receive recovery instructions
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={onSend} className="p-8 pt-6 space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Account Email
              </label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setSent(false);
                    setErr(null);
                    setOk(null);
                  }}
                  placeholder="name@company.com"
                  required
                  className="flex-1 px-4 py-3 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500 dark:focus:ring-indigo-400/30 dark:focus:border-indigo-400 shadow-xs"
                />

                <button
                  type="submit"
                  disabled={!canSend}
                  className="px-4 py-3 rounded-md font-semibold text-xs whitespace-nowrap bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending
                    ? "Sending…"
                    : cooldown > 0
                    ? `Wait ${cooldown}s`
                    : sent
                    ? "Resend OTP"
                    : "Send OTP"}
                </button>
              </div>
            </div>

            {err && (
              <div className="text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 px-4 py-3 rounded-md">
                {err}
              </div>
            )}

            {ok && (
              <div className="text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 px-4 py-3 rounded-md flex items-center gap-2">
                <MailCheck className="w-4 h-4 shrink-0" />
                {ok}
              </div>
            )}

            <button
              type="button"
              onClick={() => navigate("/reset-password", { state: { email: cleanEmail } })}
              disabled={!sent}
              className="w-full py-3 px-4 rounded-md bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-semibold text-sm shadow-lg shadow-indigo-600/25 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue with Recovery
            </button>

            <div className="pt-2 text-center text-xs">
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 font-semibold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Sign in
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
