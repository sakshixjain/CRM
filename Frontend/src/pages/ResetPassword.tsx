import React, { useMemo, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import { useTheme } from "../theme/ThemeContext";
import { Sun, Moon, Lock, ArrowLeft, Eye, EyeOff } from "lucide-react";

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const q = useQuery();
  const { isDark, toggleTheme } = useTheme();

  // token from URL or state
  const token = q.get("token") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const tokenOk = token.length > 5;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);

    if (!tokenOk) {
      setErr("Reset link is invalid or missing token. Please request a new link.");
      return;
    }

    if (!newPassword || !confirmPassword) {
      setErr("Please enter both password fields.");
      return;
    }

    if (newPassword.length < 6) {
      setErr("Password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErr("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      await api.resetPassword({ token, newPassword, confirmPassword });
      toast.success("Password reset successfully. Please login.");
      navigate("/login", { replace: true });
    } catch (e: any) {
      setErr(e?.message || "Failed to reset password.");
    } finally {
      setBusy(false);
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
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-blue-600/10 dark:bg-blue-600/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(99,102,241,0.06)_1px,transparent_0)] dark:bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.04)_1px,transparent_0)] [background-size:24px_24px]" />
      </div>

      <div className="w-full max-w-[420px] relative z-10">
        <div className="rounded-md border border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl shadow-2xl shadow-slate-900/5 dark:shadow-black/40 overflow-hidden">
          {/* Header */}
          <div className="p-8 pb-6 border-b border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white grid place-items-center shadow-lg shadow-indigo-500/25 shrink-0">
                <Lock className="w-6 h-6" />
              </div>

              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Set New Password
                </h1>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                  Create a strong, secure password
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={onSubmit} className="p-8 pt-6 space-y-5">
            {!tokenOk && (
              <div className="text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 px-4 py-3 rounded-md">
                Reset link is invalid or expired. Please request a new password reset.
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={!tokenOk}
                  className="w-full px-4 py-3 pr-11 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500 dark:focus:ring-indigo-400/30 dark:focus:border-indigo-400 disabled:opacity-50 shadow-xs"
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

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Confirm New Password
              </label>
              <input
                type={showPass ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={!tokenOk}
                className="w-full px-4 py-3 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500 dark:focus:ring-indigo-400/30 dark:focus:border-indigo-400 disabled:opacity-50 shadow-xs"
              />
            </div>

            {err && (
              <div className="text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 px-4 py-3 rounded-md">
                {err}
              </div>
            )}

            <button
              type="submit"
              disabled={busy || !tokenOk}
              className="w-full py-3 px-4 rounded-md bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-semibold text-sm shadow-lg shadow-indigo-600/25 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? "Updating Password…" : "Update Password"}
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
