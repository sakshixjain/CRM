/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Loader2,
  Pencil,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Trash2,
  X,
  XCircle,
} from "lucide-react";

import { api } from "../lib/api";
import PageHeader from "./Header";
import { useAuth } from "../auth/AuthContext";
import toast from "react-hot-toast";

type YesNo = "yes" | "no";

type LeadOption = {
  id: number;
  name?: string | null;
  full_name?: string | null;
  lead_name?: string | null;
  contact_no?: string | null;
};

type FieldWorkRow = {
  id: number;
  lead_id?: number | null;
  lead?: LeadOption | null;
  days?: string | null;
  number?: string | null;
  remarks?: string | null;
  report_submit: YesNo;
  recheck: YesNo;
  proof: YesNo;
  case_type?: string | null;
  amount?: string | number | null;
  createdAt?: string;
  updatedAt?: string;
  created_at?: string;
  updated_at?: string;
};

type FormState = {
  lead_id: string;
  days: string;
  number: string;
  remarks: string;
  report_submit: YesNo;
  recheck: YesNo;
  proof: YesNo;
  case_type: string;
  amount: string;
};

const defaultForm: FormState = {
  lead_id: "",
  days: "",
  number: "",
  remarks: "",
  report_submit: "no",
  recheck: "no",
  proof: "no",
  case_type: "",
  amount: "",
};

function formatDateTime(value?: string) {
  if (!value) return "—";

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) return value;

  return d.toLocaleString();
}

function getLeadName(lead?: LeadOption | null) {
  return lead?.name || lead?.full_name || lead?.lead_name || "";
}

function normalizeList(res: any): any[] {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.data?.data)) return res.data.data;
  if (Array.isArray(res?.leads)) return res.leads;
  if (Array.isArray(res?.data?.leads)) return res.data.leads;
  return [];
}

function useDebouncedValue<T>(value: T, delay = 400) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return debounced;
}

function YesNoBadge({ value }: { value?: YesNo }) {
  const yes = value === "yes";

  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold",
        yes
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-red-200 bg-red-50 text-red-700",
      ].join(" ")}
    >
      {yes ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
      {yes ? "Yes" : "No"}
    </span>
  );
}

