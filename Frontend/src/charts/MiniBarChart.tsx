import  { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Tooltip,
  Cell,
} from "recharts";

type Props = {
  data: number[];
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function MiniBarChart({ data }: Props) {
  const chartData = useMemo(() => {
    const arr = (data || []).map((v, i) => ({
      i,
      value: Number(v) || 0,
    }));
    // keep stable even with all zeros
    const max = Math.max(1, ...arr.map((x) => x.value));
    return arr.map((x) => ({ ...x, pct: x.value / max }));
  }, [data]);

  if (!chartData.length) return null;

  return (
    <div className="h-[210px] w-full rounded-md bg-gradient-to-b from-slate-50 to-white border border-slate-100">
      <div className="h-full w-full p-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 6, right: 6, left: 6, bottom: 6 }}>
            <Tooltip
              cursor={{ fill: "rgba(15,23,42,0.04)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as any;
                return (
                  <div className="rounded-md border border-slate-200 bg-white px-3 py-2 shadow-lg">
                    <div className="text-[11px] text-slate-500">Leads</div>
                    <div className="text-sm font-extrabold text-slate-900">{row.value}</div>
                  </div>
                );
              }}
            />

            <Bar dataKey="value" radius={[10, 10, 10, 10]} barSize={18}>
              {chartData.map((entry) => {
                // create a subtle “depth” effect without needing hardcoded colors
                const op = clamp(0.35 + entry.pct * 0.65, 0.35, 1);
                return (
                  <Cell
                    key={entry.i}
                    fill={`rgba(2, 132, 199, ${op})`}
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* bottom “labels” as dots (cleaner than ugly X-axis text) */}
        <div className="mt-2 grid grid-cols-6 gap-2">
          {chartData.slice(0, 6).map((x) => (
            <div key={x.i} className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full rounded-full bg-sky-500"
                style={{ width: `${Math.round(x.pct * 100)}%` }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
