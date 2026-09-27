/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BriefcaseBusiness,
  FileText,
  IndianRupee,
  RefreshCcw,
  CheckCircle2,
  Clock,
  LayoutDashboard,
} from "lucide-react";
import toast from "react-hot-toast";
import ChartCard from "../charts/ChartCard";
import PageHeader from "./Header";
import { api } from "../lib/api";

type QuotationRow = {
  id: number;
  created_at?: string;
  total_amount?: string | number;
  service_type?: string | number | null;
  status?: string | null;
  first_payment_date?: string | null;
  second_payment_date?: string | null;
  service?: {
    id: number;
    name: string;
  } | null;
};

type ServiceRow = {
  id: number;
  name: string;
};

type RangeKey = "today" | "yesterday" | "week" | "month" | "year";
type DateRange = { start: Date; end: Date };

function toNumber(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getQuotationStatus(row: QuotationRow) {
  if (row.first_payment_date && row.second_payment_date) return "converted";
  if (row.first_payment_date) return "partial";
  return row.status || "pending";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value || 0);
}

function slugLabel(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function startOfDayUTC(d: Date) {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function endOfDayUTC(d: Date) {
  const x = new Date(d);
  x.setUTCHours(23, 59, 59, 999);
  return x;
}

function getDateRange(range: RangeKey, year?: number): DateRange {
  const now = new Date();
  const todayStart = startOfDayUTC(now);
  const todayEnd = endOfDayUTC(now);

  if (range === "today") return { start: todayStart, end: todayEnd };

  if (range === "yesterday") {
    const y = new Date(now);
    y.setUTCDate(y.getUTCDate() - 1);
    return { start: startOfDayUTC(y), end: endOfDayUTC(y) };
  }

  if (range === "week") {
    const start = new Date(todayStart);
    start.setUTCDate(start.getUTCDate() - 6);
    return { start, end: todayEnd };
  }

  if (range === "month") {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    return { start: startOfDayUTC(start), end: todayEnd };
  }

  const y = year ?? now.getUTCFullYear();
  return {
    start: startOfDayUTC(new Date(Date.UTC(y, 0, 1))),
    end: endOfDayUTC(new Date(Date.UTC(y, 11, 31))),
  };
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3.5 py-1.5 text-xs font-bold transition ${
        active
          ? "bg-[#111827] dark:bg-purple-600 text-white shadow-xs"
          : "border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
      }`}
    >
      {children}
    </button>
  );
}

function KpiCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">{title}</div>
          <div className="mt-1 text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">{value}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">{subtitle}</div>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shadow-2xs">
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function QuotationDashboard() {
  const [rows, setRows] = useState<QuotationRow[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [range, setRange] = useState<RangeKey>("month");

  const refresh = async () => {
    setLoading(true);
    try {
      const fetchAllQuotations = async () => {
        const allRows: QuotationRow[] = [];
        let currentPage = 1;
        let totalPages = 1;

        while (currentPage <= totalPages) {
          const response = await api.listQuotations({ page: currentPage, limit: 200 });
          const pageRows = Array.isArray(response?.data) ? response.data : [];
          allRows.push(...pageRows);
          totalPages = Number(response?.pagination?.pages || 1);
          currentPage += 1;
        }

        return allRows;
      };

      const [allQuotationRows, serviceRes] = await Promise.all([
        fetchAllQuotations(),
        api.listQuotationServices({ page: 1, limit: 500 }),
      ]);

      setRows(allQuotationRows);
      setServices(Array.isArray(serviceRes) ? serviceRes : []);
    } catch (error: any) {
      toast.error(error?.message || "Failed to load quotation dashboard");
      setRows([]);
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const availableYears = useMemo(() => {
    const dataYears = Array.from(
      new Set(
        rows
          .map((row) => new Date(row.created_at || "").getFullYear())
          .filter((value) => Number.isFinite(value))
      )
    );

    const currentYear = new Date().getFullYear();
    const fallbackYears = Array.from({ length: 6 }, (_, index) => currentYear - index);

    const next = Array.from(new Set([...dataYears, ...fallbackYears])).sort((a, b) => b - a);

    return next.length > 0 ? next : [new Date().getFullYear()];
  }, [rows]);

  useEffect(() => {
    if (!availableYears.includes(year)) {
      setYear(availableYears[0]);
    }
  }, [availableYears, year]);

  useEffect(() => {
    if (range !== "year") {
      setYear(new Date().getFullYear());
    }
  }, [range]);

  const dateRange = useMemo(() => getDateRange(range, year), [range, year]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const dt = new Date(row.created_at || "");
      if (Number.isNaN(dt.getTime())) return false;
      return dt >= dateRange.start && dt <= dateRange.end;
    });
  }, [dateRange.end, dateRange.start, rows]);

  const totalQuotes = filteredRows.length;
  const totalServices =
    services.length ||
    new Set(filteredRows.map((row) => String(row.service_type || ""))).size;
  const totalRevenue = filteredRows.reduce((sum, row) => sum + toNumber(row.total_amount), 0);

  const monthlyData = useMemo(() => {
    const labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const data = labels.map((month, index) => ({
      month,
      totalAmount: 0,
      quoteCount: 0,
      index,
    }));

    filteredRows.forEach((row) => {
      const dt = new Date(row.created_at || "");
      if (Number.isNaN(dt.getTime()) || dt.getFullYear() !== year) return;
      const monthIndex = dt.getMonth();
      data[monthIndex].totalAmount += toNumber(row.total_amount);
      data[monthIndex].quoteCount += 1;
    });

    return data;
  }, [filteredRows, year]);

  const servicePopularity = useMemo(() => {
    const counts = new Map<string, number>();

    filteredRows.forEach((row) => {
      const label =
        row.service?.name ||
        services.find((item) => String(item.id) === String(row.service_type))?.name ||
        slugLabel(String(row.service_type || ""));

      if (!label) return;
      counts.set(label, (counts.get(label) || 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredRows, services]);

  const statusData = useMemo(() => {
    const counts = new Map<string, number>([
      ["Pending", 0],
      ["Partial", 0],
      ["Converted", 0],
    ]);

    filteredRows.forEach((row) => {
      const status = getQuotationStatus(row);
      const label = status.charAt(0).toUpperCase() + status.slice(1);
      counts.set(label, (counts.get(label) || 0) + 1);
    });

    return Array.from(counts.entries()).map(([name, value]) => ({ name, value }));
  }, [filteredRows]);

  const pendingCount = statusData.find((item) => item.name === "Pending")?.value || 0;
  const partialCount = statusData.find((item) => item.name === "Partial")?.value || 0;
  const convertedCount = statusData.find((item) => item.name === "Converted")?.value || 0;

  const conversionRate = totalQuotes > 0 ? ((convertedCount / totalQuotes) * 100).toFixed(1) : "0.0";

  const pieColors = ["#f59e0b", "#3b82f6", "#10b981"];
  const serviceColors = ["#8b5cf6", "#3b82f6", "#06b6d4", "#10b981", "#f59e0b", "#ec4899"];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Quotation Dashboard"
        subtitle="Live quotation metrics, revenue conversion, and service performance"
        total={totalQuotes}
        icon={<LayoutDashboard size={18} />}
        rightActions={
          <button
            type="button"
            onClick={() => void refresh()}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md bg-[#111827] dark:bg-purple-600 hover:bg-black dark:hover:bg-purple-700 text-white text-xs font-bold transition shadow-2xs"
          >
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
            Refresh Data
          </button>
        }
      />

      {/* Filter Ribbon Card */}
      <div className="rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs transition-colors">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <FilterPill active={range === "today"} onClick={() => setRange("today")}>
              Today
            </FilterPill>
            <FilterPill active={range === "yesterday"} onClick={() => setRange("yesterday")}>
              Yesterday
            </FilterPill>
            <FilterPill active={range === "week"} onClick={() => setRange("week")}>
              Last 7 Days
            </FilterPill>
            <FilterPill active={range === "month"} onClick={() => setRange("month")}>
              This Month
            </FilterPill>
            <FilterPill active={range === "year"} onClick={() => setRange("year")}>
              Full Year
            </FilterPill>
          </div>

          <div className="flex items-center gap-2">
            {range === "year" && (
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="rounded-md border border-slate-200/80 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-500"
              >
                {availableYears.map((item) => (
                  <option key={item} value={item} className="dark:bg-slate-900">
                    {item}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard
          title="Total Quotes"
          value={loading ? "-" : totalQuotes}
          subtitle="All quotations"
          icon={<FileText size={18} />}
        />
        <KpiCard
          title="Service Types"
          value={loading ? "-" : totalServices}
          subtitle="Distinct services"
          icon={<BriefcaseBusiness size={18} />}
        />
        <KpiCard
          title="Total Revenue"
          value={loading ? "-" : formatCurrency(totalRevenue)}
          subtitle="Quoted revenue"
          icon={<IndianRupee size={18} />}
        />
        <KpiCard
          title="Pending"
          value={loading ? "-" : pendingCount}
          subtitle="Awaiting payment"
          icon={<Clock size={18} />}
        />
        <KpiCard
          title="Partial"
          value={loading ? "-" : partialCount}
          subtitle="Advance received"
          icon={<RefreshCcw size={18} />}
        />
        <KpiCard
          title="Converted"
          value={loading ? "-" : convertedCount}
          subtitle="Fully completed"
          icon={<CheckCircle2 size={18} />}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-12">
          <ChartCard
            title={`Monthly Quotation Overview (${range === "year" ? year : "Selected Range"})`}
            subtitle="Quotation amount and count by month"
            value={loading ? "-" : `${monthlyData.reduce((sum, item) => sum + item.quoteCount, 0)} quotes`}
            icon={<FileText size={18} />}
          >
            <div className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthlyData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.4} />
                  <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 11 }} />
                  <YAxis
                    yAxisId="left"
                    tick={{ fill: "#64748b", fontSize: 11 }}
                    tickFormatter={(value) => formatCompactCurrency(Number(value))}
                  />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: "#64748b", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "6px", color: "#fff", fontSize: "12px" }}
                    formatter={(value: any, name: any) =>
                      name === "Total Amount"
                        ? [formatCurrency(Number(value || 0)), "Total Amount"]
                        : [Number(value || 0), "Quotes"]
                    }
                  />
                  <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
                  <Bar yAxisId="right" dataKey="quoteCount" name="Quotes" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="totalAmount"
                    name="Total Amount"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>

        <div className="xl:col-span-5">
          <ChartCard
            title="Quotation Statuses"
            subtitle="Pending, partial, and converted distribution"
            value={`${conversionRate}% converted`}
            icon={<FileText size={18} />}
          >
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "6px", color: "#fff", fontSize: "12px" }}
                  />
                  <Pie
                    data={statusData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                  >
                    {statusData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                    ))}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>

        <div className="xl:col-span-7">
          <ChartCard
            title="Top Services Quoted"
            subtitle="Most frequently requested services"
            value={`${servicePopularity.length} services`}
            icon={<BriefcaseBusiness size={18} />}
          >
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={servicePopularity.slice(0, 6)} layout="vertical" margin={{ top: 5, right: 20, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.4} />
                  <XAxis type="number" tick={{ fill: "#64748b", fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} width={120} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "6px", color: "#fff", fontSize: "12px" }}
                  />
                  <Bar dataKey="value" name="Quotations" radius={[0, 4, 4, 0]}>
                    {servicePopularity.slice(0, 6).map((_, index) => (
                      <Cell key={`cell-service-${index}`} fill={serviceColors[index % serviceColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>
      </div>
    </div>
  );
}
