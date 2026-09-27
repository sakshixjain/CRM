import React, { useEffect, useMemo, useRef, useState } from "react";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";

import { api } from "../lib/api";
import PageHeader from "../pages/Header";
import toast from "react-hot-toast";
import { useAgents } from "../store/agentStore";
import { storage } from "../lib/storage";
import { useAuth } from "../auth/AuthContext";
import { useSearchParams } from "react-router-dom";

import {
  RefreshCcw,
  Plus,
  IndianRupee,
  X,
  Loader2,
  Clock,
  CheckCircle2,
  CircleX,
  AlertCircle,
  UserCheck,
  Trash2,
  Pencil,
  Upload,
  Download,
  WifiOff,
  Filter,
  ChevronDown,
} from "lucide-react";

const emptyForm = {
  date: new Date().toISOString().slice(0, 10),
  lead_id: "",
  lead_name: "",
  caller_id: "",
  contact_no: "", // local number only
  country_code: "91", // ✅ added
  case_location: "",
  case_type: "",
  duration: "",
  field_work: "No",
  total_amount: "",
  received_amount: "",
  status: "assign",
};

const PAYMENT_DURATION_KEY = "crm_payment_duration_options";
const defaultPaymentDurations = ["10-12 days", "7-10 days", "15-20 days", "1-2 days"];

function cn(...cls: Array<string | false | null | undefined>) {
  return cls.filter(Boolean).join(" ");
}

