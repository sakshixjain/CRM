import React, { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { storage } from "../lib/storage";
import PageHeader from "../pages/Header";
import toast from "react-hot-toast";

import {
  Plus,
  X,
  Loader2,
  RefreshCcw,
  Trash2,
  Users,
  Mail,
  Phone,
  Shield,
  Pencil,
  ArrowRightLeft,
  AlertTriangle,
} from "lucide-react";

type Agent = {
  id: number;
  name: string;
  contact_no: string;
  email: string;
  city?: string;
  role_id: number;
  is_active?: boolean;
  created_at?: string;
};

const emptyForm = {
  name: "",
  contact_no: "",
  email: "",
  city: "",

  is_active: true,
  role_id: 2,
};

function cn(...cls: Array<string | boolean | undefined | null>) {
  return cls.filter(Boolean).join(" ");
}

/** ✅ Reusable toggle */
function ToggleSwitch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200",
        checked ? "bg-green-600" : "bg-slate-300",
        disabled && "opacity-60 cursor-not-allowed"
      )}
      aria-pressed={checked}
      aria-label="Toggle Active"
    >
      <span
        className={cn(
          "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200",
          checked ? "translate-x-5" : "translate-x-1"
        )}
      />
    </button>
  );
}

function Modal({
  open,
  title,
  subtitle,
  children,
  onClose,
  onSubmit,
  submitText,
  busy,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
  onSubmit: () => void;
  submitText: string;
  busy?: boolean;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]" onClick={onClose} />

      <div className="relative flex max-h-[calc(100vh-32px)] w-full max-w-xl flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-xl">
        <div className="shrink-0 px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-start justify-between gap-4">
          <div>
            <div className="text-lg font-bold text-slate-900">{title}</div>
            {subtitle && (
              <div className="text-sm text-slate-600">{subtitle}</div>
            )}
          </div>

          <button
            onClick={onClose}
            className="w-10 h-10 rounded-md border border-slate-200 bg-white hover:bg-slate-50 transition flex items-center justify-center"
            title="Close"
            type="button"
          >
            <X size={18} className="text-slate-700" />
          </button>
        </div>

        <div className="sidebar-scroll min-h-0 flex-1 overflow-y-auto p-5">{children}</div>

        <div className="shrink-0 px-5 py-4 bg-white border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 transition text-slate-800 font-medium shadow-sm"
            type="button"
          >
            Cancel
          </button>

          <button
            disabled={busy}
            onClick={onSubmit}
            className="px-5 py-2.5 rounded-md bg-slate-900 text-white font-semibold hover:bg-slate-800 transition shadow-sm disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
            type="button"
          >
            {busy && <Loader2 size={16} className="animate-spin" />}
            {submitText}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * ✅ DELETE helper:
 * tries:
 * 1) api.removeAgent(id, body) if your api supports
 * 2) fetch DELETE with JSON body
 * 3) fallback: query ?reassign_to=
 *
 * Endpoint: DELETE /api/user-agent/:id
 */