export default function FieldWork() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth() as any;

  const highlightLeadId = useMemo(() => {
    const raw = searchParams.get("highlightLeadId");
    return raw ? Number(raw) : null;
  }, [searchParams]);
  const isAdmin = user?.role_id === 1;

  const [rows, setRows] = useState<FieldWorkRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [q, setQ] = useState("");
  const [caseType, _setCaseType] = useState("");
  const [reportSubmit, _setReportSubmit] = useState("");
  const [recheck, _setRecheck] = useState("");
  const [proof, _setProof] = useState("");

  const debouncedSearch = useDebouncedValue(q, 400);
  const didMount = useRef(false);

  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<FieldWorkRow | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [leadSearch, setLeadSearch] = useState("");
  const [leadResults, setLeadResults] = useState<LeadOption[]>([]);
  const [selectedLead, setSelectedLead] = useState<LeadOption | null>(null);
  const [leadLoading, setLeadLoading] = useState(false);

  const loadFieldWorks = async () => {
    setLoading(true);

    try {
      const res = await api.getAllFieldWorks({
        search: debouncedSearch?.trim() || undefined,
        case_type: caseType || undefined,
        report_submit: reportSubmit || undefined,
        recheck: recheck || undefined,
        proof: proof || undefined,
      });

      setRows(normalizeList(res));
    } catch (e) {
      console.error(e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const searchLeads = async (value: string) => {
    setLeadSearch(value);
    setSelectedLead(null);
    setForm((prev) => ({ ...prev, lead_id: "" }));

    if (!value.trim()) {
      setLeadResults([]);
      return;
    }

    setLeadLoading(true);

    try {
      const res = await api.leads.list({
        search: value,
        limit: 10,
      });

      setLeadResults(normalizeList(res));
    } catch (error) {
      console.error(error);
      setLeadResults([]);
    } finally {
      setLeadLoading(false);
    }
  };

  const selectLead = (lead: LeadOption) => {
    setSelectedLead(lead);
    setLeadSearch(getLeadName(lead));
    setLeadResults([]);
    setForm((prev) => ({
      ...prev,
      lead_id: String(lead.id),
    }));
  };

  const clearSelectedLead = () => {
    setSelectedLead(null);
    setLeadSearch("");
    setLeadResults([]);
    setForm((prev) => ({
      ...prev,
      lead_id: "",
    }));
  };

  const handleLeadOpen = (row: FieldWorkRow) => {
    if (!row.lead_id) return;

    navigate(`/lead-history/${row.lead_id}`);
  };

  useEffect(() => {
    if (!highlightLeadId || rows.length === 0) return;

    const index = rows.findIndex((r) => Number(r.lead_id) === highlightLeadId);
    if (index !== -1) {
      const targetPage = Math.floor(index / pageSize) + 1;
      if (page !== targetPage) {
        setPage(targetPage);
      }
    }
  }, [highlightLeadId, rows, page]);

  useEffect(() => {
    if (!highlightLeadId || loading || rows.length === 0) return;

    const targetRow = rows.find((r) => Number(r.lead_id) === highlightLeadId);
    if (!targetRow) return;

    const timer = setTimeout(() => {
      const el = document.getElementById(`fieldwork-row-${targetRow.id}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [highlightLeadId, loading, rows]);

  useEffect(() => {
    loadFieldWorks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }

    setPage(1);
    loadFieldWorks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, caseType, reportSubmit, recheck, proof]);

  const totalPages = useMemo(() => {
    const n = Math.ceil(rows.length / pageSize);
    return n <= 0 ? 1 : n;
  }, [rows.length]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, page]);

  const openCreateModal = () => {
    setEditingRow(null);
    setForm(defaultForm);
    setLeadSearch("");
    setSelectedLead(null);
    setLeadResults([]);
    setModalOpen(true);
  };

  const openEditModal = (row: FieldWorkRow) => {
    const leadName = getLeadName(row.lead);

    setEditingRow(row);
    setSelectedLead(row.lead_id ? { id: Number(row.lead_id), ...row.lead } : null);
    setLeadSearch(leadName);
    setLeadResults([]);

    setForm({
      lead_id: row.lead_id ? String(row.lead_id) : "",
      days: row.days || "",
      number: row.number || "",
      remarks: row.remarks || "",
      report_submit: row.report_submit || "no",
      recheck: row.recheck || "no",
      proof: row.proof || "no",
      case_type: row.case_type || "",
      amount: row.amount ? String(row.amount) : "",
    });

    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;

    setModalOpen(false);
    setEditingRow(null);
    setForm(defaultForm);
    setLeadSearch("");
    setSelectedLead(null);
    setLeadResults([]);
  };

  const updateForm = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!form.lead_id) {
      toast.error("Please search and select a lead name first.");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        lead_id: Number(form.lead_id),
        days: form.days || null,
        number: form.number || null,
        remarks: form.remarks || null,
        report_submit: form.report_submit,
        recheck: form.recheck,
        proof: form.proof,
        case_type: form.case_type || null,
        amount: form.amount ? Number(form.amount) : 0,
      };

      if (editingRow?.id) {
        await api.updateFieldWork(editingRow.id, payload);
      } else {
        await api.createFieldWork(payload);
      }

      closeModal();
      await loadFieldWorks();
      toast.success(editingRow?.id ? "Field work updated successfully" : "Field work created successfully");
    } catch (e) {
      console.error(e);
      toast.error("Failed to save field work");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!isAdmin) return;

    const ok = window.confirm("Are you sure you want to delete this field work?");
    if (!ok) return;

    try {
      setDeletingId(id);
      await api.deleteFieldWork(id);
      await loadFieldWorks();
      toast.success("Field work deleted successfully");
    } catch (e) {
      console.error(e);
      toast.error("Failed to delete field work");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Field Work"
        subtitle="Manage report submit, recheck, proof and field amount."
        total={rows.length}
        search={q}
        onSearch={setQ}
        icon={<BriefcaseBusiness size={18} />}
        rightActions={
          <>
            <button
              type="button"
              onClick={loadFieldWorks}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md border border-[#233a47] bg-[#233a47] hover:bg-[#1c303b] transition shadow-sm text-white font-semibold"
            >
              <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>

            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md border border-emerald-600 bg-emerald-600 hover:bg-emerald-700 transition shadow-sm text-white font-semibold"
            >
              <Plus size={16} />
              Add Field Work
            </button>
          </>
        }
      />


      <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
        <div className="px-4 py-3 border-b border-slate-200">
          <div className="text-sm font-bold text-slate-900">Field Work Records</div>
          <div className="text-xs text-slate-500">All field work entries.</div>
        </div>

        {loading ? (
          <div className="p-5 text-slate-700 font-semibold">Loading...</div>
        ) : rows.length === 0 ? (
          <div className="p-5 text-slate-600">No field work found.</div>
        ) : (
          <>
            <div className="w-full overflow-x-auto">
              <table className="min-w-[1280px] w-full border-collapse">
                <thead className="bg-slate-50">
                  <tr className="text-left">
                    {[
                      "S.No",
                      "Lead",
                      "Days",
                      "Number",
                      "Case Type",
                      "Report Submit",
                      "Recheck",
                      "Proof",
                      "Amount",
                      "Remarks",
                      "Updated",
                      "Actions",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-[11px] font-extrabold uppercase tracking-wide text-slate-600"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
                  {paginated.map((r, idx) => {
                    const leadName = getLeadName(r.lead);
                    const isHighlighted = highlightLeadId !== null && Number(r.lead_id) === highlightLeadId;

                    return (
                      <tr
                        key={r.id}
                        id={`fieldwork-row-${r.id}`}
                        className={`transition-all duration-300 hover:bg-slate-50 ${
                          isHighlighted
                            ? "bg-blue-50/80 outline outline-2 outline-blue-500 outline-offset-[-2px] shadow-sm"
                            : ""
                        }`}
                      >
                        <td className="px-4 py-3 text-sm font-bold text-slate-900">
                          {(page - 1) * pageSize + idx + 1}
                        </td>

                        <td className="px-4 py-3">
                          {r.lead_id ? (
                            <button
                              type="button"
                              onClick={() => handleLeadOpen(r)}
                              className="text-left group"
                            >
                              <div className="text-sm font-bold text-blue-700 group-hover:underline">
                                {leadName || "No Lead Name"}
                              </div>

                              <div className="text-xs font-semibold text-slate-500">
                                Lead No: {r.lead?.contact_no || "—"}
                              </div>
                            </button>
                          ) : (
                            <span className="text-sm font-bold text-slate-400">No Lead</span>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1  px-3 py-1 text-sm font-bold text-slate-700">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {r.days || "—"}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-sm font-semibold text-blue-600">
                          {r.number || "—"}
                        </td>

                        <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                          {r.case_type || "—"}
                        </td>

                        <td className="px-4 py-3">
                          <YesNoBadge value={r.report_submit} />
                        </td>

                        <td className="px-4 py-3">
                          <YesNoBadge value={r.recheck} />
                        </td>

                        <td className="px-4 py-3">
                          <YesNoBadge value={r.proof} />
                        </td>

                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 px-3 py-1 text-sm font-bold text-slate-900">
                            <CircleDollarSign className="h-3.5 w-3.5" />
                            {r.amount || 0}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <div className="max-w-[280px] truncate text-sm text-slate-700">
                            {r.remarks || "—"}
                          </div>
                        </td>

                        <td className="px-4 py-3 text-xs text-slate-600">
                          {formatDateTime(r.updatedAt || r.updated_at)}
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {isAdmin && (   
                            <button
                              type="button"
                              onClick={() => openEditModal(r)}
                              className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-800 shadow-sm"
                            >
                              <Pencil className="h-4 w-4" />
                              Edit
                            </button>

                            )}

                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => handleDelete(r.id)}
                                disabled={deletingId === r.id}
                                className="inline-flex items-center gap-2 rounded-md border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-60"
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

            <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between">
              <div className="text-xs text-slate-600">
                Page <b>{page}</b> of <b>{totalPages}</b>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-2 text-xs font-bold disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Prev
                </button>

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-2 text-xs font-bold disabled:opacity-50"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]">
          <div className="flex max-h-[calc(100vh-32px)] w-full max-w-3xl flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-[0_28px_90px_rgba(15,23,42,0.38)]">
            <div className="shrink-0 flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {editingRow ? "Edit Field Work" : "Add Field Work"}
                </h3>
                <p className="text-sm text-slate-500">
                  Search lead by name and add field work details.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="rounded-md border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="sidebar-scroll min-h-0 flex-1 overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2 relative">
                <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  Lead Name
                </label>

                <div className="mt-1 flex items-center gap-2 rounded-md border border-slate-200 px-3">
                  <Search className="h-4 w-4 text-slate-500" />

                  <input
                    type="text"
                    value={leadSearch}
                    onChange={(e) => searchLeads(e.target.value)}
                    className="h-11 w-full bg-transparent text-sm font-semibold text-slate-900 outline-none"
                    placeholder="Search lead name..."
                  />

                  {leadLoading && <Loader2 className="h-4 w-4 animate-spin text-slate-500" />}

                  {leadSearch && (
                    <button
                      type="button"
                      onClick={clearSelectedLead}
                      className="rounded-full p-1 text-slate-500 hover:bg-slate-100"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {selectedLead && (
                  <div className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
                    Selected Lead: {getLeadName(selectedLead)} {selectedLead.contact_no ? `(${selectedLead.contact_no})` : ""}
                  </div>
                )}

                {leadResults.length > 0 && (
                  <div className="absolute left-0 right-0 z-50 mt-2 max-h-64 overflow-auto rounded-md border border-slate-200 bg-white shadow-xl">
                    {leadResults.map((lead) => (
                      <button
                        key={lead.id}
                        type="button"
                        onClick={() => selectLead(lead)}
                        className="block w-full border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50 last:border-b-0"
                      >
                        <div className="text-sm font-bold text-slate-900">
                          {getLeadName(lead) || "No Lead Name"}
                        </div>

                        <div className="text-xs font-semibold text-slate-500">
                          Lead No: {lead.contact_no || "—"}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {[
                ["Days", "days", "text"],
                ["Number", "number", "text"],
                ["Case Type", "case_type", "text"],
                ["Amount", "amount", "number"],
              ].map(([label, key, type]: any) => (
                <div key={key}>
                  <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    {label}
                  </label>
                  <input
                    type={type}
                    value={(form as any)[key]}
                    onChange={(e) => updateForm(key, e.target.value)}
                    className="mt-1 h-11 w-full rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-900 outline-none focus:border-slate-400"
                    placeholder={`Enter ${label.toLowerCase()}`}
                  />
                </div>
              ))}

              {[
                ["Report Submit", "report_submit"],
                ["Recheck", "recheck"],
                ["Proof", "proof"],
              ].map(([label, key]: any) => (
                <div key={key}>
                  <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    {label}
                  </label>
                  <select
                    value={(form as any)[key]}
                    onChange={(e) => updateForm(key, e.target.value)}
                    className="mt-1 h-11 w-full rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-900 outline-none focus:border-slate-400"
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </div>
              ))}

              <div className="md:col-span-2">
                <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  Remarks
                </label>
                <textarea
                  value={form.remarks}
                  onChange={(e) => updateForm("remarks", e.target.value)}
                  rows={4}
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-3 text-sm text-slate-900 outline-none focus:border-slate-400 resize-none"
                  placeholder="Enter remarks"
                />
              </div>
            </div>

            <div className="shrink-0 flex items-center justify-end gap-3 border-t border-slate-200 bg-white px-5 py-4">
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="inline-flex h-11 items-center justify-center rounded-md border border-slate-200 px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {saving ? (
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
