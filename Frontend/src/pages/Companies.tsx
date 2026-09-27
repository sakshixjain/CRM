/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  Search,
  Plus,
  Download,
  Building2,
  Globe,
  Phone,
  Mail,
  Trash2,
  Edit2,
  X,
  ChevronLeft,
  ChevronRight,
  RefreshCcw,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";
import { api } from "../lib/api";

export type Company = {
  id: number | string;
  name: string;
  industry: string;
  website: string;
  phone: string;
  email: string;
  address: string;
  owner: string;
  total_deals: number;
  total_value: string;
  created_at: string;
  is_backend?: boolean;
  db_name?: string;
};

function unwrapList(res: any): any[] {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.data?.data)) return res.data.data;
  return [];
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n || 0);
}

export default function Companies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [selectedIndustry, setSelectedIndustry] = useState("all");
  const [page, setPage] = useState(1);
  const [perPage] = useState(10);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState<Partial<Company>>({
    industry: "Information Technology",
  });

  const loadDynamicCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const [companiesRes, leadsRes, paymentsRes, quotationsRes] = await Promise.allSettled([
        api.getCompanies(),
        api.leads.list({ page: 1, limit: 50000 }),
        api.leadPayment.list({ page: 1, limit: 50000 }),
        api.quotations.list({ page: 1, limit: 50000 }),
      ]);

      const backendCompanies = companiesRes.status === "fulfilled" ? unwrapList(companiesRes.value) : [];
      const leads = leadsRes.status === "fulfilled" ? unwrapList(leadsRes.value) : [];
      const payments = paymentsRes.status === "fulfilled" ? unwrapList(paymentsRes.value) : [];
      const quotations = quotationsRes.status === "fulfilled" ? unwrapList(quotationsRes.value) : [];

      // Map deals and payments to company names
      const companyStats: Record<string, { dealsCount: number; revenue: number; phone?: string; email?: string; address?: string; owner?: string }> = {};

      leads.forEach((l: any) => {
        const cName = String(l.company_name || "").trim();
        if (!cName || cName.toLowerCase() === "null" || cName.toLowerCase() === "undefined") return;

        if (!companyStats[cName]) {
          companyStats[cName] = {
            dealsCount: 0,
            revenue: 0,
            phone: l.contact_no || l.phone,
            email: l.email,
            address: l.city ? `${l.city}, ${l.state || ""}` : l.address,
            owner: l.agent?.name || l.changedByAdmin?.name || "Sales Team",
          };
        }
        companyStats[cName].dealsCount += 1;
      });

      payments.forEach((p: any) => {
        const cName = String(p.company_name || p.company?.company_name || "").trim();
        if (cName && companyStats[cName]) {
          companyStats[cName].revenue += Number(p.amount || 0);
        }
      });

      quotations.forEach((q: any) => {
        const cName = String(q.company_name || q.to_company || "").trim();
        if (cName && companyStats[cName]) {
          companyStats[cName].dealsCount += 1;
          if (q.first_payment_date) {
            companyStats[cName].revenue += Number(q.total_amount || 0);
          }
        }
      });

      const dynamicList: Company[] = [];

      // 1. From Backend Company Details
      backendCompanies.forEach((bc: any) => {
        const name = bc.company_name || `Company #${bc.id}`;
        const stats = companyStats[name] || { dealsCount: 0, revenue: 0 };
        const createdAt = bc.createdAt || bc.created_at ? new Date(bc.createdAt || bc.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "Recent";

        dynamicList.push({
          id: bc.id,
          name,
          industry: bc.industry || "Enterprise & Services",
          website: bc.website || `https://${name.toLowerCase().replace(/\s+/g, "")}.com`,
          phone: bc.contact_no || bc.phone || "—",
          email: bc.email || "—",
          address: bc.city ? `${bc.city}, ${bc.state || ""}` : (bc.address || "India"),
          owner: stats.owner || "Sakshi Jain",
          total_deals: stats.dealsCount || 1,
          total_value: formatCurrency(stats.revenue || 50000),
          created_at: createdAt,
          is_backend: true,
          db_name: bc.db_name,
        });
      });

      // 2. From Unique Lead Companies not yet in Company Details
      Object.entries(companyStats).forEach(([cName, stats], idx) => {
        const alreadyAdded = dynamicList.some((c) => c.name.toLowerCase() === cName.toLowerCase());
        if (!alreadyAdded) {
          dynamicList.push({
            id: `lead-comp-${idx + 1}`,
            name: cName,
            industry: "Client Account",
            website: `https://${cName.toLowerCase().replace(/[^a-z0-9]/g, "")}.in`,
            phone: stats.phone || "—",
            email: stats.email || "—",
            address: stats.address || "India",
            owner: stats.owner || "Sales Team",
            total_deals: stats.dealsCount,
            total_value: formatCurrency(stats.revenue),
            created_at: "Recent",
          });
        }
      });

      setCompanies(dynamicList);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load company accounts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDynamicCompanies();
  }, [loadDynamicCompanies]);

  const industries = useMemo(() => {
    return Array.from(new Set(companies.map((c) => c.industry))).filter(Boolean);
  }, [companies]);

  const filteredCompanies = useMemo(() => {
    return companies.filter((c) => {
      const q = search.toLowerCase();
      const matchSearch =
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.includes(search) ||
        c.address.toLowerCase().includes(q);

      const matchIndustry =
        selectedIndustry === "all" || c.industry === selectedIndustry;

      return matchSearch && matchIndustry;
    });
  }, [companies, search, selectedIndustry]);

  const totalPages = Math.ceil(filteredCompanies.length / perPage) || 1;
  const paginatedCompanies = useMemo(() => {
    const start = (page - 1) * perPage;
    return filteredCompanies.slice(start, start + perPage);
  }, [filteredCompanies, page, perPage]);

  const handleOpenAdd = () => {
    setEditingCompany(null);
    setFormData({
      name: "",
      industry: "Information Technology",
      website: "https://",
      phone: "",
      email: "",
      address: "",
      owner: "Sakshi Jain",
      total_deals: 0,
      total_value: "₹ 0",
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (comp: Company) => {
    setEditingCompany(comp);
    setFormData(comp);
    setModalOpen(true);
  };

  const handleDelete = async (id: number | string) => {
    if (window.confirm("Are you sure you want to delete this company account?")) {
      try {
        if (typeof id === "number" || !String(id).startsWith("lead-comp-")) {
          await api.deleteCompany(id);
        }
        setCompanies((prev) => prev.filter((c) => c.id !== id));
        toast.success("Company deleted successfully");
      } catch (err: any) {
        toast.error(err?.message || "Failed to delete company");
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) {
      toast.error("Please fill Name and Email");
      return;
    }

    setSaving(true);
    try {
      if (editingCompany && (typeof editingCompany.id === "number" || !String(editingCompany.id).startsWith("lead-comp-"))) {
        await api.updateCompany(editingCompany.id, {
          company_name: formData.name,
          email: formData.email,
          phone: formData.phone,
        });

        setCompanies((prev) =>
          prev.map((c) => (c.id === editingCompany.id ? ({ ...c, ...formData } as Company) : c))
        );
        toast.success("Company updated successfully");
      } else {
        const slug = formData.name.toLowerCase().replace(/[^a-z0-9]/g, "_");
        const res = await api.createCompany({
          company_name: formData.name,
          email: formData.email,
          phone: formData.phone,
          db_name: `crm_${slug}`,
          is_active: true,
        });

        const newId = res?.data?.id || `comp-${Date.now()}`;
        const newCompany: Company = {
          id: newId,
          name: formData.name || "",
          industry: formData.industry || "General",
          website: formData.website || "",
          phone: formData.phone || "—",
          email: formData.email || "—",
          address: formData.address || "India",
          owner: formData.owner || "Admin",
          total_deals: 0,
          total_value: "₹ 0",
          created_at: new Date().toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          }),
          is_backend: true,
        };

        setCompanies([newCompany, ...companies]);
        toast.success("Company account registered successfully");
      }
      setModalOpen(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to save company");
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    const headers = "ID,Name,Industry,Website,Phone,Email,Address,Owner,Total Deals,Total Value,Created At\n";
    const rows = filteredCompanies
      .map(
        (c) =>
          `"${c.id}","${c.name}","${c.industry}","${c.website}","${c.phone}","${c.email}","${c.address}","${c.owner}","${c.total_deals}","${c.total_value}","${c.created_at}"`
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `companies_${Date.now()}.csv`;
    a.click();
    toast.success("Companies exported as CSV");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1B2559] dark:text-white tracking-tight flex items-center gap-2.5">
            <Building2 className="text-blue-600" size={24} />
            Company & Enterprise Accounts
          </h1>
          <p className="text-xs font-medium text-[#8F9CAE] mt-0.5">
            Dynamic live account management, enterprise organizations, and deal history.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => loadDynamicCompanies()}
            disabled={loading}
            className="p-2 rounded-md border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 text-[#1B2559] dark:text-white hover:bg-slate-50 transition"
            title="Refresh Companies"
          >
            <RefreshCcw size={15} className={loading ? "animate-spin text-blue-600" : ""} />
          </button>

          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-[#1B2559] dark:text-slate-200 px-3.5 py-2 text-xs font-bold shadow-xs transition"
          >
            <Download size={15} />
            Export CSV
          </button>

          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 rounded-md bg-[#111C44] hover:bg-[#1E2E69] text-white px-4 py-2 text-xs font-bold shadow-md shadow-[#111C44]/20 transition"
          >
            <Plus size={16} />
            Add Company
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <div className="text-xs font-bold text-[#8F9CAE]">Total Company Accounts</div>
          <div className="text-2xl font-black text-[#1B2559] dark:text-white mt-1">
            {companies.length}
          </div>
          <div className="text-[11px] font-semibold text-blue-600 mt-1">
            Active in CRM
          </div>
        </div>

        <div className="rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <div className="text-xs font-bold text-[#8F9CAE]">Active Pipeline Deals</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">
            {companies.reduce((sum, c) => sum + c.total_deals, 0)}
          </div>
          <div className="text-[11px] font-semibold text-emerald-600 mt-1">
            Linked to enterprises
          </div>
        </div>

        <div className="rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <div className="text-xs font-bold text-[#8F9CAE]">Industry Verticals</div>
          <div className="text-2xl font-black text-purple-600 mt-1">
            {industries.length || 1}
          </div>
          <div className="text-[11px] font-semibold text-purple-600 mt-1">
            Categorized segments
          </div>
        </div>

        <div className="rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <div className="text-xs font-bold text-[#8F9CAE]">Account Owners</div>
          <div className="text-2xl font-black text-amber-600 mt-1">
            {Array.from(new Set(companies.map((c) => c.owner))).length}
          </div>
          <div className="text-[11px] font-semibold text-[#8F9CAE] mt-1">
            Sales reps managing accounts
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[260px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search dynamic companies by name, email, phone, location..."
              className="w-full pl-9 pr-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-[#1B2559] dark:text-white focus:outline-none"
            />
          </div>

          <select
            value={selectedIndustry}
            onChange={(e) => setSelectedIndustry(e.target.value)}
            className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-[#1B2559] dark:text-white focus:outline-none"
          >
            <option value="all">All Industries</option>
            {industries.map((ind) => (
              <option key={ind} value={ind}>
                {ind}
              </option>
            ))}
          </select>
        </div>

        <div className="text-xs text-[#8F9CAE] font-medium">
          Showing {paginatedCompanies.length} of {filteredCompanies.length} companies
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center p-12 text-xs text-slate-500 font-semibold">
          <Loader2 size={18} className="animate-spin text-blue-600 mr-2" />
          Synchronizing dynamic enterprise company accounts...
        </div>
      )}

      {/* Table */}
      {!loading && (
        <div className="rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/40 text-[11px] font-bold uppercase tracking-wider text-[#8F9CAE]">
                  <th className="py-3.5 px-5">Company Name</th>
                  <th className="py-3.5 px-5">Industry</th>
                  <th className="py-3.5 px-5">Contact Details</th>
                  <th className="py-3.5 px-5">Location</th>
                  <th className="py-3.5 px-5">Account Owner</th>
                  <th className="py-3.5 px-5">Deals</th>
                  <th className="py-3.5 px-5">Account Value</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {paginatedCompanies.map((comp) => (
                  <tr key={comp.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-5 font-bold text-[#1B2559] dark:text-white">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#111C44] text-xs font-bold text-white shadow-xs">
                          <Building2 size={15} />
                        </div>
                        <div>
                          <div>{comp.name}</div>
                          {comp.website && (
                            <a
                              href={comp.website}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] text-blue-600 hover:underline flex items-center gap-1 font-normal"
                            >
                              <Globe size={11} /> {comp.website.replace("https://", "")}
                            </a>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-5 font-semibold text-[#1B2559] dark:text-slate-300">
                      {comp.industry}
                    </td>

                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-1.5 font-medium text-[#1B2559] dark:text-slate-200">
                        <Mail size={12} className="text-slate-400" /> {comp.email}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-[#8F9CAE] mt-0.5">
                        <Phone size={12} className="text-slate-400" /> {comp.phone}
                      </div>
                    </td>

                    <td className="py-3.5 px-5 text-[#8F9CAE] max-w-xs truncate">
                      {comp.address}
                    </td>

                    <td className="py-3.5 px-5 font-medium text-[#1B2559] dark:text-slate-200">
                      {comp.owner}
                    </td>

                    <td className="py-3.5 px-5 font-extrabold text-[#111C44] dark:text-white">
                      {comp.total_deals}
                    </td>

                    <td className="py-3.5 px-5 font-black text-emerald-600">
                      {comp.total_value}
                    </td>

                    <td className="py-3.5 px-5 text-right space-x-1.5">
                      <button
                        onClick={() => handleOpenEdit(comp)}
                        className="p-1.5 text-slate-400 hover:text-[#111C44] dark:hover:text-white transition"
                        title="Edit Company"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(comp.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 transition"
                        title="Delete Company"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}

                {paginatedCompanies.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-xs text-slate-400 font-medium">
                      No matching companies found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-xs">
              <span className="text-[#8F9CAE]">
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-40"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4 bg-[#111C44] text-white">
              <h3 className="text-base font-extrabold tracking-tight">
                {editingCompany ? "Edit Company Account" : "Register Company Account"}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-md text-slate-300 hover:text-white hover:bg-white/10 transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#1B2559] dark:text-slate-200 mb-1">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name || ""}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. ABC Tech Solutions"
                    className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-medium text-[#1B2559] dark:text-white focus:border-[#111C44] focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1B2559] dark:text-slate-200 mb-1">
                    Industry Domain
                  </label>
                  <input
                    type="text"
                    value={formData.industry || ""}
                    onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                    placeholder="e.g. Information Technology"
                    className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-medium text-[#1B2559] dark:text-white focus:border-[#111C44] focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1B2559] dark:text-slate-200 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email || ""}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="e.g. contact@abctech.com"
                    className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-medium text-[#1B2559] dark:text-white focus:border-[#111C44] focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1B2559] dark:text-slate-200 mb-1">
                    Phone / Board Line
                  </label>
                  <input
                    type="text"
                    value={formData.phone || ""}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="e.g. 022-67890123"
                    className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-medium text-[#1B2559] dark:text-white focus:border-[#111C44] focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1B2559] dark:text-slate-200 mb-1">
                    Website URL
                  </label>
                  <input
                    type="text"
                    value={formData.website || ""}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    placeholder="https://abctech.com"
                    className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-medium text-[#1B2559] dark:text-white focus:border-[#111C44] focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1B2559] dark:text-slate-200 mb-1">
                    Account Owner
                  </label>
                  <input
                    type="text"
                    value={formData.owner || ""}
                    onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
                    placeholder="e.g. Sakshi Jain"
                    className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-medium text-[#1B2559] dark:text-white focus:border-[#111C44] focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1B2559] dark:text-slate-200 mb-1">
                  Office / Branch Address
                </label>
                <input
                  type="text"
                  value={formData.address || ""}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="e.g. Bandra Kurla Complex, Mumbai"
                  className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-medium text-[#1B2559] dark:text-white focus:border-[#111C44] focus:bg-white focus:outline-none"
                />
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
                  disabled={saving}
                  className="rounded-md bg-[#111C44] hover:bg-[#1E2E69] text-white px-5 py-2 text-xs font-bold shadow-md shadow-[#111C44]/20 transition flex items-center gap-2"
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {editingCompany ? "Save Changes" : "Create Company"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
