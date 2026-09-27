/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Filter,
  RefreshCcw,
  X,
  UserRound,
  CircleDot,
  ChevronLeft,
  ChevronRight,
  History,
  Pencil,
  Trash2,
  Loader2,
  Save,
  Clock,
} from "lucide-react";

import { api } from "../lib/api";
import PageHeader from "../pages/Header";
import { useStatuses } from "../store/statusStore";
import { useNavigate } from "react-router-dom";
import { useAgents } from "../store/agentStore";
import { useAuth } from "../auth/AuthContext";
import toast from "react-hot-toast";

type FollowupRow = any;

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}
function toISODate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
function formatDateTime(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
function getDateInputValue(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function getTimeInputValue(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

// small debounce helper for search
function useDebouncedValue<T>(value: T, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function Followup() {
  const { statuses, fetchStatuses } = useStatuses() as any;
  const { agents, fetchAgents } = useAgents() as any;
  const { user } = useAuth() as any;
  const navigate = useNavigate();

  const isAdmin = user?.role_id === 1;

  // filters
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [statusId, setStatusId] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [changedById, setChangedById] = useState("");
  const [q, setQ] = useState("");
  const [quick, setQuick] = useState<"" | "today" | "tomorrow" | "previous">("");

  // data
  const [rows, setRows] = useState<FollowupRow[]>([]);
  const [loading, setLoading] = useState(false);

  // pagination
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // edit modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<FollowupRow | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editStatusId, setEditStatusId] = useState("");
  const [editRemark, setEditRemark] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // delete state
  const [deletingId, setDeletingId] = useState<number | string | null>(null);

  const debouncedSearch = useDebouncedValue(q, 400);
  const didMount = useRef(false);

  const applyQuick = (type: "today" | "tomorrow" | "previous") => {
    const now = new Date();

    if (type === "today") {
      setQuick("today");
      setFromDate(toISODate(startOfDay(now)));
      setToDate(toISODate(endOfDay(now)));
      return;
    }

    if (type === "tomorrow") {
      const t = new Date(now);
      t.setDate(t.getDate() + 1);
      setQuick("tomorrow");
      setFromDate(toISODate(startOfDay(t)));
      setToDate(toISODate(endOfDay(t)));
      return;
    }

    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    setQuick("previous");
    setFromDate("");
    setToDate(toISODate(endOfDay(y)));
  };

  const resetFilters = () => {
    setFromDate("");
    setToDate("");
    setStatusId("");
    setSourceId("");
    setChangedById("");
    setQ("");
    setQuick("");
    setPage(1);
  };

  const loadFollowups = async (overrides?: Partial<Record<string, any>>) => {
    setLoading(true);
    try {
      const params = {
        from: fromDate || undefined,
        to: toDate || undefined,
        status_id: statusId || undefined,
        source_id: sourceId || undefined,
        changed_by: changedById || undefined,
        search: debouncedSearch?.trim() || undefined,
        sortBy: "followup_date",
        sortOrder: "DESC",
        ...overrides,
      };

      const res = await api.getAllFollowups(params);
      setRows(res?.data || []);
    } catch (e) {
      console.error(e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatuses?.();
    fetchAgents?.();
    loadFollowups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    setPage(1);
    loadFollowups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate, statusId, sourceId, changedById, debouncedSearch, quick]);

  const totalPages = useMemo(() => {
    const n = Math.ceil((rows?.length || 0) / pageSize);
    return n <= 0 ? 1 : n;
  }, [rows?.length]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, page]);

  const openEditModal = (row: FollowupRow) => {
    setEditingRow(row);
    setEditDate(getDateInputValue(row?.followup_date));
    setEditTime(getTimeInputValue(row?.followup_date));
    setEditStatusId(row?.status?.id ? String(row.status.id) : "");
    setEditRemark(row?.remark || row?.note || "");
    setEditOpen(true);
  };

  const closeEditModal = () => {
    if (savingEdit) return;
    setEditOpen(false);
    setEditingRow(null);
    setEditDate("");
    setEditTime("");
    setEditStatusId("");
    setEditRemark("");
  };

  const handleUpdateFollowup = async () => {
    if (!editingRow?.id) return;

    if (!editDate || !editTime) {
      toast.error("Followup date and time are required");
      return;
    }

    try {
      setSavingEdit(true);

      await api.updateFollowup(editingRow.id, {
        followup_date: editDate,
        followup_time: editTime,
        status_id: editStatusId ? Number(editStatusId) : null,
        remark: editRemark,
      });

      closeEditModal();
      await loadFollowups();
      toast.success("Followup updated successfully");
    } catch (e) {
      console.error(e);
      toast.error("Failed to update followup");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteFollowup = async (id: number | string) => {
    if (!isAdmin) return;

    const ok = window.confirm("Are you sure you want to delete this followup?");
    if (!ok) return;

    try {
      setDeletingId(id);
      await api.deleteFollowup(Number(id));
      await loadFollowups();
      toast.success("Followup deleted successfully");

      if (page > 1 && paginated.length === 1) {
        setPage((p) => Math.max(1, p - 1));
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to delete followup");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Follow-ups"
        subtitle="Filter by date, source, status, and agent."
        total={rows.length}
        search={q}
        onSearch={(val: string) => {
          setQuick("");
          setQ(val);
        }}
        icon={<History size={18} />}
        rightActions={
          <button
            type="button"
            onClick={() => loadFollowups()}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md bg-[#111827] dark:bg-purple-600 hover:bg-black dark:hover:bg-purple-700 text-white text-xs font-bold transition shadow-2xs"
          >
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        }
      />

      {/* Filters Card */}
      <div className="rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs transition-colors">
        <div className="p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {(["today", "tomorrow", "previous"] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => applyQuick(key)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                    quick === key
                      ? "bg-[#111827] dark:bg-purple-600 text-white shadow-xs"
                      : "border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                  }`}
                >
                  {key === "today"
                    ? "Today"
                    : key === "tomorrow"
                    ? "Tomorrow"
                    : "Previous"}
                </button>
              ))}
            </div>

            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Showing <span className="font-bold text-slate-900 dark:text-white">{rows.length}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12 items-end">
            <div className="lg:col-span-3">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 block">
                From Date
              </label>
              <div className="flex items-center gap-2 rounded-md border border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60 px-3 py-2">
                <CalendarDays className="h-4 w-4 text-slate-400" />
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => {
                    setQuick("");
                    setFromDate(e.target.value);
                  }}
                  className="w-full bg-transparent text-xs font-semibold text-slate-900 dark:text-white outline-none"
                />
              </div>
            </div>

            <div className="lg:col-span-3">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 block">
                To Date
              </label>
              <div className="flex items-center gap-2 rounded-md border border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60 px-3 py-2">
                <CalendarDays className="h-4 w-4 text-slate-400" />
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => {
                    setQuick("");
                    setToDate(e.target.value);
                  }}
                  className="w-full bg-transparent text-xs font-semibold text-slate-900 dark:text-white outline-none"
                />
              </div>
            </div>

            <div className="lg:col-span-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 block">
                Status
              </label>
              <div className="flex items-center gap-2 rounded-md border border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60 px-3 py-2">
                <CircleDot className="h-4 w-4 text-slate-400" />
                <select
                  value={statusId}
                  onChange={(e) => setStatusId(e.target.value)}
                  className="w-full bg-transparent text-xs font-semibold text-slate-900 dark:text-white outline-none"
                >
                  <option value="" className="dark:bg-slate-900">All</option>
                  {(statuses || []).map((s: any) => (
                    <option key={s.id} value={String(s.id)} className="dark:bg-slate-900">
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="lg:col-span-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 block">
                Agent
              </label>
              <div className="flex items-center gap-2 rounded-md border border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60 px-3 py-2">
                <UserRound className="h-4 w-4 text-slate-400" />
                <select
                  value={changedById}
                  onChange={(e) => setChangedById(e.target.value)}
                  className="w-full bg-transparent text-xs font-semibold text-slate-900 dark:text-white outline-none"
                >
                  <option value="" className="dark:bg-slate-900">All</option>
                  {(agents || []).map((a: any) => (
                    <option key={a.id} value={String(a.id)} className="dark:bg-slate-900">
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="lg:col-span-2">
              <button
                type="button"
                onClick={resetFilters}
                className="w-full flex items-center justify-center gap-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 py-2 px-3 text-xs font-bold transition shadow-2xs"
              >
                <X className="h-3.5 w-3.5" />
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="overflow-hidden rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs transition-colors">
        <div className="px-5 py-4 border-b border-slate-200/70 dark:border-slate-800 flex items-center justify-between">
          <div className="text-sm font-extrabold text-slate-900 dark:text-white">Follow-up History</div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600 mr-2.5" />
            Loading follow-up records...
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-xs font-medium text-slate-400">
            No follow-ups found. Try adjusting your search filters.
          </div>
        ) : (
          <>
            <div className="w-full overflow-x-auto">
              <table className="min-w-[1100px] w-full border-collapse text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200/70 dark:border-slate-800 text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3.5">S.No</th>
                    <th className="px-4 py-3.5">Follow-up Date</th>
                    <th className="px-4 py-3.5">Lead Name</th>
                    <th className="px-4 py-3.5">Contact No</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5">Followed Up By</th>
                    <th className="px-4 py-3.5">Remark</th>
                    <th className="px-4 py-3.5">Updated</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                  {paginated.map((r: any, idx: number) => {
                    const sn = (page - 1) * pageSize + idx + 1;

                    const leadName = r.lead?.name || "—";
                    const leadPhone = r.lead?.contact_no || "—";
                    const statusName = r.status?.name || "—";
                    const byName =
                      r.changedByAdmin?.name ||
                      r.changedByAdmin?.email ||
                      r.changedBy?.name ||
                      r.changedBy?.email ||
                      "—";
                    const remark = r.remark || r.note || "—";

                    return (
                      <tr key={r.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                        <td className="px-4 py-3 font-bold text-slate-500 dark:text-slate-400">
                          {sn}
                        </td>

                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                          {formatDateTime(r.followup_date)}
                        </td>

                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-white max-w-[200px] truncate">
                          {leadName}
                        </td>

                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => r.lead?.id && navigate(`/lead-history/${r.lead.id}`)}
                            className="font-bold text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            {leadPhone}
                          </button>
                        </td>

                        <td className="px-4 py-3">
                          <span className="inline-flex items-center rounded-md border border-slate-200/80 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-0.5 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                            {statusName}
                          </span>
                        </td>

                        <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">
                          {byName}
                        </td>

                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300 max-w-[280px] truncate">
                          {remark}
                        </td>

                        <td className="px-4 py-3 text-slate-400 text-[11px] whitespace-nowrap">
                          {formatDateTime(r.updatedAt || r.updated_at)}
                        </td>

                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openEditModal(r)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition shadow-2xs"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Edit
                            </button>

                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => handleDeleteFollowup(r.id)}
                                disabled={deletingId === r.id}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-xs font-bold text-rose-600 dark:text-rose-400 transition disabled:opacity-50"
                              >
                                {deletingId === r.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="px-5 py-3.5 border-t border-slate-200/70 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Page <span className="font-bold text-slate-900 dark:text-white">{page}</span> of{" "}
                <span className="font-bold text-slate-900 dark:text-white">{totalPages}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Prev
                </button>

                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Edit Modal */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="flex max-h-[calc(100vh-40px)] w-full max-w-xl flex-col overflow-hidden rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl">
            <div className="shrink-0 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Edit Follow-up</h3>
                <p className="text-xs font-medium text-slate-400 mt-0.5">
                  Update follow-up scheduled date, time, status, and remarks.
                </p>
              </div>

              <button
                type="button"
                onClick={closeEditModal}
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-white transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1 block">
                    Followup Date
                  </label>
                  <div className="flex items-center gap-2 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2">
                    <CalendarDays className="h-4 w-4 text-slate-400" />
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="w-full bg-transparent text-xs font-semibold text-slate-900 dark:text-white outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1 block">
                    Followup Time
                  </label>
                  <div className="flex items-center gap-2 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2">
                    <Clock className="h-4 w-4 text-slate-400" />
                    <input
                      type="time"
                      step="1"
                      value={editTime}
                      onChange={(e) => setEditTime(e.target.value)}
                      className="w-full bg-transparent text-xs font-semibold text-slate-900 dark:text-white outline-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1 block">
                  Status
                </label>
                <select
                  value={editStatusId}
                  onChange={(e) => setEditStatusId(e.target.value)}
                  className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-500"
                >
                  <option value="" className="dark:bg-slate-900">Select status</option>
                  {(statuses || []).map((s: any) => (
                    <option key={s.id} value={String(s.id)} className="dark:bg-slate-900">
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1 block">
                  Remark / Note
                </label>
                <textarea
                  value={editRemark}
                  onChange={(e) => setEditRemark(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-medium text-slate-900 dark:text-white outline-none focus:border-blue-500 resize-none"
                  placeholder="Enter followup remark..."
                />
              </div>
            </div>

            <div className="shrink-0 flex items-center justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 px-6 py-4">
              <button
                type="button"
                onClick={closeEditModal}
                disabled={savingEdit}
                className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleUpdateFollowup}
                disabled={savingEdit}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#111827] dark:bg-purple-600 hover:bg-black dark:hover:bg-purple-700 px-4 py-2 text-xs font-bold text-white transition shadow-xs disabled:opacity-60"
              >
                {savingEdit ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
