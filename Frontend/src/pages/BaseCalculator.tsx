"use client";

import React, { useMemo, useState } from "react";
import PageHeader from "../pages/Header";
import { Calculator, RefreshCcw } from "lucide-react";

type GSTMode = "add" | "remove";
type RateMode = "preset" | "custom";

const PRESET_RATES = [0, 3, 5, 12, 18, 28];
const SPLIT_PRESETS: Array<[number, number]> = [
  [50, 50],
  [60, 40],
  [70, 30],
  [80, 20],
];

function inr(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(v);
}

function cn(...cls: Array<string | boolean | undefined | null>) {
  return cls.filter(Boolean).join(" ");
}

export default function GSTCalculator() {
  const [amount, setAmount] = useState<number>(500);
  const [mode, setMode] = useState<GSTMode>("remove");
  const [useIGST, setUseIGST] = useState<boolean>(false);

  const [rateMode, setRateMode] = useState<RateMode>("preset");
  const [gstRate, setGstRate] = useState<number>(18);
  const [customRate, setCustomRate] = useState<number>(18);
  const [splitPercentA, setSplitPercentA] = useState<number>(60);
  const [splitPercentB, setSplitPercentB] = useState<number>(40);

  const activeRate = rateMode === "custom" ? customRate : gstRate;

  const result = useMemo(() => {
    const a = Number(amount) || 0;
    const r = Number(activeRate) || 0;

    const out = {
      baseAmount: 0,
      gstAmount: 0,
      totalAmount: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
    };

    if (a <= 0) return out;

    if (mode === "add") {
      const gstAmount = (a * r) / 100;
      const totalAmount = a + gstAmount;

      out.baseAmount = a;
      out.gstAmount = gstAmount;
      out.totalAmount = totalAmount;

      if (useIGST) out.igst = gstAmount;
      else {
        out.cgst = gstAmount / 2;
        out.sgst = gstAmount / 2;
      }
      return out;
    }

    const baseAmount = a / (1 + r / 100);
    const gstAmount = a - baseAmount;

    out.baseAmount = baseAmount;
    out.gstAmount = gstAmount;
    out.totalAmount = a;

    if (useIGST) out.igst = gstAmount;
    else {
      out.cgst = gstAmount / 2;
      out.sgst = gstAmount / 2;
    }

    return out;
  }, [amount, activeRate, mode, useIGST]);

  const safeSplitA = Number(splitPercentA) || 0;
  const safeSplitB = Number(splitPercentB) || 0;
  const splitA = result.totalAmount * (safeSplitA / 100);
  const splitB = result.totalAmount * (safeSplitB / 100);
  const splitTotal = safeSplitA + safeSplitB;

  const handleSplitAChange = (value: number) => {
    const nextA = Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));
    setSplitPercentA(nextA);
    setSplitPercentB(100 - nextA);
  };

  const handleSplitBChange = (value: number) => {
    const nextB = Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));
    setSplitPercentB(nextB);
    setSplitPercentA(100 - nextB);
  };

  const onReset = () => {
    setAmount(0);
    setMode("add");
    setUseIGST(false);
    setRateMode("preset");
    setGstRate(18);
    setCustomRate(18);
    setSplitPercentA(60);
    setSplitPercentB(40);
  };

  return (
    <div className="w-full">
      {/* ✅ HEADER LIKE STATUS PAGE */}
      <PageHeader
        title="GST Calculator"
        search=""
        icon={<Calculator size={18} />}
        rightActions={
          <>
            <div className="inline-flex rounded-md border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-1">
              <SegBtn active={mode === "add"} onClick={() => setMode("add")}>
                Add GST
              </SegBtn>
              <SegBtn
                active={mode === "remove"}
                onClick={() => setMode("remove")}
              >
                Remove GST
              </SegBtn>
            </div>

            <button
              onClick={onReset}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-sm text-slate-800 dark:text-slate-200 font-semibold"
              type="button"
            >
              <RefreshCcw size={16} />
              Reset
            </button>
          </>
        }
      />

      <div className="grid items-stretch gap-4 lg:grid-cols-12">
        {/* LEFT */}
        <div className="lg:col-span-5">
          <Card className="h-full">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>
                Mode:{" "}
                {mode === "add"
                  ? "Exclusive → Inclusive"
                  : "Inclusive → Exclusive"}
              </Badge>
              <Badge>Rate: {activeRate}%</Badge>
              <Badge>
                Tax Type: {useIGST ? "IGST" : "CGST + SGST"}
              </Badge>
            </div>

            <div className="mt-6 space-y-5">
              <Field
                label={
                  mode === "add"
                    ? "Amount (Exclusive)"
                    : "Amount (Inclusive)"
                }
                hint={
                  mode === "add"
                    ? "GST will be added to this base amount."
                    : "GST will be removed from this final total."
                }
              >
                <MoneyInput
                  value={amount}
                  onChange={setAmount}
                />
              </Field>

              <Field label="GST Rate" hint="">
                <RatePicker
                  rateMode={rateMode}
                  setRateMode={setRateMode}
                  gstRate={gstRate}
                  setGstRate={setGstRate}
                  customRate={customRate}
                  setCustomRate={setCustomRate}
                />
              </Field>

              <ToggleLine
                checked={useIGST}
                onChange={() => setUseIGST((v: boolean) => !v)}
                title="Use IGST (Inter-state)"
                desc="If OFF → GST splits into CGST + SGST equally."
              />

              <div className="rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-4">
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Quick View
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <MiniInfo label="Rate" value={`${activeRate}%`} />
                  <MiniInfo
                    label="Tax Type"
                    value={useIGST ? "IGST" : "CGST + SGST"}
                  />
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* RIGHT */}
        <div className="lg:col-span-7">
          <Card className="h-full">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Summary
              </div>
              <span className="rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                Rate: {activeRate}%
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Stat label="Base Amount" value={inr(result.baseAmount)} />
              <Stat label="GST Amount" value={inr(result.gstAmount)} />
              <Stat label="Total" value={inr(result.totalAmount)} highlight />
            </div>

            <div className="mt-4 rounded-md border border-slate-200 dark:border-slate-800 dark:bg-slate-800/30 p-4">
              <div className="flex justify-between text-sm font-semibold text-slate-900 dark:text-slate-100">
                GST Breakdown
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {useIGST ? "IGST" : "CGST + SGST"}
                </span>
              </div>

              <div className="mt-3 space-y-2 text-slate-700 dark:text-slate-300">
                {useIGST ? (
                  <Row label="IGST" value={inr(result.igst)} />
                ) : (
                  <>
                    <Row label="CGST" value={inr(result.cgst)} />
                    <Row label="SGST" value={inr(result.sgst)} />
                  </>
                )}
              </div>
            </div>

            <div className="mt-5 text-sm font-semibold text-slate-900 dark:text-slate-100">
              Payment Split
            </div>

            <div className="mt-3 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-4">
              <div className="flex flex-wrap gap-2">
                {SPLIT_PRESETS.map(([a, b]) => (
                  <button
                    key={`${a}-${b}`}
                    type="button"
                    onClick={() => {
                      setSplitPercentA(a);
                      setSplitPercentB(b);
                    }}
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-xs font-semibold transition shadow-2xs",
                      safeSplitA === a && safeSplitB === b
                        ? "border-slate-900 bg-slate-900 text-white dark:border-blue-500 dark:bg-blue-600"
                        : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                    )}
                  >
                    {a}% / {b}%
                  </button>
                ))}
              </div>

              <div className="mt-3 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={splitPercentA}
                  onChange={(e) => handleSplitAChange(Number(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer"
                />
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <SplitInput
                    label="Split 1"
                    value={splitPercentA}
                    onChange={handleSplitAChange}
                  />
                  <SplitInput
                    label="Split 2"
                    value={splitPercentB}
                    onChange={handleSplitBChange}
                  />
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <MiniPayCard
                  title={`Split 1 - ${safeSplitA}%`}
                  value={inr(splitA)}
                />
                <MiniPayCard
                  title={`Split 2 - ${safeSplitB}%`}
                  value={inr(splitB)}
                />
              </div>

              <div className="mt-4 border-t border-slate-200 dark:border-slate-700 pt-3 text-slate-700 dark:text-slate-300">
                <Row
                  label="Split Total %"
                  value={`${splitTotal}%`}
                  strong={splitTotal === 100}
                />
                <Row
                  label="Check Total"
                  value={inr(splitA + splitB)}
                  strong
                />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ---------- UI Components ---------- */

function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "h-full rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition-colors",
        className
      )}
    >
      {children}
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-3 py-1 text-xs font-semibold border rounded-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
      {children}
    </span>
  );
}

