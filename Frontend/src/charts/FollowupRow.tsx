import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PhoneCall, MessageSquare, Calendar, CheckCircle2, Search } from "lucide-react";

type FollowUpStatus = string;

export type FollowUpRow = {
  id: string | number;
  leadId?: string | number;
  leadName: string;
  leadPhone?: string;
  agentName?: string;
  note?: string;
  dueAt: string; // ISO string or "YYYY-MM-DD HH:mm:ss"
  status: FollowUpStatus;
};

export type DateRange = { start: Date; end: Date };

function cn(...cls: Array<string | false | null | undefined>) {
  return cls.filter(Boolean).join(" ");
}

function parseDate(s: string) {
  if (!s) return new Date(NaN);
  const isoish = s.includes(" ") && !s.includes("T") ? s.replace(" ", "T") : s;
  return new Date(isoish);
}

function fmtDateTime(d: Date) {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return d.toLocaleString();
  }
}

function StatusPill({ status }: { status?: string }) {
  const label = String(status || "—");
  return (
    <span className="inline-flex items-center rounded-full border border-slate-200/80 dark:border-slate-700 bg-slate-100/70 dark:bg-slate-800/80 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
      {label}
    </span>
  );
}

export default function FollowupTable({
  rows,
  dateRange,
  pageSize = 5,
  onCall,
  onWhatsApp,
  onMarkDone,
}: {
  rows: FollowUpRow[];
  dateRange?: DateRange;
  pageSize?: number;
  onCall?: (row: FollowUpRow) => void;
  onWhatsApp?: (row: FollowUpRow) => void;
  onMarkDone?: (row: FollowUpRow) => void;
}) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [q, rows, dateRange?.start?.getTime(), dateRange?.end?.getTime()]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const start = dateRange?.start ? new Date(dateRange.start) : null;
    const end = dateRange?.end ? new Date(dateRange.end) : null;

    return (rows || []).filter((r) => {
      const due = parseDate(r.dueAt);
      if (Number.isNaN(due.getTime())) return false;

      if (start && end) {
        if (due < start || due > end) return false;
      }

      if (!query) return true;

      const hay = [r.leadName, r.leadPhone, r.agentName, r.note, r.status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return hay.includes(query);
    });
  }, [rows, q, dateRange]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);

  const pageRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  return (
    <div className="w-full rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-[#1E293B] overflow-hidden shadow-sm hover:shadow-md transition-all duration-200">
      {/* Header */}
      <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/70 dark:border-slate-800">
        <div>
          <div className="text-base font-extrabold text-[#1B2559] dark:text-white">Follow-ups</div>
          <div className="text-xs font-medium text-[#8F9CAE] dark:text-slate-400 mt-0.5">
            Scheduled follow-ups for selected dashboard range
          </div>
        </div>

        <div className="relative w-full sm:w-72">
          <Search
            size={14}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8F9CAE] dark:text-slate-400 pointer-events-none"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search lead, agent, phone…"
            className="w-full rounded-md border border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900 pl-9 pr-3.5 py-2 text-xs font-semibold text-[#1B2559] dark:text-white placeholder-[#8F9CAE] focus:outline-none focus:ring-2 focus:ring-[#111C44]/20 dark:focus:ring-blue-500/20"
          />
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block">
        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full">
            <thead className="bg-slate-50/80 dark:bg-slate-900/60 text-left">
              <tr className="text-[11px] font-bold text-[#8F9CAE] dark:text-slate-400 uppercase tracking-wider">
                <th className="px-5 py-3.5">Lead</th>
                <th className="px-5 py-3.5">Contact</th>
                <th className="px-5 py-3.5">Agent</th>
                <th className="px-5 py-3.5">Due Date</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Note</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {pageRows.map((r) => {
                const due = parseDate(r.dueAt);

                return (
                  <tr
                    key={String(r.id)}
                    className="text-sm hover:bg-slate-50/70 dark:hover:bg-slate-800/60 transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      {r.leadId ? (
                        <Link
                          to={`/lead-history/${r.leadId}`}
                          className="font-bold text-[#1B2559] dark:text-white hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                        >
                          {r.leadName}
                        </Link>
                      ) : (
                        <div className="font-bold text-[#1B2559] dark:text-white">{r.leadName}</div>
                      )}
                    </td>

                    <td className="px-5 py-3.5">
                      <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {r.leadPhone || "—"}
                      </div>
                    </td>

                    <td className="px-5 py-3.5">
                      <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {r.agentName || "—"}
                      </div>
                    </td>

                    <td className="px-5 py-3.5">
                      <div className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                        <Calendar size={14} className="text-[#8F9CAE] dark:text-slate-400" />
                        <span>{fmtDateTime(due)}</span>
                      </div>
                    </td>

                    <td className="px-5 py-3.5">
                      <StatusPill status={r.status} />
                    </td>

                    <td className="px-5 py-3.5 text-xs text-slate-500 dark:text-slate-400">
                      <div className="max-w-[320px] truncate">{r.note || "—"}</div>
                    </td>
                  </tr>
                );
              })}

              {!pageRows.length && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-12 text-center text-xs font-semibold text-[#8F9CAE] dark:text-slate-400"
                  >
                    No follow-ups found for the selected timeframe.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden p-4 space-y-3">
        {pageRows.map((r) => {
          const due = parseDate(r.dueAt);

          return (
            <div
              key={String(r.id)}
              className="rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4 shadow-xs"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {r.leadId ? (
                    <Link
                      to={`/lead-history/${r.leadId}`}
                      className="truncate font-extrabold text-[#1B2559] dark:text-white hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                    >
                      {r.leadName}
                    </Link>
                  ) : (
                    <div className="truncate font-extrabold text-[#1B2559] dark:text-white">
                      {r.leadName}
                    </div>
                  )}
                  <div className="text-xs text-[#8F9CAE] dark:text-slate-400 mt-0.5">
                    {r.leadPhone || "—"} • {r.agentName || "—"}
                  </div>
                </div>
                <StatusPill status={r.status} />
              </div>

              <div className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                <Calendar size={14} className="text-[#8F9CAE] dark:text-slate-400" />
                <span>{fmtDateTime(due)}</span>
              </div>

              {r.note && (
                <div className="mt-2 text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                  {r.note}
                </div>
              )}

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => onCall?.(r)}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-md border border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                  type="button"
                >
                  <PhoneCall size={14} />
                  Call
                </button>

                <button
                  onClick={() => onWhatsApp?.(r)}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-md border border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                  type="button"
                >
                  <MessageSquare size={14} />
                  WhatsApp
                </button>

                <button
                  onClick={() => onMarkDone?.(r)}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-[#111C44] dark:bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#0A122E] dark:hover:bg-blue-700 transition"
                  type="button"
                >
                  <CheckCircle2 size={14} />
                  Done
                </button>
              </div>
            </div>
          );
        })}

        {!pageRows.length && (
          <div className="rounded-md border border-dashed border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-6 text-center text-xs font-semibold text-[#8F9CAE] dark:text-slate-400">
            No follow-ups found for the selected timeframe.
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-slate-200/70 dark:border-slate-800 px-5 py-3.5">
        <div className="text-xs text-[#8F9CAE] dark:text-slate-400">
          Showing{" "}
          <span className="font-bold text-[#1B2559] dark:text-slate-200">
            {total === 0 ? 0 : (safePage - 1) * pageSize + 1}
          </span>{" "}
          -{" "}
          <span className="font-bold text-[#1B2559] dark:text-slate-200">
            {Math.min(safePage * pageSize, total)}
          </span>{" "}
          of <span className="font-bold text-[#1B2559] dark:text-slate-200">{total}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            className={cn(
              "rounded-md border px-3 py-1.5 text-xs font-semibold transition cursor-pointer",
              safePage <= 1
                ? "border-slate-200/80 dark:border-slate-800 text-slate-300 dark:text-slate-600 bg-slate-50/50 dark:bg-slate-900 cursor-not-allowed"
                : "border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-xs"
            )}
            type="button"
          >
            Prev
          </button>

          <div className="text-xs font-semibold text-[#8F9CAE] dark:text-slate-400 px-1">
            Page <span className="font-bold text-[#1B2559] dark:text-slate-200">{safePage}</span> / {totalPages}
          </div>

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            className={cn(
              "rounded-md border px-3 py-1.5 text-xs font-semibold transition cursor-pointer",
              safePage >= totalPages
                ? "border-slate-200/80 dark:border-slate-800 text-slate-300 dark:text-slate-600 bg-slate-50/50 dark:bg-slate-900 cursor-not-allowed"
                : "border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-xs"
            )}
            type="button"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
