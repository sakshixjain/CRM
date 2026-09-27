import { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

type Row = {
  id: string | number;
  name: string;
  value: number; // assigned leads / total leads
  changedByValue?: number; // changed_by count
};

export default function AgentCircleChart({
  rows,
  loading,
  height = 290,
}: {
  rows: Row[];
  loading?: boolean;
  height?: number;
}) {
  const data = useMemo(() => {
    return (rows || [])
      .map((r) => ({
        id: String(r.id),
        name: String(r.name || ""),
        value: Number(r.value) || 0,
        changedByValue: Number(r.changedByValue) || 0,
      }))
      .filter((x) => x.value > 0 || x.changedByValue > 0)
      .sort((a, b) => (b.value + b.changedByValue) - (a.value + a.changedByValue));
  }, [rows]);

  if (loading) {
    return (
      <div style={{ height }} className="flex flex-col justify-center gap-3">
        <div className="h-6 w-1/3 rounded-md bg-slate-100 dark:bg-slate-800 animate-pulse" />
        <div className="h-6 w-full rounded-md bg-slate-100 dark:bg-slate-800 animate-pulse" />
        <div className="h-6 w-4/5 rounded-md bg-slate-100 dark:bg-slate-800 animate-pulse" />
        <div className="h-6 w-2/3 rounded-md bg-slate-100 dark:bg-slate-800 animate-pulse" />
      </div>
    );
  }

  if (!data.length) {
    return (
      <div
        style={{ height }}
        className="flex w-full items-center justify-center rounded-md border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-xs font-semibold text-[#8F9CAE]"
      >
        No agent activity found for selected range
      </div>
    );
  }

  return (
    <div style={{ height }} className="w-full overflow-hidden">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 12, right: 10, left: -25, bottom: data.length > 6 ? 24 : 6 }}
          barCategoryGap={10}
          barGap={2}
        >
          <CartesianGrid strokeDasharray="4 6" vertical={false} stroke="rgba(148, 163, 184, 0.15)" />

          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: "#8F9CAE" }}
            axisLine={false}
            tickLine={false}
            interval={0}
            angle={data.length > 6 ? -20 : 0}
            textAnchor={data.length > 6 ? "end" : "middle"}
            height={data.length > 6 ? 40 : 25}
          />

          <YAxis
            tick={{ fontSize: 11, fill: "#8F9CAE" }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />

          <Tooltip
            shared={false}
            cursor={{ fill: "rgba(148, 163, 184, 0.08)" }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;

              const activeEntry = payload[0];
              const activeLabel =
                activeEntry?.dataKey === "changedByValue" ? "Converted / Changed" : "Assigned Leads";
              const activeValue = activeEntry?.value || 0;

              return (
                <div className="rounded-md border border-slate-200/80 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3.5 py-2.5 shadow-xl">
                  <div className="text-[11px] font-bold text-[#8F9CAE]">Agent</div>
                  <div className="text-sm font-extrabold text-[#1B2559] dark:text-white">{label}</div>

                  <div className="mt-1 text-[12px] font-semibold text-[#1B2559] dark:text-white flex items-center justify-between gap-3">
                    <span>{activeLabel}:</span>
                    <span className="font-extrabold text-[#111C44] dark:text-blue-400">
                      {String(activeValue)}
                    </span>
                  </div>
                </div>
              );
            }}
          />

          <Legend
            wrapperStyle={{ fontSize: "11px", paddingTop: "6px" }}
            formatter={(value) => {
              if (value === "value") return <span className="text-slate-600 dark:text-slate-300 font-medium">Assigned Leads</span>;
              if (value === "changedByValue") return <span className="text-slate-600 dark:text-slate-300 font-medium">Converted / Changed</span>;
              return value;
            }}
          />

          <Bar
            dataKey="value"
            name="value"
            fill="#3B82F6"
            radius={[6, 6, 0, 0]}
            maxBarSize={28}
          />

          <Bar
            dataKey="changedByValue"
            name="changedByValue"
            fill="#05CD99"
            radius={[6, 6, 0, 0]}
            maxBarSize={28}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
