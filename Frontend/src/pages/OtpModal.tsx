import { useEffect, useMemo, useRef, useState } from "react";
import { OtpBoxes } from "../ui/OtpBoxes";
import { api } from "../lib/api";
import { X, ShieldAlert, CheckCircle2 } from "lucide-react";

type Props = {
  open: boolean;
  email: string;
  password: string;
  sentOnOpen?: boolean;
  onClose: () => void;
  onVerified: () => void;
};

export default function OtpModal({
  open,
  email,
  password,
  sentOnOpen = false,
  onClose,
  onVerified,
}: Props) {
  const [otp, setOtp] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<number | null>(null);

  const cleanEmail = useMemo(() => email.trim().toLowerCase(), [email]);

  const canSendOtp = useMemo(() => {
    const okEmail = cleanEmail.includes("@");
    return okEmail && password.length > 0 && !sendingOtp && cooldown === 0;
  }, [cleanEmail, password, sendingOtp, cooldown]);

  useEffect(() => {
    if (!open) return;

    setOtp("");
    setErr(null);
    setCooldown(0);
    setOtpSent(Boolean(sentOnOpen));
  }, [open, sentOnOpen]);

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

  async function sendOtp() {
    setErr(null);
    if (!canSendOtp) return;

    setSendingOtp(true);
    try {
      await api.sendOtp({ email: cleanEmail, password });
      setOtpSent(true);
      setOtp("");
      setCooldown(30);
    } catch (e: any) {
      setErr(e?.message || "Failed to resend OTP");
      setOtpSent(false);
    } finally {
      setSendingOtp(false);
    }
  }

  async function verifyOtp() {
    setErr(null);
    if (!otpSent) return;

    if (otp.length !== 6) {
      setErr("Please enter the complete 6-digit OTP code");
      return;
    }

    setVerifyingOtp(true);
    try {
      await api.verifyOtp({ email: cleanEmail, otp });
      onVerified();
      onClose();
    } catch (e: any) {
      setErr(e?.message || "Invalid or expired OTP");
    } finally {
      setVerifyingOtp(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="w-full max-w-md relative z-10 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl shadow-slate-900/20 dark:shadow-black/50 overflow-hidden flex flex-col animate-scale-up">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Two-Factor Authentication
            </p>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
              Verify Your Identity
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Enter verification code sent to{" "}
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {cleanEmail || "your email"}
              </span>
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="text-xs">
              {otpSent ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Code sent to inbox
                </span>
              ) : (
                <span className="text-slate-400">Awaiting code dispatch</span>
              )}
            </div>

            <button
              type="button"
              onClick={sendOtp}
              disabled={!canSendOtp}
              className="text-xs font-semibold px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {sendingOtp
                ? "Sending…"
                : cooldown > 0
                ? `Wait ${cooldown}s`
                : "Resend Code"}
            </button>
          </div>

          <div className="rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                6-Digit Security Code
              </span>

              <button
                type="button"
                onClick={() => {
                  if (!otp) return;
                  navigator.clipboard?.writeText(otp).catch(() => {});
                }}
                disabled={!otp}
                className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline disabled:opacity-40"
              >
                Copy
              </button>
            </div>

            <OtpBoxes
              value={otp}
              onChange={setOtp}
              disabled={!otpSent}
              onEnter={verifyOtp}
            />
          </div>

          {err && (
            <div className="text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 px-4 py-3 rounded-md flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              {err}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 flex items-center justify-between">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Check spam/junk folder if not received.
          </p>

          <button
            type="button"
            onClick={verifyOtp}
            disabled={!otpSent || otp.length !== 6 || verifyingOtp}
            className="px-5 py-2.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {verifyingOtp ? "Verifying…" : "Confirm Code"}
          </button>
        </div>
      </div>
    </div>
  );
}
