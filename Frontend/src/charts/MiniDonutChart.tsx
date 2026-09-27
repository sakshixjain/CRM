import  { useMemo } from "react";

type MiniDonutChartProps = {
  parts: Array<{ label: string; value: number }>;
  size?: number;
};

export default function MiniDonutChart({ parts, size = 56 }: MiniDonutChartProps) {
  const { arcs, total } = useMemo(() => {
    const t = parts.reduce((a, b) => a + (b.value || 0), 0) || 1;
    let start = 0;

    const colors = ["#0b2533", "#123b52", "#2f6f95", "#6f8fb0", "#94a3b8"];

    const a = parts.map((p, i) => {
      const val = (p.value || 0) / t;
      const end = start + val * Math.PI * 2;
      const arc = { start, end, color: colors[i % colors.length] };
      start = end;
      return arc;
    });

    return { arcs: a, total: t };
  }, [parts]);

  const r = 22;
  const cx = size / 2;
  const cy = size / 2;

  function polar(angle: number) {
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  }

  function arcPath(a0: number, a1: number) {
    const p0 = polar(a0);
    const p1 = polar(a1);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return `M ${p0.x} ${p0.y} A ${r} ${r} 0 ${large} 1 ${p1.x} ${p1.y}`;
  }

  return (
    <div className="flex items-center gap-3">
      <div className="rounded-md bg-slate-50 border border-slate-200 p-2">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth="10" />
          {arcs.map((a, i) => (
            <path
              key={i}
              d={arcPath(a.start - Math.PI / 2, a.end - Math.PI / 2)}
              fill="none"
              stroke={a.color}
              strokeWidth="10"
              strokeLinecap="round"
            />
          ))}
          <circle cx={cx} cy={cy} r="14" fill="#fff" />
        </svg>
      </div>

      <div className="min-w-0">
        <div className="text-[12px] text-slate-500">Total</div>
        <div className="text-lg font-bold text-slate-900">{Math.round(total)}</div>
      </div>
    </div>
  );
}
