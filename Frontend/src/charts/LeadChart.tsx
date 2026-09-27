import { useMemo } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

type Lead = {
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  changed_by?: number | string | null;
  changedByAdmin?: { id?: number | string | null } | null;
};

type RangeKey = "today" | "yesterday" | "week" | "month" | "year";
type DateRange = { start: Date; end: Date };
type Point = { label: string; value: number; changedByCount: number; sortKey: string };

function pickDate(l: any) {
  return l?.createdAt || l?.created_at || null;
}

function pickUpdatedDate(l: any) {
  return l?.updatedAt || l?.updated_at || null;
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

function monthLabel(idx: number) {
  return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][idx] ?? "";
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

function hasChangedBy(l: Lead) {
  if (l.changed_by != null && l.changed_by !== "") return true;
  const changedByAdminId = l.changedByAdmin?.id;
  return changedByAdminId != null && changedByAdminId !== "";
}

export default function LeadChart({
  leads,
  changedByLeads,
  range,
  dateRange,
  height = 290,
}: {
  leads: Lead[];
  changedByLeads: Lead[];
  range: RangeKey;
  dateRange: DateRange;
  height?: number;
}) {
  const data: Point[] = useMemo(() => {
    const buckets = new Map<string, Point>();

    if (range === "year") {
      for (let i = 0; i < 12; i += 1) {
        const current = new Date(dateRange.start.getFullYear(), i, 1);
        const key = monthKey(current);
        buckets.set(key, {
          label: monthLabel(i),
          value: 0,
          changedByCount: 0,
          sortKey: key,
        });
      }
    } else {
      const cursor = new Date(dateRange.start);
      cursor.setHours(0, 0, 0, 0);
      const last = new Date(dateRange.end);
      last.setHours(0, 0, 0, 0);

      while (cursor <= last) {
        const key = dayKey(cursor);
        buckets.set(key, {
          label: cursor.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
          value: 0,
          changedByCount: 0,
          sortKey: key,
        });
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    for (const l of leads || []) {
      const d = parseDateSafe(pickDate(l));
      if (!d) continue;

      const key = range === "year" ? monthKey(d) : dayKey(d);
      const bucket = buckets.get(key);
      if (!bucket) continue;

      bucket.value += 1;
    }

    for (const l of changedByLeads || []) {
      if (!hasChangedBy(l)) continue;
      const d = parseDateSafe(pickUpdatedDate(l));
      if (!d) continue;

      const key = range === "year" ? monthKey(d) : dayKey(d);
      const bucket = buckets.get(key);
      if (!bucket) continue;

      bucket.changedByCount += 1;
    }

    return Array.from(buckets.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [changedByLeads, dateRange.end, dateRange.start, leads, range]);

  const yMax = useMemo(() => {
    const max = Math.max(0, ...data.flatMap((d) => [d.value, d.changedByCount]));
    return Math.max(4, Math.ceil(max * 1.25));
  }, [data]);

  const NAVY = "#111C44";
  const BLUE = "#2563EB";
  const EMERALD = "#05CD99";

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 10, left: 0, bottom: 10 }}>
          <defs>
            <linearGradient id="fillLeads" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={BLUE} stopOpacity={0.35} />
              <stop offset="100%" stopColor={NAVY} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="4 6" vertical={false} stroke="rgba(112, 144, 176, 0.15)" />

          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#8F9CAE", fontWeight: 500 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={[0, yMax]}
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "#8F9CAE", fontWeight: 500 }}
            tickLine={false}
            axisLine={false}
            width={28}
          />

          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0]?.payload as Point | undefined;
              if (!row) return null;

              return (
                <div className="rounded-md border border-slate-200/80 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3.5 py-2.5 shadow-xl">
                  <div className="text-[11px] font-bold text-[#8F9CAE]">{label}</div>
                  <div className="mt-1 text-[12px] font-semibold text-[#1B2559] dark:text-white flex items-center justify-between gap-3">
                    <span>Leads:</span> <span className="font-extrabold text-[#111C44] dark:text-blue-400">{row.value}</span>
                  </div>
                  <div className="text-[12px] font-semibold text-[#1B2559] dark:text-white flex items-center justify-between gap-3">
                    <span>Changed By:</span> <span className="font-extrabold text-[#05CD99]">{row.changedByCount}</span>
                  </div>
                </div>
              );
            }}
          />

          <Area
            type="monotone"
            dataKey="value"
            stroke={NAVY}
            strokeWidth={3}
            fill="url(#fillLeads)"
            dot={false}
            activeDot={{ r: 5, stroke: "#ffffff", strokeWidth: 2, fill: NAVY }}
          />
          <Line
            type="monotone"
            dataKey="changedByCount"
            stroke={EMERALD}
            strokeWidth={2.5}
            dot={{ r: 3, strokeWidth: 0, fill: EMERALD }}
            activeDot={{ r: 5, stroke: "#ffffff", strokeWidth: 2, fill: EMERALD }}
          />
        </ComposedChart>
      </ResponsiveContainer>

      <div className="-mt-3 ml-3 flex flex-wrap items-center gap-4 text-xs font-semibold text-[#8F9CAE]">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#111C44] dark:bg-blue-500" />
          <span className="text-[#1B2559] dark:text-slate-300">New Leads</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#05CD99]" />
          <span className="text-[#1B2559] dark:text-slate-300">Converted / Changed</span>
        </div>
      </div>
    </div>
  );
}

