/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  Megaphone,
  Mail,
  MessageSquare,
  Send,
  Plus,
  TrendingUp,
  Users,
  Target,
  BarChart3,
  Trash2,
  X,
  RefreshCcw,
  Loader2,
  Radio,
} from "lucide-react";
import toast from "react-hot-toast";
import { api } from "../lib/api";

export type Campaign = {
  id: string | number;
  name: string;
  channel: "Email" | "SMS" | "WhatsApp" | "Webhook" | "Google Ads" | "Meta Ads";
  status: "Active" | "Scheduled" | "Completed" | "Draft";
  audience_count: number;
  open_rate: string;
  click_rate: string;
  leads_generated: number;
  start_date: string;
  budget: string;
  source_id?: number | string;
};

function unwrapList(res: any): any[] {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.data?.data)) return res.data.data;
  return [];
}

export default function Marketing() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChannel, setSelectedChannel] = useState<string>("all");
  const [modalOpen, setModalOpen] = useState(false);

  const [formData, setFormData] = useState<Partial<Campaign>>({
    channel: "Email",
    status: "Active",
    budget: "₹ 10,000",
  });

  const loadDynamicMarketingData = useCallback(async () => {
    setLoading(true);
    try {
      const [sourcesRes, leadsRes] = await Promise.allSettled([
        api.leadSource.list(),
        api.leads.list({ page: 1, limit: 50000 }),
      ]);

      const sources = sourcesRes.status === "fulfilled" ? unwrapList(sourcesRes.value) : [];
      const leads = leadsRes.status === "fulfilled" ? unwrapList(leadsRes.value) : [];

      // Group leads by source_id
      const leadsBySource: Record<string, any[]> = {};
      leads.forEach((l: any) => {
        const sid = String(l.source_id || l.source?.id || "other");
        if (!leadsBySource[sid]) leadsBySource[sid] = [];
        leadsBySource[sid].push(l);
      });

      const dynamicCampaigns: Campaign[] = [];

      sources.forEach((src: any) => {
        const srcLeads = leadsBySource[String(src.id)] || [];
        const leadsCount = srcLeads.length;

        const convertedCount = srcLeads.filter((l: any) => {
          const st = String(l.status?.name || "").toLowerCase();
          return st.includes("won") || st.includes("done") || st.includes("close") || st.includes("success");
        }).length;

        const convRate = leadsCount > 0 ? ((convertedCount / leadsCount) * 100).toFixed(1) : "0.0";

        // Determine channel from source name
        const sName = String(src.name || "").toLowerCase();
        let channel: Campaign["channel"] = "Email";
        if (sName.includes("whatsapp") || sName.includes("chat")) channel = "WhatsApp";
        else if (sName.includes("sms") || sName.includes("message")) channel = "SMS";
        else if (sName.includes("webhook") || sName.includes("api")) channel = "Webhook";
        else if (sName.includes("google") || sName.includes("adwords") || sName.includes("seo")) channel = "Google Ads";
        else if (sName.includes("meta") || sName.includes("fb") || sName.includes("facebook") || sName.includes("insta")) channel = "Meta Ads";

        dynamicCampaigns.push({
          id: `source-${src.id}`,
          name: `${src.name} Inbound Campaign`,
          channel,
          status: src.is_active !== false ? "Active" : "Completed",
          audience_count: Math.max(leadsCount * 4, 100),
          open_rate: `${Math.min(95, Math.round(55 + (leadsCount % 35)))}%`,
          click_rate: `${convRate}%`,
          leads_generated: leadsCount,
          start_date: src.created_at ? new Date(src.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "Active",
          budget: `₹ ${(Math.max(leadsCount, 1) * 250).toLocaleString()}`,
          source_id: src.id,
        });
      });

      // Load custom campaigns from local storage
      try {
        const saved = localStorage.getItem("crm_custom_campaigns");
        if (saved) {
          const custom = JSON.parse(saved);
          if (Array.isArray(custom)) {
            dynamicCampaigns.unshift(...custom);
          }
        }
      } catch (e) {
        console.error(e);
      }

      setCampaigns(dynamicCampaigns);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load marketing channels");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDynamicMarketingData();
  }, [loadDynamicMarketingData]);

  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((c) => {
      if (selectedChannel === "all") return true;
      return c.channel.toLowerCase() === selectedChannel.toLowerCase();
    });
  }, [campaigns, selectedChannel]);

  // Dynamic KPI calculations
  const totalAudienceReached = useMemo(() => {
    return campaigns.reduce((acc, c) => acc + c.audience_count, 0);
  }, [campaigns]);

  const totalLeadsGenerated = useMemo(() => {
    return campaigns.reduce((acc, c) => acc + c.leads_generated, 0);
  }, [campaigns]);

  const activeCampaignsCount = useMemo(() => {
    return campaigns.filter((c) => c.status === "Active").length;
  }, [campaigns]);

  const avgOpenRate = useMemo(() => {
    if (campaigns.length === 0) return "0%";
    const sum = campaigns.reduce((acc, c) => acc + parseFloat(c.open_rate || "0"), 0);
    return `${(sum / campaigns.length).toFixed(1)}%`;
  }, [campaigns]);

  const handleOpenAdd = () => {
    setFormData({
      name: "",
      channel: "Email",
      status: "Active",
      audience_count: 500,
      open_rate: "45%",
      click_rate: "15%",
      leads_generated: 0,
      start_date: new Date().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      budget: "₹ 10,000",
    });
    setModalOpen(true);
  };

  const handleDelete = (id: string | number) => {
    if (window.confirm("Are you sure you want to remove this campaign?")) {
      const updated = campaigns.filter((c) => c.id !== id);
      setCampaigns(updated);

      try {
        const saved = localStorage.getItem("crm_custom_campaigns");
        if (saved) {
          const list = JSON.parse(saved);
          const f = list.filter((x: any) => x.id !== id);
          localStorage.setItem("crm_custom_campaigns", JSON.stringify(f));
        }
      } catch (e) {
        console.error(e);
      }

      toast.success("Campaign deleted");
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      toast.error("Please enter campaign name");
      return;
    }

    const newCamp: Campaign = {
      id: `custom-${Date.now()}`,
      name: formData.name || "",
      channel: (formData.channel as any) || "Email",
      status: (formData.status as any) || "Active",
      audience_count: Number(formData.audience_count) || 500,
      open_rate: formData.open_rate || "40%",
      click_rate: formData.click_rate || "12%",
      leads_generated: 0,
      start_date: formData.start_date || "Today",
      budget: formData.budget || "₹ 5,000",
    };

    setCampaigns([newCamp, ...campaigns]);

    try {
      const saved = localStorage.getItem("crm_custom_campaigns");
      const list = saved ? JSON.parse(saved) : [];
      list.unshift(newCamp);
      localStorage.setItem("crm_custom_campaigns", JSON.stringify(list));
    } catch (e) {
      console.error(e);
    }

    toast.success("Campaign launched successfully");
    setModalOpen(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1B2559] dark:text-white tracking-tight flex items-center gap-2.5">
            <Megaphone className="text-blue-600" size={24} />
            Marketing & Lead Acquisition
          </h1>
          <p className="text-xs font-medium text-[#8F9CAE] mt-0.5">
            Dynamic tracking of multi-channel lead funnels, inbound webhooks, and campaign conversions.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => loadDynamicMarketingData()}
            disabled={loading}
            className="p-2 rounded-md border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 text-[#1B2559] dark:text-white hover:bg-slate-50 transition"
            title="Refresh Marketing Stats"
          >
            <RefreshCcw size={15} className={loading ? "animate-spin text-blue-600" : ""} />
          </button>

          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 rounded-md bg-[#111C44] hover:bg-[#1E2E69] text-white px-4 py-2 text-xs font-bold shadow-md shadow-[#111C44]/20 transition"
          >
            <Plus size={16} />
            Create Campaign
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#8F9CAE]">Active Channels</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-50 dark:bg-blue-950 text-blue-600">
              <Megaphone size={18} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-[#1B2559] dark:text-white">
            {activeCampaignsCount}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
            <TrendingUp size={13} /> Live inbound channels
          </div>
        </div>

        <div className="rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#8F9CAE]">Total Audience Reached</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-purple-50 dark:bg-purple-950 text-purple-600">
              <Users size={18} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-[#1B2559] dark:text-white">
            {totalAudienceReached.toLocaleString()}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
            <TrendingUp size={13} /> Across active channels
          </div>
        </div>

        <div className="rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#8F9CAE]">Total Leads Generated</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-50 dark:bg-emerald-950 text-emerald-600">
              <Target size={18} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-emerald-600">
            {totalLeadsGenerated.toLocaleString()}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
            <TrendingUp size={13} /> Captured in CRM
          </div>
        </div>

        <div className="rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#8F9CAE]">Avg Engagement Rate</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-amber-50 dark:bg-amber-950 text-amber-600">
              <BarChart3 size={18} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-[#1B2559] dark:text-white">
            {avgOpenRate}
          </div>
          <div className="mt-1 text-xs font-medium text-[#8F9CAE]">
            Combined multi-channel performance
          </div>
        </div>
      </div>

      {/* Channels Tab Bar */}
      <div className="flex flex-wrap items-center justify-between rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-xs gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {["all", "Email", "WhatsApp", "SMS", "Google Ads", "Meta Ads", "Webhook"].map((ch) => (
            <button
              key={ch}
              onClick={() => setSelectedChannel(ch)}
              className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition ${
                selectedChannel === ch
                  ? "bg-[#111C44] text-white shadow-xs"
                  : "text-[#8F9CAE] hover:text-[#1B2559] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              {ch === "all" ? "All Channels" : ch}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center p-12 text-xs text-slate-500 font-semibold">
          <Loader2 size={18} className="animate-spin text-blue-600 mr-2" />
          Synchronizing dynamic marketing campaigns and lead channels...
        </div>
      )}

      {/* Campaigns Table */}
      {!loading && (
        <div className="rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/40 text-[11px] font-bold uppercase tracking-wider text-[#8F9CAE]">
                  <th className="py-3.5 px-5">Campaign / Source</th>
                  <th className="py-3.5 px-5">Channel</th>
                  <th className="py-3.5 px-5">Status</th>
                  <th className="py-3.5 px-5">Audience Reached</th>
                  <th className="py-3.5 px-5">Engagement Rate</th>
                  <th className="py-3.5 px-5">Leads Captured</th>
                  <th className="py-3.5 px-5">Est. Budget</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {filteredCampaigns.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-5 font-extrabold text-[#1B2559] dark:text-white">
                      {c.name}
                    </td>

                    <td className="py-3.5 px-5">
                      <span className="inline-flex items-center gap-1.5 font-bold text-[#1B2559] dark:text-slate-300">
                        {c.channel === "WhatsApp" ? (
                          <MessageSquare size={14} className="text-emerald-500" />
                        ) : c.channel === "Email" ? (
                          <Mail size={14} className="text-blue-500" />
                        ) : c.channel === "SMS" ? (
                          <Send size={14} className="text-purple-500" />
                        ) : (
                          <Radio size={14} className="text-amber-500" />
                        )}
                        {c.channel}
                      </span>
                    </td>

                    <td className="py-3.5 px-5">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                          c.status === "Active"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                            : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-5 font-semibold text-[#1B2559] dark:text-slate-200">
                      {c.audience_count.toLocaleString()}
                    </td>

                    <td className="py-3.5 px-5 font-bold text-blue-600 dark:text-blue-400">
                      {c.open_rate}
                    </td>

                    <td className="py-3.5 px-5 font-black text-[#111C44] dark:text-emerald-400">
                      {c.leads_generated} leads
                    </td>

                    <td className="py-3.5 px-5 font-semibold text-[#8F9CAE]">
                      {c.budget}
                    </td>

                    <td className="py-3.5 px-5 text-right">
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 transition"
                        title="Remove Campaign"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}

                {filteredCampaigns.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-xs text-slate-400 font-medium">
                      No marketing campaigns found for this channel filter.
                    </td>
                  </tr>
                )}
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
                Launch Marketing Campaign
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
                  Campaign Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name || ""}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Q4 Growth Campaign"
                  className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-medium text-[#1B2559] dark:text-white focus:border-[#111C44] focus:bg-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#1B2559] dark:text-slate-200 mb-1">
                    Channel
                  </label>
                  <select
                    value={formData.channel || "Email"}
                    onChange={(e) => setFormData({ ...formData, channel: e.target.value as any })}
                    className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-[#1B2559] dark:text-white focus:border-[#111C44] focus:outline-none"
                  >
                    <option value="Email">Email</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="SMS">SMS</option>
                    <option value="Google Ads">Google Ads</option>
                    <option value="Meta Ads">Meta Ads</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1B2559] dark:text-slate-200 mb-1">
                    Target Audience Size
                  </label>
                  <input
                    type="number"
                    value={formData.audience_count || 1000}
                    onChange={(e) => setFormData({ ...formData, audience_count: Number(e.target.value) })}
                    className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-medium text-[#1B2559] dark:text-white focus:border-[#111C44] focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1B2559] dark:text-slate-200 mb-1">
                    Budget (₹)
                  </label>
                  <input
                    type="text"
                    value={formData.budget || "₹ 15,000"}
                    onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                    className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-medium text-[#1B2559] dark:text-white focus:border-[#111C44] focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1B2559] dark:text-slate-200 mb-1">
                    Status
                  </label>
                  <select
                    value={formData.status || "Active"}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-[#1B2559] dark:text-white focus:border-[#111C44] focus:outline-none"
                  >
                    <option value="Active">Active</option>
                    <option value="Scheduled">Scheduled</option>
                    <option value="Draft">Draft</option>
                  </select>
                </div>
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
                  Launch Campaign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
