/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import PageHeader from "./Header";
import { CheckCircle2, FileText, Pencil, Plus, Printer, RefreshCcw, Save, X } from "lucide-react";
import { api } from "../lib/api";
import toast from "react-hot-toast";
import { openQuotationPrintWindow } from "../lib/quotationPrint";
import { useAuth } from "../auth/AuthContext";

type QuotationRow = {
  id: number;
  client_name: string;
  client_mobile: string;
  service_type: string | number;
  service_name?: string;
  base_amount?: string;
  gst_rate?: number;
  gst_amount?: string | number;
  duration?: string;
  service_desc?: string;
  total_amount?: string | number;
  advance_amount?: string | number;
  remaining_amount?: string | number;
  first_payment_date?: string | null;
  second_payment_date?: string | null;
  created_at: string;
  updated_at: string;
  status?: string;
  service?: {
    id: number;
    name: string;
  } | null;
};

type ServiceOption = {
  id: number;
  name: string;
};
const PAGE_SIZE = 10;

function toCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function slugLabel(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value?: string) {
  if (!value) return "-";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateInputValue(value?: string | null) {
  if (!value) return "";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toISOString().slice(0, 10);
}

function canEditSecondPayment(value?: string | null) {
  if (!value) return true;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return false;
  const diffHours = (Date.now() - dt.getTime()) / (1000 * 60 * 60);
  return diffHours <= 24;
}

function getQuotationStatus(row: QuotationRow) {
  if (row.first_payment_date && row.second_payment_date) return "converted";
  if (row.first_payment_date) return "partial";
  return row.status || "pending";
}

function ConversionCongratsModal({
  open,
  name,
  context,
  onClose,
}: {
  open: boolean;
  name?: string | null;
  context?: string | null;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden">
      <style>{`
        @keyframes crm-sparkle-float {
          0% { transform: translate3d(0, 28px, 0) scale(0.75) rotate(0deg); opacity: 0; }
          18% { opacity: 1; }
          100% { transform: translate3d(var(--spark-x), -92vh, 0) scale(1.2) rotate(260deg); opacity: 0; }
        }
        @keyframes crm-pop-in {
          0% { transform: translateY(18px) scale(0.94); opacity: 0; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes crm-pulse-ring {
          0%, 100% { transform: scale(1); opacity: 0.62; }
          50% { transform: scale(1.16); opacity: 0.18; }
        }
      `}</style>
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-md" onClick={onClose} />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_25%,rgba(16,185,129,0.28),transparent_32%),radial-gradient(circle_at_18%_70%,rgba(251,191,36,0.18),transparent_26%),radial-gradient(circle_at_82%_72%,rgba(56,189,248,0.18),transparent_28%)]" />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          style={{ animation: "crm-pop-in 0.45s cubic-bezier(0.16, 1, 0.3, 1)" }}
          className="relative w-full max-w-md overflow-hidden rounded-md border border-emerald-400/30 bg-white dark:bg-slate-900 p-6 text-center shadow-2xl"
        >
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 shadow-md">
            <CheckCircle2 size={32} />
          </div>

          <h3 className="mt-4 text-xl font-extrabold text-slate-900 dark:text-white">
            🎉 Deal Converted!
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Congratulations {name}! Both payments for <strong className="text-slate-900 dark:text-white">{context}</strong> have been marked as received.
          </p>

          <button
            type="button"
            onClick={onClose}
            className="mt-6 w-full rounded-md bg-[#111827] dark:bg-purple-600 py-2.5 text-xs font-bold text-white hover:bg-black transition shadow-md"
          >
            Continue Working
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Quotations() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rows, setRows] = useState<QuotationRow[]>([]);
  const [serviceOptions, setServiceOptions] = useState<ServiceOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [serviceFilter, setServiceFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [savingSecondPaymentId, setSavingSecondPaymentId] = useState<number | null>(null);
  const [savingFirstPaymentId, setSavingFirstPaymentId] = useState<number | null>(null);
  const [pendingSecondPaymentDates, setPendingSecondPaymentDates] = useState<Record<number, string>>({});
  const [congratsOpen, setCongratsOpen] = useState(false);
  const [congratsContext, setCongratsContext] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const response = await api.listQuotations({
        page,
        limit: PAGE_SIZE,
        search: search.trim() || undefined,
        service_type: serviceFilter || undefined,
        status: statusFilter || undefined,
        from: startDate || undefined,
        to: endDate || undefined,
      });

      const nextRows = Array.isArray(response?.data) ? response.data : [];
      setRows(nextRows);
      setTotal(Number(response?.pagination?.total || nextRows.length));
      setPageCount(Number(response?.pagination?.pages || Math.max(1, Math.ceil(nextRows.length / PAGE_SIZE))));
    } catch (error: any) {
      toast.error(error?.message || "Failed to load quotations");
      setRows([]);
      setTotal(0);
      setPageCount(1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, serviceFilter, statusFilter, startDate, endDate]);

  useEffect(() => {
    const loadServices = async () => {
      try {
        const response = await api.listQuotationServices({ page: 1, limit: 100 });
        const list = Array.isArray(response)
          ? response
          : Array.isArray((response as any)?.data)
            ? (response as any).data
            : [];
        setServiceOptions(list);
      } catch (error) {
        console.error("Failed to load quotation services", error);
      }
    };

    void loadServices();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, serviceFilter, statusFilter, startDate, endDate]);

  useEffect(() => {
    setPendingSecondPaymentDates((prev) => {
      const next: Record<number, string> = {};

      for (const row of rows) {
        next[row.id] = prev[row.id] || formatDateInputValue(row.second_payment_date);
      }

      return next;
    });
  }, [rows]);

  const saveSecondPaymentDate = async (row: QuotationRow) => {
    const secondPaymentDate = pendingSecondPaymentDates[row.id]?.trim();
    if (!secondPaymentDate) {
      toast.error("Select second payment date");
      return;
    }

    const wasConverted = getQuotationStatus(row) === "converted";
    setSavingSecondPaymentId(row.id);
    try {
      await api.updateQuotation(row.id, {
        second_payment_date: secondPaymentDate,
      });

      toast.success("Second payment date updated");
      setPendingSecondPaymentDates((prev) => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
      await refresh();
      if (!wasConverted) {
        setCongratsContext(row.client_name || `quotation #${row.id}`);
        setCongratsOpen(true);
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to update second payment date");
    } finally {
      setSavingSecondPaymentId(null);
    }
  };

  const receiveFirstPayment = async (row: QuotationRow) => {
    const confirmed = window.confirm("Mark the first payment as received?");
    if (!confirmed) return;

    setSavingFirstPaymentId(row.id);
    try {
      await api.updateQuotation(row.id, {
        first_payment_date: new Date().toISOString(),
      });

      toast.success("First payment updated");
      await refresh();
    } catch (error: any) {
      toast.error(error?.message || "Failed to update first payment");
    } finally {
      setSavingFirstPaymentId(null);
    }
  };

  const printQuotation = (row: QuotationRow) => {
    const amount = Number(row.base_amount || 0);
    const gstAmount = Number(row.gst_amount ?? amount * (Number(row.gst_rate || 0) / 100));
    const totalAmount = Number(row.total_amount ?? amount + gstAmount);
    const advanceAmount = Number(row.advance_amount ?? 0);
    const balanceAmount = Number(row.remaining_amount ?? totalAmount - advanceAmount);

    const opened = openQuotationPrintWindow({
      id: row.id,
      client_name: row.client_name,
      client_mobile: row.client_mobile,
      service_name: row.service?.name || row.service_name || slugLabel(String(row.service_type || "")),
      created_at: row.created_at,
      service_desc: row.service_desc || "<p></p>",
      base_amount: amount,
      gst_rate: row.gst_rate,
      gst_amount: gstAmount,
      total_amount: totalAmount,
      advance_amount: advanceAmount,
      remaining_amount: balanceAmount,
      duration: row.duration || "",
    });

    if (!opened) {
      toast.error("Allow popups to print quotation");
    }
  };

  const resetFilters = () => {
    setSearch("");
    setServiceFilter("");
    setStatusFilter("");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Quotations"
        subtitle="Manage and convert customer quotations, track partial payments, and print invoices."
        total={total}
        search={search}
        onSearch={setSearch}
        icon={<FileText size={18} />}
        rightActions={
          <div className="flex items-center gap-2">
            <Link
              to="/create-quotation"
              className="inline-flex items-center gap-1.5 rounded-md bg-[#111827] dark:bg-purple-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-black dark:hover:bg-purple-700 transition shadow-2xs"
            >
              <Plus size={14} />
              New Quotation
            </Link>
            <button
              type="button"
              onClick={refresh}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-2xs"
            >
              <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        }
      />

      {/* Filter Card */}
      <div className="rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs transition-colors">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 items-end">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 block">
              From Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-10 w-full rounded-md border border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60 px-3 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 block">
              To Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-10 w-full rounded-md border border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60 px-3 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 block">
              Service
            </label>
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="h-10 w-full rounded-md border border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60 px-3 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-500"
            >
              <option value="" className="dark:bg-slate-900">All Services</option>
              {serviceOptions.map((item) => (
                <option key={item.id} value={String(item.id)} className="dark:bg-slate-900">
                  {item.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 block">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 w-full rounded-md border border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60 px-3 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-500"
            >
              <option value="" className="dark:bg-slate-900">All Status</option>
              <option value="pending" className="dark:bg-slate-900">Pending</option>
              <option value="partial" className="dark:bg-slate-900">Partial</option>
              <option value="converted" className="dark:bg-slate-900">Converted</option>
            </select>
          </div>

          <div>
            <button
              type="button"
              onClick={resetFilters}
              className="h-10 w-full flex items-center justify-center gap-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-4 text-xs font-bold transition shadow-2xs"
            >
              <X className="h-3.5 w-3.5" />
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="overflow-hidden rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs transition-colors">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200/70 dark:border-slate-800 text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3.5">#ID</th>
                <th className="px-4 py-3.5">Client</th>
                <th className="px-4 py-3.5">Mobile</th>
                <th className="px-4 py-3.5">Service</th>
                <th className="px-4 py-3.5">Total (₹)</th>
                <th className="px-4 py-3.5">Advance (₹)</th>
                <th className="px-4 py-3.5">Remaining (₹)</th>
                <th className="px-4 py-3.5">Duration</th>
                <th className="px-4 py-3.5">Date</th>
                <th className="px-4 py-3.5">1st Payment</th>
                <th className="px-4 py-3.5">2nd Payment</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {loading ? (
                <tr>
                  <td colSpan={13} className="px-4 py-12 text-center text-xs font-semibold text-slate-500">
                    Loading quotations...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-4 py-12 text-center text-xs font-medium text-slate-400">
                    No quotations found. Click &apos;New Quotation&apos; to create one.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const amount = Number(row.base_amount || 0);
                  const gstAmount = Number(row.gst_amount ?? amount * (Number(row.gst_rate || 0) / 100));
                  const totalAmount = Number(row.total_amount ?? amount + gstAmount);
                  const advanceAmount = Number(row.advance_amount ?? 0);
                  const balanceAmount = Number(row.remaining_amount ?? totalAmount - advanceAmount);
                  const status = getQuotationStatus(row);

                  const firstPayment = row.first_payment_date ? formatDate(row.first_payment_date) : null;
                  const secondPayment = row.second_payment_date ? formatDate(row.second_payment_date) : null;
                  const allowSecondEdit = canEditSecondPayment(row.second_payment_date);
                  const showSecondPaymentEditor = !row.second_payment_date || allowSecondEdit;
                  const statusClasses =
                    status === "converted"
                      ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                      : status === "partial"
                        ? "bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-400 border border-sky-200 dark:border-sky-800"
                        : "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-800";

                  return (
                    <tr key={row.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                      <td className="px-4 py-3 font-bold text-slate-500 dark:text-slate-400">#{row.id}</td>
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-white max-w-[150px] truncate">{row.client_name || "-"}</td>
                      <td className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">{row.client_mobile || "-"}</td>
                      <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">
                        {row.service?.name || row.service_name || slugLabel(String(row.service_type || ""))}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{toCurrency(totalAmount)}</td>
                      <td className="px-4 py-3 font-semibold text-emerald-600 dark:text-emerald-400">{toCurrency(advanceAmount)}</td>
                      <td className="px-4 py-3 font-semibold text-rose-600 dark:text-rose-400">{toCurrency(balanceAmount)}</td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">{row.duration || "-"}</td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">{formatDate(row.created_at)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {firstPayment ? (
                          <span className="font-semibold text-slate-700 dark:text-slate-300">{firstPayment}</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void receiveFirstPayment(row)}
                            disabled={savingFirstPaymentId === row.id}
                            className="inline-flex items-center gap-1 rounded-md bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1 text-[11px] font-bold text-white transition shadow-2xs"
                          >
                            <CheckCircle2 size={12} />
                            {savingFirstPaymentId === row.id ? "Updating..." : "Receive"}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {showSecondPaymentEditor ? (
                          <div className="min-w-[150px] space-y-1.5">
                            <input
                              type="date"
                              value={pendingSecondPaymentDates[row.id] || ""}
                              onChange={(e) =>
                                setPendingSecondPaymentDates((prev) => ({
                                  ...prev,
                                  [row.id]: e.target.value,
                                }))
                              }
                              className="h-8 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 text-xs font-medium text-slate-900 dark:text-white outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => void saveSecondPaymentDate(row)}
                              disabled={savingSecondPaymentId === row.id}
                              className="inline-flex w-full items-center justify-center gap-1 rounded-md bg-[#111827] dark:bg-purple-600 hover:bg-black dark:hover:bg-purple-700 px-2.5 py-1 text-[11px] font-bold text-white transition shadow-2xs"
                            >
                              <Save size={12} />
                              {savingSecondPaymentId === row.id ? "Saving..." : row.second_payment_date ? "Update" : "Save"}
                            </button>
                          </div>
                        ) : (
                          <span className="font-semibold text-slate-700 dark:text-slate-300">{secondPayment}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex rounded-md px-2.5 py-0.5 text-[10px] font-bold ${statusClasses}`}>
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => printQuotation(row)}
                            className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1.5 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-2xs"
                            title="Print quotation"
                          >
                            <Printer size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate(`/create-quotation?id=${row.id}`)}
                            className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1.5 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-2xs"
                            title="Edit quotation"
                          >
                            <Pencil size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200/70 dark:border-slate-800 px-5 py-3.5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Page <span className="font-bold text-slate-900 dark:text-white">{page}</span> of <span className="font-bold text-slate-900 dark:text-white">{pageCount}</span></div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={page >= pageCount}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <ConversionCongratsModal
        open={congratsOpen}
        name={user?.name || user?.email || "Team"}
        context={congratsContext}
        onClose={() => setCongratsOpen(false)}
      />
    </div>
  );
}
