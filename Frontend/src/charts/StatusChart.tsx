import { useMemo } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

export type Row = { id: string; name: string; value: number };

export default function StatusChart({
  rows,
  loading,
}: {
  rows: Row[];
  loading?: boolean;
}) {
  const total = useMemo(
    () => rows.reduce((s, r) => s + (Number(r.value) || 0), 0),
    [rows]
  );

  const ringData = useMemo(() => {
    const sorted = [...rows].sort((a, b) => b.value - a.value);
    const top = sorted.slice(0, 3);
    const rest = sorted.slice(3).reduce((s, r) => s + (r.value || 0), 0);
    return rest > 0 ? [...top, { id: "rest", name: "Others", value: rest }] : top;
  }, [rows]);

  if (loading) return <div className="h-[240px] rounded-md bg-slate-50 animate-pulse" />;

  const colors = ["#6D28D9", "#F59E0B", "#EF4444", "#CBD5E1"];

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <div className="h-[170px] w-full relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={ringData}
              dataKey="value"
              nameKey="name"
              innerRadius={58}
              outerRadius={78}
              stroke="transparent"
              paddingAngle={3}
            >
              {ringData.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-2xl font-extrabold text-slate-900">{total}</div>
          <div className="text-xs text-slate-500 -mt-1">Total leads</div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
        {rows.map((r, idx) => (
          <div key={r.id} className="flex items-center justify-between text-xs">
            <div className="min-w-0 flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: colors[idx % colors.length] }}
              />
              <span className="truncate text-slate-700">{r.name}</span>
            </div>
            <span className="font-semibold text-slate-900">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
