import React from "react";

type Col<T> = {
  key: keyof T | "actions";
  title: string;
  render?: (row: T) => React.ReactNode;
};

export default function Table<T extends { id?: number | string }>({
  cols,
  rows,
}: {
  cols: Col<T>[];
  rows: T[];
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
      <table className="w-full border-collapse min-w-[650px] text-left">
        <thead>
          <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
            {cols.map((c) => (
              <th
                key={String(c.key)}
                className="px-4 py-3.5"
              >
                {c.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-sm">
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={cols.length}
                className="px-4 py-8 text-center text-slate-400 dark:text-slate-500 font-medium"
              >
                No records found
              </td>
            </tr>
          ) : (
            rows.map((r, idx) => (
              <tr
                key={String(r.id ?? idx)}
                className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors text-slate-800 dark:text-slate-200"
              >
                {cols.map((c) => (
                  <td key={String(c.key)} className="px-4 py-3.5">
                    {c.render ? c.render(r) : String(r[c.key as keyof T] ?? "—")}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
