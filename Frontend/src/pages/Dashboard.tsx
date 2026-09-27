import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { api } from "../lib/api";

import ChartCard from "../charts/ChartCard";
import LeadChart from "../charts/LeadChart";
import SourceChart from "../charts/SourceChart";

// ✅ Followup table UI
import FollowupTable, { type FollowUpRow } from "../charts/FollowupRow.tsx";

import AgentChart from "../charts/AgentChart";
import type { PaymentStatusTotals } from "../charts/PaymentChart";
import PaymentChart from "../charts/PaymentChart";

import { useSources } from "../store/sourceStore";
import { useAgents } from "../store/agentStore";

import { RefreshCcw, Users, Tag, UserCog, IndianRupee, Clock, ArrowUpRight, ArrowDownRight, Briefcase } from "lucide-react";

/* ================= TYPES ================= */

type Lead = {
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  whatsapp_chat?: string | null;
  source_id?: number | string | null;
  status_id?: number | string | null;
  agent_id?: number | string | null;
  assign_to?: number | string | null;
  changed_by?: number | string | null;
  changedByAdmin?: { id?: number | string | null; name?: string; email?: string } | null;
};

type Payment = {
  date?: string;
  status?: "hold" | "assign" | "closed" | "done" | "pending" | "unresponsive" | string;
};

type UserRole = { id: number | string; role?: string; name?: string };
type Row = { id: string; name: string; value: number; changedByValue?: number };

type RangeKey = "today" | "yesterday" | "week" | "month" | "year";
export type DateRange = { start: Date; end: Date };

/* ================= DATE HELPERS ================= */

function pickDate(l: any) {
  return l?.createdAt || l?.created_at || null;
}

function pickUpdatedDate(l: any) {
  return l?.updatedAt || l?.updated_at || null;
}

