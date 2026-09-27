import React, { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import PageHeader from "../pages/Header";
import toast from "react-hot-toast";

import {
  Plus,
  X,
  Loader2,
  RefreshCcw,
  Trash2,
  Tag,
  Pencil,
} from "lucide-react";

type LeadSource = {
  id?: number | string;
  name: string;
  is_active?: boolean;
  createdAt?: string;
};

function cn(...cls: Array<string | boolean | undefined | null>) {
  return cls.filter(Boolean).join(" ");
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
      {/* overlay */}
      <div className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]" onClick={onClose} />

      {/* modal */}
      <div className="relative flex max-h-[calc(100vh-32px)] w-full max-w-xl flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-xl">
        <div className="shrink-0 px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-start justify-between gap-4">
          <div>
            <div className="text-lg font-bold text-slate-900">{title}</div>
            {subtitle && <div className="text-sm text-slate-600">{subtitle}</div>}
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

export default function SourcePage() {
  const [items, setItems] = useState<LeadSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // search
  const [q, setQ] = useState("");
const [isActive, setIsActive] = useState(true); // ✅ new

  // modal fields
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  // ✅ edit support
  const [mode, setMode] = useState<"add" | "edit">("add");
  const [editId, setEditId] = useState<number | string | null>(null);

  async function load() {
    setErr(null);
    setLoading(true);
    try {
      const rows = await api.listLeadSource();
      setItems(Array.isArray(rows) ? rows : []);
    } catch (e: any) {
      setItems([]);
      setErr(e?.message || null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((x) => x.name.toLowerCase().includes(s));
  }, [items, q]);

  function openAdd() {
    setErr(null);
    setMode("add");
    setEditId(null);
    setName("");
    setIsActive(true); // ✅ default active for new sources
    setOpen(true);
  }

  function openEdit(row: LeadSource) {
    setErr(null);
    setMode("edit");
    setEditId(row.id ?? null);
    setName(row.name || "");
    setOpen(true);
    setIsActive(Boolean(row.is_active)); // ✅ load from row
  }

  function closeModal() {
    if (busy) return;
    setOpen(false);
  }


 async function onSubmit() {
  setErr(null);
  if (!name.trim()) return setErr("Source name is required");

  setBusy(true);
  try {
    const payload = { name: name.trim(), is_active: isActive }; // ✅

    if (mode === "add") {
      await api.createLeadSource(payload);
    } else {
      if (!editId) throw new Error("Missing source id");
      await (api as any).updateLeadSource(editId, payload);
    }

    setOpen(false);
    setName("");
    setIsActive(true);
    setEditId(null);
    setMode("add");
    await load();
  } catch (e: any) {
    setErr(e?.message || "Failed to save source");
  } finally {
    setBusy(false);
  }
}

async function toggleActive(row: LeadSource) {
  if (!row.id) return;

  const next = !Boolean(row.is_active);

  // optimistic UI
  setItems((prev) =>
    prev.map((x) => (x.id === row.id ? { ...x, is_active: next } : x))
  );

  const toastId = toast.loading(
    next ? "Enabling source..." : "Disabling source..."
  );

  try {
    await (api as any).updateLeadSource(row.id, { is_active: next });

    toast.success(
      next ? "Source enabled successfully" : "Source disabled successfully",
      { id: toastId }
    );
  } catch (e: any) {
    // rollback
    setItems((prev) =>
      prev.map((x) =>
        x.id === row.id ? { ...x, is_active: !next } : x
      )
    );

    toast.error(e?.message || "Failed to update source", {
      id: toastId,
    });
  }
}

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


  async function onDelete(id: number | string | undefined) {
    if (!id) return;
    if (!confirm("Delete this source?")) return;
    try {
      await api.removeLeadSource(id);
      await load();
      toast.success("Source deleted successfully");
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    }
  }

  return (
    <div className="w-full">
      {/* ✅ NEW HEADER LIKE IMAGE */}
      <PageHeader
        title="Lead Source"
        subtitle="Manage sources like Facebook, Website, WhatsApp"
        total={filtered.length}
        search={q}
        onSearch={setQ}
        icon={<Tag size={18} />}
        rightActions={
          <>
            <button
              onClick={load}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md border border-[#233a47] bg-[#233a47] hover:bg-[#1c303b] transition shadow-sm text-white font-semibold"
              type="button"
            >
              <RefreshCcw size={16} />
              Refresh
            </button>

            <button
              onClick={openAdd}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-slate-900 text-white hover:bg-slate-800 transition shadow-sm font-semibold"
              type="button"
            >
              <Plus size={18} />
              Add Source
            </button>
          </>
        }
      />

      {/* Error under header if needed */}
      {err && (
        <div className="mb-5 text-sm text-red-700 bg-red-50 border border-red-100 px-3 py-2 rounded-md">
          {err}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-md border border-slate-200/70 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 flex items-center justify-center gap-2 text-slate-600">
            <Loader2 className="animate-spin" size={18} />
            Loading sources...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <div className="w-14 h-14 mx-auto rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center">
              <Tag size={22} className="text-slate-600" />
            </div>
            <div className="mt-3 text-lg font-semibold text-slate-900">
              No sources found
            </div>
            <div className="text-sm text-slate-600 mt-1">
              Click <span className="font-semibold">Add Source</span> to create one.
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm ">
              <thead className="bg-slate-50 border-b border-slate-200 ">
                <tr className="text-left">
                  <th className="px-5 py-3 text-xs font-semibold text-slate-600">
                    S.No
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold text-slate-600">
                    Name
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold text-slate-600">
                Active
              </th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-slate-600">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filtered.map((s, idx) => (
                  <tr
                    key={String(s.id ?? idx)}
                    className={cn(
                      "hover:bg-slate-50 transition",
                      idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"
                    )}
                  >
                    <td className="px-5 py-3 text-slate-700 font-semibold">
                      {idx + 1}
                    </td>

                    <td className="px-5 py-3">
                      <div className="font-semibold text-slate-900">{s.name}</div>
                      
                    </td>
                 <td className="px-5 py-3">
                    <ToggleSwitch
                      checked={Boolean(s.is_active)}
                      onChange={() => toggleActive(s)}
                    />
                  </td>


                    <td className="px-5 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => openEdit(s)}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-slate-200 bg-white hover:bg-slate-50
                          text-sm font-semibold text-slate-800 shadow-sm"
                          type="button"
                          title="Edit"
                        >
                          <Pencil size={16} className="text-slate-700" />
                          Edit
                        </button>

                        <button
                          onClick={() => onDelete(s.id)}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-red-200 bg-white hover:bg-red-50 text-sm font-semibold text-red-700 shadow-sm"
                          type="button"
                          title="Delete"
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

      {/* Add/Edit Source Modal */}
      <Modal
        open={open}
        title={mode === "add" ? "Add Source" : "Edit Source"}
        subtitle={
          mode === "add"
            ? "Create a new lead source (Facebook, Website, Referral)."
            : `Update source #${editId ?? ""}`
        }
        onClose={closeModal}
        onSubmit={onSubmit}
        submitText={mode === "add" ? "Create Source" : "Save Changes"}
        busy={busy}
      >
        {err && (
          <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-100 px-3 py-2 rounded-md">
            {err}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            Source Name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Facebook"
            className="w-full px-3 py-2.5 rounded-md border border-slate-200 bg-white
            focus:outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-300 transition"
          />
          <div className="text-xs text-slate-500 mt-2">
            Keep names short and clear (e.g. WhatsApp, Website).
          </div>
        </div>
      </Modal>
    </div>
  );
}