async function deleteAgentApi(agentId: number, reassignTo?: number) {
  const token = storage.getToken();
  const authHeaders: Record<string, string> = {};
  if (token) authHeaders.Authorization = `Bearer ${token}`;

  // 1) try your api wrapper first (if it supports body on DELETE)
  try {
    if (api?.removeAgent) {
      // @ts-ignore - if your api supports second param as body
      return await api.removeAgent(
        agentId,
        reassignTo ? { reassign_to: reassignTo } : undefined
      );
    }
  } catch (e: any) {
    // fallthrough
  }

  // 2) fetch with body
  const base =
    (import.meta as any).env?.VITE_API_BASE_URL || "http://localhost:3000";
  const url = `${base}/api/user-agent/${agentId}`;

  try {
    const res = await fetch(url, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: reassignTo ? JSON.stringify({ reassign_to: reassignTo }) : undefined,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err: any = new Error(data?.message || "Delete failed");
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  } catch (err: any) {
    // 3) fallback: query param (useful when server ignores DELETE body)
    const url2 = reassignTo ? `${url}?reassign_to=${reassignTo}` : url;
    const res2 = await fetch(url2, {
      method: "DELETE",
      headers: authHeaders,
    });
    const data2 = await res2.json().catch(() => ({}));
    if (!res2.ok) {
      const e2: any = new Error(data2?.message || "Delete failed");
      e2.status = res2.status;
      e2.data = data2;
      throw e2;
    }
    return data2;
  }
}

export default function AgentPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // ✅ modal toggle state
  const [isActive, setIsActive] = useState(true);

  // ✅ Add Modal
  const [openAdd, setOpenAdd] = useState(false);

  // ✅ Edit Modal
  const [openEdit, setOpenEdit] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  const [form, setForm] = useState(emptyForm);

  // ✅ Reassign modal (count comes from delete API response)
  const [openReassign, setOpenReassign] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [leadCount, setLeadCount] = useState<number>(0);
  const [reassignTo, setReassignTo] = useState<number | "">("");
  const [reassignBusy, _setReassignBusy] = useState(false);

  async function loadAgents() {
    try {
      setLoading(true);
      setError(null);
      const res = await api.listAgents();
      setAgents(Array.isArray(res) ? res : []);
    } catch (e: any) {
      setAgents([]);
      const msg = e?.message || "Failed to load agents";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAgents();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return agents;
    return agents.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        a.contact_no.includes(q)
    );
  }, [agents, search]);

  function openAddModal() {
    setError(null);
    setForm(emptyForm);
    setIsActive(true);
    setOpenAdd(true);
  }

  function closeAddModal() {
    if (busy) return;
    setOpenAdd(false);
    setForm(emptyForm);
    setIsActive(true);
  }

  function openEditModal(agent: Agent) {
    setError(null);
    setEditId(agent.id);

    const active = Boolean(agent.is_active);

    setForm({
      name: agent.name || "",
      contact_no: agent.contact_no || "",
      email: agent.email || "",
      city: agent.city || "",
      is_active: active,
      role_id: agent.role_id ?? 2,
    });

    setIsActive(active);
    setOpenEdit(true);
  }

  function closeEditModal() {
    if (busy) return;
    setOpenEdit(false);
    setEditId(null);
    setForm(emptyForm);
    setIsActive(true);
  }

  function closeReassignModal() {
    if (reassignBusy) return;
    setOpenReassign(false);
    setDeleteId(null);
    setLeadCount(0);
    setReassignTo("");
  }

  async function toggleActive(agent: Agent) {
    if (!agent.id) return;

    const next = !Boolean(agent.is_active);

    // optimistic UI
    setAgents((prev) =>
      prev.map((x) => (x.id === agent.id ? { ...x, is_active: next } : x))
    );

    const toastId = toast.loading(
      next ? "Enabling agent..." : "Disabling agent..."
    );

    try {
      await api.updateAgent(agent.id, { is_active: next });
      toast.success(next ? "Agent enabled ✅" : "Agent disabled ✅", {
        id: toastId,
      });
    } catch (e: any) {
      // rollback
      setAgents((prev) =>
        prev.map((x) => (x.id === agent.id ? { ...x, is_active: !next } : x))
      );
      toast.error(e?.message || "Failed to update agent", { id: toastId });
    }
  }

  async function submitCreate() {
    setError(null);

    if (!form.name || !form.contact_no || !form.email ) {
      toast.error("All fields are required");
      return;
    }

    try {
      setBusy(true);

      await api.createAgent({
        name: form.name,
        contact_no: form.contact_no,
        email: form.email,
        city: form.city || undefined,
        role_id: Number(form.role_id),
        is_active: isActive,
      });

      toast.success("Agent created successfully ✅");
      setOpenAdd(false);
      setForm(emptyForm);
      setIsActive(true);
      await loadAgents();
    } catch (e: any) {
      const msg = e?.message || "Failed to create agent";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function submitEdit() {
    setError(null);

    if (!editId) {
      toast.error("Missing agent id");
      return;
    }

    if (!form.name || !form.contact_no || !form.email) {
      toast.error("Name, Contact, Email are required");
      return;
    }

    try {
      setBusy(true);

      const payload: any = {
        name: form.name,
        contact_no: form.contact_no,
        email: form.email,
        city: form.city || null,
        role_id: Number(form.role_id),
        is_active: isActive,
      };

 

      await api.updateAgent(editId, payload);

      toast.success("Agent updated ✅");
      setOpenEdit(false);
      setEditId(null);
      setForm(emptyForm);
      setIsActive(true);
      await loadAgents();
    } catch (e: any) {
      const msg = e?.message || "Failed to update agent";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  /**
   * ✅ Delete:
   * - call delete API WITHOUT reassign_to
   * - if success -> deleted
   * - if 409 -> open reassign modal using leadsCount from response
   */
  async function remove(id: number) {
    if (busy || reassignBusy) return;

    if (!confirm("Delete this agent?")) return;

    const t = toast.loading("Deleting agent...");
    try {
      await deleteAgentApi(id); // no reassign_to
      toast.success("Agent deleted ✅", { id: t });
      await loadAgents();
    } catch (e: any) {
      // if backend says reassignment required
      const status = e?.status;
      const data = e?.data;

      // typical backend response you had: 409 + { leadsCount, required: ["reassign_to"] }
      const count = Number(data?.leadsCount ?? data?.leads_count ?? 0);

      if (status === 409 && count > 0) {
        toast.dismiss(t);
        setDeleteId(id);
        setLeadCount(count);
        setReassignTo("");
        setOpenReassign(true);
        toast("This agent has assigned leads. Reassign required.", { icon: "⚠️" });
        return;
      }

      toast.error(e?.message || "Delete failed", { id: t });
    }
  }

  async function submitReassignAndDelete() {
    if (!deleteId) return toast.error("Missing agent id");
    if (!reassignTo) return toast.error("Select an agent to reassign leads");

    const t = toast.loading("Reassigning & deleting...");
    try {
      await deleteAgentApi(deleteId, Number(reassignTo));
      toast.success("Leads reassigned & agent deleted ✅", { id: t });
      closeReassignModal();
      await loadAgents();
    } catch (e: any) {
      toast.error(e?.message || "Failed to reassign/delete", { id: t });
    }
  }

  return (
    <div className="w-full">
      <PageHeader
        title="Agent Management"
        subtitle="Create and manage agents for lead assignments."
        total={filtered.length}
        search={search}
        onSearch={setSearch}
        icon={<Users size={18} />}
        rightActions={
          <>
            <button
              onClick={loadAgents}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md border border-[#233a47] bg-[#233a47] hover:bg-[#1c303b] transition shadow-sm text-white font-semibold"
              type="button"
            >
              <RefreshCcw size={16} />
              Refresh
            </button>

            <button
              onClick={openAddModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-slate-900 text-white hover:bg-slate-800 transition shadow-sm font-semibold"
              type="button"
            >
              <Plus size={18} />
              Add Agent
            </button>
          </>
        }
      />

      {error && (
        <div className="mb-5 text-sm text-red-700 bg-red-50 border border-red-100 px-3 py-2 rounded-md">
          {error}
        </div>
      )}

      <div className="bg-white rounded-md border border-slate-200/70 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 flex items-center justify-center gap-2 text-slate-600">
            <Loader2 className="animate-spin" size={18} />
            Loading agents...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <div className="w-14 h-14 mx-auto rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center">
              <Users size={22} className="text-slate-600" />
            </div>
            <div className="mt-3 text-lg font-semibold text-slate-900">
              No agents found
            </div>
            <div className="text-sm text-slate-600 mt-1">
              Click <span className="font-semibold">Add Agent</span> to create
              your first agent.
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-left">
                  <th className="px-5 py-3 text-xs font-semibold text-slate-600">
                    ID
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold text-slate-600">
                    Name
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold text-slate-600">
                    Contact
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold text-slate-600">
                    Email
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold text-slate-600">
                    Role
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold text-slate-600">
                    Active
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-slate-600">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filtered.map((a, idx) => (
                  <tr
                    key={a.id}
                    className={cn(
                      "hover:bg-slate-50 transition",
                      idx % 2 === 0 ? "bg-white" : "bg-slate-50/30"
                    )}
                  >
                    <td className="px-5 py-3 text-slate-700">{a.id}</td>

                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-slate-900">{a.name}</span>
                        {a.city && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {a.city}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-5 py-3 text-slate-700">
                      <div className="inline-flex items-center gap-2">
                        <Phone size={16} className="text-slate-500" />
                        {a.contact_no}
                      </div>
                    </td>

                    <td className="px-5 py-3 text-slate-700">
                      <div className="inline-flex items-center gap-2">
                        <Mail size={16} className="text-slate-500" />
                        {a.email}
                      </div>
                    </td>

                    <td className="px-5 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border",
                          a.role_id === 1
                            ? "bg-purple-50 text-purple-700 border-purple-200"
                            : "bg-blue-50 text-blue-700 border-blue-200"
                        )}
                      >
                        <Shield size={14} />
                        {a.role_id === 1 ? "Admin" : "Agent"}
                      </span>
                    </td>

                    <td className="px-5 py-3">
                      <ToggleSwitch
                        checked={Boolean(a.is_active)}
                        onChange={() => toggleActive(a)}
                        disabled={busy || reassignBusy}
                      />
                    </td>

                    <td className="px-5 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => openEditModal(a)}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-800 shadow-sm"
                          type="button"
                        >
                          <Pencil size={16} />
                          Edit
                        </button>

                        <button
                          onClick={() => remove(a.id)}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-red-200 bg-white hover:bg-red-50 text-sm font-semibold text-red-700 shadow-sm"
                          type="button"
                        >
                          <Trash2 size={16} />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ✅ Add Modal */}
      <Modal
        open={openAdd}
        title="Add Agent"
        subtitle="Create a new agent for lead assignments."
        onClose={closeAddModal}
        onSubmit={submitCreate}
        submitText="Create Agent"
        busy={busy}
      >
        {error && (
          <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-100 px-3 py-2 rounded-md">
            {error}
          </div>
        )}

        <AgentForm
          form={form}
          setForm={setForm}
          mode="create"
          isActive={isActive}
          setIsActive={setIsActive}
        />
      </Modal>

      {/* ✅ Edit Modal */}
      <Modal
        open={openEdit}
        title="Edit Agent"
        subtitle="Update agent details."
        onClose={closeEditModal}
        onSubmit={submitEdit}
        submitText="Update Agent"
        busy={busy}
      >
        {error && (
          <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-100 px-3 py-2 rounded-md">
            {error}
          </div>
        )}

        <AgentForm
          form={form}
          setForm={setForm}
          mode="edit"
          isActive={isActive}
          setIsActive={setIsActive}
        />

      </Modal>

      {/* ✅ Reassign Leads Modal (count comes from delete API response) */}
      <Modal
        open={openReassign}
        title="Reassign Leads Before Deleting"
        subtitle="This agent has assigned leads. Move them to another agent to continue."
        onClose={closeReassignModal}
        onSubmit={submitReassignAndDelete}
        submitText="Reassign & Delete"
        busy={reassignBusy}
      >
        <div className="space-y-4">
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
            <div className="mt-0.5">
              <AlertTriangle className="text-amber-700" size={18} />
            </div>
            <div>
              <div className="text-sm font-semibold text-amber-900">
                Assigned Leads:{" "}
                <span className="font-extrabold">{leadCount}</span>
              </div>
              <div className="text-xs text-amber-800 mt-1">
                Select another agent to reassign these leads, then we’ll delete
                this agent.
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Reassign To
            </label>

            <div className="relative">
              <select
                value={reassignTo}
                onChange={(e) =>
                  setReassignTo(e.target.value ? Number(e.target.value) : "")
                }
                className="w-full px-3 py-2.5 rounded-md border border-slate-200 bg-white
                focus:outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-300 transition pr-10"
              >
                <option value="">Select agent...</option>

                {agents
                  .filter((x) => x.id !== deleteId) // ✅ can't pick same agent
                  .filter((x) => x.role_id !== 1) // ✅ optional: exclude Admin
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name} ({x.email})
                    </option>
                  ))}
              </select>

              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                <ArrowRightLeft size={18} />
              </div>
            </div>

            <div className="mt-2 text-xs text-slate-500">
              Tip: choose an active agent so leads don’t get stuck.
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/** ✅ extracted form UI */
function AgentForm({
  form,
  setForm,
  isActive,
  setIsActive,
}: {
  form: typeof emptyForm;
  setForm: React.Dispatch<React.SetStateAction<typeof emptyForm>>;
  mode: "create" | "edit";
  isActive: boolean;
  setIsActive: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1">
          Name
        </label>
        <input
          className="w-full px-3 py-2.5 rounded-md border border-slate-200 bg-white
          focus:outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-300 transition"
          placeholder="Amit Sharma"
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1">
          Contact No
        </label>
        <input
          className="w-full px-3 py-2.5 rounded-md border border-slate-200 bg-white
          focus:outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-300 transition"
          placeholder="9876543210"
          value={form.contact_no}
          onChange={(e) =>
            setForm((p) => ({ ...p, contact_no: e.target.value }))
          }
        />
      </div>

      <div className="">
        <label className="block text-xs font-semibold text-slate-600 mb-1">
          Email
        </label>
        <input
          className="w-full px-3 py-2.5 rounded-md border border-slate-200 bg-white
          focus:outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-300 transition"
          placeholder="agent@email.com"
          value={form.email}
          onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
        />
      </div>

      <div className="">
        <label className="block text-xs font-semibold text-slate-600 mb-1">
          Role
        </label>
        <select
          className="w-full px-3 py-2.5 rounded-md border border-slate-200 bg-white
          focus:outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-300 transition"
          value={form.role_id}
          onChange={(e) =>
            setForm((p) => ({ ...p, role_id: Number(e.target.value) }))
          }
        >
          <option value={1}>Admin</option>
          <option value={2}>Agent</option>
        </select>
      </div>

      <div className="sm:col-span-2">
        <label className="block text-xs font-semibold text-slate-600 mb-1">
          Assigned City (for Intelligent Auto-Assignment)
        </label>
        <input
          className="w-full px-3 py-2.5 rounded-md border border-slate-200 bg-white
          focus:outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-300 transition"
          placeholder="e.g. Mumbai, Delhi, Bengaluru, Dubai, London"
          value={form.city}
          onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
        />
        <div className="mt-1 text-[11px] text-slate-500">
          Inbound leads matching this city will automatically route to this agent.
        </div>

      </div>

      <div className="sm:col-span-2 flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">Active</div>
          <div className="text-xs text-slate-600">Enable/disable this agent</div>
        </div>

        <ToggleSwitch
          checked={isActive}
          onChange={(v) => {
            setIsActive(v);
            setForm((p) => ({ ...p, is_active: v }));
          }}
        />
      </div>
    </div>
  );
}