function readArray(key: string, fallback: string[]) {
  if (typeof window === "undefined") return fallback;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function writeArray(key: string, value: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

type PaymentRow = {
  id: number;
  date?: string;
  lead_id?: number | string;
  lead_name?: string;

  caller_id?: number | string;
  caller_name?: string;

  contact_no?: string;
  country_code?: string;
  case_location?: string;
  case_type?: string;
  duration?: string;
  field_work?: string;
  total_amount?: number | string;
  received_amount?: number | string;
  pending_amount?: number | string;
  status?: string;
};

function digitsOnly(value: string) {
  return String(value || "").replace(/\D/g, "");
}

function stripCountryCode(fullValue: string, dialCode: string) {
  const onlyDigits = digitsOnly(fullValue);
  const cc = digitsOnly(dialCode);

  if (cc && onlyDigits.startsWith(cc)) {
    return onlyDigits.slice(cc.length);
  }
  return onlyDigits;
}

function normalizePaymentContact(value: string) {
  const digits = digitsOnly(value);
  if (digits.length > 10 && digits.startsWith("91")) return digits.slice(2);
  return digits;
}

/** ✅ Reusable toast wrapper for async calls */
async function toastApi<T>(
  actionText: string,
  fn: () => Promise<T>,
  opts?: {
    successText?: string;
    errorText?: string;
    silentSuccess?: boolean;
  }
): Promise<T> {
  const id = toast.loading(actionText);
  try {
    const res = await fn();
    if (!opts?.silentSuccess) toast.success(opts?.successText || "Done ✅", { id });
    else toast.dismiss(id);
    return res;
  } catch (e: any) {
    const msg = e?.message || opts?.errorText || "Something went wrong";
    toast.error(msg, { id });
    throw e;
  }
}

function money(n: any) {
  const num = Number(n || 0);
  if (Number.isNaN(num)) return "0";
  return num.toLocaleString("en-IN");
}

function fmtDate(d?: string) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function statusRowBg(statusRaw?: string) {
  const status = (statusRaw || "").toLowerCase();
  if (status === "assign") return "bg-yellow-50/90";
  if (status === "hold") return "bg-orange-50/90";
  if (status === "done") return "bg-emerald-50/90";
  if (status === "pending") return "bg-amber-50/90";
  if (status === "unresponsive") return "bg-red-50/90";
  if (status === "closed") return "bg-rose-50/90";
  return "";
}

function statusPill(statusRaw?: string) {
  const status = (statusRaw || "").toLowerCase();
  const base =
    "inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold border";

  if (status === "assign")
    return cn(base, "bg-yellow-50 text-yellow-700 border-yellow-200");
  if (status === "hold")
    return cn(base, "bg-orange-50 text-orange-800 border-orange-200");
  if (status === "done")
    return cn(base, "bg-emerald-50 text-emerald-700 border-emerald-200");
  if (status === "pending")
    return cn(base, "bg-amber-50 text-amber-800 border-amber-200");
  if (status === "unresponsive")
    return cn(base, "bg-red-50 text-red-700 border-red-200");
  if (status === "closed")
    return cn(base, "bg-rose-50 text-rose-700 border-rose-200");

  return cn(base, "bg-slate-50 text-slate-700 border-slate-200");
}

const DOWNLOAD_DUMMY_URL = "/api/payments/dummy-sheet";
const IMPORT_URL = "/api/payment/import";

export default function Payment() {
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const { agents, loadingAgents: agentsLoading, reload } = useAgents();

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [activeId, setActiveId] = useState<number | null>(null);
  const [form, setForm] = useState<typeof emptyForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [savingFieldWorkId, setSavingFieldWorkId] = useState<number | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [highlightPaymentId, setHighlightPaymentId] = useState<number | null>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [importErr, setImportErr] = useState<string | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);

  const [q, setQ] = useState("");
  const didFilterFetchMount = useRef(false);
  const [durationOptions, setDurationOptions] = useState<string[]>(() =>
    readArray(PAYMENT_DURATION_KEY, defaultPaymentDurations)
  );
  const [showCustomDuration, setShowCustomDuration] = useState(false);

  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState({
    day_range: "",
    from_date: "",
    to_date: "",
    status: "",
    caller_id: "",
    min_amount: "",
    max_amount: "",
  });

  const { user } = useAuth();
  const isAdmin = user?.role_id === 1;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const pendingPreview = useMemo(() => {
    const t = Number(form.total_amount || 0);
    const r = Number(form.received_amount || 0);
    const p = t - r;
    return p < 0 ? 0 : p;
  }, [form.total_amount, form.received_amount]);

  const filteredRows = useMemo(() => {
    const query = q.trim().toLowerCase();

    return rows.filter((r) => {
      const hay = `${r.lead_name || ""} ${r.contact_no || ""} ${
        r.case_location || ""
      } ${r.case_type || ""} ${r.duration || ""} ${r.field_work || ""} ${
        r.status || ""
      }`.toLowerCase();

      const matchesSearch = !query || hay.includes(query);

      const rowDate = r.date ? new Date(r.date) : null;
      const rowOnlyDate = rowDate
        ? new Date(rowDate.getFullYear(), rowDate.getMonth(), rowDate.getDate())
        : null;

      const fromDate = filters.from_date ? new Date(filters.from_date) : null;
      const toDate = filters.to_date ? new Date(filters.to_date) : null;
      const today = new Date();
      const todayOnly = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      );
      const dayRange = Number(filters.day_range || 0);
      const dayStart =
        dayRange > 0
          ? new Date(
              todayOnly.getFullYear(),
              todayOnly.getMonth(),
              todayOnly.getDate() - (dayRange - 1)
            )
          : null;

      const matchesDayRange =
        !dayStart || (rowOnlyDate && rowOnlyDate >= dayStart && rowOnlyDate <= todayOnly);

      const matchesFromDate =
        !fromDate ||
        (rowOnlyDate &&
          rowOnlyDate >=
            new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate()));

      const matchesToDate =
        !toDate ||
        (rowOnlyDate &&
          rowOnlyDate <=
            new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate()));

      const rowStatus = String(r.status || "").toLowerCase();
      const filterStatus = String(filters.status || "").toLowerCase();
      const matchesStatus = !filterStatus || rowStatus === filterStatus;

      const rowCallerId = r.caller_id != null ? String(r.caller_id) : "";
      const matchesAgent =
        !filters.caller_id || rowCallerId === String(filters.caller_id);

      const amount = Number(r.total_amount || 0);
      const minAmount =
        filters.min_amount !== "" ? Number(filters.min_amount) : null;
      const maxAmount =
        filters.max_amount !== "" ? Number(filters.max_amount) : null;

      const matchesMinAmount = minAmount === null || amount >= minAmount;
      const matchesMaxAmount = maxAmount === null || amount <= maxAmount;

      return (
        matchesSearch &&
        matchesDayRange &&
        matchesFromDate &&
        matchesToDate &&
        matchesStatus &&
        matchesAgent &&
        matchesMinAmount &&
        matchesMaxAmount
      );
    });
  }, [rows, q, filters]);

  useEffect(() => setPage(1), [q, pageSize, filters]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredRows.length / pageSize));
  }, [filteredRows.length, pageSize]);

  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    const rawId = searchParams.get("highlightPaymentId");
    if (!rawId) return;

    const paymentId = Number(rawId);
    if (!Number.isFinite(paymentId) || rows.length === 0) return;

    const rowIndex = filteredRows.findIndex((row) => Number(row.id) === paymentId);
    if (rowIndex >= 0) {
      setPage(Math.floor(rowIndex / pageSize) + 1);
    }

    setHighlightPaymentId(paymentId);

    window.setTimeout(() => {
      document
        .getElementById(`payment-row-${paymentId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);

    const next = new URLSearchParams(searchParams);
    next.delete("highlightPaymentId");
    setSearchParams(next, { replace: true });

    const timer = window.setTimeout(() => {
      setHighlightPaymentId(null);
    }, 8000);

    return () => window.clearTimeout(timer);
  }, [filteredRows, pageSize, rows.length, searchParams, setSearchParams]);

  const statusTotals = useMemo(() => {
    const base = {
      assign: 0,
      hold: 0,
      pending: 0,
      done: 0,
      closed: 0,
      unresponsive: 0,
      other: 0,
    };

    for (const r of rows) {
      const s = String(r.status || "").toLowerCase();
      if (s in base) (base as any)[s] += 1;
      else base.other += 1;
    }
    return base;
  }, [rows]);

  const agentNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of agents) {
      map.set(String(a.id), String(a.name || a.email || `Agent #${a.id}`));
    }
    return map;
  }, [agents]);

  const activeFilterCount = useMemo(() => {
    return Object.values(filters).filter((v) => String(v).trim() !== "").length;
  }, [filters]);

  const getCallerName = (r: PaymentRow) => {
    const id = r.caller_id != null ? String(r.caller_id) : "";
    return agentNameById.get(id) || r.caller_name || "—";
  };

  function onFilterChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target;
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function resetFilters() {
    setFilters({
      day_range: "",
      from_date: "",
      to_date: "",
      status: "",
      caller_id: "",
      min_amount: "",
      max_amount: "",
    });
    setPage(1);
  }

  function getPaymentQuery() {
    return {
      day_range: filters.day_range || undefined,
      from_date: filters.from_date || undefined,
      to_date: filters.to_date || undefined,
      status: filters.status || undefined,
      caller_id: filters.caller_id || undefined,
      min_amount: filters.min_amount || undefined,
      max_amount: filters.max_amount || undefined,
      search: q || undefined,
    };
  }

  async function fetchPayments() {
    try {
      setLoading(true);
      const data = await api.listLeadPayments(getPaymentQuery());
      setRows(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to fetch payments");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPayments();
    if (!agents?.length) reload?.();
  }, []);

  useEffect(() => {
    if (!didFilterFetchMount.current) {
      didFilterFetchMount.current = true;
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        setLoading(true);
        const data = await api.listLeadPayments(getPaymentQuery());
        if (!cancelled) setRows(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [q, filters]);

  const downloadDummy = async () => {
    const tId = toast.loading("Downloading sample...");
    try {
      const base = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
      const token = storage.getToken();

      const res = await fetch(`${base}${DOWNLOAD_DUMMY_URL}`, {
        method: "GET",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || "Failed to download");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;

      const contentType = res.headers.get("content-type") || "";
      const isExcel =
        contentType.includes("spreadsheet") || DOWNLOAD_DUMMY_URL.includes("excel");
      a.download = isExcel ? "lead_import_template.xlsx" : "lead_import_template.csv";

      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      toast.success("Sample downloaded ✅", { id: tId });
    } catch (e: any) {
      toast.error(e?.message || "Download failed", { id: tId });
    }
  };

  const openImport = async () => {
    setImportErr(null);
    setImportOpen(true);
    setImportFile(null);
  };

  const closeImport = () => {
    if (importBusy) {
      toast("Import is running... please wait", { icon: "⏳" });
      return;
    }
    setImportOpen(false);
    setImportErr(null);
  };

  const doImport = async () => {
    setImportErr(null);

    if (!importFile) {
      toast.error("Please choose a file (CSV/XLSX)");
      return setImportErr("Please choose a file (CSV/XLSX)");
    }

    setImportBusy(true);
    const tId = toast.loading("Importing leads...");
    try {
      const fd = new FormData();
      fd.append("file", importFile);

      await api.postMultipart(IMPORT_URL, fd);

      toast.success("Leads imported successfully ✅", { id: tId });
      setImportOpen(false);
      setImportFile(null);

      fetchPayments();
    } catch (e: any) {
      const msg = e?.message || "Import failed";
      setImportErr(msg);
      toast.error(msg, { id: tId });
    } finally {
      setImportBusy(false);
    }
  };

  function openCreate() {
    setMode("create");
    setActiveId(null);
    setShowCustomDuration(false);
    setForm({
      ...emptyForm,
      date: new Date().toISOString().slice(0, 10),
      country_code: "91",
    });
    setOpen(true);
  }

  function openEdit(row: PaymentRow) {
    setMode("edit");
    setActiveId(row.id);

    const rawContact = digitsOnly(String(row.contact_no || ""));
    const cc = rawContact.startsWith("91") ? "91" : "";
    const duration = row.duration ?? "";
    setShowCustomDuration(Boolean(duration) && !durationOptions.includes(duration));

    setForm({
      date: row.date ? new Date(row.date).toISOString().slice(0, 10) : "",
      lead_id: (row.lead_id as any) ?? "",
      lead_name: row.lead_name ?? "",
      caller_id: row.caller_id != null ? String(row.caller_id) : "",
      contact_no: cc ? rawContact.slice(cc.length) : rawContact,
      country_code: cc || "91",
      case_location: row.case_location ?? "",
      case_type: row.case_type ?? "",
      duration,
      field_work: row.field_work || "No",
      total_amount: String(row.total_amount ?? ""),
      received_amount: String(row.received_amount ?? ""),
      status: (row.status || "assign").toLowerCase(),
    });

    setOpen(true);
    toast("Edit payment", { icon: "✏️" });
  }

  function closeModal() {
    setOpen(false);
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;

    if (name === "total_amount" || name === "received_amount") {
      const clean = value.replace(/[^\d.]/g, "");
      setForm((p) => ({ ...p, [name]: clean }));
      return;
    }

    setForm((p) => ({ ...p, [name]: value }));
  }

  function rememberDurationOption(value: string) {
    const normalized = value.trim();
    if (!normalized || durationOptions.includes(normalized)) return;

    setDurationOptions((prev) => {
      const next = [...prev, normalized];
      writeArray(PAYMENT_DURATION_KEY, next);
      return next;
    });
  }

  async function updateFieldWork(row: PaymentRow, value: string) {
    const nextValue = value === "Yes" ? "Yes" : "No";
    const previousValue = row.field_work || "No";
    if (previousValue === nextValue || savingFieldWorkId === row.id) return;

    setSavingFieldWorkId(row.id);
    setRows((prev) =>
      prev.map((item) => (item.id === row.id ? { ...item, field_work: nextValue } : item))
    );

    try {
      const payload = { field_work: nextValue };
      const res = await api.updateLeadPayment(row.id, payload);
      const updated = (res as any)?.data;
      if (updated) {
        setRows((prev) => prev.map((item) => (item.id === row.id ? updated : item)));
      }
      toast.success("Field work updated");
    } catch (err: any) {
      setRows((prev) =>
        prev.map((item) =>
          item.id === row.id ? { ...item, field_work: previousValue } : item
        )
      );
      toast.error(err?.message || "Failed to update field work");
    } finally {
      setSavingFieldWorkId(null);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.lead_name.trim()) return toast.error("Lead name is required");
    if (!form.caller_id) return toast.error("Caller (Agent) is required");
    if (!form.contact_no.trim()) return toast.error("Contact no is required");
    if (!form.case_location.trim()) return toast.error("Case location is required");
    if (!form.case_type.trim()) return toast.error("Case type is required");
    if (form.total_amount === "" || Number(form.total_amount) <= 0)
      return toast.error("Total amount must be > 0");
    rememberDurationOption(form.duration);

    const fullContactNo = `${digitsOnly(form.country_code)}${digitsOnly(form.contact_no)}`;
    const normalizedContactNo = normalizePaymentContact(fullContactNo);
    const duplicatePayment = rows.find((row) => {
      if (mode === "edit" && Number(row.id) === Number(activeId)) return false;
      return normalizePaymentContact(String(row.contact_no || "")) === normalizedContactNo;
    });

    if (duplicatePayment) {
      return toast.error("Payment entry with this contact number already exists");
    }

    const payload = {
      date: form.date,
      lead_name: form.lead_name.trim(),
      caller_id: Number(form.caller_id),
      contact_no: normalizedContactNo,
      case_location: form.case_location.trim(),
      case_type: form.case_type.trim(),
      duration: form.duration.trim(),
      field_work: form.field_work === "Yes" ? "Yes" : "No",
      total_amount: Number(form.total_amount || 0),
      received_amount: Number(form.received_amount || 0),
      status:
        (form.status || "Assign").charAt(0).toUpperCase() +
        (form.status || "Assign").slice(1).toLowerCase(),
    };

    try {
      setSaving(true);

      if (mode === "create") {
        const res = await toastApi(
          "Saving payment...",
          () => api.createLeadPayment(payload),
          { successText: "Payment added ✅", errorText: "Failed to save payment" }
        );

        const created = (res as any)?.data;
        if (created) setRows((prev) => [created, ...prev]);
        else fetchPayments();
      } else {
        if (activeId == null) return toast.error("Payment id missing");

        const res = await toastApi(
          "Updating payment...",
          () => api.updateLeadPayment(activeId, payload),
          { successText: "Payment updated ✅", errorText: "Failed to update payment" }
        );

        const updated = (res as any)?.data;
        setRows((prev) =>
          prev.map((r) =>
            r.id === activeId ? updated || { ...r, ...payload, id: activeId } : r
          )
        );
      }

      closeModal();
    } catch (err: any) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function removeRow(id: number) {
    const ok = window.confirm("Delete this payment?");
    if (!ok) return;

    try {
      await toastApi("Deleting payment...", () => api.removeLeadPayment(id), {
        successText: "Payment deleted ✅",
        errorText: "Failed to delete payment",
      });

      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (err: any) {
      console.error(err);
    }
  }

  return (
    <div className="w-full">
      <PageHeader
        title="Payments"
        subtitle="Manage total, received & pending payments"
        total={filteredRows.length}
        search={q}
        icon={<IndianRupee size={18} />}
        onSearch={setQ}
        rightActions={
          <>  
           {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={downloadDummy}
                  className="inline-flex items-center gap-2 px-2 py-2 rounded-md border border-slate-200 bg-white hover:bg-slate-50 transition shadow-sm text-slate-800 font-semibold"
                >
                  <Download size={16} />
                  Download Sample
                </button>

                <button
                  type="button"
                  onClick={openImport}
                  className="inline-flex items-center gap-2 px-2 py-2 rounded-md border border-white/10 bg-[#0b2533]/90 text-white hover:bg-[#123b52] transition shadow-sm font-semibold"
                >
                  <Upload size={16} className="text-white/80" />
                  Import Leads
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setFilterOpen((prev) => !prev)}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2.5 rounded-md border transition shadow-sm text-sm font-semibold",
                filterOpen
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white hover:bg-slate-50 text-slate-800"
              )}
            >
              <Filter size={16} />
              {filterOpen
                ? "Hide Filter"
                : `Filter${activeFilterCount ? ` (${activeFilterCount})` : ""}`}
            </button>

            <button
              onClick={fetchPayments}
              className="px-4 py-2.5 rounded-md border border-[#233a47] bg-[#233a47] hover:bg-[#1c303b] text-sm font-semibold text-white flex items-center gap-2 shadow-sm"
              type="button"
            >
              <RefreshCcw size={16} />
              Refresh
            </button>

            <button
              onClick={openCreate}
              className="px-4 py-2.5 rounded-md bg-slate-900 text-white hover:bg-slate-800 text-sm font-semibold flex items-center gap-2 shadow-sm"
              type="button"
            >
              <Plus size={16} />
              Add Payment
            </button>
          </>
        }
      />

      {filterOpen && (
        <div className="mb-4 rounded-md border border-slate-200 bg-white shadow-sm p-4">
          <div className="flex items-center justify-between ">
            <h3 className="text-sm font-bold text-slate-900">Payment Filters</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-8 gap-4 items-end">
            <div>
              <label className="text-xs font-semibold text-slate-700">Days</label>
              <select
                name="day_range"
                value={filters.day_range}
                onChange={onFilterChange}
                className="mt-1 w-full px-3 py-2.5 rounded-md border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-300 transition"
              >
                <option value="">All Days</option>
                <option value="1">Today</option>
                <option value="7">Last 7 Days</option>
                <option value="15">Last 15 Days</option>
                <option value="30">Last 30 Days</option>
                <option value="90">Last 90 Days</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">From Date</label>
              <input
                type="date"
                name="from_date"
                value={filters.from_date}
                onChange={onFilterChange}
                className="mt-1 w-full px-3 py-2.5 rounded-md border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-300 transition"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">To Date</label>
              <input
                type="date"
                name="to_date"
                value={filters.to_date}
                onChange={onFilterChange}
                className="mt-1 w-full px-3 py-2.5 rounded-md border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-300 transition"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">Status</label>
              <select
                name="status"
                value={filters.status}
                onChange={onFilterChange}
                className="mt-1 w-full px-3 py-2.5 rounded-md border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-300 transition"
              >
                <option value="">All Status</option>
                <option value="assign">Assign</option>
                <option value="hold">Hold</option>
                <option value="unresponsive">Unresponsive</option>
                <option value="closed">Closed</option>
                <option value="pending">Pending</option>
                <option value="done">Done</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">Agent</label>
              <select
                name="caller_id"
                value={filters.caller_id}
                onChange={onFilterChange}
                className="mt-1 w-full px-3 py-2.5 rounded-md border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-300 transition"
              >
                <option value="">
                  {agentsLoading ? "Loading agents..." : "All Agents"}
                </option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">Min Amount</label>
              <input
                type="number"
                name="min_amount"
                value={filters.min_amount}
                onChange={onFilterChange}
                placeholder="0"
                className="mt-1 w-full px-3 py-2.5 rounded-md border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-300 transition"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">Max Amount</label>
              <input
                type="number"
                name="max_amount"
                value={filters.max_amount}
                onChange={onFilterChange}
                placeholder="50000"
                className="mt-1 w-full px-3 py-2.5 rounded-md border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-300 transition"
              />
            </div>

            <div>
              <button
                type="button"
                onClick={resetFilters}
                className="w-full px-3 py-3 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-700"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
        <MiniStat label="Assign" value={statusTotals.assign} />
        <MiniStat label="Hold" value={statusTotals.hold} />
        <MiniStat label="Pending" value={statusTotals.pending} />
        <MiniStat label="Done" value={statusTotals.done} />
        <MiniStat label="Closed" value={statusTotals.closed} />
        <MiniStat label="Unresponsive" value={statusTotals.unresponsive} />
        <MiniStat label="Total" value={rows.length} />
      </div>

      <div className="bg-white rounded-md border border-slate-200/70 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[1320px] w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-xs font-bold text-slate-700">
                <th className="px-5 py-4">S.No</th>
                <th className="px-5 py-4">Date</th>
                <th className="px-5 py-4">Agent Name</th>
                <th className="px-5 py-4">Lead Name</th>
                <th className="px-5 py-4">Contact</th>
                <th className="px-5 py-4">Field Work</th>
                <th className="px-5 py-4">Location</th>
                <th className="px-5 py-4">Case Type</th>
                <th className="px-5 py-4">Duration</th>
                <th className="px-5 py-4 text-right">Total</th>
                <th className="px-5 py-4 text-right">Received</th>
                <th className="px-5 py-4 text-right">Pending</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4 text-right">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td className="px-6 py-14 text-center" colSpan={14}>
                    <div className="flex flex-col items-center justify-center">
                      <Loader2 className="w-8 h-8 text-slate-700 animate-spin mb-3" />
                      <div className="text-slate-700">Loading payments...</div>
                    </div>
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td className="px-6 py-14 text-center" colSpan={14}>
                    <div className="text-slate-600">No payments found.</div>
                  </td>
                </tr>
              ) : (
                pageRows.map((r, idx) => {
                  const total = Number(r.total_amount || 0);
                  const received = Number(r.received_amount || 0);
                  const pendingRaw = r.pending_amount ?? total - received;
                  const pending = Math.max(0, Number(pendingRaw || 0));
                  const status = (r.status || "").toLowerCase();
                  const isHighlighted = highlightPaymentId === Number(r.id);

                  return (
                    <tr
                      id={`payment-row-${r.id}`}
                      key={r.id}
                      className={cn(
                        "transition hover:brightness-[0.98]",
                        statusRowBg(status),
                        isHighlighted &&
                          "animate-pulse bg-amber-200/90 ring-2 ring-inset ring-amber-500"
                      )}
                    >
                      <td className="px-5 py-3 text-slate-700 font-semibold">
                        {(page - 1) * pageSize + idx + 1}
                      </td>

                      <td className="px-5 py-3 text-md text-slate-800">
                        {fmtDate(r.date)}
                      </td>

                      <td className="px-5 py-3">
                        <div className="text-md font-semibold text-slate-900">
                          {getCallerName(r)}
                        </div>
                      </td>

                      <td className="px-5 py-3">
                        <div className="text-md font-semibold text-slate-900">
                          {r.lead_name || "—"}
                        </div>
                      </td>

                      <td  className="px-5 py-3 text-md text-slate-800">
                        {r.contact_no || "—"}
                      </td>

                      <td className="px-5 py-3">
                        <div className="relative inline-flex w-[82px] items-center">
                          <select
                            value={r.field_work || "No"}
                            disabled={savingFieldWorkId === r.id}
                            onChange={(e) => void updateFieldWork(r, e.target.value)}
                            className={cn(
                              "h-9 w-full appearance-none rounded-md border border-slate-200 bg-slate-50 pl-3 pr-8 text-sm font-semibold text-slate-800 shadow-sm outline-none transition",
                              "hover:bg-white focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-slate-200",
                              savingFieldWorkId === r.id && "cursor-not-allowed opacity-60"
                            )}
                            aria-label="Update field work"
                            title="Update field work"
                          >
                            <option value="No">No</option>
                            <option value="Yes">Yes</option>
                          </select>
                          <span className="pointer-events-none absolute right-2.5 text-slate-500">
                            {savingFieldWorkId === r.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <ChevronDown size={14} />
                            )}
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-3 text-md text-slate-800">
                        {r.case_location || "—"}
                      </td>

                      <td className="px-5 py-3 text-md text-slate-800">
                        {r.case_type || "—"}
                      </td>

                      <td className="px-5 py-3 text-md text-slate-800">
                        {r.duration || "â€”"}
                      </td>

                      <td className="px-5 py-3 text-sm text-right font-semibold text-slate-900">
                        ₹{money(total)}
                      </td>

                      <td className="px-5 py-3 text-sm text-right font-semibold text-slate-900">
                        ₹{money(received)}
                      </td>

                      <td className="px-5 py-3 text-sm text-right font-bold text-slate-900">
                        ₹{money(pending)}
                      </td>

                      <td className="px-5 py-3">
                        <span className={statusPill(status)}>
                          {status === "done" ? (
                            <CheckCircle2 size={14} />
                          ) : status === "hold" ? (
                            <AlertCircle size={14} />
                          ) : status === "closed" ? (
                            <CircleX size={14} />
                          ) : status === "assign" ? (
                            <UserCheck size={14} />
                          ) : status === "pending" ? (
                            <Clock size={14} />
                          ) : status === "unresponsive" ? (
                            <WifiOff size={14} />
                          ) : null}
                          {r.status || "—"}
                        </span>
                      </td>

                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openEdit(r)}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-800 shadow-sm"
                            type="button"
                          >
                            <Pencil size={16} />
                            Edit
                          </button>

                      
                             {isAdmin && (   <button
                              onClick={() => removeRow(r.id)}
                              className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-red-200 bg-white hover:bg-red-50 text-sm font-semibold text-red-700 shadow-sm"
                              type="button"
                            >
                              <Trash2 size={16} />
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-4 text-sm text-slate-600 border-t border-slate-200 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span>
              Total rows:{" "}
              <span className="font-bold text-slate-900">{filteredRows.length}</span>
            </span>
            <span className="text-slate-300">•</span>
            <span>
              Page: <span className="font-bold text-slate-900">{page}</span> /{" "}
              {totalPages}
            </span>
          </div>

          <div className="flex items-center gap-2 justify-between sm:justify-end">
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="px-3 py-2 rounded-md border border-slate-200 bg-white text-sm font-semibold text-slate-800"
            >
              <option value={10}>10 / page</option>
              <option value={20}>20 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
            </select>

            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className={cn(
                "px-3 py-2 rounded-md border border-slate-200 bg-white hover:bg-slate-50 font-semibold text-slate-800",
                page <= 1 && "opacity-60 cursor-not-allowed"
              )}
            >
              Prev
            </button>

            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className={cn(
                "px-3 py-2 rounded-md border border-slate-200 bg-white hover:bg-slate-50 font-semibold text-slate-800",
                page >= totalPages && "opacity-60 cursor-not-allowed"
              )}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]" onClick={closeModal} />

          <div className="relative flex max-h-[calc(100vh-32px)] w-[95%] max-w-3xl flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-[0_28px_90px_rgba(15,23,42,0.38)]">
            <div className="shrink-0 px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <div className="text-lg font-bold text-slate-900">
                  {mode === "create" ? "Add Payment" : "Edit Payment"}
                </div>
                <div className="text-xs text-slate-600">
                  Lead is manual now (no lead API)
                </div>
              </div>

              <button
                onClick={closeModal}
                className="w-10 h-10 rounded-md border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-700"
                title="Close"
                type="button"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="sidebar-scroll grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-6 md:grid-cols-2">
                <Field
                  label="Date"
                  name="date"
                  type="date"
                  value={form.date}
                  onChange={onChange}
                />

                <Field
                  label="Lead Name"
                  name="lead_name"
                  value={form.lead_name}
                  onChange={onChange}
                  placeholder="Lead name..."
                />

                <div>
                  <label className="text-xs font-semibold text-slate-700">Agent</label>
                  <select
                    name="caller_id"
                    value={form.caller_id}
                    onChange={onChange}
                    className="mt-1 w-full px-3 py-2.5 rounded-md border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-300 transition"
                  >
                    <option value="">
                      {agentsLoading ? "Loading agents..." : "Select agent"}
                    </option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Contact No
                  </label>
                  <PhoneInput
                    country={"in"}
                    value={`${form.country_code}${form.contact_no || ""}`}
                    onChange={(value, country: any) => {
                      const dialCode = String(country?.dialCode || "");
                      const localNumber = stripCountryCode(value, dialCode);

                      setForm((p) => ({
                        ...p,
                        country_code: dialCode,
                        contact_no: localNumber,
                      }));
                    }}
                    inputStyle={{
                      width: "100%",
                      height: "44px",
                      borderRadius: "12px",
                      border: "1px solid #e2e8f0",
                      fontSize: "14px",
                      paddingLeft: "52px",
                    }}
                    buttonStyle={{
                      borderTopLeftRadius: "12px",
                      borderBottomLeftRadius: "12px",
                      border: "1px solid #e2e8f0",
                      background: "#fff",
                    }}
                    containerStyle={{ width: "100%" }}
                    dropdownStyle={{ width: "300px" }}
                    enableSearch
                    countryCodeEditable={false}
                    placeholder="Phone Number"
                  />
                </div>

                <Field
                  label="Case Location"
                  name="case_location"
                  value={form.case_location}
                  onChange={onChange}
                  placeholder="Mumbai"
                />
                <Field
                  label="Case Type"
                  name="case_type"
                  value={form.case_type}
                  onChange={onChange}
                  placeholder="Civil / Matrimonial / Surveillance..."
                />

                <div>
                  <label className="text-xs font-semibold text-slate-700">Duration</label>
                  <div className="mt-1 space-y-2">
                    <select
                      value={
                        showCustomDuration
                          ? "__custom__"
                          : durationOptions.includes(form.duration)
                          ? form.duration
                          : ""
                      }
                      onChange={(e) => {
                        if (e.target.value === "__custom__") {
                          setShowCustomDuration(true);
                          setForm((p) => ({ ...p, duration: "" }));
                          return;
                        }

                        setShowCustomDuration(false);
                        setForm((p) => ({ ...p, duration: e.target.value }));
                      }}
                      className="w-full px-3 py-2.5 rounded-md border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-300 transition"
                    >
                      <option value="">Select saved duration</option>
                      {durationOptions.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                      <option value="__custom__">Others</option>
                    </select>

                    {showCustomDuration && (
                      <input
                        name="duration"
                        value={form.duration}
                        onChange={onChange}
                        onBlur={(e) => rememberDurationOption(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-md border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-300 transition"
                        placeholder="Enter manual duration, e.g. 25 days"
                      />
                    )}
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Select saved duration or choose Others to add manually.
                  </p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700">Field Work</label>
                  <select
                    name="field_work"
                    value={form.field_work}
                    onChange={onChange}
                    className="mt-1 w-full px-3 py-2.5 rounded-md border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-300 transition"
                  >
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700">Status</label>
                  <select
                    name="status"
                    value={form.status}
                    onChange={onChange}
                    className="mt-1 w-full px-3 py-2.5 rounded-md border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-300 transition"
                  >
                    <option value="assign">Assign</option>
                    <option value="hold">Hold</option>
                    <option value="unresponsive">Unresponsive</option>
                    <option value="closed">Closed</option>
                    <option value="pending">Pending</option>
                    <option value="done">Done</option>
                  </select>
                </div>

                <Field
                  label="Total Amount"
                  name="total_amount"
                  value={form.total_amount}
                  onChange={onChange}
                  placeholder="50000"
                />
                <Field
                  label="Received Amount"
                  name="received_amount"
                  value={form.received_amount}
                  onChange={onChange}
                  placeholder="15000"
                />

                <div className="md:col-span-2">
                  <div className="p-4 rounded-md border border-slate-200 bg-slate-50 flex items-center justify-between">
                    <div>
                      <div className="text-xs text-slate-600">Pending Amount (auto)</div>
                      <div className="text-lg font-bold text-slate-900">
                        ₹{money(pendingPreview)}
                      </div>
                    </div>

                    <span
                      className={cn(
                        "px-3 py-1 rounded-md text-xs font-bold border",
                        pendingPreview === 0
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-amber-50 text-amber-800 border-amber-200"
                      )}
                    >
                      {pendingPreview === 0 ? "Cleared" : "Pending"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="shrink-0 border-t border-slate-200 bg-white px-6 py-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-5 py-2.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-800 shadow-sm"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-md bg-slate-900 text-white hover:bg-slate-800 text-sm font-semibold shadow-sm disabled:opacity-60"
                  disabled={saving}
                >
                  {saving ? "Saving..." : mode === "create" ? "Save Payment" : "Update Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      { importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/45" onClick={closeImport} />

          <div className="relative w-[94%] max-w-xl bg-white rounded-md shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 bg-gradient-to-r from-[#0b2533] via-[#123b52] to-[#0b2533] text-white flex items-center justify-between">
              <div className="font-semibold">Import Leads</div>
              <button
                type="button"
                onClick={closeImport}
                className="p-2 rounded-md hover:bg-white/10 transition"
                disabled={importBusy}
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {importErr && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-md">
                  {importErr}
                </div>
              )}

              {importBusy ? (
                <div className="flex items-center gap-2 text-slate-700">
                  <Loader2 className="animate-spin" size={18} />
                  Importing...
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    File (CSV / XLSX)
                  </label>
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                    className="w-full text-sm file:mr-3 file:px-16 file:py-2 file:rounded-md file:border file:border-slate-200 file:bg-white file:hover:bg-slate-50 file:cursor-pointer cursor-pointer"
                  />
                  <div className="text-[11px] text-slate-500 mt-1">
                    Tip: Download Sample first, then fill and upload.
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row gap-2 sm:justify-end">
              <button
                type="button"
                onClick={downloadDummy}
                className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-md border border-slate-200 bg-white hover:bg-slate-50 transition text-slate-800 font-semibold text-sm"
              >
                <Download size={16} />
                Download Sample
              </button>

              <button
                type="button"
                onClick={doImport}
                disabled={importBusy}
                className={cn(
                  "inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-md",
                  "bg-[#0b2533] text-white font-semibold text-sm hover:bg-[#123b52] transition",
                  importBusy && "opacity-60 cursor-not-allowed"
                )}
              >
                {importBusy ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload size={16} />
                    Import
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

function Field({ label, ...props }: { label: string; [key: string]: any }) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-700">{label}</label>
      <input
        {...props}
        className="mt-1 w-full px-3 py-2.5 rounded-md border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-300 transition"
      />
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex justify-between rounded-md border border-slate-200 bg-white px-3 py-2">
      <div className="text-[15px] text-slate-500 font-semibold">{label}</div>
      <div className="text-lg font-bold text-slate-900">{value}</div>
    </div>
  );
}
