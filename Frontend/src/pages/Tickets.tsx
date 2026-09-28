/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import { api } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { useAgents } from "../store/agentStore";
import PageHeader from "./Header";
import {
  Ticket as TicketIcon,
  Plus,
  RefreshCcw,
  Search,
  Filter,
  Layers,
  LayoutGrid,
  List,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  User,
  Users,
  Calendar,
  Phone,
  Mail,
  FileText,
  Trash2,
  Pencil,
  ChevronRight,
  ChevronLeft,
  X,
  Loader2,
  ExternalLink,
  MessageSquare,
  Sparkles,
  ArrowRight,
  Tag,
  ShieldAlert,
} from "lucide-react";

// Types
export interface Ticket {
  id: number;
  ticket_number: string;
  title: string;
  description: string | null;
  category: "technical" | "billing" | "service" | "inquiry" | "bug" | "feature_request" | "other" | string;
  priority: "low" | "medium" | "high" | "urgent" | string;
  status: "open" | "in_progress" | "pending" | "resolved" | "closed" | string;
  lead_id: number | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  assigned_to: number | null;
  created_by: number | null;
  due_date: string | null;
  resolution_notes: string | null;
  resolved_at: string | null;
  createdAt: string;
  updatedAt: string;
  lead?: {
    id: number;
    name?: string;
    contact_no?: string;
    email?: string;
    city?: string;
    case_type?: string;
  } | null;
  assignedAgent?: {
    id: number;
    name?: string;
    email?: string;
  } | null;
  creator?: {
    id: number;
    name?: string;
    email?: string;
  } | null;
}

interface TicketStats {
  total: number;
  open: number;
  inProgress: number;
  pending: number;
  resolved: number;
  closed: number;
  urgent: number;
  high: number;
}

function cn(...cls: Array<string | false | null | undefined>) {
  return cls.filter(Boolean).join(" ");
}

function fmtDate(d?: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtDateTime(d?: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  return dt.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Badges
function PriorityBadge({ priority }: { priority?: string }) {
  const p = (priority || "medium").toLowerCase();
  switch (p) {
    case "urgent":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 shadow-xs">
          <ShieldAlert size={12} className="text-rose-600 dark:text-rose-400" />
          Urgent
        </span>
      );
    case "high":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60">
          <AlertCircle size={12} />
          High
        </span>
      );
    case "medium":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60">
          Medium
        </span>
      );
    case "low":
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
          Low
        </span>
      );
  }
}

function StatusBadge({ status }: { status?: string }) {
  const s = (status || "open").toLowerCase();
  switch (s) {
    case "open":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-800/60">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
          Open
        </span>
      );
    case "in_progress":
    case "in progress":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60">
          <Clock size={12} />
          In Progress
        </span>
      );
    case "pending":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800/60">
          <Clock size={12} />
          Pending
        </span>
      );
    case "resolved":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
          <CheckCircle2 size={12} />
          Resolved
        </span>
      );
    case "closed":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
          <XCircle size={12} />
          Closed
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
          {status}
        </span>
      );
  }
}

function CategoryBadge({ category }: { category?: string }) {
  const c = String(category || "general").toLowerCase();
  const label = c.replace(/_/g, " ");
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
      {label}
    </span>
  );
}

const CATEGORIES = [
  { value: "technical", label: "Technical Support" },
  { value: "billing", label: "Billing & Payment" },
  { value: "service", label: "Customer Service" },
  { value: "inquiry", label: "General Inquiry" },
  { value: "bug", label: "Bug / Issue" },
  { value: "feature_request", label: "Feature Request" },
  { value: "other", label: "Other" },
];

const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const STATUSES = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "pending", label: "Pending" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

