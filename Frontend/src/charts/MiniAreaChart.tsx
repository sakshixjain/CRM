import { useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Tooltip,
} from "recharts";

type Props = {
  data: number[];
};

function formatCompact(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export default function MiniAreaChart({ data }: Props) {
  const chartData = useMemo(
    () =>
      (data || []).map((v, i) => ({
        x: i + 1,
        value: Number(v) || 0,
      })),
    [data]
  );

  const total = chartData.reduce((s, r) => s + r.value, 0);
  const last = chartData.at(-1)?.value ?? 0;
  const prev = chartData.at(-2)?.value ?? 0;
  const delta = last - prev;

  if (!chartData.length) return null;

  return (
    <div className="w-full">
      {/* small header inside chart area */}
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[12px] text-slate-500">
          7-day total: <span className="font-semibold text-slate-800">{formatCompact(total)}</span>
        </div>
        <div
          className={
            "text-[12px] font-semibold " +
            (delta >= 0 ? "text-emerald-600" : "text-rose-600")
          }
        >
          {delta >= 0 ? "+" : ""}
          {formatCompact(delta)}
        </div>
      </div>

      <div className="h-[210px] w-full rounded-md bg-gradient-to-b from-slate-50 to-white border border-slate-100">
        <div className="h-full w-full p-3">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 6, right: 6, left: 6, bottom: 0 }}>
              <defs>
                <linearGradient id="leadFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="currentColor" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="currentColor" stopOpacity={0.02} />
                </linearGradient>
              </defs>

              <Tooltip
                cursor={{ stroke: "rgba(15,23,42,0.20)", strokeWidth: 1, strokeDasharray: "4 4" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const v = payload[0].value as number;
                  return (
                    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 shadow-lg">
                      <div className="text-[11px] text-slate-500">Leads</div>
                      <div className="text-sm font-extrabold text-slate-900">{v}</div>
                    </div>
                  );
                }}
              />

              {/* Set chart color via text-* */}
              <Area
                type="monotone"
                dataKey="value"
                stroke="currentColor"
                strokeWidth={2.5}
                fill="url(#leadFill)"
                dot={false}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* apply theme color here */}
      <style>{`:root {}`}</style>
      <div className="hidden text-sky-600" />
    </div>
  );
}