function SegBtn({
  active,
  onClick,
  children,
}: any) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-4 py-2 text-sm font-semibold rounded-md transition",
        active
          ? "bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white shadow-sm"
          : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
      )}
    >
      {children}
    </button>
  );
}

function Field({ label, hint, children }: any) {
  return (
    <div>
      <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">
        {label}
      </label>
      <div className="mt-2">{children}</div>
      {hint && (
        <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
          {hint}
        </div>
      )}
    </div>
  );
}

function MoneyInput({ value, onChange }: any) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 transition focus-within:border-blue-500 dark:focus-within:border-blue-400">
      <span className="text-slate-500 dark:text-slate-400 font-bold">₹</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full bg-transparent outline-none text-sm font-semibold text-slate-900 dark:text-white"
      />
    </div>
  );
}

function ToggleLine({ checked, onChange, title, desc }: any) {
  return (
    <div className="rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-4 transition">
      <label className="flex gap-3 items-start cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="mt-0.5 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 accent-blue-600 h-4 w-4"
        />
        <div>
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</div>
          <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{desc}</div>
        </div>
      </label>
    </div>
  );
}

function RatePicker({
  rateMode,
  setRateMode,
  gstRate,
  setGstRate,
  customRate,
  setCustomRate,
}: any) {
  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-md border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-1">
        <button
          onClick={() => setRateMode("preset")}
          className={cn(
            "px-3 py-1 text-xs font-semibold rounded-md transition",
            rateMode === "preset"
              ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          )}
        >
          Preset
        </button>
        <button
          onClick={() => setRateMode("custom")}
          className={cn(
            "px-3 py-1 text-xs font-semibold rounded-md transition",
            rateMode === "custom"
              ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          )}
        >
          Custom
        </button>
      </div>

      {rateMode === "preset" ? (
        <div className="flex gap-2 flex-wrap">
          {PRESET_RATES.map((r) => (
            <button
              key={r}
              onClick={() => setGstRate(r)}
              className={cn(
                "px-3 py-2 text-sm font-semibold border rounded-md transition shadow-2xs",
                gstRate === r
                  ? "bg-slate-900 dark:bg-blue-600 border-slate-900 dark:border-blue-500 text-white"
                  : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
              )}
            >
              {r}%
            </button>
          ))}
        </div>
      ) : (
        <input
          type="number"
          value={customRate}
          onChange={(e) =>
            setCustomRate(Number(e.target.value))
          }
          className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-md px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500 dark:focus:border-blue-400"
        />
      )}
    </div>
  );
}

