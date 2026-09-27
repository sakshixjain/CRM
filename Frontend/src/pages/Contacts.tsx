/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  Search,
  Plus,
  Download,
  Mail,
  Phone,
  Building2,
  Trash2,
  Edit2,
  X,
  ChevronLeft,
  ChevronRight,
  RefreshCcw,
  Loader2,
  Users,
} from "lucide-react";
import toast from "react-hot-toast";
import { api } from "../lib/api";

export type Contact = {
  id: number | string;
  name: string;
  email: string;
  phone: string;
  company: string;
  designation?: string;
  address?: string;
  tag: "Customer" | "Lead" | "Partner";
  status: "Active" | "Inactive" | "Pending";
  assigned_to: string;
  created_at: string;
  agent_id?: number | string;
};

function unwrapList(res: any): any[] {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.data?.data)) return res.data.data;
  return [];
}

export default function Contacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [agentsList, setAgentsList] = useState<any[]>([]);

  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedIds, setSelectedIds] = useState<(number | string)[]>([]);
  const [page, setPage] = useState(1);
  const [perPage] = useState(10);

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState<Partial<Contact>>({
    tag: "Lead",
    status: "Active",
  });

  const loadDynamicContacts = useCallback(async () => {
    setLoading(true);
    try {
      const [leadsRes, paymentsRes, agentsRes] = await Promise.allSettled([
        api.leads.list({ page: 1, limit: 50000 }),
        api.leadPayment.list({ page: 1, limit: 50000 }),
        api.listAgents(),
      ]);

      const leads = leadsRes.status === "fulfilled" ? unwrapList(leadsRes.value) : [];
      const payments = paymentsRes.status === "fulfilled" ? unwrapList(paymentsRes.value) : [];
      const agents = agentsRes.status === "fulfilled" ? unwrapList(agentsRes.value) : [];
      setAgentsList(agents);

      // Identify customer phone numbers from payments
      const customerContacts = new Set<string>();
      payments.forEach((p: any) => {
        if (p.contact_no) customerContacts.add(String(p.contact_no).trim());
      });

      const dynamicContacts: Contact[] = leads.map((l: any) => {
        const phone = l.contact_no || l.phone || "";
        const isCustomer = customerContacts.has(String(phone).trim()) || String(l.status?.name || "").toLowerCase().includes("won");

        let tag: Contact["tag"] = "Lead";
        if (isCustomer) tag = "Customer";
        else if (String(l.source?.name || "").toLowerCase().includes("partner")) tag = "Partner";

        const createdAt = l.created_at || l.createdAt ? new Date(l.created_at || l.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "Recent";

        return {
          id: l.id,
          name: l.name || l.lead_name || `Contact #${l.id}`,
          email: l.email || "—",
          phone: phone || "—",
          company: l.company_name || "Independent",
          designation: l.designation || l.requirement || "Decision Maker",
          address: l.city ? `${l.city}, ${l.state || "India"}` : (l.address || "India"),
          tag,
          status: l.is_active !== false ? "Active" : "Inactive",
          assigned_to: l.agent?.name || l.changedByAdmin?.name || "Sales Team",
          created_at: createdAt,
          agent_id: l.agent_id || l.assign_to,
        };
      });

      setContacts(dynamicContacts);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load contacts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDynamicContacts();
  }, [loadDynamicContacts]);

  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      const q = search.toLowerCase();
      const matchesSearch =
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.includes(search) ||
        c.company.toLowerCase().includes(q) ||
        c.assigned_to.toLowerCase().includes(q);

      const matchesTag = selectedTag === "all" || c.tag === selectedTag;
      const matchesStatus = selectedStatus === "all" || c.status === selectedStatus;

      return matchesSearch && matchesTag && matchesStatus;
    });
  }, [contacts, search, selectedTag, selectedStatus]);

  const totalPages = Math.ceil(filteredContacts.length / perPage) || 1;
  const paginatedContacts = useMemo(() => {
    const start = (page - 1) * perPage;
    return filteredContacts.slice(start, start + perPage);
  }, [filteredContacts, page, perPage]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(paginatedContacts.map((c) => c.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: number | string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleOpenAdd = () => {
    setEditingContact(null);
    setFormData({
      name: "",
      email: "",
      phone: "",
      company: "",
      designation: "",
      address: "",
      tag: "Customer",
      status: "Active",
      assigned_to: agentsList[0]?.name || "Sales Team",
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (contact: Contact) => {
    setEditingContact(contact);
    setFormData(contact);
    setModalOpen(true);
  };

  const handleDelete = async (id: number | string) => {
    if (window.confirm("Are you sure you want to delete this contact / lead?")) {
      try {
        await api.leads.remove(id);
        setContacts((prev) => prev.filter((c) => c.id !== id));
        setSelectedIds((prev) => prev.filter((i) => i !== id));
        toast.success("Contact deleted successfully");
      } catch (err: any) {
        toast.error(err?.message || "Failed to delete contact");
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) {
      toast.error("Please fill Name and Phone number");
      return;
    }

    setSaving(true);
    try {
      if (editingContact) {
        await api.leads.update(editingContact.id, {
          name: formData.name,
          email: formData.email,
          contact_no: formData.phone,
          company_name: formData.company,
          city: formData.address,
        });

        setContacts((prev) =>
          prev.map((c) => (c.id === editingContact.id ? ({ ...c, ...formData } as Contact) : c))
        );
        toast.success("Contact updated successfully");
      } else {
        const res = await api.leads.create({
          name: formData.name,
          email: formData.email,
          contact_no: formData.phone,
          company_name: formData.company || "Independent",
          city: formData.address || "",
        });

        const newId = res?.data?.id || `lead-${Date.now()}`;
        const newContact: Contact = {
          id: newId,
          name: formData.name || "",
          email: formData.email || "—",
          phone: formData.phone || "—",
          company: formData.company || "Independent",
          designation: formData.designation || "Contact",
          address: formData.address || "India",
          tag: (formData.tag as any) || "Lead",
          status: (formData.status as any) || "Active",
          assigned_to: formData.assigned_to || "Admin",
          created_at: new Date().toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          }),
        };

        setContacts([newContact, ...contacts]);
        toast.success("Contact created in CRM successfully");
      }
      setModalOpen(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to save contact");
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    const headers = "ID,Name,Email,Phone,Company,Designation,Tag,Status,Assigned To,Created At\n";
    const rows = filteredContacts
      .map(
        (c) =>
          `"${c.id}","${c.name}","${c.email}","${c.phone}","${c.company}","${c.designation || ""}","${c.tag}","${c.status}","${c.assigned_to}","${c.created_at}"`
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contacts_export_${Date.now()}.csv`;
    a.click();
    toast.success("Exported contacts to CSV");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1B2559] dark:text-white tracking-tight flex items-center gap-2.5">
            <Users className="text-blue-600" size={24} />
            Customer & Lead Contacts
          </h1>
          <p className="text-xs font-medium text-[#8F9CAE] mt-0.5">
            Dynamic live address book and contact profiles synced directly from CRM leads.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => loadDynamicContacts()}
            disabled={loading}
            className="p-2 rounded-md border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 text-[#1B2559] dark:text-white hover:bg-slate-50 transition"
            title="Refresh Contacts"
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
            Add Contact
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <div className="text-xs font-bold text-[#8F9CAE]">Total Contacts</div>
          <div className="text-2xl font-black text-[#1B2559] dark:text-white mt-1">
            {contacts.length}
          </div>
          <div className="text-[11px] font-semibold text-blue-600 mt-1">
            Synced from CRM
          </div>
        </div>

        <div className="rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <div className="text-xs font-bold text-[#8F9CAE]">Paying Customers</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">
            {contacts.filter((c) => c.tag === "Customer").length}
          </div>
          <div className="text-[11px] font-semibold text-emerald-600 mt-1">
            Active converted accounts
          </div>
        </div>

        <div className="rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <div className="text-xs font-bold text-[#8F9CAE]">Prospect Leads</div>
          <div className="text-2xl font-black text-amber-600 mt-1">
            {contacts.filter((c) => c.tag === "Lead").length}
          </div>
          <div className="text-[11px] font-semibold text-amber-600 mt-1">
            In pipeline discovery
          </div>
        </div>

        <div className="rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <div className="text-xs font-bold text-[#8F9CAE]">Channel Partners</div>
          <div className="text-2xl font-black text-purple-600 mt-1">
            {contacts.filter((c) => c.tag === "Partner").length}
          </div>
          <div className="text-[11px] font-semibold text-purple-600 mt-1">
            Affiliate & Vendors
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
              placeholder="Search dynamic contacts by name, email, phone, company..."
              className="w-full pl-9 pr-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-[#1B2559] dark:text-white focus:outline-none"
            />
          </div>

          <select
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
            className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-[#1B2559] dark:text-white focus:outline-none"
          >
            <option value="all">All Tags</option>
            <option value="Customer">Customer</option>
            <option value="Lead">Lead</option>
            <option value="Partner">Partner</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-[#1B2559] dark:text-white focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>

        <div className="text-xs text-[#8F9CAE] font-medium">
          Showing {paginatedContacts.length} of {filteredContacts.length} contacts
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center p-12 text-xs text-slate-500 font-semibold">
          <Loader2 size={18} className="animate-spin text-blue-600 mr-2" />
          Synchronizing dynamic contacts from CRM leads database...
        </div>
      )}

      {/* Table */}
      {!loading && (
        <div className="rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/40 text-[11px] font-bold uppercase tracking-wider text-[#8F9CAE]">
                  <th className="py-3.5 px-4 w-10 text-center">
                    <input
                      type="checkbox"
                      onChange={handleSelectAll}
                      checked={
                        paginatedContacts.length > 0 &&
                        selectedIds.length === paginatedContacts.length
                      }
                      className="rounded border-slate-300"
                    />
                  </th>
                  <th className="py-3.5 px-5">Contact Name</th>
                  <th className="py-3.5 px-5">Contact Info</th>
                  <th className="py-3.5 px-5">Company / Account</th>
                  <th className="py-3.5 px-5">Tag</th>
                  <th className="py-3.5 px-5">Owner</th>
                  <th className="py-3.5 px-5">Created</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {paginatedContacts.map((contact) => (
                  <tr key={contact.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(contact.id)}
                        onChange={() => handleSelectOne(contact.id)}
                        className="rounded border-slate-300"
                      />
                    </td>

                    <td className="py-3.5 px-5">
                      <div className="font-bold text-[#1B2559] dark:text-white">
                        {contact.name}
                      </div>
                      <div className="text-[11px] text-[#8F9CAE]">{contact.designation}</div>
                    </td>

                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-1.5 font-medium text-[#1B2559] dark:text-slate-200">
                        <Mail size={12} className="text-slate-400" /> {contact.email}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-[#8F9CAE] mt-0.5">
                        <Phone size={12} className="text-slate-400" /> {contact.phone}
                      </div>
                    </td>

                    <td className="py-3.5 px-5">
                      <div className="font-semibold text-[#1B2559] dark:text-slate-200 flex items-center gap-1.5">
                        <Building2 size={13} className="text-slate-400" />
                        {contact.company}
                      </div>
                      <div className="text-[11px] text-[#8F9CAE]">{contact.address}</div>
                    </td>

                    <td className="py-3.5 px-5">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                          contact.tag === "Customer"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                            : contact.tag === "Partner"
                            ? "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400"
                            : "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
                        }`}
                      >
                        {contact.tag}
                      </span>
                    </td>

                    <td className="py-3.5 px-5 font-medium text-[#1B2559] dark:text-slate-200">
                      {contact.assigned_to}
                    </td>

                    <td className="py-3.5 px-5 text-[#8F9CAE]">
                      {contact.created_at}
                    </td>

                    <td className="py-3.5 px-5 text-right space-x-1.5">
                      <button
                        onClick={() => handleOpenEdit(contact)}
                        className="p-1.5 text-slate-400 hover:text-[#111C44] dark:hover:text-white transition"
                        title="Edit Contact"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(contact.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 transition"
                        title="Delete Contact"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}

                {paginatedContacts.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-xs text-slate-400 font-medium">
                      No matching contacts found in CRM.
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
                {editingContact ? "Edit Contact" : "Add New Contact"}
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
                    Contact Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name || ""}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Priya Sharma"
                    className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-medium text-[#1B2559] dark:text-white focus:border-[#111C44] focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1B2559] dark:text-slate-200 mb-1">
                    Phone / Contact No *
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.phone || ""}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="e.g. 9876543210"
                    className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-medium text-[#1B2559] dark:text-white focus:border-[#111C44] focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1B2559] dark:text-slate-200 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={formData.email || ""}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="e.g. priya@abctech.com"
                    className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-medium text-[#1B2559] dark:text-white focus:border-[#111C44] focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1B2559] dark:text-slate-200 mb-1">
                    Company / Organization
                  </label>
                  <input
                    type="text"
                    value={formData.company || ""}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    placeholder="e.g. ABC Tech"
                    className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-medium text-[#1B2559] dark:text-white focus:border-[#111C44] focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1B2559] dark:text-slate-200 mb-1">
                    Designation / Title
                  </label>
                  <input
                    type="text"
                    value={formData.designation || ""}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    placeholder="e.g. Vice President"
                    className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-medium text-[#1B2559] dark:text-white focus:border-[#111C44] focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1B2559] dark:text-slate-200 mb-1">
                    Tag Category
                  </label>
                  <select
                    value={formData.tag || "Customer"}
                    onChange={(e) => setFormData({ ...formData, tag: e.target.value as any })}
                    className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-[#1B2559] dark:text-white focus:border-[#111C44] focus:outline-none"
                  >
                    <option value="Customer">Customer</option>
                    <option value="Lead">Lead</option>
                    <option value="Partner">Partner</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1B2559] dark:text-slate-200 mb-1">
                  Location / City / Address
                </label>
                <input
                  type="text"
                  value={formData.address || ""}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="e.g. Mumbai, Maharashtra"
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
                  {editingContact ? "Save Changes" : "Create Contact"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
