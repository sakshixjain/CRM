// src/pages/LeadHistory.tsx
import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import StatusBadge from "../components/statusBadge";
import PageHeader from "../pages/Header";
import { useParams } from "react-router-dom";
import { useStatuses } from "../store/statusStore";
import { useAgents } from "../store/agentStore";
import { useSources } from "../store/sourceStore";
import toast from "react-hot-toast";
import {
  RefreshCcw,
  X,
  Loader2,
  Save,
  Calendar,
  Tag,
  User,
  CircleDot,
  Globe,
  UserRound,
  Plus,
  Mail,
  Phone,
  ChevronLeft,
  ChevronRight,
  History,
} from "lucide-react";

type Lead = {
  id: number;
  name?: string;
  email?: string;
  contact_no?: string;
  description?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  status_id?: number | null;
  source_id?: number | null;
  assign_to?: number | null;
  status?: { id: number; name: string };
  source?: { id: number; name: string };
  assignedTo?: { id: number; name: string };
};

type DescItem = { name?: string; description?: string; createdAt?: string };

type LeadHistoryRow = {
  id: number;
  lead_id: number;
  followup_date: string | null;
  status_id: number | null;
  changed_by: number | null;
  remark?: string | null;
  created_at?: string;
  updated_at?: string;

  status?: { id: number; name: string; color?: string };
  changedBy?: { id: number; name?: string; email?: string };
  changedByAdmin?: { id: number; name?: string; email?: string };
};

function cn(...cls: Array<string | false | null | undefined>) {
  return cls.filter(Boolean).join(" ");
}

function formatFollowupDate(v: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatUpdatedAt(v?: string) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
}

function splitDatetimeLocal(value: string) {
  const [date, time] = (value || "").split("T");
  return {
    followup_date: date || "",
    followup_time: time ? `${time}:00` : "",
  };
}

function parseDescString(desc: any): DescItem[] {
  if (!desc) return [];
  if (Array.isArray(desc)) return desc;

  if (typeof desc === "string") {
    try {
      const parsed = JSON.parse(desc);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [{ name: "system", description: desc }];
    }
  }

  return [];
}

function getLeadDescriptionText(desc: any) {
  return parseDescString(desc)
    .map((item) => String(item.description || "").trim())
    .filter(Boolean)
    .join("\n\n");
}