function Stat({ label, value, highlight }: any) {
  return (
    <div
      className={cn(
        "rounded-md border p-4 transition",
        highlight
          ? "bg-slate-100 dark:bg-blue-950/30 border-slate-200 dark:border-blue-800/60"
          : "bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-800"
      )}
    >
      <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</div>
      <div
        className={cn(
          "mt-1 text-sm font-bold",
          highlight
            ? "text-blue-600 dark:text-blue-400 text-base"
            : "text-slate-900 dark:text-slate-100"
        )}
      >
        {value}
      </div>
    </div>
  );
}

function Row({ label, value, strong }: any) {
  return (
    <div className="flex justify-between text-sm py-1">
      <div className="text-slate-600 dark:text-slate-400">{label}</div>
      <div className={cn("text-slate-900 dark:text-slate-100", strong && "font-bold text-slate-950 dark:text-white")}>
        {value}
      </div>
    </div>
  );
}

function SplitInput({ label, value, onChange }: any) {
  return (
    <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 p-3">
      <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">{label}</div>
      <div className="mt-2 flex items-center rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2">
        <input
          type="number"
          min="0"
          max="100"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full bg-transparent text-sm font-bold outline-none text-slate-900 dark:text-white"
        />
        <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">%</span>
      </div>
    </div>
  );
}

function MiniInfo({ label, value }: any) {
  return (
    <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 shadow-2xs">
      <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">{value}</div>
    </div>
  );
}

function MiniPayCard({ title, value }: any) {
  return (
    <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-2xs">
      <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{title}</div>
      <div className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">{value}</div>
    </div>
  );
}
