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
} from "lucide-react";

import { api } from "../lib/api"; // <-- adjust path
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
  return d.toLocaleString();
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

// ✅ small debounce helper for search
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

  // ✅ admin check
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

  // ✅ debounce search so API gets correct filtered data
  const debouncedSearch = useDebouncedValue(q, 400);

  // ✅ avoid double fetch on mount
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

  // ✅ fetch when filters change
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
  const navigate = useNavigate();
  return (
    <div className="space-y-4">
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
          <>
            <button
              type="button"
              onClick={() => loadFollowups()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md border border-[#233a47] bg-[#233a47] hover:bg-[#1c303b] transition shadow-sm text-white font-semibold"
            >
              <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </>
        }
      />

      {/* Filters */}
      <div className="rounded-md border border-slate-200 bg-white shadow-sm">
        <div className="p-4 sm:p-5 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {(["today", "tomorrow", "previous"] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => applyQuick(key)}
                className={[
                  "rounded-full border px-3 py-1.5 text-xs font-bold",
                  quick === key
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                ].join(" ")}
              >
                {key === "today"
                  ? "Today"
                  : key === "tomorrow"
                  ? "Tomorrow"
                  : "Previous"}
              </button>
            ))}

            <div className="ml-auto text-xs text-slate-500 flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Showing <span className="font-semibold text-slate-900">{rows.length}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
            <div className="lg:col-span-3">
              <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                From date
              </label>
              <div className="mt-1 flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2.5">
                <CalendarDays className="h-4 w-4 text-slate-500" />
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => {
                    setQuick("");
                    setFromDate(e.target.value);
                  }}
                  className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none"
                />
              </div>
            </div>

            <div className="lg:col-span-3">
              <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                To date
              </label>
              <div className="mt-1 flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2.5">
                <CalendarDays className="h-4 w-4 text-slate-500" />
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => {
                    setQuick("");
                    setToDate(e.target.value);
                  }}
                  className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none"
                />
              </div>
            </div>

            <div className="lg:col-span-2">
              <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                Status
              </label>
              <div className="mt-1 flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2.5">
                <CircleDot className="h-4 w-4 text-slate-500" />
                <select
                  value={statusId}
                  onChange={(e) => setStatusId(e.target.value)}
                  className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none"
                >
                  <option value="">All</option>
                  {(statuses || []).map((s: any) => (
                    <option key={s.id} value={String(s.id)}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="lg:col-span-2">
              <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                Agent
              </label>
              <div className="mt-1 flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2.5">
                <UserRound className="h-4 w-4 text-slate-500" />
                <select
                  value={changedById}
                  onChange={(e) => setChangedById(e.target.value)}
                  className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none"
                >
                  <option value="">All</option>
                  {(agents || []).map((a: any) => (
                    <option key={a.id} value={String(a.id)}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="xl:col-span-2 flex items-end">
              <button
                type="button"
                onClick={resetFilters}
                className="h-11 w-full inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
              >
                <X className="h-4 w-4" />
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="text-sm font-bold text-slate-900">Follow-up History</div>
        </div>

        {loading ? (
          <div className="p-5 text-slate-700 font-semibold">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-5 text-slate-600">No follow-ups found.</div>
        ) : (
          <>
            <div className="w-full overflow-x-auto">
              <table className="min-w-[1260px] w-full border-collapse">
                <thead className="bg-slate-50">
                  <tr className="text-left">
                    <th className="px-4 py-3 text-[11px] font-extrabold uppercase tracking-wide text-slate-600">
                      S.No
                    </th>
                    <th className="px-4 py-3 text-[11px] font-extrabold uppercase tracking-wide text-slate-600">
                      Follow-up
                    </th>
                    <th className="px-4 py-3 text-[11px] font-extrabold uppercase tracking-wide text-slate-600">
                      Lead
                    </th>
                    <th className="px-4 py-3 text-[11px] font-extrabold uppercase tracking-wide text-slate-600">
                      Contact
                    </th>
                    <th className="px-4 py-3 text-[11px] font-extrabold uppercase tracking-wide text-slate-600">
                      Status
                    </th>
                    <th className="px-4 py-3 text-[11px] font-extrabold uppercase tracking-wide text-slate-600">
                      Followed Up By
                    </th>
                    <th className="px-4 py-3 text-[11px] font-extrabold uppercase tracking-wide text-slate-600">
                      Remark
                    </th>
                    <th className="px-4 py-3 text-[11px] font-extrabold uppercase tracking-wide text-slate-600">
                      Updated
                    </th>
                    <th className="px-4 py-3 text-[11px] font-extrabold uppercase tracking-wide text-slate-600">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
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
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="text-sm font-bold text-slate-900">{sn}</div>
                        </td>

                        <td className="px-4 py-3">
                          <div className="text-md font-bold text-slate-900">
                            {formatDateTime(r.followup_date)}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <div className="max-w-[220px] truncate text-sm font-semibold text-slate-900">
                            {leadName}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => r.lead?.id && navigate(`/lead-history/${r.lead.id}`)}
                            className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                          >
                            {leadPhone}
                          </button>
                        </td>

                        <td className="px-4 py-3">
                          <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-700">
                            {statusName}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <div className="text-xs text-slate-500">
                            <span className="font-semibold text-slate-700">{byName}</span>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <div className="max-w-[340px] truncate text-md text-slate-800">
                            {remark}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <div className="text-xs text-slate-600">
                            {formatDateTime(r.updatedAt || r.updated_at)}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openEditModal(r)}
                               className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-slate-200 bg-white hover:bg-slate-50
                          text-sm font-semibold text-slate-800 shadow-sm"
                            >
                              <Pencil className="h-4 w-4" />
                              Edit
                            </button>

                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => handleDeleteFollowup(r.id)}
                                disabled={deletingId === r.id}
                                className={[
                                  "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-bold",
                                  deletingId === r.id
                                    ? "border-red-200 bg-white text-red-400 cursor-not-allowed"
                                    : "border-red-200 bg-white text-red-700 hover:bg-red-50",
                                ].join(" ")}
                              >
                                {deletingId === r.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
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

            <div className="px-4 py-3 border-t border-slate-200 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-slate-600">
                Page <span className="font-semibold text-slate-900">{page}</span> of{" "}
                <span className="font-semibold text-slate-900">{totalPages}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className={[
                    "inline-flex items-center gap-1 rounded-md border px-3 py-2 text-xs font-bold",
                    page <= 1
                      ? "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                  ].join(" ")}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Prev
                </button>

                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className={[
                    "inline-flex items-center gap-1 rounded-md border px-3 py-2 text-xs font-bold",
                    page >= totalPages
                      ? "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                  ].join(" ")}
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
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]">
          <div className="flex max-h-[calc(100vh-32px)] w-full max-w-2xl flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-[0_28px_90px_rgba(15,23,42,0.38)]">
            <div className="shrink-0 flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Edit Follow-up</h3>
                <p className="text-sm text-slate-500">
                  Update follow-up date, time, status, and remark.
                </p>
              </div>

              <button
                type="button"
                onClick={closeEditModal}
                className="rounded-md border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="sidebar-scroll min-h-0 flex-1 overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  Followup date
                </label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="mt-1 h-11 w-full rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-900 outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  Followup time
                </label>
                <input
                  type="time"
                  step="1"
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                  className="mt-1 h-11 w-full rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-900 outline-none focus:border-slate-400"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  Status
                </label>
                <select
                  value={editStatusId}
                  onChange={(e) => setEditStatusId(e.target.value)}
                  className="mt-1 h-11 w-full rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-900 outline-none focus:border-slate-400"
                >
                  <option value="">Select status</option>
                  {(statuses || []).map((s: any) => (
                    <option key={s.id} value={String(s.id)}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  Remark
                </label>
                <textarea
                  value={editRemark}
                  onChange={(e) => setEditRemark(e.target.value)}
                  rows={4}
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-3 text-sm text-slate-900 outline-none focus:border-slate-400 resize-none"
                  placeholder="Enter followup remark"
                />
              </div>
            </div>

            <div className="shrink-0 flex items-center justify-end gap-3 border-t border-slate-200 bg-white px-5 py-4">
              <button
                type="button"
                onClick={closeEditModal}
                disabled={savingEdit}
                className="inline-flex h-11 items-center justify-center rounded-md border border-slate-200 px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleUpdateFollowup}
                disabled={savingEdit}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingEdit ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
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
