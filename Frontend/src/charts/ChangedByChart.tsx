import { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

type Row = {
  id: string | number;
  name: string;
  changedByValue?: number;
};

export default function ChangedByChart({
  rows,
  loading,
}: {
  rows: Row[];
  loading?: boolean;
}) {
  const data = useMemo(() => {
    return (rows || [])
      .map((row) => ({
        id: String(row.id),
        name: String(row.name || ""),
        changedByValue: Number(row.changedByValue) || 0,
      }))
      .filter((row) => row.changedByValue > 0)
      .sort((a, b) => b.changedByValue - a.changedByValue);
  }, [rows]);

  if (loading) {
    return (
      <div className="rounded-md border border-slate-200 bg-white p-2">
        <div className="h-5 w-32 animate-pulse rounded bg-slate-100" />
        <div className="mt-2 h-56 animate-pulse rounded-md bg-slate-50" />
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="flex h-64 items-center justify-center rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-500">
        No changed-by data found
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden">
      <div className="h-[290px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 8, left: -24, bottom: 2 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12, fill: "#475569" }}
              axisLine={false}
              tickLine={false}
              interval={0}
              angle={data.length > 5 ? -20 : 0}
              textAnchor={data.length > 5 ? "end" : "middle"}
              height={data.length > 5 ? 58 : 30}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "#475569" }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ fill: "rgba(148,163,184,0.08)" }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;

                const changed = payload[0]?.value || 0;
                return (
                  <div className="rounded-md border border-slate-200 bg-white px-3 py-2 shadow-lg">
                    <div className="text-[11px] text-slate-500">Agent</div>
                    <div className="text-sm font-extrabold text-slate-900">{label}</div>
                    <div className="mt-2 text-[13px] text-slate-600">
                      Changed By:{" "}
                      <span className="font-semibold text-slate-900">{String(changed)}</span>
                    </div>
                  </div>
                );
              }}
            />
            <Bar
              dataKey="changedByValue"
              name="Changed By"
              fill="rgba(14,116,144,0.9)"
              radius={[8, 8, 0, 0]}
              maxBarSize={42}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
