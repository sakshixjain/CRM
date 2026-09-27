import React from "react";
import { Search } from "lucide-react";

export default function PageHeader({
  title,
  subtitle,
  total,
  search,
  icon,
  onSearch,
  rightActions,
}: {
  title: string;
  subtitle?: string;
  total?: number;
  search?: string;
  icon: React.ReactNode;
  onSearch?: (v: string) => void;
  rightActions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-[#1E293B] p-5 shadow-xs transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* LEFT */}
        <div className="flex items-center gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#111C44]/10 dark:bg-white/10 text-[#111C44] dark:text-white font-extrabold shadow-2xs">
            {icon}
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-[#1B2559] dark:text-white tracking-tight">
              {title}
            </h2>
            <div className="text-xs font-medium text-[#8F9CAE] dark:text-slate-400 mt-0.5">
              {subtitle}
              {typeof total === "number" && (
                <span className="ml-2 font-bold text-[#111C44] dark:text-blue-400">
                  • Total: {total.toLocaleString("en-IN")}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {search !== undefined && onSearch && (
            <div className="relative w-full sm:w-[300px]">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8F9CAE]"
              />
              <input
                value={search}
                onChange={(e) => onSearch(e.target.value)}
                placeholder="Search..."
                className="w-full rounded-md border border-slate-200/80 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/80 py-2 pl-9 pr-3 text-xs font-medium text-[#1B2559] dark:text-white placeholder:text-[#8F9CAE] dark:placeholder:text-slate-500 focus:border-blue-500 dark:focus:border-blue-400 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/15 transition"
              />
            </div>
          )}

          {rightActions}
        </div>
      </div>
    </div>
  );
}
