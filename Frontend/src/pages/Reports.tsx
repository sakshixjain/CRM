import { useState, useEffect, useMemo, useCallback } from "react";
import {
  TrendingUp,
  IndianRupee,
  Briefcase,
  Target,
  Download,
  BarChart3,
  Award,
  RefreshCcw,
  Loader2,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  PieChart as RePieChart,
  Pie,
  Cell,
  CartesianGrid,
} from "recharts";
import { useTheme } from "../theme/ThemeContext";
import { api } from "../lib/api";
import toast from "react-hot-toast";

function unwrapList(res: any): any[] {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.data?.data)) return res.data.data;
  return [];
}

const DONUT_COLORS = ["#2563EB", "#38BDF8", "#F59E0B", "#05CD99", "#EE5D50", "#8B5CF6", "#EC4899"];

function formatInr(val: number) {
  if (val >= 10000000) return `₹ ${(val / 10000000).toFixed(2)} Cr`;
  if (val >= 100000) return `₹ ${(val / 100000).toFixed(1)} L`;
  if (val >= 1000) return `₹ ${(val / 1000).toFixed(0)} K`;
  return `₹ ${val.toLocaleString("en-IN")}`;
}

export default function Reports() {
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(true);

  const [leads, setLeads] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);

  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const loadReportData = useCallback(async () => {
    setLoading(true);
    try {
      const [leadsRes, paymentsRes, quotationsRes, agentsRes] =
        await Promise.allSettled([
          api.leads.list({ page: 1, limit: 50000 }),
          api.leadPayment.list({ page: 1, limit: 50000 }),
          api.quotations.list({ page: 1, limit: 50000 }),
          api.listAgents(),
        ]);

      setLeads(leadsRes.status === "fulfilled" ? unwrapList(leadsRes.value) : []);
      setPayments(paymentsRes.status === "fulfilled" ? unwrapList(paymentsRes.value) : []);
      setQuotations(quotationsRes.status === "fulfilled" ? unwrapList(quotationsRes.value) : []);
      setAgents(agentsRes.status === "fulfilled" ? unwrapList(agentsRes.value) : []);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load report data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReportData();
  }, [loadReportData]);

  // 1. Dynamic Monthly Revenue Trend
  const monthlyRevenueData = useMemo(() => {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthTotals = Array(12).fill(0);

    // Sum from payments
    payments.forEach((p: any) => {
      const rawDate = p.date || p.created_at || p.createdAt;
      if (!rawDate) return;
      const d = new Date(rawDate);
      if (!isNaN(d.getTime()) && d.getFullYear() === selectedYear) {
        const m = d.getMonth();
        const amt = Number(p.amount || 0);
        if (amt > 0) monthTotals[m] += amt;
      }
    });

    // Also include quotations converted
    quotations.forEach((q: any) => {
      const rawDate = q.first_payment_date || q.created_at || q.createdAt;
      if (!rawDate) return;
      const d = new Date(rawDate);
      if (!isNaN(d.getTime()) && d.getFullYear() === selectedYear) {
        const m = d.getMonth();
        const amt = Number(q.total_amount || 0);
        if (amt > 0 && q.first_payment_date) monthTotals[m] += amt;
      }
    });

    return monthNames.map((name, i) => ({
      month: name,
      revenueLakhs: parseFloat((monthTotals[i] / 100000).toFixed(2)),
      actualRevenue: monthTotals[i],
    }));
  }, [payments, quotations, selectedYear]);

  // 2. Dynamic Deals / Leads by Stage
  const stageDonutData = useMemo(() => {
    const stageCounts: Record<string, number> = {};
    let totalValidLeads = 0;

    leads.forEach((l: any) => {
      const statusName = l.status?.name || (l.status_id ? `Status #${l.status_id}` : "New Leads");
      stageCounts[statusName] = (stageCounts[statusName] || 0) + 1;
      totalValidLeads += 1;
    });

    if (totalValidLeads === 0) {
      return [{ name: "No Leads", value: 1, percent: "100%", color: "#94A3B8" }];
    }

    return Object.entries(stageCounts).map(([name, count], idx) => ({
      name,
      value: count,
      percent: `${((count / totalValidLeads) * 100).toFixed(0)}%`,
      color: DONUT_COLORS[idx % DONUT_COLORS.length],
    }));
  }, [leads]);

  // 3. Top 4 Dynamic KPI Cards
  const totalRevenueNumber = useMemo(() => {
    const fromPayments = payments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    const fromQuotations = quotations.reduce(
      (acc, q) => acc + (q.first_payment_date ? Number(q.total_amount) || 0 : 0),
      0
    );
    return Math.max(fromPayments, fromQuotations);
  }, [payments, quotations]);

  const closedDealsCount = useMemo(() => {
    return leads.filter((l: any) => {
      const st = String(l.status?.name || "").toLowerCase();
      return st.includes("won") || st.includes("done") || st.includes("close") || st.includes("convert");
    }).length;
  }, [leads]);

  const conversionRate = useMemo(() => {
    if (leads.length === 0) return "0%";
    return `${((closedDealsCount / leads.length) * 100).toFixed(1)}%`;
  }, [closedDealsCount, leads.length]);

  const avgDealValue = useMemo(() => {
    if (closedDealsCount === 0) return 0;
    return Math.round(totalRevenueNumber / closedDealsCount);
  }, [totalRevenueNumber, closedDealsCount]);

  // 4. Salesperson Performance Leaderboard
  const salesRepsPerformance = useMemo(() => {
    return agents.map((agent, idx) => {
      const agentIdStr = String(agent.id);
      const agentLeads = leads.filter(
        (l: any) =>
          String(l.agent_id) === agentIdStr ||
          String(l.assign_to) === agentIdStr ||
          String(l.changed_by) === agentIdStr ||
          String(l.agent?.id) === agentIdStr
      );

      const handledCount = agentLeads.length;
      const closedCount = agentLeads.filter((l: any) => {
        const st = String(l.status?.name || "").toLowerCase();
        return st.includes("won") || st.includes("done") || st.includes("close");
      }).length;

      const agentRevenue = payments
        .filter((p: any) => String(p.agent_id) === agentIdStr || String(p.company_id) === agentIdStr)
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

      const conv = handledCount > 0 ? `${((closedCount / handledCount) * 100).toFixed(1)}%` : "0.0%";
      const targetGoal = Math.max(handledCount * 0.3, 10);
      const progress = Math.min(150, Math.round((closedCount / targetGoal) * 100)) || 0;

      return {
        id: agent.id,
        name: agent.name || `Agent ${idx + 1}`,
        email: agent.email,
        leads: handledCount,
        deals: closedCount,
        revenue: formatInr(agentRevenue),
        conv,
        progress: progress > 0 ? progress : closedCount * 25,
      };
    });
  }, [agents, leads, payments]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1B2559] dark:text-white tracking-tight flex items-center gap-2.5">
            <BarChart3 className="text-blue-600" size={24} />
            Sales & Revenue Reports
          </h1>
          <p className="text-xs font-medium text-[#8F9CAE] mt-0.5">
            Dynamic live analytics of business growth, pipeline distribution, and team conversion metrics.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => loadReportData()}
            disabled={loading}
            className="p-2 rounded-md border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 text-[#1B2559] dark:text-white hover:bg-slate-50 transition"
            title="Refresh Reports"
          >
            <RefreshCcw size={15} className={loading ? "animate-spin text-blue-600" : ""} />
          </button>

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="rounded-md border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-bold text-[#1B2559] dark:text-white shadow-xs focus:outline-none"
          >
            {[2024, 2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>
                Year {y}
              </option>
            ))}
          </select>

          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-md bg-[#111C44] hover:bg-[#1E2E69] text-white px-4 py-2 text-xs font-bold shadow-md shadow-[#111C44]/20 transition"
          >
            <Download size={15} />
            Export Report
          </button>
        </div>
      </div>

      {/* 4 Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#8F9CAE]">Total Revenue</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-600">
              <IndianRupee size={18} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-[#1B2559] dark:text-white">
            {formatInr(totalRevenueNumber)}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
            <TrendingUp size={13} /> Live dynamic payments
          </div>
        </div>

        <div className="rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#8F9CAE]">Closed Won Deals</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-600">
              <Briefcase size={18} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-[#1B2559] dark:text-white">
            {closedDealsCount}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-purple-600">
            <TrendingUp size={13} /> Converted opportunities
          </div>
        </div>

        <div className="rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#8F9CAE]">Lead Conversion Rate</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600">
              <Target size={18} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-emerald-600">
            {conversionRate}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
            <TrendingUp size={13} /> {leads.length} total leads
          </div>
        </div>

        <div className="rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#8F9CAE]">Avg Deal Ticket Size</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-600">
              <Award size={18} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-[#1B2559] dark:text-white">
            {formatInr(avgDealValue)}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-[#8F9CAE]">
            Across converted deals
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center p-12 text-xs text-slate-500 font-semibold">
          <Loader2 size={18} className="animate-spin text-blue-600 mr-2" />
          Calculating dynamic sales reports and performance charts...
        </div>
      )}

      {/* Visual Analytics Charts Grid */}
      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue Trend Bar Chart */}
          <div className="lg:col-span-2 rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-extrabold text-[#1B2559] dark:text-white tracking-tight">
                  Revenue Trend
                </h3>
                <p className="text-xs font-medium text-[#8F9CAE] mt-0.5">
                  Monthly closed payments & quotation milestones for {selectedYear}
                </p>
              </div>
              <span className="rounded-md bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1 text-xs font-bold text-blue-600">
                {selectedYear} YTD
              </span>
            </div>

            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyRevenueData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: isDark ? "#94A3B8" : "#8F9CAE", fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => `₹ ${v}L`}
                    tick={{ fontSize: 11, fill: isDark ? "#94A3B8" : "#8F9CAE", fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <RechartsTooltip
                    formatter={(_val: any, _name: any, item: any) => [
                      formatInr(item.payload.actualRevenue),
                      "Revenue",
                    ]}
                    contentStyle={{
                      backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
                      borderColor: isDark ? "#1E293B" : "#E2E8F0",
                      borderRadius: "6px",
                      boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                      fontSize: "12px",
                      fontWeight: "bold",
                    }}
                  />
                  <Bar dataKey="revenueLakhs" fill="#2563EB" radius={[4, 4, 0, 0]} maxBarSize={45} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Deals by Stage Donut Chart */}
          <div className="rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-base font-extrabold text-[#1B2559] dark:text-white tracking-tight">
                  Leads by Status
                </h3>
                <p className="text-xs font-medium text-[#8F9CAE] mt-0.5">
                  Live dynamic pipeline distribution
                </p>
              </div>
            </div>

            <div className="h-[180px] relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <RePieChart>
                  <Pie
                    data={stageDonutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {stageDonutData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    formatter={(v: any, name: any) => [`${v} leads`, name]}
                    contentStyle={{
                      backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
                      borderColor: isDark ? "#1E293B" : "#E2E8F0",
                      borderRadius: "10px",
                      fontSize: "11px",
                    }}
                  />
                </RePieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-black text-[#1B2559] dark:text-white">{leads.length}</span>
                <span className="text-[10px] font-bold text-[#8F9CAE] uppercase">Total</span>
              </div>
            </div>

            {/* Legend Items */}
            <div className="mt-3 space-y-1.5 border-t border-slate-100 dark:border-slate-800 pt-3 max-h-32 overflow-y-auto">
              {stageDonutData.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="font-semibold text-[#1B2559] dark:text-slate-300 truncate">
                      {item.name}
                    </span>
                  </div>
                  <span className="font-bold text-[#8F9CAE]">{item.value} ({item.percent})</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Performance Leaderboard Table */}
      {!loading && (
        <div className="rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
          <div className="border-b border-slate-100 dark:border-slate-800 p-5">
            <h3 className="text-base font-extrabold text-[#1B2559] dark:text-white tracking-tight">
              Sales Representative Performance
            </h3>
            <p className="text-xs font-medium text-[#8F9CAE] mt-0.5">
              Live dynamic metrics on leads handled, deals closed, and revenue generated.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/40 text-[11px] font-bold uppercase tracking-wider text-[#8F9CAE]">
                  <th className="py-3.5 px-5">Sales Agent</th>
                  <th className="py-3.5 px-5">Leads Handled</th>
                  <th className="py-3.5 px-5">Deals Closed</th>
                  <th className="py-3.5 px-5">Total Revenue</th>
                  <th className="py-3.5 px-5">Conversion Rate</th>
                  <th className="py-3.5 px-5 text-right">Target Achieved</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {salesRepsPerformance.map((rep, idx) => (
                  <tr key={rep.id || rep.name} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#111C44] text-xs font-bold text-white shadow-xs">
                          {rep.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-[#1B2559] dark:text-white">{rep.name}</div>
                          <div className="text-[11px] text-[#8F9CAE]">Rank #{idx + 1} • {rep.email || "Agent"}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-5 font-semibold text-[#1B2559] dark:text-slate-200">
                      {rep.leads}
                    </td>

                    <td className="py-3.5 px-5 font-semibold text-[#1B2559] dark:text-slate-200">
                      {rep.deals}
                    </td>

                    <td className="py-3.5 px-5 font-black text-[#111C44] dark:text-emerald-400">
                      {rep.revenue}
                    </td>

                    <td className="py-3.5 px-5 font-bold text-emerald-600">
                      {rep.conv}
                    </td>

                    <td className="py-3.5 px-5 text-right">
                      <div className="inline-flex items-center gap-2">
                        <div className="w-20 bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-blue-600 h-full rounded-full"
                            style={{ width: `${Math.min(100, rep.progress)}%` }}
                          />
                        </div>
                        <span className="font-extrabold text-[#1B2559] dark:text-white">
                          {rep.progress}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}

                {salesRepsPerformance.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-xs text-slate-400 font-medium">
                      No agent activity records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