export default function LeadHistory() {
  const { leadId } = useParams<{ leadId: string }>();

  const { statuses } = useStatuses();
  const { agents } = useAgents();
  const { sources } = useSources();

  const [rows, setRows] = useState<LeadHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const [lead, setLead] = useState<Lead | null>(null);
  const [leadLoading, setLeadLoading] = useState(true);

  // add modal
  const [addOpen, setAddOpen] = useState(false);

  // form
  const [followupLocal, setFollowupLocal] = useState<string>("");
  const [statusId, setStatusId] = useState<number | "">("");
  const [remark, setRemark] = useState<string>("");

  // ✅ header search (like other pages)
  const [search, setSearch] = useState("");

  // pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const statusMap = useMemo(() => {
    const m = new Map<number, string>();
    statuses.forEach((s: any) => m.set(s.id, s.name));
    return m;
  }, [statuses]);

  const sourceMap = useMemo(() => {
    const m = new Map<number, string>();
    sources.forEach((s: any) => m.set(s.id, s.name));
    return m;
  }, [sources]);

  const agentMap = useMemo(() => {
    const m = new Map<number, string>();
    agents.forEach((a: any) => m.set(a.id, a.name || a.email || ""));
    return m;
  }, [agents]);

  function getChangedByLabel(r: LeadHistoryRow) {
    const relName =
      r.changedByAdmin?.name ||
      r.changedByAdmin?.email ||
      r.changedBy?.name ||
      r.changedBy?.email;
    if (relName) return relName;
    if (r.changed_by) {
      const fromStore = agentMap.get(r.changed_by);
      if (fromStore) return fromStore;
    }
    return "—";
  }

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((r) => {
      const statusName =
        r.status?.name ||
        (r.status_id ? statusMap.get(r.status_id) : "") ||
        "";

      const changedByName = getChangedByLabel(r);

      const followup = r.followup_date ? String(r.followup_date) : "";
      const rem = r.remark ? String(r.remark) : "";

      const hay = `${statusName} ${changedByName} ${followup} ${rem}`.toLowerCase();
      return hay.includes(q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, search, statusMap, agentMap]);

  const total = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startIdx = (page - 1) * pageSize;
  const pageRows = filteredRows.slice(startIdx, startIdx + pageSize);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPages]);

  async function load() {
    if (!leadId) return;

    setLoading(true);
    setLeadLoading(true);

    try {
      const [leadRes, histRes] = await Promise.all([
        api.leads.get(leadId),
        api.getLeadFollowups(Number(leadId)),
      ]);

      setLead(leadRes?.success ? (leadRes.data as Lead) : null);

      const list = (histRes as any)?.data;
      setRows(Array.isArray(list) ? (list as LeadHistoryRow[]) : []);
      setPage(1);
    } catch (e: any) {
      console.error(e);
      setLead(null);
      setRows([]);
    } finally {
      setLeadLoading(false);
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  function openAddModal() {
    setFollowupLocal("");
    setStatusId("");
    setRemark("");
    setAddOpen(true);
  }

  function closeAddModal() {
    setAddOpen(false);
    setFollowupLocal("");
    setStatusId("");
    setRemark("");
  }

  async function createFollowup() {
    if (!leadId) return;

    const { followup_date, followup_time } = splitDatetimeLocal(followupLocal);

    if (!followup_date || !followup_time) {
      toast.error("Follow-up date and time are required");
      return;
    }

    const cleanRemark = remark.trim();
    const payload: any = {
      followup_date,
      followup_time,
      status_id: statusId === "" ? null : Number(statusId),
    };

    if (cleanRemark) payload.remark = cleanRemark;

    setBusyId(-1);
    const toastId = toast.loading("Adding follow-up...");
    try {
      const res = await api.addLeadFollowup(Number(leadId), payload);
      const created = (res as any)?.followup ?? (res as any)?.data?.followup ?? res;

      setRows((prev) => [created as any, ...prev]);
      setPage(1);
      closeAddModal();
      toast.success((res as any)?.message || "Follow-up added successfully", { id: toastId });
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to add follow-up", { id: toastId });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="w-full p-1 sm:p-1">
      {/* ✅ HEADER LIKE OTHER PAGES */}
      <PageHeader
        title="Lead History"
        subtitle="View follow-ups, status changes, and who changed them."
        total={filteredRows.length}
        search={search}
        onSearch={setSearch}
        icon={<History size={18} />}
        rightActions={
          <>
            <button
              onClick={load}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md border border-[#233a47] bg-[#233a47] hover:bg-[#1c303b] transition shadow-sm text-white font-semibold"
              type="button"
            >
              <RefreshCcw size={16} className={cn(loading && "animate-spin")} />
              Refresh
            </button>

            <button
              onClick={openAddModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-slate-900 text-white hover:bg-slate-800 transition shadow-sm font-semibold"
              type="button"
            >
              <Plus size={18} />
              Add Follow-up
            </button>
          </>
        }
      />

      {/* Lead Details */}
      <div className="mb-4 rounded-md border border-slate-200 bg-white shadow-sm">
        <div className="p-3 sm:p-4">
          {leadLoading ? (
            <div className="flex items-center gap-2 text-slate-700 font-semibold">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading lead details...
            </div>
          ) : !lead ? (
            <div className="text-slate-600">Lead not found.</div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-start gap-3">
                <div className="min-w-0">
                  <div className="truncate text-lg font-bold text-slate-900">
                    {lead.name || "—"}
                  </div>
                </div>
              </div>

              <div className="rounded-md border border-slate-200 bg-white p-3">
                <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  Description
                </div>
                <div className="mt-2 whitespace-pre-wrap text-lg leading-5 text-slate-700">
                  {getLeadDescriptionText(lead.description) || "—"}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
                <div className="rounded-md border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-md bg-slate-50">
                      <Mail className="h-4 w-4 text-slate-700" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                        Email
                      </div>
                      <div className="truncate text-sm font-semibold text-slate-900">
                        {lead.email || "—"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-md border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-md bg-slate-50">
                      <Phone className="h-4 w-4 text-slate-700" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                        Phone
                      </div>
                      <div className="truncate text-sm font-semibold text-slate-900">
                        {lead.contact_no || "—"}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="rounded-md border border-slate-200 bg-white p-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-md bg-slate-50">
                      <CircleDot className="h-4 w-4 text-slate-700" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                        Status
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <StatusBadge statusId={lead?.status_id ?? null} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-md border border-slate-200 bg-white p-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-md bg-slate-50">
                      <Globe className="h-4 w-4 text-slate-700" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                        Source
                      </div>
                      <div className="truncate mt-1 text-sm font-bold text-slate-900">
                        {lead?.source?.name ||
                          (lead?.source_id ? sourceMap.get(lead?.source_id) : null) ||
                          "—"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-md border border-slate-200 bg-white p-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-md bg-slate-50">
                      <UserRound className="h-4 w-4 text-slate-700" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                        Assigned To
                      </div>
                      <div className="truncate mt-1 text-sm font-bold text-slate-900">
                        {lead?.assignedTo?.name ||
                          (lead?.assign_to ? agentMap.get(lead?.assign_to) : null) ||
                          "—"}
                      </div>
                    </div>
                  </div>
                </div>
            
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-xs font-bold text-slate-600 uppercase tracking-wide">
                <th className="px-5 py-3">S.No</th>
                <th className="px-5 py-3">Follow-up Date</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Changed By</th>
                <th className="px-5 py-3">Remark</th>
                <th className="px-5 py-3">Updated</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center">
                    <div className="inline-flex items-center gap-2 text-slate-600 font-semibold">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Loading lead history...
                    </div>
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-600">
                    No lead history found.
                  </td>
                </tr>
              ) : (
                pageRows.map((r, idx) => (
                  <tr key={r.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                      {startIdx + idx + 1}
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-700">
                      <div className="inline-flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-slate-500" />
                        {formatFollowupDate(r.followup_date)}
                      </div>
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-700">
                      <div className="inline-flex items-center gap-2">
                        <Tag className="h-4 w-4 text-slate-500" />
                        {r.status?.name ||
                          (r.status_id ? statusMap.get(r.status_id) : null) ||
                          "—"}
                      </div>
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-700">
                      <div className="inline-flex items-center gap-2">
                        <User className="h-4 w-4 text-slate-500" />
                        {getChangedByLabel(r)}
                      </div>
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-700">
                      {r.remark ? r.remark : "—"}
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-600">
                      {formatUpdatedAt(r.updated_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination toolbar */}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-slate-600">
          Showing{" "}
          <span className="font-semibold text-slate-900">
            {total === 0 ? 0 : startIdx + 1}
          </span>
          –
          <span className="font-semibold text-slate-900">
            {Math.min(startIdx + pageSize, total)}
          </span>{" "}
          of <span className="font-semibold text-slate-900">{total}</span>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="px-3 py-2 rounded-md border border-slate-200 bg-white text-sm font-semibold text-slate-800"
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>

          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className={cn(
              "h-10 w-10 rounded-md border border-slate-200 bg-white flex items-center justify-center",
              page <= 1 ? "opacity-50 cursor-not-allowed" : "hover:bg-slate-50"
            )}
            type="button"
            title="Previous"
          >
            <ChevronLeft className="h-5 w-5 text-slate-700" />
          </button>

          <div className="px-3 py-2 rounded-md border border-slate-200 bg-white text-sm font-semibold text-slate-800">
            {page} / {totalPages}
          </div>

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className={cn(
              "h-10 w-10 rounded-md border border-slate-200 bg-white flex items-center justify-center",
              page >= totalPages ? "opacity-50 cursor-not-allowed" : "hover:bg-slate-50"
            )}
            type="button"
            title="Next"
          >
            <ChevronRight className="h-5 w-5 text-slate-700" />
          </button>
        </div>
      </div>

      {/* Add Follow-up Modal */}
      {addOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]" onClick={closeAddModal} />
          <div className="relative flex max-h-[calc(100vh-32px)] w-full max-w-xl flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-[0_28px_90px_rgba(15,23,42,0.38)]">
            <div className="shrink-0 px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-lg font-bold text-slate-900">Add Follow-up</div>
              </div>

              <button
                onClick={closeAddModal}
                className="h-10 w-10 rounded-md border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center"
                type="button"
              >
                <X className="h-5 w-5 text-slate-700" />
              </button>
            </div>

            <div className="sidebar-scroll min-h-0 flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <label className="text-sm font-semibold text-slate-800">
                  Follow-up Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={followupLocal}
                  onChange={(e) => setFollowupLocal(e.target.value)}
                  className="mt-2 w-full px-4 py-3 rounded-md border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
                />
                <p className="mt-1 text-xs text-slate-500">
                  This sends <b>followup_date</b> + <b>followup_time</b>.
                </p>
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-800">Status</label>
                <select
                  value={statusId}
                  onChange={(e) => setStatusId(e.target.value === "" ? "" : Number(e.target.value))}
                  className="mt-2 w-full px-4 py-3 rounded-md border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
                >
                  <option value="">— None —</option>
                  {statuses.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-800">
                  Remark (optional)
                </label>
                <textarea
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  rows={3}
                  className="mt-2 w-full px-4 py-3 rounded-md border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
                  placeholder="Add remark..."
                />
                <p className="mt-1 text-xs text-slate-500">
                  If you type remark, backend should NOT add default “status updated…” remark.
                </p>
              </div>
            </div>

            <div className="shrink-0 px-5 py-4 border-t border-slate-200 bg-white flex items-center justify-end gap-2">
              <button
                onClick={closeAddModal}
                className="px-4 py-2.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 font-semibold text-slate-800"
                type="button"
              >
                Cancel
              </button>

              <button
                onClick={createFollowup}
                disabled={busyId === -1}
                className={cn(
                  "inline-flex items-center gap-2 px-4 py-2.5 rounded-md font-semibold text-white shadow-sm",
                  busyId === -1 ? "bg-slate-400 cursor-not-allowed" : "bg-slate-900 hover:bg-slate-800"
                )}
                type="button"
              >
                {busyId === -1 ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save
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
