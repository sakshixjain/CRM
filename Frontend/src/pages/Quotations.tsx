import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import PageHeader from "./Header";
import { CheckCircle2, FileText, Pencil, Printer, RefreshCcw, Save, X } from "lucide-react";
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
        @keyframes crm-shine {
          0% { transform: translateX(-130%) rotate(18deg); opacity: 0; }
          28% { opacity: 0.45; }
          100% { transform: translateX(150%) rotate(18deg); opacity: 0; }
        }
        @keyframes crm-badge-bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
      `}</style>
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-md" onClick={onClose} />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_25%,rgba(16,185,129,0.28),transparent_32%),radial-gradient(circle_at_18%_70%,rgba(251,191,36,0.18),transparent_26%),radial-gradient(circle_at_82%_72%,rgba(56,189,248,0.18),transparent_28%)]" />
      <div className="pointer-events-none absolute inset-0">
        {Array.from({ length: 34 }).map((_, index) => (
          <span
            key={index}
            className="absolute rounded-full shadow-[0_0_18px_rgba(251,191,36,0.85)]"
            style={{
              width: `${5 + (index % 3) * 2}px`,
              height: `${5 + (index % 4)}px`,
              borderRadius: index % 4 === 0 ? "2px" : "999px",
              backgroundColor: ["#fbbf24", "#34d399", "#38bdf8", "#f472b6"][index % 4],
              left: `${(index * 37) % 100}%`,
              bottom: index < 14 ? `${8 + (index * 7) % 78}%` : `${-8 - (index % 5) * 7}%`,
              opacity: index < 14 ? 0.9 : undefined,
              animation: `crm-sparkle-float ${3.6 + (index % 6) * 0.35}s linear ${index < 14 ? -index * 0.22 : index * 0.08}s infinite`,
              ["--spark-x" as any]: `${index % 2 === 0 ? "" : "-"}${18 + (index % 7) * 9}px`,
            }}
          />
        ))}
      </div>
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className="relative w-full max-w-[520px] overflow-hidden rounded-md border border-white/50 bg-white shadow-[0_34px_120px_rgba(0,0,0,0.45)]"
          role="dialog"
          aria-modal="true"
          style={{ animation: "crm-pop-in 260ms ease-out" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-amber-400 via-emerald-400 to-sky-400" />
          <div className="pointer-events-none absolute -left-16 top-0 h-full w-24 bg-white/60 blur-sm" style={{ animation: "crm-shine 2.8s ease-in-out infinite" }} />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-full border border-white/70 bg-white/80 text-slate-500 shadow-sm transition hover:bg-white hover:text-slate-900"
            aria-label="Close congratulations modal"
          >
            <X size={16} />
          </button>
          <div className="relative overflow-hidden bg-[linear-gradient(135deg,#ecfdf5_0%,#ffffff_48%,#fffbeb_100%)] px-7 pb-7 pt-10 text-center">
            <div className="absolute -left-16 -top-16 h-36 w-36 rounded-full bg-emerald-200/45 blur-2xl" />
            <div className="absolute -right-12 top-24 h-32 w-32 rounded-full bg-amber-200/45 blur-2xl" />
            <div className="absolute left-8 top-8 text-2xl font-black text-amber-400">+</div>
            <div className="absolute right-12 top-16 text-xl font-black text-emerald-400">+</div>
            <div className="absolute bottom-10 left-12 text-lg font-black text-sky-400">+</div>
            <div className="absolute bottom-16 right-9 h-2 w-8 rotate-12 rounded-full bg-pink-300/80" />
            <div className="relative mx-auto grid h-24 w-24 place-items-center">
              <div
                className="absolute inset-0 rounded-full bg-emerald-300"
                style={{ animation: "crm-pulse-ring 1.8s ease-in-out infinite" }}
              />
              <div className="absolute inset-2 rounded-full border border-emerald-200 bg-white" />
              <div
                className="relative grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-emerald-500 via-teal-600 to-teal-800 text-white shadow-[0_18px_42px_rgba(16,185,129,0.48)] ring-8 ring-white"
                style={{ animation: "crm-badge-bob 2.4s ease-in-out infinite" }}
              >
                <CheckCircle2 size={42} />
              </div>
            </div>
            <div className="mx-auto mt-6 inline-flex rounded-full border border-emerald-200 bg-white/90 px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.22em] text-emerald-700 shadow-[0_8px_22px_rgba(16,185,129,0.12)]">
              Quotation Converted
            </div>
            <h3 className="mt-4 text-[28px] font-black leading-tight text-slate-950 sm:text-4xl">
              Congratulations, you did it!
            </h3>
            <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-slate-600">
              {name ? `${name}, ` : ""}you converted {context || "this quotation"}.
              This one is a win. Keep the momentum going.
            </p>
        
          </div>
          <div className="border-t border-slate-100 bg-gradient-to-b from-white to-slate-50 px-7 py-5">
            <button
              type="button"
              onClick={onClose}
              className="h-12 w-full rounded-md bg-gradient-to-r from-emerald-600 via-teal-600 to-teal-800 px-4 text-sm font-extrabold text-white shadow-[0_14px_28px_rgba(15,118,110,0.26)] transition hover:translate-y-[-1px] hover:from-emerald-700 hover:to-teal-900"
            >
              Celebrate
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function printQuotation(row: QuotationRow) {
  const amount = Number(row.base_amount || 0);
  const gstAmount = Number(row.gst_amount ?? amount * (Number(row.gst_rate || 0) / 100));
  const totalAmount = Number(row.total_amount ?? amount + gstAmount);
  const advanceAmount = Number(row.advance_amount ?? 0);
  const balanceAmount = Number(row.remaining_amount ?? totalAmount - advanceAmount);
  openQuotationPrintWindow({
    id: row.id,
    client_name: row.client_name,
    client_mobile: row.client_mobile,
    service_name: row.service?.name || row.service_name || slugLabel(String(row.service_type || "")),
    created_at: row.created_at,
    service_desc: row.service_desc || "",
    base_amount: amount,
    gst_rate: Number(row.gst_rate || 0),
    gst_amount: gstAmount,
    total_amount: totalAmount,
    advance_amount: advanceAmount,
    remaining_amount: balanceAmount,
    duration: row.duration || "",
  });
}

export default function Quotations() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rows, setRows] = useState<QuotationRow[]>([]);
  const [search, setSearch] = useState("");
  const [serviceFilter, setServiceFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [serviceOptions, setServiceOptions] = useState<ServiceOption[]>([]);
  const [pendingSecondPaymentDates, setPendingSecondPaymentDates] = useState<Record<number, string>>({});
  const [savingFirstPaymentId, setSavingFirstPaymentId] = useState<number | null>(null);
  const [savingSecondPaymentId, setSavingSecondPaymentId] = useState<number | null>(null);
  const [congratsOpen, setCongratsOpen] = useState(false);
  const [congratsContext, setCongratsContext] = useState("");

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await api.listQuotations({
        page,
        limit: PAGE_SIZE,
        search,
        service_type: serviceFilter,
        status: statusFilter,
        start_date: startDate,
        end_date: endDate,
      });

      setRows(Array.isArray(res.data) ? res.data : []);
      setTotal(Number(res.pagination?.total || 0));
      setPageCount(Number(res.pagination?.pages || 1));
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
  }, [page, search, serviceFilter, statusFilter, startDate, endDate]);

  useEffect(() => {
    const loadServices = async () => {
      try {
        const res = await api.listQuotationServices({ page: 1, limit: 200 });
        const next = Array.isArray(res)
          ? res.map((item: any) => ({
              id: Number(item.id),
              name: String(item.name || ""),
            }))
          : [];
        setServiceOptions(next);
      } catch {
        setServiceOptions([]);
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

  const resetFilters = () => {
    setSearch("");
    setServiceFilter("");
    setStatusFilter("");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  return (
    <div className="w-full">
      <PageHeader
        title="Quotations"
        subtitle="Quotation records from quotations table"
        total={total}
        search={search}
        onSearch={setSearch}
        icon={<FileText size={18} />}
        rightActions={
          <button
            type="button"
            onClick={refresh}
            className="inline-flex items-center gap-2 rounded-md border border-[#233a47] bg-[#233a47] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1c303b]"
          >
            <RefreshCcw size={16} />
            Refresh
          </button>
        }
      />

      <div className="mb-4 rounded-md border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-11 rounded-md border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-slate-300"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-11 rounded-md border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-slate-300"
          />
          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            className="h-11 rounded-md border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-slate-300"
          >
              <option value="">All Services</option>
              {serviceOptions.map((item) => (
                <option key={item.id} value={String(item.id)}>
                  {item.name}
                </option>
              ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-11 rounded-md border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-slate-300"
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="partial">Partial</option>
            <option value="converted">Converted</option>
          </select>
          <button
            type="button"
            onClick={resetFilters}
            className="h-11 rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-800">
              <tr className="text-left text-sm font-semibold text-white">
                <th className="border-r border-slate-600 px-4 py-4">#ID</th>
                <th className="border-r border-slate-600 px-4 py-4">Client</th>
                <th className="border-r border-slate-600 px-4 py-4">Mobile</th>
                <th className="border-r border-slate-600 px-4 py-4">Service</th>
                <th className="border-r border-slate-600 px-4 py-4">Total (₹)</th>
                <th className="border-r border-slate-600 px-4 py-4">Advance (₹)</th>
                <th className="border-r border-slate-600 px-4 py-4">Remaining (₹)</th>
                <th className="border-r border-slate-600 px-4 py-4">Duration</th>
                <th className="border-r border-slate-600 px-4 py-4">Date</th>
                <th className="border-r border-slate-600 px-4 py-4">1st Payment</th>
                <th className="border-r border-slate-600 px-4 py-4">2nd Payment</th>
                <th className="border-r border-slate-600 px-4 py-4">Status</th>
                <th className="px-4 py-4">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={13} className="px-4 py-10 text-center text-sm text-slate-500">
                    Loading quotations...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-4 py-10 text-center text-sm text-slate-500">
                    No quotations found.
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
                      ? "bg-emerald-100 text-emerald-700"
                      : status === "partial"
                        ? "bg-sky-100 text-sky-700"
                        : "bg-amber-100 text-amber-700";

                  return (
                    <tr key={row.id} className="border-t border-slate-200 bg-white align-top">
                      <td className="border-r border-slate-200 px-4 py-4 text-sm text-slate-700">{row.id}</td>
                      <td className="border-r border-slate-200 px-4 py-4 text-sm font-medium text-slate-900">{row.client_name || "-"}</td>
                      <td className="border-r border-slate-200 px-4 py-4 text-sm text-slate-700">{row.client_mobile || "-"}</td>
                      <td className="border-r border-slate-200 px-4 py-4 text-sm text-slate-700">
                        {row.service?.name || row.service_name || slugLabel(String(row.service_type || ""))}
                      </td>
                      <td className="border-r border-slate-200 px-4 py-4 text-sm text-slate-700">{toCurrency(totalAmount)}</td>
                      <td className="border-r border-slate-200 px-4 py-4 text-sm text-slate-700">{toCurrency(advanceAmount)}</td>
                      <td className="border-r border-slate-200 px-4 py-4 text-sm text-slate-700">{toCurrency(balanceAmount)}</td>
                      <td className="border-r border-slate-200 px-4 py-4 text-sm text-slate-700">{row.duration || "-"}</td>
                      <td className="border-r border-slate-200 px-4 py-4 text-sm text-slate-700">{formatDate(row.created_at)}</td>
                      <td className="border-r border-slate-200 px-4 py-4 text-sm text-slate-700">
                        {firstPayment ? (
                          firstPayment
                        ) : (
                          <button
                            type="button"
                            onClick={() => void receiveFirstPayment(row)}
                            disabled={savingFirstPaymentId === row.id}
                            className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
                          >
                            <CheckCircle2 size={14} />
                            {savingFirstPaymentId === row.id ? "Updating..." : "Receive"}
                          </button>
                        )}
                      </td>
                      <td className="border-r border-slate-200 px-4 py-4 text-sm text-slate-700">
                        {showSecondPaymentEditor ? (
                          <div className="min-w-[168px] space-y-2">
                            <input
                              type="date"
                              value={pendingSecondPaymentDates[row.id] || ""}
                              onChange={(e) =>
                                setPendingSecondPaymentDates((prev) => ({
                                  ...prev,
                                  [row.id]: e.target.value,
                                }))
                              }
                              className="h-9 w-full rounded-md border border-slate-300 px-2 text-sm outline-none focus:ring-2 focus:ring-amber-300"
                            />
                            <button
                              type="button"
                              onClick={() => void saveSecondPaymentDate(row)}
                              disabled={savingSecondPaymentId === row.id}
                              className="inline-flex w-full items-center justify-center gap-1 rounded-md bg-gradient-to-r from-pink-600 to-amber-500 px-3 py-2 text-xs font-semibold text-white transition hover:opacity-95"
                            >
                              <Save size={14} />
                              {savingSecondPaymentId === row.id ? "Saving..." : row.second_payment_date ? "Update" : "Save"}
                            </button>
                          </div>
                        ) : (
                          secondPayment
                        )}
                      </td>
                      <td className="border-r border-slate-200 px-4 py-4 text-sm text-slate-700">
                        <span className={`inline-flex rounded-md px-3 py-1.5 text-xs font-semibold ${statusClasses}`}>
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => printQuotation(row)}
                            className="rounded-md border border-rose-300 p-2 text-rose-500 transition hover:bg-rose-50"
                            title="Print quotation"
                          >
                            <Printer size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate(`/create-quotation?id=${row.id}`)}
                            className="rounded-md border border-slate-300 p-2 text-slate-500 transition hover:bg-slate-50"
                            title="Edit quotation"
                          >
                            <Pencil size={16} />
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

        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
          <div className="text-sm text-slate-500">Page {page} of {pageCount}</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:opacity-50"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={page >= pageCount}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <Link
          to="/create-quotation"
          className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          <FileText size={16} />
          Create Quotation
        </Link>
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
