import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Field from "../ui/Field";
import { useAuth } from "../auth/AuthContext";
import { useTheme } from "../theme/ThemeContext";
import { Sun, Moon, Sparkles, Building2 } from "lucide-react";

export default function Signup() {
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [contact_no, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const { signup, loading } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (!name.trim()) {
      setErr("Full name is required");
      return;
    }

    if (!companyName.trim()) {
      setErr("Company name is required");
      return;
    }

    if (!contact_no.trim()) {
      setErr("Phone number is required");
      return;
    }

    if (!email.trim() || !email.includes("@")) {
      setErr("Valid email address is required");
      return;
    }

    setBusy(true);

    try {
      await signup(
        name.trim(),
        email.trim(),
        contact_no.trim(),
        companyName.trim()
      );

      navigate("/login", { replace: true });
    } catch (e: any) {
      setErr(e?.message || "Registration failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#080C14] text-slate-600 dark:text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-3 border-indigo-500/20 border-t-indigo-600 animate-spin" />
          <p className="text-sm font-medium">Checking session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-[#080C14] px-4 py-12 transition-colors duration-200">
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
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 h-96 w-[640px] rounded-full bg-indigo-500/10 dark:bg-indigo-600/15 blur-3xl" />
        <div className="absolute bottom-[-80px] right-[-60px] h-[360px] w-[360px] rounded-full bg-blue-600/10 dark:bg-blue-600/10 blur-3xl" />
        <div className="absolute top-1/3 left-[-80px] h-[360px] w-[360px] rounded-full bg-violet-600/10 dark:bg-violet-600/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(99,102,241,0.06)_1px,transparent_0)] dark:bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.04)_1px,transparent_0)] [background-size:24px_24px]" />
      </div>

      <div className="w-full max-w-[460px] relative z-10">
        <div className="rounded-md border border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl shadow-2xl shadow-slate-900/5 dark:shadow-black/40 overflow-hidden">
          {/* Header */}
          <div className="p-8 pb-6 border-b border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white grid place-items-center shadow-lg shadow-indigo-500/25 shrink-0">
                <Building2 className="w-6 h-6" />
              </div>

              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Create Account
                </h1>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                  Start empowering your sales team with CRM
                </p>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={onSubmit} className="p-8 pt-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="sm:col-span-2">
                <Field
                  label="Full Name"
                  value={name}
                  onChange={setName}
                  placeholder="e.g. Rahul Sharma"
                />
              </div>

              <div className="sm:col-span-2">
                <Field
                  label="Company Name"
                  value={companyName}
                  onChange={setCompanyName}
                  placeholder="e.g. Apex Enterprises"
                />
              </div>

              <div>
                <Field
                  label="Phone Number"
                  value={contact_no}
                  onChange={setPhone}
                  type="tel"
                  placeholder="+91 98765 43210"
                />
              </div>

              <div>
                <Field
                  label="Business Email"
                  value={email}
                  onChange={setEmail}
                  type="email"
                  placeholder="name@company.com"
                />
              </div>
            </div>

            {err && (
              <div className="text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 px-4 py-3 rounded-md animate-fade-in">
                {err}
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={busy}
                className="w-full py-3 px-4 rounded-md bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-semibold text-sm shadow-lg shadow-indigo-600/25 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {busy ? (
                  "Setting up your workspace..."
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Create Organization Account
                  </>
                )}
              </button>
            </div>

            <div className="pt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Enterprise Encryption
              </span>

              <span>
                Already registered?{" "}
                <Link
                  to="/login"
                  className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Sign in
                </Link>
              </span>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}