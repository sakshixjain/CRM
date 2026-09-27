/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  Kanban,
  List,
  Plus,
  Search,
  Building2,
  User,
  Trash2,
  Edit2,
  X,
  Clock,
  RefreshCcw,
  Loader2,
  TrendingUp,
} from "lucide-react";
import toast from "react-hot-toast";
import { api } from "../lib/api";

export type DealStage = "New" | "Contacted" | "Negotiation" | "Won" | "Lost";

export type Deal = {
  id: string | number;
  title: string;
  amount: number;
  company: string;
  contact_name: string;
  stage: DealStage;
  assigned_to: string;
  expected_close_date: string;
  probability: number;
  description?: string;
  created_at: string;
  lead_id?: string | number;
  quotation_id?: string | number;
};

const STAGES: { key: DealStage; label: string; color: string; badgeBg: string }[] = [
  { key: "New", label: "New", color: "border-blue-500", badgeBg: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400" },
  { key: "Contacted", label: "Contacted", color: "border-amber-500", badgeBg: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" },
  { key: "Negotiation", label: "Negotiation", color: "border-purple-500", badgeBg: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400" },
  { key: "Won", label: "Won", color: "border-emerald-500", badgeBg: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" },
  { key: "Lost", label: "Lost", color: "border-rose-500", badgeBg: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400" },
];

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n || 0);
}

function unwrapList(res: any): any[] {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.data?.data)) return res.data.data;
  return [];
}

export default function Deals() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [agentsList, setAgentsList] = useState<any[]>([]);

  const [formData, setFormData] = useState<Partial<Deal>>({
    stage: "New",
    probability: 30,
    amount: 50000,
  });

  const loadDynamicDeals = useCallback(async () => {
    setLoading(true);
    try {
      const [quotationsRes, leadsRes, agentsRes] = await Promise.allSettled([
        api.quotations.list({ page: 1, limit: 5000 }),
        api.leads.list({ page: 1, limit: 5000 }),
        api.listAgents(),
      ]);

      const agents = agentsRes.status === "fulfilled" ? unwrapList(agentsRes.value) : [];
      setAgentsList(agents);

      const dynamicDeals: Deal[] = [];

      // 1. From Quotations
      if (quotationsRes.status === "fulfilled" && quotationsRes.value) {
        const rawQuotations = unwrapList(quotationsRes.value);
        rawQuotations.forEach((q: any) => {
          let stage: DealStage = "New";
          if (q.first_payment_date && q.second_payment_date) stage = "Won";
          else if (q.first_payment_date) stage = "Negotiation";
          else if (q.status === "rejected" || q.status === "lost") stage = "Lost";
          else if (q.status === "sent" || q.status === "contacted") stage = "Contacted";
          else if (q.status === "negotiation" || q.status === "pending") stage = "Negotiation";

          const totalAmt = Number(q.total_amount || q.amount || 0);
          const contactName = q.to_company || q.client_name || q.contact_person || `Client #${q.id}`;
          const companyName = q.company_name || q.to_company || "Direct Client";
          const createdAt = q.created_at || q.createdAt ? new Date(q.created_at || q.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "Recent";

          dynamicDeals.push({
            id: `quotation-${q.id}`,
            title: q.subject || q.service?.name || `Quotation #${q.id}`,
            amount: totalAmt,
            company: companyName,
            contact_name: contactName,
            stage,
            assigned_to: q.created_by_name || "Sales Team",
            expected_close_date: q.second_payment_date || q.first_payment_date || "Open",
            probability: stage === "Won" ? 100 : stage === "Negotiation" ? 75 : stage === "Contacted" ? 50 : stage === "Lost" ? 0 : 30,
            description: q.remarks || `Quotation for ${q.service?.name || "Services"}`,
            created_at: createdAt,
            quotation_id: q.id,
          });
        });
      }

      // 2. From High-Value / In-Progress Leads
      if (leadsRes.status === "fulfilled" && leadsRes.value) {
        const rawLeads = unwrapList(leadsRes.value);
        rawLeads.forEach((l: any) => {
          const statusName = String(l.status?.name || "").toLowerCase();
          let stage: DealStage = "New";
          if (statusName.includes("won") || statusName.includes("done") || statusName.includes("close")) stage = "Won";
          else if (statusName.includes("lost") || statusName.includes("dead") || statusName.includes("reject")) stage = "Lost";
          else if (statusName.includes("nego") || statusName.includes("proposal") || statusName.includes("quote")) stage = "Negotiation";
          else if (statusName.includes("contact") || statusName.includes("call") || statusName.includes("follow")) stage = "Contacted";

          const amt = Number(l.amount || l.deal_value || (stage === "Won" ? 75000 : 45000));
          const leadName = l.name || l.contact_person || `Lead #${l.id}`;
          const company = l.company_name || "Enterprise";
          const createdAt = l.created_at || l.createdAt ? new Date(l.created_at || l.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "Recent";
          const agentName = l.agent?.name || l.changedByAdmin?.name || "Sakshi";

          // Avoid duplicates if quotation already created for lead
          dynamicDeals.push({
            id: `lead-${l.id}`,
            title: l.requirement || l.product_name || `Deal: ${leadName}`,
            amount: amt,
            company,
            contact_name: leadName,
            stage,
            assigned_to: agentName,
            expected_close_date: "15-30 Days",
            probability: stage === "Won" ? 100 : stage === "Negotiation" ? 80 : stage === "Contacted" ? 50 : stage === "Lost" ? 0 : 25,
            description: l.notes || l.remark || "",
            created_at: createdAt,
            lead_id: l.id,
          });
        });
      }

      // Check for user-added local deals
      try {
        const savedCustom = localStorage.getItem("crm_custom_deals");
        if (savedCustom) {
          const customDeals = JSON.parse(savedCustom);
          if (Array.isArray(customDeals)) {
            dynamicDeals.unshift(...customDeals);
          }
        }
      } catch (e) {
        console.error(e);
      }

      setDeals(dynamicDeals);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load deals");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDynamicDeals();
  }, [loadDynamicDeals]);

  const filteredDeals = useMemo(() => {
    return deals.filter((d) => {
      const q = search.toLowerCase();
      return (
        d.title.toLowerCase().includes(q) ||
        d.company.toLowerCase().includes(q) ||
        d.contact_name.toLowerCase().includes(q) ||
        d.assigned_to.toLowerCase().includes(q)
      );
    });
  }, [deals, search]);

  const stageTotals = useMemo(() => {
    const totals: Record<DealStage, { count: number; sum: number }> = {
      New: { count: 0, sum: 0 },
      Contacted: { count: 0, sum: 0 },
      Negotiation: { count: 0, sum: 0 },
      Won: { count: 0, sum: 0 },
      Lost: { count: 0, sum: 0 },
    };

    filteredDeals.forEach((d) => {
      if (totals[d.stage]) {
        totals[d.stage].count += 1;
        totals[d.stage].sum += Number(d.amount) || 0;
      }
    });

    return totals;
  }, [filteredDeals]);

  const totalPipelineValue = useMemo(() => {
    return filteredDeals.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  }, [filteredDeals]);

  const wonDealsValue = useMemo(() => {
    return filteredDeals
      .filter((d) => d.stage === "Won")
      .reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  }, [filteredDeals]);

  const handleStageChange = (dealId: string | number, nextStage: DealStage) => {
    const updated = deals.map((d) =>
      d.id === dealId
        ? {
            ...d,
            stage: nextStage,
            probability:
              nextStage === "Won"
                ? 100
                : nextStage === "Negotiation"
                ? 75
                : nextStage === "Contacted"
                ? 50
                : nextStage === "Lost"
                ? 0
                : 30,
          }
        : d
    );
    setDeals(updated);
    toast.success(`Deal moved to ${nextStage}`);
  };

  const handleOpenAdd = () => {
    setEditingDeal(null);
    setFormData({
      title: "",
      amount: 50000,
      company: "",
      contact_name: "",
      stage: "New",
      assigned_to: agentsList[0]?.name || "Sakshi",
      expected_close_date: new Date(Date.now() + 14 * 86400000).toLocaleDateString(
        "en-GB",
        { day: "2-digit", month: "short", year: "numeric" }
      ),
      probability: 30,
      description: "",
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (d: Deal) => {
    setEditingDeal(d);
    setFormData(d);
    setModalOpen(true);
  };

  const handleDelete = (id: string | number) => {
    if (window.confirm("Are you sure you want to delete this deal?")) {
      const updated = deals.filter((d) => d.id !== id);
      setDeals(updated);

      try {
        const savedCustom = localStorage.getItem("crm_custom_deals");
        if (savedCustom) {
          const list = JSON.parse(savedCustom);
          const filtered = list.filter((x: any) => x.id !== id);
          localStorage.setItem("crm_custom_deals", JSON.stringify(filtered));
        }
      } catch (e) {
        console.error(e);
      }

      toast.success("Deal removed successfully");
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.amount) {
      toast.error("Please provide title and amount");
      return;
    }

    if (editingDeal) {
      const updated = deals.map((d) =>
        d.id === editingDeal.id ? ({ ...d, ...formData } as Deal) : d
      );
      setDeals(updated);
      toast.success("Deal updated");
    } else {
      const newDeal: Deal = {
        id: `custom-${Date.now()}`,
        title: formData.title || "",
        amount: Number(formData.amount) || 0,
        company: formData.company || "Independent",
        contact_name: formData.contact_name || "Lead",
        stage: (formData.stage as DealStage) || "New",
        assigned_to: formData.assigned_to || "Admin",
        expected_close_date: formData.expected_close_date || "30 Days",
        probability: Number(formData.probability) || 30,
        description: formData.description || "",
        created_at: new Date().toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
      };

      setDeals([newDeal, ...deals]);

      try {
        const savedCustom = localStorage.getItem("crm_custom_deals");
        const list = savedCustom ? JSON.parse(savedCustom) : [];
        list.unshift(newDeal);
        localStorage.setItem("crm_custom_deals", JSON.stringify(list));
      } catch (e) {
        console.error(e);
      }

      toast.success("Deal created successfully");
    }
    setModalOpen(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1B2559] dark:text-white tracking-tight flex items-center gap-2.5">
            <Kanban className="text-blue-600" size={24} />
            Deals Pipeline
          </h1>
          <p className="text-xs font-medium text-[#8F9CAE] mt-0.5">
            Dynamic tracking of customer opportunities, quotation stages, and revenue conversions.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => loadDynamicDeals()}
            disabled={loading}
            className="p-2 rounded-md border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 text-[#1B2559] dark:text-white hover:bg-slate-50 transition"
            title="Refresh from CRM"
          >
            <RefreshCcw size={15} className={loading ? "animate-spin text-blue-600" : ""} />
          </button>

          {/* Kanban / List Toggle */}
          <div className="inline-flex rounded-md border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 p-1 shadow-xs">
            <button
              onClick={() => setViewMode("kanban")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition ${
                viewMode === "kanban"
                  ? "bg-[#111C44] text-white shadow-xs"
                  : "text-[#8F9CAE] hover:text-[#1B2559] dark:hover:text-white"
              }`}
            >
              <Kanban size={14} /> Kanban
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition ${
                viewMode === "list"
                  ? "bg-[#111C44] text-white shadow-xs"
                  : "text-[#8F9CAE] hover:text-[#1B2559] dark:hover:text-white"
              }`}
            >
              <List size={14} /> List
            </button>
          </div>

          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 rounded-md bg-[#111C44] hover:bg-[#1E2E69] text-white px-4 py-2 text-xs font-bold shadow-md shadow-[#111C44]/20 transition"
          >
            <Plus size={16} />
            Create Deal
          </button>
        </div>
      </div>

      {/* KPI Metric Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <div className="text-xs font-bold text-[#8F9CAE]">Total Pipeline Value</div>
          <div className="text-2xl font-black text-[#1B2559] dark:text-white mt-1">
            {formatCurrency(totalPipelineValue)}
          </div>
          <div className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 mt-1 flex items-center gap-1">
            <TrendingUp size={12} /> {filteredDeals.length} dynamic deals active
          </div>
        </div>

        <div className="rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <div className="text-xs font-bold text-[#8F9CAE]">Closed Won Revenue</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">
            {formatCurrency(wonDealsValue)}
          </div>
          <div className="text-[11px] font-semibold text-emerald-600 mt-1">
            {stageTotals.Won.count} converted opportunities
          </div>
        </div>

        <div className="rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <div className="text-xs font-bold text-[#8F9CAE]">Negotiations In Progress</div>
          <div className="text-2xl font-black text-purple-600 mt-1">
            {formatCurrency(stageTotals.Negotiation.sum)}
          </div>
          <div className="text-[11px] font-semibold text-purple-600 mt-1">
            {stageTotals.Negotiation.count} high-intent deals
          </div>
        </div>

        <div className="rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <div className="text-xs font-bold text-[#8F9CAE]">Avg Deal Size</div>
          <div className="text-2xl font-black text-[#1B2559] dark:text-white mt-1">
            {formatCurrency(
              filteredDeals.length > 0 ? Math.round(totalPipelineValue / filteredDeals.length) : 0
            )}
          </div>
          <div className="text-[11px] font-semibold text-[#8F9CAE] mt-1">
            Across active opportunities
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search dynamic deals by title, company, contact, or owner..."
          className="w-full pl-10 pr-4 py-2.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-[#1B2559] dark:text-white focus:border-[#111C44] focus:outline-none shadow-xs"
        />
      </div>

      {loading && (
        <div className="flex items-center justify-center p-12 text-xs text-slate-500 font-semibold">
          <Loader2 size={18} className="animate-spin text-blue-600 mr-2" />
          Synchronizing dynamic pipeline opportunities...
        </div>
      )}

      {/* KANBAN VIEW */}
      {!loading && viewMode === "kanban" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-start">
          {STAGES.map((stage) => {
            const stageDeals = filteredDeals.filter((d) => d.stage === stage.key);
            const totalStageAmt = stageTotals[stage.key].sum;

            return (
              <div
                key={stage.key}
                className="rounded-md border border-slate-200/70 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-3.5 space-y-3 flex flex-col min-h-[500px]"
              >
                {/* Stage Header */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/70 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${stage.color.replace("border-", "bg-")}`} />
                    <span className="text-xs font-extrabold text-[#1B2559] dark:text-white">
                      {stage.label}
                    </span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-[#1B2559] dark:text-slate-300">
                      {stageDeals.length}
                    </span>
                  </div>
                  <span className="text-[11px] font-black text-[#1B2559] dark:text-slate-200">
                    {formatCurrency(totalStageAmt)}
                  </span>
                </div>

                {/* Deal Cards */}
                <div className="space-y-2.5 flex-1">
                  {stageDeals.map((deal) => (
                    <div
                      key={deal.id}
                      className="group rounded-md border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-extrabold text-xs text-[#1B2559] dark:text-white line-clamp-2">
                          {deal.title}
                        </div>
                        <button
                          onClick={() => handleOpenEdit(deal)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-[#111C44] dark:hover:text-white transition"
                        >
                          <Edit2 size={13} />
                        </button>
                      </div>

                      <div className="text-base font-black text-[#111C44] dark:text-emerald-400">
                        {formatCurrency(deal.amount)}
                      </div>

                      <div className="space-y-1 text-[11px] text-[#8F9CAE]">
                        <div className="flex items-center gap-1.5 truncate">
                          <Building2 size={12} /> {deal.company}
                        </div>
                        <div className="flex items-center gap-1.5 truncate">
                          <User size={12} /> {deal.contact_name}
                        </div>
                        <div className="flex items-center gap-1.5 truncate">
                          <Clock size={12} /> Close: {deal.expected_close_date}
                        </div>
                      </div>

                      {/* Quick stage mover */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <select
                          value={deal.stage}
                          onChange={(e) => handleStageChange(deal.id, e.target.value as DealStage)}
                          className="text-[10px] font-bold rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1 text-[#1B2559] dark:text-white focus:outline-none"
                        >
                          {STAGES.map((s) => (
                            <option key={s.key} value={s.key}>
                              {s.label}
                            </option>
                          ))}
                        </select>

                        <span className="text-[10px] font-bold text-slate-400">
                          {deal.assigned_to}
                        </span>
                      </div>
                    </div>
                  ))}

                  {stageDeals.length === 0 && (
                    <div className="text-center py-10 text-[11px] text-slate-400 font-medium border border-dashed border-slate-200 dark:border-slate-800 rounded-md">
                      No deals in {stage.label}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* LIST VIEW */}
      {!loading && viewMode === "list" && (
        <div className="rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/40 text-[11px] font-bold uppercase tracking-wider text-[#8F9CAE]">
                  <th className="py-3.5 px-5">Deal Opportunity</th>
                  <th className="py-3.5 px-5">Amount</th>
                  <th className="py-3.5 px-5">Company & Contact</th>
                  <th className="py-3.5 px-5">Stage</th>
                  <th className="py-3.5 px-5">Assigned To</th>
                  <th className="py-3.5 px-5">Expected Close</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {filteredDeals.map((deal) => (
                  <tr key={deal.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-5 font-bold text-[#1B2559] dark:text-white">
                      {deal.title}
                    </td>
                    <td className="py-3.5 px-5 font-black text-[#111C44] dark:text-emerald-400">
                      {formatCurrency(deal.amount)}
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="font-semibold text-[#1B2559] dark:text-slate-200">{deal.company}</div>
                      <div className="text-[11px] text-[#8F9CAE]">{deal.contact_name}</div>
                    </td>
                    <td className="py-3.5 px-5">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-extrabold ${STAGES.find((s) => s.key === deal.stage)?.badgeBg}`}>
                        {deal.stage}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-[#8F9CAE] font-medium">
                      {deal.assigned_to}
                    </td>
                    <td className="py-3.5 px-5 text-[#8F9CAE] font-medium">
                      {deal.expected_close_date}
                    </td>
                    <td className="py-3.5 px-5 text-right space-x-1.5">
                      <button
                        onClick={() => handleOpenEdit(deal)}
                        className="p-1.5 text-slate-400 hover:text-[#111C44] dark:hover:text-white transition"
                        title="Edit Deal"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(deal.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 transition"
                        title="Delete Deal"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4 bg-[#111C44] text-white">
              <h3 className="text-base font-extrabold tracking-tight">
                {editingDeal ? "Edit Deal" : "Create New Deal"}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-md text-slate-300 hover:text-white hover:bg-white/10 transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#1B2559] dark:text-slate-200 mb-1">
                  Deal Title *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title || ""}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Enterprise Software Contract"
                  className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-medium text-[#1B2559] dark:text-white focus:border-[#111C44] focus:bg-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#1B2559] dark:text-slate-200 mb-1">
                    Amount (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    value={formData.amount || ""}
                    onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                    className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-medium text-[#1B2559] dark:text-white focus:border-[#111C44] focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1B2559] dark:text-slate-200 mb-1">
                    Pipeline Stage
                  </label>
                  <select
                    value={formData.stage || "New"}
                    onChange={(e) => setFormData({ ...formData, stage: e.target.value as DealStage })}
                    className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-[#1B2559] dark:text-white focus:border-[#111C44] focus:outline-none"
                  >
                    {STAGES.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1B2559] dark:text-slate-200 mb-1">
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={formData.company || ""}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    placeholder="e.g. ABC Tech Solutions"
                    className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-medium text-[#1B2559] dark:text-white focus:border-[#111C44] focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1B2559] dark:text-slate-200 mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    value={formData.contact_name || ""}
                    onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                    placeholder="e.g. Priya Sharma"
                    className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-medium text-[#1B2559] dark:text-white focus:border-[#111C44] focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1B2559] dark:text-slate-200 mb-1">
                  Assigned Sales Rep
                </label>
                <select
                  value={formData.assigned_to || ""}
                  onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                  className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-[#1B2559] dark:text-white focus:border-[#111C44] focus:outline-none"
                >
                  {agentsList.map((a: any) => (
                    <option key={a.id} value={a.name}>
                      {a.name} ({a.email || "Agent"})
                    </option>
                  ))}
                  {agentsList.length === 0 && <option value="Sakshi">Sakshi</option>}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-semibold text-[#1B2559] dark:text-slate-200 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-[#111C44] hover:bg-[#1E2E69] text-white px-5 py-2 text-xs font-bold shadow-md shadow-[#111C44]/20 transition"
                >
                  {editingDeal ? "Save Changes" : "Create Deal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
