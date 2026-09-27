import React from "react";

type Props = {
  title: string;
  subtitle?: string;
  value?: string;
  right?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
};

export default function ChartCard({ title, subtitle, value, right, icon, children }: Props) {
  return (
    <div className="rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-[#1E293B] shadow-sm hover:shadow-md transition-all duration-200">
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            {icon ? (
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#111C44] dark:bg-blue-600 text-white shrink-0 shadow-sm">
                {icon}
              </span>
            ) : null}
            <div className="min-w-0">
              <div className="text-base font-bold text-[#1B2559] dark:text-white truncate">{title}</div>
              {subtitle ? (
                <div className="mt-0.5 text-xs font-medium text-[#8F9CAE] dark:text-slate-400 truncate">{subtitle}</div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {value ? (
            <div className="text-sm font-extrabold text-[#1B2559] dark:text-white">{value}</div>
          ) : null}
          {right}
        </div>
      </div>

      <div className="px-5 pb-5 pt-4">{children}</div>
    </div>
  );
}

