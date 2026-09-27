import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BriefcaseBusiness, FileText, IndianRupee, RefreshCcw } from "lucide-react";
import toast from "react-hot-toast";
import ChartCard from "../charts/ChartCard";
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
      className={[
        "rounded-md border px-3 py-1 text-sm font-semibold transition",
        active
          ? "border-slate-900 bg-slate-900 text-white shadow-[0_10px_28px_rgba(0,0,0,0.18)]"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
      ].join(" ")}
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
    <div className="rounded-md border border-slate-200 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-slate-500">{title}</div>
          <div className="mt-1 text-2xl font-extrabold text-slate-900">{value}</div>
          <div className="text-[12px] text-slate-500">{subtitle}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-800">
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
  const conversionRate = totalQuotes > 0 ? ((convertedCount / totalQuotes) * 100).toFixed(2) : "0.00";

  return (
    <div className="w-full">

      <div className="mb-2 rounded-md border border-slate-200 bg-white p-3 shadow-[0_10px_28px_rgba(15,23,42,0.06)] sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 sm:text-2xl">Quotation Dashboard</h2>
            <p className="mt-1 text-sm text-slate-600">Filter quotation insights by date range</p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <FilterPill active={range === "today"} onClick={() => setRange("today")}>
              Today
            </FilterPill>
            <FilterPill active={range === "yesterday"} onClick={() => setRange("yesterday")}>
              Yesterday
            </FilterPill>
            <FilterPill active={range === "week"} onClick={() => setRange("week")}>
              Week
            </FilterPill>
            <FilterPill active={range === "month"} onClick={() => setRange("month")}>
              This Month
            </FilterPill>
            <FilterPill active={range === "year"} onClick={() => setRange("year")}>
              Year
            </FilterPill>

            {range === "year" ? (
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300"
              >
                {availableYears.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            ) : null}

            <button
              type="button"
              onClick={() => void refresh()}
              className="inline-flex items-center gap-2 rounded-md bg-black px-4 py-2 font-semibold text-white transition hover:bg-slate-900"
            >
              <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="mb-2 grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          title="Total Quotes"
          value={loading ? "-" : totalQuotes}
          subtitle="All quotations"
          icon={<FileText size={18} />}
        />
        <KpiCard
          title="Service Types"
          value={loading ? "-" : totalServices}
          subtitle="Distinct quotation services"
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
          icon={<FileText size={18} />}
        />
        <KpiCard
          title="Partial"
          value={loading ? "-" : partialCount}
          subtitle="First payment received"
          icon={<RefreshCcw size={18} />}
        />
        <KpiCard
          title="Converted"
          value={loading ? "-" : convertedCount}
          subtitle="Both payments complete"
          icon={<BriefcaseBusiness size={18} />}
        />
      </div>

      <div className="grid grid-cols-1 gap-2 xl:grid-cols-12">
        <div className="xl:col-span-12">
          <ChartCard
            title={`Monthly Quotation Overview (${range === "year" ? year : "Selected Range"})`}
            subtitle="Quotation amount and count by month"
            value={loading ? "-" : `${monthlyData.reduce((sum, item) => sum + item.quoteCount, 0)} quotes`}
            icon={<FileText size={18} />}
          >
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthlyData} margin={{ top: 8, right: 0, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fill: "#475569", fontSize: 12 }} />
                  <YAxis
                    yAxisId="left"
                    tick={{ fill: "#475569", fontSize: 12 }}
                    tickFormatter={(value) => formatCompactCurrency(Number(value))}
                  />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: "#475569", fontSize: 12 }} />
                  <Tooltip
                    formatter={(value: number | string | undefined, name: string | undefined) =>
                      name === "totalAmount"
                        ? [formatCurrency(Number(value || 0)), "Total Amount"]
                        : [Number(value || 0), "Quotes"]
                    }
                  />
                  <Legend />
                  <Bar yAxisId="right" dataKey="quoteCount" name="Quotes" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="totalAmount"
                    name="Total Amount"
                    stroke="#1e3a8a"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>

       <div className="xl:col-span-5">
          <ChartCard
            title="Quotation Statuses"
            subtitle="Pending, partial, and converted"
            value={`${conversionRate}% converted`}
            icon={<FileText size={18} />}
          >
            <div className="h-[330px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="45%"
                    outerRadius={108}
                    innerRadius={60}
                    paddingAngle={3}
                  >
                    {statusData.map((entry) => {
                      const fill =
                        entry.name === "Converted"
                          ? "#10b981"
                          : entry.name === "Partial"
                            ? "#0ea5e9"
                            : "#f59e0b";
                      return <Cell key={entry.name} fill={fill} />;
                    })}
                  </Pie>
                  <Tooltip formatter={(value: number | string | undefined) => [`${Number(value || 0)} quotations`, "Count"]} />
                  <Legend verticalAlign="bottom" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div> 

        <div className="xl:col-span-7">
          <ChartCard
            title="Service Popularity"
            subtitle="Most-used quotation services"
            value={loading ? "-" : `${servicePopularity.length} services`}
            icon={<BriefcaseBusiness size={18} />}
          >
            <div className="h-[330px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={servicePopularity} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" angle={-20} textAnchor="end" height={70} tick={{ fill: "#475569", fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fill: "#475569", fontSize: 12 }} />
                  <Tooltip formatter={(value: number | string | undefined) => [`${Number(value || 0)} quotations`, "Count"]} />
                  <Bar dataKey="value" fill="#0f766e" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>
      </div>
    </div>
  );
}