export default function Tickets() {
  const { user } = useAuth();
  const { agents } = useAgents();
  const isAdmin = user?.role_id === 1;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<TicketStats>({
    total: 0,
    open: 0,
    inProgress: 0,
    pending: 0,
    resolved: 0,
    closed: 0,
    urgent: 0,
    high: 0,
  });

  // Filters
  const [q, setQ] = useState(() => searchParams.get("search") || "");
  const [filterStatus, setFilterStatus] = useState<string>(() => searchParams.get("status") || "");
  const [filterPriority, setFilterPriority] = useState<string>(() => searchParams.get("priority") || "");
  const [filterCategory, setFilterCategory] = useState<string>(() => searchParams.get("category") || "");
  const [filterAgent, setFilterAgent] = useState<number | "">(() => {
    const raw = searchParams.get("assigned_to");
    return raw ? Number(raw) : "";
  });
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "kanban">("table");

  // Pagination
  const [page, setPage] = useState(1);
  const [perPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [ticketToDelete, setTicketToDelete] = useState<Ticket | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Load tickets & stats
  async function loadData() {
    setLoading(true);
    try {
      const [ticketRes, statsRes] = await Promise.all([
        api.tickets.list({
          page,
          limit: perPage,
          search: q || undefined,
          status: filterStatus || undefined,
          priority: filterPriority || undefined,
          category: filterCategory || undefined,
          assigned_to: filterAgent || undefined,
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
        }),
        api.tickets.stats(),
      ]);

      const data = ticketRes?.data || [];
      const pg = ticketRes?.pagination;

      setTickets(Array.isArray(data) ? data : []);
      setTotalCount(pg?.total ?? 0);
      setTotalPages(pg?.totalPages ?? 1);

      if (statsRes?.data) {
        setStats(statsRes.data);
      }
    } catch (error: any) {
      console.error("Failed to load tickets:", error);
      toast.error(error?.message || "Failed to load tickets");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [page, q, filterStatus, filterPriority, filterCategory, filterAgent, fromDate, toDate]);

  // Sync filters to searchParams
  useEffect(() => {
    const next = new URLSearchParams();
    if (q) next.set("search", q);
    if (filterStatus) next.set("status", filterStatus);
    if (filterPriority) next.set("priority", filterPriority);
    if (filterCategory) next.set("category", filterCategory);
    if (filterAgent) next.set("assigned_to", String(filterAgent));
    setSearchParams(next, { replace: true });
  }, [q, filterStatus, filterPriority, filterCategory, filterAgent]);

  const handleResetFilters = () => {
    setQ("");
    setFilterStatus("");
    setFilterPriority("");
    setFilterCategory("");
    setFilterAgent("");
    setFromDate("");
    setToDate("");
    setPage(1);
  };

  const handleOpenDetail = async (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setDetailModalOpen(true);
    try {
      const res = await api.tickets.getById(ticket.id);
      if (res?.data) {
        setSelectedTicket(res.data);
      }
    } catch {
      // Keep existing
    }
  };

  const handleQuickStatusChange = async (ticketId: number, nextStatus: string) => {
    const toastId = toast.loading("Updating status...");
    try {
      const payload: any = { status: nextStatus };
      if (nextStatus === "resolved") {
        payload.resolved_at = new Date().toISOString();
      }
      await api.tickets.update(ticketId, payload);
      toast.success("Status updated successfully", { id: toastId });
      loadData();
      if (selectedTicket && selectedTicket.id === ticketId) {
        setSelectedTicket((prev) => (prev ? { ...prev, status: nextStatus } : null));
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to update status", { id: toastId });
    }
  };

  const confirmDelete = async () => {
    if (!ticketToDelete) return;
    setDeleting(true);
    const toastId = toast.loading("Deleting ticket...");
    try {
      await api.tickets.delete(ticketToDelete.id);
      toast.success("Ticket deleted successfully", { id: toastId });
      setDeleteModalOpen(false);
      setTicketToDelete(null);
      if (detailModalOpen && selectedTicket?.id === ticketToDelete.id) {
        setDetailModalOpen(false);
      }
      loadData();
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete ticket", { id: toastId });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="Ticket Management"
        subtitle="Track, assign, and resolve client support tickets and inquiries"
        total={totalCount}
        search={q}
        onSearch={setQ}
        icon={<TicketIcon size={20} />}
        rightActions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => loadData()}
              className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-2xs inline-flex items-center gap-1.5 transition"
              type="button"
            >
              <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>

            <button
              onClick={() => setCreateModalOpen(true)}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 inline-flex items-center gap-1.5 transition"
              type="button"
            >
              <Plus size={15} />
              New Ticket
            </button>
          </div>
        }
      />

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div
          onClick={() => {
            setFilterStatus("");
            setPage(1);
          }}
          className={cn(
            "p-4 rounded-xl border transition-all cursor-pointer shadow-2xs",
            filterStatus === ""
              ? "bg-blue-50/60 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800"
              : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
          )}
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium mb-1.5">
            <span>Total Tickets</span>
            <TicketIcon size={16} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {stats.total || totalCount}
          </div>
        </div>

        <div
          onClick={() => {
            setFilterStatus("open");
            setPage(1);
          }}
          className={cn(
            "p-4 rounded-xl border transition-all cursor-pointer shadow-2xs",
            filterStatus === "open"
              ? "bg-sky-50/60 dark:bg-sky-950/40 border-sky-300 dark:border-sky-800"
              : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
          )}
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium mb-1.5">
            <span>Open Tickets</span>
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-ping" />
          </div>
          <div className="text-2xl font-black text-sky-600 dark:text-sky-400">
            {stats.open}
          </div>
        </div>

        <div
          onClick={() => {
            setFilterStatus("in_progress");
            setPage(1);
          }}
          className={cn(
            "p-4 rounded-xl border transition-all cursor-pointer shadow-2xs",
            filterStatus === "in_progress"
              ? "bg-indigo-50/60 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800"
              : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
          )}
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium mb-1.5">
            <span>In Progress</span>
            <Clock size={16} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
            {stats.inProgress}
          </div>
        </div>

        <div
          onClick={() => {
            setFilterStatus("resolved");
            setPage(1);
          }}
          className={cn(
            "p-4 rounded-xl border transition-all cursor-pointer shadow-2xs",
            filterStatus === "resolved"
              ? "bg-emerald-50/60 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800"
              : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
          )}
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium mb-1.5">
            <span>Resolved</span>
            <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {stats.resolved}
          </div>
        </div>

        <div
          onClick={() => {
            setFilterPriority("urgent");
            setPage(1);
          }}
          className={cn(
            "p-4 rounded-xl border transition-all cursor-pointer shadow-2xs col-span-2 sm:col-span-1",
            filterPriority === "urgent"
              ? "bg-rose-50/60 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800"
              : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
          )}
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium mb-1.5">
            <span>Urgent Priority</span>
            <ShieldAlert size={16} className="text-rose-600 dark:text-rose-400" />
          </div>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400">
            {stats.urgent}
          </div>
        </div>
      </div>

      {/* Filter Toolbar & View Toggle */}
      <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Status Dropdown */}
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setPage(1);
              }}
              className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">All Statuses</option>
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>

            {/* Priority Dropdown */}
            <select
              value={filterPriority}
              onChange={(e) => {
                setFilterPriority(e.target.value);
                setPage(1);
              }}
              className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">All Priorities</option>
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>

            {/* Category Dropdown */}
            <select
              value={filterCategory}
              onChange={(e) => {
                setFilterCategory(e.target.value);
                setPage(1);
              }}
              className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>

            {/* Agent Dropdown */}
            <select
              value={filterAgent}
              onChange={(e) => {
                setFilterAgent(e.target.value ? Number(e.target.value) : "");
                setPage(1);
              }}
              className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">All Assigned Agents</option>
              {agents.map((a: any) => (
                <option key={a.id} value={a.id}>
                  {a.name || a.email}
                </option>
              ))}
            </select>

            {/* Clear Filters */}
            {(q || filterStatus || filterPriority || filterCategory || filterAgent || fromDate || toDate) && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="h-9 px-3 rounded-lg border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 text-xs font-bold hover:bg-rose-100 transition inline-flex items-center gap-1.5"
              >
                <X size={13} />
                Clear
              </button>
            )}
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={cn(
                "p-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition",
                viewMode === "table"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              )}
            >
              <List size={14} />
              <span className="hidden sm:inline">Table</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("kanban")}
              className={cn(
                "p-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition",
                viewMode === "kanban"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              )}
            >
              <LayoutGrid size={14} />
              <span className="hidden sm:inline">Kanban Board</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area: Table View or Kanban View */}
      {viewMode === "table" ? (
        <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 uppercase font-bold text-[11px] tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Ticket</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Priority</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Assigned To</th>
                  <th className="py-3.5 px-4">Due Date</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-14 text-center">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                        <span className="text-slate-500 text-xs font-semibold">
                          Loading tickets...
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : tickets.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-14 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                          <TicketIcon size={28} />
                        </div>
                        <div className="text-base font-bold text-slate-800 dark:text-white">
                          No tickets found
                        </div>
                        <p className="text-xs text-slate-500 max-w-sm">
                          Try adjusting search keywords or clearing active filters.
                        </p>
                        <button
                          type="button"
                          onClick={() => setCreateModalOpen(true)}
                          className="mt-1 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition"
                        >
                          Create New Ticket
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  tickets.map((t) => (
                    <tr
                      key={t.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group"
                    >
                      {/* Ticket # and Title */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-extrabold text-blue-600 dark:text-blue-400">
                              {t.ticket_number}
                            </span>
                            {t.lead_id && (
                              <span
                                onClick={() => navigate(`/leads?search=${t.lead?.name || t.lead_id}`)}
                                className="cursor-pointer text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 hover:underline flex items-center gap-1"
                                title="Associated Lead"
                              >
                                Lead #{t.lead_id}
                              </span>
                            )}
                          </div>
                          <div
                            onClick={() => handleOpenDetail(t)}
                            className="font-bold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer line-clamp-1 max-w-xs"
                          >
                            {t.title}
                          </div>
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <div className="font-semibold text-slate-900 dark:text-slate-200">
                            {t.customer_name || t.lead?.name || "—"}
                          </div>
                          {t.customer_phone ? (
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                              <Phone size={11} />
                              {t.customer_phone}
                            </div>
                          ) : t.customer_email ? (
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 truncate max-w-[150px]">
                              <Mail size={11} />
                              {t.customer_email}
                            </div>
                          ) : null}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4">
                        <CategoryBadge category={t.category} />
                      </td>

                      {/* Priority */}
                      <td className="py-3.5 px-4">
                        <PriorityBadge priority={t.priority} />
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <StatusBadge status={t.status} />
                      </td>

                      {/* Assigned Agent */}
                      <td className="py-3.5 px-4">
                        {t.assignedAgent ? (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-bold text-[10px] text-slate-700 dark:text-slate-300">
                              {t.assignedAgent.name?.[0]?.toUpperCase() || "A"}
                            </div>
                            <span className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[120px]">
                              {t.assignedAgent.name || t.assignedAgent.email}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs italic">Unassigned</span>
                        )}
                      </td>

                      {/* Due Date */}
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 font-medium">
                        {fmtDate(t.due_date)}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenDetail(t)}
                            className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
                            title="View & Edit"
                          >
                            <Pencil size={15} />
                          </button>

                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => {
                                setTicketToDelete(t);
                                setDeleteModalOpen(true);
                              }}
                              className="p-1.5 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/50 text-rose-600 dark:text-rose-400 transition"
                              title="Delete Ticket"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Page {page} of {totalPages} ({totalCount} total)
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold disabled:opacity-40"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold disabled:opacity-40"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Kanban Board View */
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {STATUSES.map((col) => {
            const colTickets = tickets.filter(
              (t) => (t.status || "").toLowerCase() === col.value
            );

            return (
              <div
                key={col.value}
                className="flex flex-col rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 p-3 min-h-[450px]"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200/60 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                      {col.label}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                      {colTickets.length}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCreateModalOpen(true);
                    }}
                    className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500"
                    title={`Add ticket to ${col.label}`}
                  >
                    <Plus size={14} />
                  </button>
                </div>

                {/* Column Cards */}
                <div className="space-y-2.5 flex-1 overflow-y-auto">
                  {colTickets.length === 0 ? (
                    <div className="py-8 text-center text-[11px] text-slate-400 italic">
                      No {col.label.toLowerCase()} tickets
                    </div>
                  ) : (
                    colTickets.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => handleOpenDetail(t)}
                        className="rounded-lg border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-800/90 p-3 shadow-2xs hover:shadow-md hover:border-blue-400 dark:hover:border-blue-500 transition cursor-pointer space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[11px] font-bold text-blue-600 dark:text-blue-400">
                            {t.ticket_number}
                          </span>
                          <PriorityBadge priority={t.priority} />
                        </div>

                        <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2">
                          {t.title}
                        </h4>

                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {t.customer_name || t.lead?.name || "No customer"}
                        </div>

                        <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-[10px] text-slate-400">
                          <div className="flex items-center gap-1.5">
                            <User size={12} />
                            <span className="truncate max-w-[80px]">
                              {t.assignedAgent?.name || "Unassigned"}
                            </span>
                          </div>
                          {t.due_date && (
                            <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                              <Calendar size={11} />
                              <span>{fmtDate(t.due_date)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Ticket Modal */}
      {createModalOpen && (
        <CreateTicketModal
          open={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          onSuccess={() => {
            setCreateModalOpen(false);
            loadData();
          }}
        />
      )}

      {/* Ticket Detail & Edit Modal */}
      {detailModalOpen && selectedTicket && (
        <TicketDetailModal
          open={detailModalOpen}
          ticket={selectedTicket}
          onClose={() => {
            setDetailModalOpen(false);
            setSelectedTicket(null);
          }}
          onUpdated={() => {
            loadData();
          }}
          onDelete={() => {
            setTicketToDelete(selectedTicket);
            setDeleteModalOpen(true);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && ticketToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Delete Ticket
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Are you sure you want to delete {ticketToDelete.ticket_number}?
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
              <strong className="block text-slate-900 dark:text-white font-semibold">
                {ticketToDelete.title}
              </strong>
              This action cannot be undone. All ticket logs and resolution records will be removed.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={confirmDelete}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white shadow-sm inline-flex items-center gap-1.5 transition disabled:opacity-50"
              >
                {deleting ? <Loader2 size={13} className="animate-spin" /> : null}
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Modal Components
function CreateTicketModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { agents } = useAgents();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("service");
  const [priority, setPriority] = useState("medium");
  const [status, setStatus] = useState("open");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [assignedTo, setAssignedTo] = useState<number | "">("");
  const [dueDate, setDueDate] = useState("");
  const [leadId, setLeadId] = useState<number | "">("");

  // Search existing leads to autofill
  const [leadsList, setLeadsList] = useState<any[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setLeadsLoading(true);
      api.leads
        .list({ limit: 50 })
        .then((res: any) => {
          const list = (res as any)?.data?.data ?? (res as any)?.data ?? [];
          setLeadsList(Array.isArray(list) ? list : []);
        })
        .catch(() => {})
        .finally(() => setLeadsLoading(false));
    }
  }, [open]);

  const handleSelectLead = (selectedId: string) => {
    if (!selectedId) {
      setLeadId("");
      return;
    }
    const idNum = Number(selectedId);
    setLeadId(idNum);
    const found = leadsList.find((l) => l.id === idNum);
    if (found) {
      if (!customerName) setCustomerName(found.name || "");
      if (!customerPhone) setCustomerPhone(found.contact_no || "");
      if (!customerEmail) setCustomerEmail(found.email || "");
      if (found.agent_id && !assignedTo) setAssignedTo(found.agent_id);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Please enter a ticket title");
      return;
    }

    setSaving(true);
    const toastId = toast.loading("Creating support ticket...");
    try {
      await api.tickets.create({
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        priority,
        status,
        customer_name: customerName.trim() || undefined,
        customer_phone: customerPhone.trim() || undefined,
        customer_email: customerEmail.trim() || undefined,
        assigned_to: assignedTo ? Number(assignedTo) : null,
        lead_id: leadId ? Number(leadId) : null,
        due_date: dueDate || null,
      });

      toast.success("Ticket created successfully!", { id: toastId });
      onSuccess();
    } catch (error: any) {
      console.error("Failed to create ticket:", error);
      toast.error(error?.message || "Failed to create ticket", { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <TicketIcon size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Create New Ticket
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Register a new client issue, inquiry, or task
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Associate with Lead */}
          <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Associate with Existing Lead (Optional)
            </label>
            <select
              value={leadId}
              onChange={(e) => handleSelectLead(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">-- Select lead to autofill details --</option>
              {leadsList.map((l) => (
                <option key={l.id} value={l.id}>
                  #{l.id} {l.name || "Unnamed"} - {l.contact_no || l.email || "No contact"}
                </option>
              ))}
            </select>
          </div>

          {/* Ticket Title */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Ticket Title / Subject *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Quotation revision request, payment confirmation issue..."
              className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Category, Priority, Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-medium focus:outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-medium focus:outline-none"
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Initial Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-medium focus:outline-none"
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Customer Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Customer Name
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Client name"
                className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-medium focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Customer Phone
              </label>
              <input
                type="text"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="+91 9876543210"
                className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-medium focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Customer Email
              </label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="client@example.com"
                className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-medium focus:outline-none"
              />
            </div>
          </div>

          {/* Assigned Agent & Due Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Assign to Agent
              </label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value ? Number(e.target.value) : "")}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-medium focus:outline-none"
              >
                <option value="">-- Assign later (Unassigned) --</option>
                {agents.map((a: any) => (
                  <option key={a.id} value={a.id}>
                    {a.name || a.email}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Target Resolution Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-medium focus:outline-none"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Description / Notes
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the issue, requested changes, or follow-up instructions..."
              className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Footer buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-xs font-bold text-white shadow-sm inline-flex items-center gap-1.5 transition"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : null}
              Create Ticket
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TicketDetailModal({
  open,
  ticket,
  onClose,
  onUpdated,
  onDelete,
}: {
  open: boolean;
  ticket: Ticket;
  onClose: () => void;
  onUpdated: () => void;
  onDelete: () => void;
}) {
  const { agents } = useAgents();
  const { user } = useAuth();
  const isAdmin = user?.role_id === 1;
  const navigate = useNavigate();

  const [saving, setSaving] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(ticket.status || "open");
  const [currentPriority, setCurrentPriority] = useState(ticket.priority || "medium");
  const [currentCategory, setCurrentCategory] = useState(ticket.category || "service");
  const [assignedTo, setAssignedTo] = useState<number | "">(ticket.assigned_to || "");
  const [dueDate, setDueDate] = useState(ticket.due_date ? String(ticket.due_date).slice(0, 10) : "");
  const [resolutionNotes, setResolutionNotes] = useState(ticket.resolution_notes || "");
  const [description, setDescription] = useState(ticket.description || "");

  const handleSave = async () => {
    setSaving(true);
    const toastId = toast.loading("Saving ticket updates...");
    try {
      const payload: any = {
        status: currentStatus,
        priority: currentPriority,
        category: currentCategory,
        assigned_to: assignedTo ? Number(assignedTo) : null,
        due_date: dueDate || null,
        resolution_notes: resolutionNotes.trim() || null,
        description: description.trim() || null,
      };

      if (currentStatus === "resolved" && !ticket.resolved_at) {
        payload.resolved_at = new Date().toISOString();
      }

      await api.tickets.update(ticket.id, payload);
      toast.success("Ticket updated successfully", { id: toastId });
      onUpdated();
      onClose();
    } catch (error: any) {
      console.error("Failed to update ticket:", error);
      toast.error(error?.message || "Failed to update ticket", { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <TicketIcon size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-black text-blue-600 dark:text-blue-400">
                  {ticket.ticket_number}
                </span>
                <StatusBadge status={currentStatus} />
                <PriorityBadge priority={currentPriority} />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white line-clamp-1 mt-0.5">
                {ticket.title}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Quick Info Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-700">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Created At</span>
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-0.5 block">
                {fmtDateTime(ticket.createdAt)}
              </span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-700">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Created By</span>
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-0.5 block truncate">
                {ticket.creator?.name || ticket.creator?.email || "System"}
              </span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-700">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Customer</span>
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-0.5 block truncate">
                {ticket.customer_name || ticket.lead?.name || "—"}
              </span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-700">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Lead Reference</span>
              {ticket.lead_id ? (
                <button
                  type="button"
                  onClick={() => navigate(`/leads?search=${ticket.lead?.name || ticket.lead_id}`)}
                  className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 mt-0.5"
                >
                  Lead #{ticket.lead_id} <ExternalLink size={10} />
                </button>
              ) : (
                <span className="text-xs text-slate-400 mt-0.5 block">—</span>
              )}
            </div>
          </div>

          {/* Status & Priority Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50/50 dark:bg-slate-800/30 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Status
              </label>
              <select
                value={currentStatus}
                onChange={(e) => setCurrentStatus(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-semibold focus:outline-none"
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Priority
              </label>
              <select
                value={currentPriority}
                onChange={(e) => setCurrentPriority(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-semibold focus:outline-none"
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Assigned Agent
              </label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value ? Number(e.target.value) : "")}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-semibold focus:outline-none"
              >
                <option value="">-- Unassigned --</option>
                {agents.map((a: any) => (
                  <option key={a.id} value={a.id}>
                    {a.name || a.email}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Due Date & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Category
              </label>
              <select
                value={currentCategory}
                onChange={(e) => setCurrentCategory(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-semibold focus:outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Target Resolution Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-medium focus:outline-none"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Issue / Inquiry Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ticket details..."
              className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-medium focus:outline-none"
            />
          </div>

          {/* Resolution Notes */}
          <div className="bg-emerald-50/50 dark:bg-emerald-950/30 p-3.5 rounded-xl border border-emerald-200/80 dark:border-emerald-800/50 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400" />
                Resolution Notes
              </label>
              {ticket.resolved_at && (
                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">
                  Resolved on: {fmtDateTime(ticket.resolved_at)}
                </span>
              )}
            </div>
            <textarea
              rows={3}
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              placeholder="Provide details on how this issue was resolved..."
              className="w-full p-2.5 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-medium focus:outline-none"
            />
          </div>

          {/* Footer Controls */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
            {isAdmin ? (
              <button
                type="button"
                onClick={onDelete}
                className="px-3 py-2 rounded-lg text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 transition inline-flex items-center gap-1.5"
              >
                <Trash2 size={13} />
                Delete Ticket
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-xs font-bold text-white shadow-sm inline-flex items-center gap-1.5 transition"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : null}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
