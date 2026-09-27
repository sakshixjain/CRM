import { useMemo } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts";

type RangeKey = "today" | "yesterday" | "month" | "year";

type Lead = {
  createdAt?: string;
  created_at?: string;
  source_id?: number | string;
};

type Source = { id: number | string; name?: string };

function pickDate(l: any) {
  return l?.createdAt || l?.created_at || null;
}

function parseDateSafe(dt: any) {
  if (!dt) return null;
  if (dt instanceof Date && !isNaN(dt.getTime())) return dt;

  if (typeof dt === "string") {
    const s = dt.includes("T") ? dt : dt.replace(" ", "T");
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d;
  }

  if (typeof dt === "number") {
    const d = new Date(dt);
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

function inRangeByKey(d: Date, range: RangeKey) {
  const now = new Date();

  if (range === "today") return dayKey(d) === dayKey(now);

  if (range === "yesterday") {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return dayKey(d) === dayKey(y);
  }

  if (range === "month") return monthKey(d) === monthKey(now);

  return d.getFullYear() === now.getFullYear();
}

const COLORS = [
  "#111C44",
  "#2563EB",
  "#38BDF8",
  "#05CD99",
  "#8B5CF6",
  "#F59E0B",
  "#64748B",
  "#EC4899",
];

export default function SourceBudgetStyleChart({
  leads,
  sources,
  range,
  height = 265,
}: {
  leads: Lead[];
  sources: Source[];
  range: RangeKey;
  height?: number;
}) {
  const sourceNameById = useMemo(() => {
    const m = new Map<string, string>();
    (sources || []).forEach((s) =>
      m.set(String(s.id), String(s.name || `Source ${s.id}`))
    );
    return m;
  }, [sources]);

  const filteredLeads = useMemo(() => {
    return (leads || []).filter((l) => {
      const d = parseDateSafe(pickDate(l));
      return d ? inRangeByKey(d, range) : false;
    });
  }, [leads, range]);

  const totalFilteredCount = filteredLeads.length;

  const data = useMemo(() => {
    const counts = new Map<string, number>();

    filteredLeads.forEach((l) => {
      const sid = l.source_id == null ? "" : String(l.source_id);
      if (!sid) return;
      counts.set(sid, (counts.get(sid) || 0) + 1);
    });

    return (sources || [])
      .map((s, idx) => {
        const id = String(s.id);
        const name = sourceNameById.get(id) || `Source ${id}`;
        const value = counts.get(id) || 0;
        const color = COLORS[idx % COLORS.length];
        return { id, name, value, color };
      })
      .filter((item) => item.value > 0);
  }, [filteredLeads, sources, sourceNameById]);

  return (
    <div>
      <div style={{ height }} className="relative flex items-center justify-center">
        {data.length === 0 ? (
          <div className="flex h-full w-full items-center justify-center rounded-md border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-xs font-semibold text-[#8F9CAE]">
            No source data found for selected range
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={96}
                  paddingAngle={3}
                  stroke="white"
                  strokeWidth={2}
                >
                  {data.map((entry) => (
                    <Cell key={entry.id} fill={entry.color} />
                  ))}
                </Pie>

                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const p: any = payload[0]?.payload;

                    return (
                      <div className="rounded-md border border-slate-200/80 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3.5 py-2.5 shadow-xl">
                        <div className="text-[11px] font-bold text-[#8F9CAE]">Source</div>
                        <div className="text-sm font-extrabold text-[#1B2559] dark:text-white">
                          {p?.name}
                        </div>
                        <div className="mt-1 text-[12px] font-semibold text-[#1B2559] dark:text-white flex items-center justify-between gap-3">
                          <span>Leads:</span>
                          <span className="font-extrabold text-[#111C44] dark:text-blue-400">
                            {p?.value ?? 0}
                          </span>
                        </div>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Center Total Overlay */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-xl font-extrabold text-[#1B2559] dark:text-white leading-none">
                {totalFilteredCount}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#8F9CAE] mt-0.5">
                Total
              </span>
            </div>
          </>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
        {data.map((s) => {
          const pct = totalFilteredCount > 0 ? Math.round((s.value / totalFilteredCount) * 100) : 0;
          return (
            <div key={s.id} className="flex items-center gap-2 text-xs">
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ background: s.color }}
              />
              <span className="text-slate-600 dark:text-slate-300 font-medium">{s.name}</span>
              <span className="font-bold text-[#1B2559] dark:text-white">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}