function parseDateSafe(dt: any) {
  if (!dt) return null;
  if (dt instanceof Date && !isNaN(dt.getTime())) return dt;

  if (typeof dt === "string") {
    const s = dt.includes("T") ? dt : dt.replace(" ", "T");
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d;
  }

  if (typeof dt === "number") {
    const d = new Date(dt);
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function toKeyLocal(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
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

/* ================= DATA HELPERS ================= */

function unwrapArray<T>(res: any): T[] {
  if (Array.isArray(res)) return res as T[];
  if (res && typeof res === "object") {
    if (Array.isArray(res.data)) return res.data as T[];
    if (res.data && typeof res.data === "object" && Array.isArray(res.data.data)) {
      return res.data.data as T[];
    }
  }
  return [];
}

/* ================= UI COMPONENTS ================= */

function FilterPill({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  children: any;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all duration-150 shadow-xs cursor-pointer",
        active
          ? "bg-[#111C44] dark:bg-blue-600 text-white shadow-md shadow-[#111C44]/20"
          : "bg-white dark:bg-[#1E293B] text-[#8F9CAE] hover:text-[#1B2559] dark:hover:text-white border border-slate-200/80 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-700/50",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function KpiCard({
  title,
  value,
  trend,
  trendPositive = true,
  icon,
  to,
  loading,
}: {
  title: string;
  value: string | number;
  trend?: string;
  trendPositive?: boolean;
  icon: React.ReactNode;
  to: string;
  loading: boolean;
}) {
  return (
    <Link
      to={to}
      className="group rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-[#1E293B] p-5 shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200 block"
    >
      <div className="flex items-center gap-4">
        {/* Navy Icon Container */}
        <div className="h-12 w-12 rounded-xl bg-[#111C44] dark:bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-[#111C44]/15 group-hover:scale-105 transition-transform">
          {icon}
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-[#8F9CAE] truncate">{title}</div>
          <div className="text-2xl font-extrabold text-[#1B2559] dark:text-white tracking-tight mt-0.5">
            {loading ? "—" : value}
          </div>
          {trend ? (
            <div
              className={`text-[11px] font-bold mt-0.5 flex items-center gap-0.5 ${
                trendPositive ? "text-[#05CD99]" : "text-rose-500"
              }`}
            >
              {trendPositive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
              <span>{trend}</span>
            </div>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

/* ================= FOLLOWUP MAPPER ================= */

// 🔁 Map backend followup object -> FollowUpRow (safe)
function mapFollowupToRow(x: any): FollowUpRow {
  return {
    id: x.id,
    leadId: x?.lead?.id || x?.lead_id || "",
    leadName: x?.lead?.name || `Lead #${x?.lead_id ?? ""}`,
    leadPhone: x?.lead?.contact_no || "",
    agentName: x?.changedBy?.name || "",
    note: x?.remark || "",
    dueAt: x?.followup_date || x?.created_at || "",
    status: x?.status?.name || "",
  };
}

/* ================= MAIN DASHBOARD ================= */

export default function Dashboard() {
  const { user } = useAuth();
  const isAdmin = Number(user?.role_id) === 1;

  const { sources } = useSources();
  const { agents } = useAgents();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [_roles, setRoles] = useState<UserRole[]>([]);

  // ✅ followups rows
  const [followups, setFollowups] = useState<FollowUpRow[]>([]);

  const [range, setRange] = useState<RangeKey>("month");
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getUTCFullYear());

  useEffect(() => {
    if (range !== "year") setSelectedYear(new Date().getUTCFullYear());
  }, [range]);

  const dateRange = useMemo(() => getDateRange(range, selectedYear), [range, selectedYear]);

  const yearsList = useMemo(() => {
    const nowY = new Date().getUTCFullYear();
    return Array.from({ length: 6 }, (_, i) => nowY - i);
  }, []);

  const currentAgentRowId = useMemo(() => {
    if (isAdmin) return user?.id != null ? String(user.id) : "";

    const userEmail = String(user?.email || "").trim().toLowerCase();
    const matchedAgent = (agents || []).find(
      (agent: any) => String(agent?.email || "").trim().toLowerCase() === userEmail
    );

    if (matchedAgent?.id != null) return String(matchedAgent.id);
    return user?.id != null ? String(user.id) : "";
  }, [agents, isAdmin, user?.email, user?.id]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setErr(null);

    try {
      const [leadsRes, rolesRes, paymentsRes, followupsRes] = await Promise.all([
        api.leads.list({ page: 1, limit: 50000 }),
        api.listUserRoles(),
        api.leadPayment?.list?.({ page: 1, limit: 50000 }) ?? Promise.resolve([]),
        api.getAllFollowups({ page: 1, limit: 50000 }),
      ]);

      setLeads(unwrapArray<Lead>(leadsRes));
      setRoles(unwrapArray<UserRole>(rolesRes));
      setPayments(unwrapArray<Payment>(paymentsRes));

      const rawFollowups = unwrapArray<any>(followupsRes);
      setFollowups(rawFollowups.map(mapFollowupToRow));
    } catch (e: any) {
      setErr(e?.message || "Failed to load dashboard");
      setLeads([]);
      setPayments([]);
      setRoles([]);
      setFollowups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const filteredLeads = useMemo(() => {
    const { start, end } = dateRange;
    return leads.filter((l) => {
      const dt = pickDate(l);
      if (!dt) return false;
      const d = new Date(dt);
      return d >= start && d <= end;
    });
  }, [leads, dateRange]);

  const visibleLeads = useMemo(() => {
    if (isAdmin) return leads;
    return leads.filter((l) => String(l.agent_id ?? l.assign_to ?? "") === currentAgentRowId);
  }, [currentAgentRowId, isAdmin, leads]);

  const visibleFilteredLeads = useMemo(() => {
    if (isAdmin) return filteredLeads;
    return filteredLeads.filter((l) => String(l.agent_id ?? l.assign_to ?? "") === currentAgentRowId);
  }, [currentAgentRowId, filteredLeads, isAdmin]);

  const filteredPayments = useMemo(() => {
    const { start, end } = dateRange;

    return payments.filter((p) => {
      const dt = p?.date;
      if (!dt) return false;
      const d = new Date(dt);
      return d >= start && d <= end;
    });
  }, [payments, dateRange]);

  const paymentSeries: PaymentStatusTotals[] = useMemo(() => {
    const map = new Map<
      string,
      { label: string; hold: number; assign: number; closed: number; pending: number; done: number; unresponsive: number }
    >();

    filteredPayments.forEach((p) => {
      const dt = p?.date;
      if (!dt) return;

      const d = new Date(dt);
      const key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
      const label = d.toLocaleDateString(undefined, { month: "short", year: "numeric" });

      if (!map.has(key)) map.set(key, { label, hold: 0, assign: 0, closed: 0, pending: 0, done: 0, unresponsive: 0 });

      const row = map.get(key)!;
      const st = String(p.status || "").toLowerCase();

      if (st === "hold") row.hold += 1;
      else if (st === "assign") row.assign += 1;
      else if (st === "closed") row.closed += 1;
      else if (st === "pending") row.pending += 1;
      else if (st === "done") row.done += 1;
      else if (st === "unresponsive") row.unresponsive += 1;
    });

    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map((x) => x[1]);
  }, [filteredPayments]);

  const paymentTotals = useMemo(() => {
    return paymentSeries.reduce(
      (acc, row) => {
        acc.hold += row.hold;
        acc.assign += row.assign;
        acc.closed += row.closed;
        acc.pending += row.pending;
        acc.done += row.done;
        acc.unresponsive += row.unresponsive;
        return acc;
      },
      { hold: 0, assign: 0, closed: 0, pending: 0, done: 0, unresponsive: 0 }
    );
  }, [paymentSeries]);

  const totalLeadsAll = visibleLeads.length;
  const totalLeadsInRange = visibleFilteredLeads.length;
  const filteredChangedByLeads = useMemo(() => {
    const { start, end } = dateRange;

    return leads.filter((l) => {
      const dt = pickUpdatedDate(l);
      if (!dt) return false;
      const d = new Date(dt);
      if (d < start || d > end) return false;

      if (l.changed_by != null && l.changed_by !== "") return true;
      const changedByAdminId = l.changedByAdmin?.id;
      return changedByAdminId != null && changedByAdminId !== "";
    });
  }, [dateRange, leads]);

  const visibleFilteredChangedByLeads = useMemo(() => {
    if (isAdmin) return filteredChangedByLeads;

    const currentUserId = user?.id != null ? String(user.id) : "";
    const currentUserEmail = String(user?.email || "").trim().toLowerCase();

    return filteredChangedByLeads.filter((l) => {
      const changedEmail = String(l.changedByAdmin?.email || "").trim().toLowerCase();
      const changedId = String(l.changed_by ?? l.changedByAdmin?.id ?? "");

      return (
        (currentUserEmail && changedEmail === currentUserEmail) ||
        (currentAgentRowId && changedId === currentAgentRowId) ||
        (currentUserId && changedId === currentUserId)
      );
    });
  }, [currentAgentRowId, filteredChangedByLeads, isAdmin, user?.email, user?.id]);

  const totalSources = sources.length;
  const totalAgents = agents.length;
  const totalFilteredPayments = filteredPayments.length;

  const todayFollowupsCount = useMemo(() => {
    const t = toKeyLocal(new Date());
    return followups.filter((f) => {
      const d = parseDateSafe(f.dueAt);
      return d ? toKeyLocal(d) === t : false;
    }).length;
  }, [followups]);

  const agentRows: Row[] = useMemo(() => {
    const assignedCounts = new Map<string, number>();
    const changedCounts = new Map<string, number>();
    const agentMap = new Map<string, any>();
    const agentByEmail = new Map<string, any>();

    (agents || []).forEach((a: any) => {
      const agentId = a?.id != null ? String(a.id) : "";
      const agentEmail = String(a?.email || "").trim().toLowerCase();
      if (agentId) agentMap.set(agentId, a);
      if (agentEmail) agentByEmail.set(agentEmail, a);
    });

    filteredLeads.forEach((l: any) => {
      const assignId = l.agent_id ?? l.assign_to ?? null;
      if (!assignId) return;
      const k = String(assignId);
      assignedCounts.set(k, (assignedCounts.get(k) || 0) + 1);
    });

    filteredChangedByLeads.forEach((l: any) => {
      const changedEmail = String(l.changedByAdmin?.email || "").trim().toLowerCase();
      const matchedAgentId = changedEmail ? agentByEmail.get(changedEmail)?.id : null;
      const changedId = matchedAgentId ?? l.changed_by ?? l.changedByAdmin?.id ?? null;
      if (!changedId) return;
      const k = String(changedId);
      changedCounts.set(k, (changedCounts.get(k) || 0) + 1);
    });

    const allIds = new Set<string>([
      ...Array.from(agentMap.keys()),
      ...Array.from(assignedCounts.keys()),
      ...Array.from(changedCounts.keys()),
    ]);

    return Array.from(allIds)
      .map((id) => {
        const a = agentMap.get(id);
        const isCurrentUser = user?.id != null && String(user.id) === String(id);
        return {
          id,
          name: String(
            a?.name ||
              a?.full_name ||
              a?.email ||
              (isCurrentUser ? user?.name || user?.email : null) ||
              `User #${id}`
          ),
          value: assignedCounts.get(id) || 0,
          changedByValue: changedCounts.get(id) || 0,
        };
      })
      .sort((a, b) => (b.value + b.changedByValue) - (a.value + a.changedByValue));
  }, [filteredLeads, filteredChangedByLeads, agents, user?.email, user?.id, user?.name]);

  const visibleAgentRows = useMemo(() => {
    if (isAdmin) return agentRows;
    return agentRows.filter((row) => String(row.id) === currentAgentRowId);
  }, [agentRows, currentAgentRowId, isAdmin]);

  const visibleAgentTotal = useMemo(() => {
    if (isAdmin) return totalAgents;
    return visibleAgentRows.reduce((sum, row) => sum + Number(row.value || 0), 0);
  }, [isAdmin, totalAgents, visibleAgentRows]);

  const leadRoute = (preset: RangeKey) => {
    if (preset === "year") return `/leads?range=year&year=${selectedYear}`;
    return `/leads?range=${preset}`;
  };

  return (
    <div className="w-full space-y-6">
      {err && (
        <div className="rounded-md bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 text-xs font-semibold">
          {err}
        </div>
      )}

      {/* DASHBOARD HEADER & FILTER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1B2559] dark:text-white tracking-tight">Dashboard</h1>
          <p className="text-xs font-medium text-[#8F9CAE] dark:text-slate-400 mt-0.5">
            Here's what's happening with your business today.
          </p>
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
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-3 py-1.5 rounded-md border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-[#1E293B] text-xs font-semibold text-[#1B2559] dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700/50 focus:outline-none focus:ring-2 focus:ring-[#111C44]/20 shadow-xs"
            >
              {yearsList.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          ) : null}

          <button
            onClick={loadAll}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md bg-white dark:bg-[#1E293B] border border-slate-200/80 dark:border-slate-700 text-[#1B2559] dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700/50 transition font-semibold text-xs shadow-xs active:scale-[0.98] cursor-pointer"
            type="button"
            title="Refresh dashboard data"
          >
            <RefreshCcw size={14} className={loading ? "animate-spin text-[#111C44] dark:text-blue-400" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* TOP ROW: 4 STAT KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5">
        <KpiCard
          title="Total Leads"
          value={loading ? "—" : totalLeadsAll.toLocaleString("en-IN")}
          trend="12%"
          trendPositive={true}
          icon={<Users size={22} />}
          to="/leads"
          loading={loading}
        />
        <KpiCard
          title="Active Deals"
          value={loading ? "—" : totalLeadsInRange.toLocaleString("en-IN")}
          trend="3%"
          trendPositive={true}
          icon={<Briefcase size={22} />}
          to={leadRoute(range)}
          loading={loading}
        />
        <KpiCard
          title="Total Revenue"
          value={loading ? "—" : `₹ ${totalFilteredPayments > 0 ? (totalFilteredPayments * 15000).toLocaleString("en-IN") : "0"}`}
          trend="10%"
          trendPositive={true}
          icon={<IndianRupee size={22} />}
          to="/payments"
          loading={loading}
        />
        <KpiCard
          title="Tasks Pending"
          value={loading ? "—" : todayFollowupsCount.toLocaleString("en-IN")}
          trend="3%"
          trendPositive={false}
          icon={<Clock size={22} />}
          to="/followups"
          loading={loading}
        />
      </div>

      {/* MIDDLE ROW: Leads Overview, Leads by Source, & Promo Card */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        {/* Leads Overview (Area Chart) */}
        <div className="xl:col-span-5">
          <ChartCard
            title="Leads Overview"
            subtitle="Trends across selected range"
            value={String(totalLeadsInRange)}
          >
            <LeadChart
              leads={visibleFilteredLeads}
              changedByLeads={visibleFilteredChangedByLeads}
              range={range}
              dateRange={dateRange}
            />
          </ChartCard>
        </div>

        {/* Leads by Source (Donut Chart) */}
        <div className="xl:col-span-4">
          <ChartCard
            title="Leads by Source"
            subtitle="Distribution by lead channels"
            value={String(totalSources)}
          >
            <SourceChart
              leads={visibleFilteredLeads as any}
              sources={sources as any}
              range={range as any}
            />
          </ChartCard>
        </div>

        {/* Action Banner Card (Simplify Sales Maximize Results) */}
        <div className="xl:col-span-3 rounded-md border border-blue-100/80 dark:border-slate-800 bg-gradient-to-br from-indigo-50/70 via-blue-50/40 to-white dark:from-[#1E293B] dark:via-slate-800 dark:to-slate-900 p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden">
          {/* Subtle background decoration */}
          <div className="absolute top-0 right-0 -mr-6 -mt-6 w-32 h-32 rounded-full bg-blue-500/10 dark:bg-blue-600/10 blur-xl pointer-events-none" />

          <div>
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#111C44] dark:bg-blue-600 text-white shadow-md shadow-[#111C44]/20 mb-4">
              <Tag size={20} />
            </div>

            <h3 className="text-xl font-extrabold text-[#1B2559] dark:text-white leading-snug">
              Simplify Sales <br />
              Maximize Results
            </h3>
            <p className="text-xs font-medium text-[#8F9CAE] dark:text-slate-400 mt-2 leading-relaxed">
              Your complete CRM solution for tracking leads, managing team agents, and closing deals faster.
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-blue-100/60 dark:border-slate-800">
            <Link
              to="/create-lead"
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-md bg-[#111C44] dark:bg-blue-600 hover:bg-[#0A122E] dark:hover:bg-blue-700 text-white font-bold text-xs tracking-wide shadow-md shadow-[#111C44]/20 active:scale-[0.98] transition-all"
            >
              Create New Lead
            </Link>
          </div>
        </div>
      </div>

      {/* BOTTOM ROW: Agent Performance & Payment Statistics */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="xl:col-span-6">
          <ChartCard
            title="Agent Performance"
            subtitle="Assigned vs changed leads"
            value={String(visibleAgentTotal)}
            icon={<UserCog size={18} />}
          >
            <AgentChart rows={visibleAgentRows} loading={loading} />
          </ChartCard>
        </div>
        <div className="xl:col-span-6">
          <ChartCard
            title="Payment Statistics"
            subtitle="Current payment statuses"
            value={String(totalFilteredPayments)}
            icon={<IndianRupee size={18} />}
          >
            <PaymentChart totals={paymentTotals} loading={loading} />
          </ChartCard>
        </div>
      </div>

      {/* Followups Table */}
      <div className="w-full">
        <FollowupTable rows={followups} dateRange={dateRange} pageSize={5} />
      </div>
    </div>
  );
}
