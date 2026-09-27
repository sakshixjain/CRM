import { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";

export type PaymentStatusTotals = {
  hold: number;
  assign: number;
  unresponsive: number;
  closed: number;
  pending: number;
  done: number;
};

type Row = {
  key: keyof PaymentStatusTotals;
  name: string;
  value: number;
};

type Props = {
  totals?: PaymentStatusTotals;
  loading?: boolean;
  title?: string;
  subtitle?: string;
  height?: number;
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export default function PaymentStatusBarChart({
  totals,
  loading,
  height = 290,
}: Props) {
  /* ================= SAFE TOTALS ================= */

  const safeTotals: PaymentStatusTotals = {
    hold: Number(totals?.hold) || 0,
    unresponsive: Number(totals?.unresponsive) || 0,
    assign: Number(totals?.assign) || 0,
    closed: Number(totals?.closed) || 0,
    pending: Number(totals?.pending) || 0,
    done: Number(totals?.done) || 0,
  };

  /* ================= BUILD ROWS ================= */

  const rows: Row[] = useMemo(() => {
    const base: Row[] = [
      { key: "assign", name: "Assign", value: safeTotals.assign },
      { key: "pending", name: "Pending", value: safeTotals.pending },
      { key: "unresponsive", name: "Unresponsive", value: safeTotals.unresponsive },
      { key: "hold", name: "Hold", value: safeTotals.hold },
      { key: "done", name: "Done", value: safeTotals.done },
      { key: "closed", name: "Closed", value: safeTotals.closed },
    ];

    return [...base].sort((a, b) => b.value - a.value);
  }, [safeTotals]);

  /* ================= MAX VALUE ================= */

  const max = useMemo(() => {
    const m = Math.max(...rows.map((r) => r.value));
    return m <= 0 ? 1 : m;
  }, [rows]);

  const guide = useMemo(
    () => rows.map((r) => ({ ...r, guide: max })),
    [rows, max]
  );

  const totalPayments = useMemo(() => {
    return rows.reduce((sum, r) => sum + r.value, 0);
  }, [rows]);

  /* ================= COLORS ================= */

  const colors: Record<keyof PaymentStatusTotals, string> = {
    assign: "#EAB308",
    pending: "#A855F7",
    hold: "#F97316",
    unresponsive: "#EF4444",
    done: "#10B981",
    closed: "#64748B",
  };

  /* ================= LOADING ================= */

  if (loading) {
    return (
      <div style={{ height }} className="flex flex-col justify-center gap-3">
        <div className="h-6 w-3/4 rounded-md bg-slate-100 dark:bg-slate-800 animate-pulse" />
        <div className="h-6 w-full rounded-md bg-slate-100 dark:bg-slate-800 animate-pulse" />
        <div className="h-6 w-4/5 rounded-md bg-slate-100 dark:bg-slate-800 animate-pulse" />
        <div className="h-6 w-2/3 rounded-md bg-slate-100 dark:bg-slate-800 animate-pulse" />
        <div className="h-6 w-1/2 rounded-md bg-slate-100 dark:bg-slate-800 animate-pulse" />
      </div>
    );
  }

  if (totalPayments === 0) {
    return (
      <div
        style={{ height }}
        className="flex w-full items-center justify-center rounded-md border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-xs font-semibold text-[#8F9CAE]"
      >
        No payment records found for selected range
      </div>
    );
  }

  /* ================= RENDER ================= */

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={guide}
          layout="vertical"
          margin={{ top: 8, right: 30, left: 60, bottom: 8 }}
          barCategoryGap={14}
        >
          <CartesianGrid
            strokeDasharray="4 6"
            horizontal={false}
            stroke="rgba(148, 163, 184, 0.15)"
          />

          <XAxis
            type="number"
            domain={[0, max]}
            tick={{ fontSize: 11, fill: "#8F9CAE" }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />

          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 11, fill: "#94A3B8", fontWeight: 600 }}
            tickLine={false}
            axisLine={false}
          />

          <Tooltip
            cursor={{ fill: "rgba(148, 163, 184, 0.08)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const entry =
                payload.find((p) => p?.dataKey === "value") ??
                payload[payload.length - 1] ??
                payload[0];
              const r: any = entry?.payload;
              if (!r) return null;

              return (
                <div className="rounded-md border border-slate-200/80 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3.5 py-2.5 shadow-xl">
                  <div className="text-[11px] font-bold text-[#8F9CAE]">Status</div>
                  <div className="text-sm font-extrabold text-[#1B2559] dark:text-white capitalize">
                    {r?.name ?? "Unknown"}
                  </div>
                  <div className="mt-1 text-[12px] font-semibold text-[#1B2559] dark:text-white flex items-center justify-between gap-3">
                    <span>Count:</span>
                    <span className="font-extrabold text-[#111C44] dark:text-blue-400">
                      {r?.value ?? 0}
                    </span>
                  </div>
                </div>
              );
            }}
          />

          <Bar
            dataKey="value"
            radius={[0, 6, 6, 0]}
            barSize={16}
          >
            {guide.map((r) => {
              const pct = max > 0 ? r.value / max : 0;
              const opacity = clamp(0.5 + pct * 0.5, 0.5, 1);
              return (
                <Cell
                  key={String(r.key)}
                  fill={colors[r.key]}
                  fillOpacity={opacity}
                />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
