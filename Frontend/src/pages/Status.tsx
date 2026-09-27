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
  Palette,
  Pencil,
} from "lucide-react";

type LeadStatus = {
  id?: number | string;
  name: string;
  color?: string;
  is_active?: boolean; // ✅ new
  createdAt?: string;
};

const defaultColor = "#3b82f6";

function cn(...cls: Array<string | boolean | undefined | null>) {
  return cls.filter(Boolean).join(" ");
}


function StatusPill({ name, color }: { name: string; color: string }) {
  const c = color || defaultColor;
  return (
    <span
      className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border"
      style={{
        borderColor: c,
        background: `${c}14`,
        color: "#0f172a",
      }}
    >
      <span className="w-2 h-2 rounded-full" style={{ background: c }} />
      {name}
    </span>
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

      <div className="relative flex max-h-[calc(100vh-32px)] w-full max-w-xl flex-col overflow-hidden rounded-md border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        {/* header theme */}
        <div className="shrink-0 px-5 py-4 bg-gradient-to-r from-[#0b2533] via-[#123b52] to-[#0b2533] border-b border-white/10">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-lg font-semibold text-white">{title}</div>
              {subtitle && <div className="text-sm text-white/70">{subtitle}</div>}
            </div>

            <button
              onClick={onClose}
              className="w-10 h-10 rounded-md border border-white/10 bg-white/10 hover:bg-white/15 transition flex items-center justify-center"
              title="Close"
              type="button"
            >
              <X size={18} className="text-white" />
            </button>
          </div>
        </div>

        <div className="sidebar-scroll min-h-0 flex-1 overflow-y-auto bg-white p-5">{children}</div>

        <div className="shrink-0 bg-white px-5 py-4 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 transition text-slate-800 font-semibold shadow-sm"
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

export default function StatusPage() {
  const [items, setItems] = useState<LeadStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [search, setSearch] = useState("");
const [isActive, setIsActive] = useState(true); // ✅ new
  // modal (add/edit)
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"add" | "edit">("add");
  const [editingId, setEditingId] = useState<number | string | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(defaultColor);

  const presets = useMemo(
    () => [
      "#3b82f6",
      "#10b981",
      "#f59e0b",
      "#ef4444",
      "#8b5cf6",
      "#0ea5e9",
      "#64748b",
      "#111827",
    ],
    []
  );


  

async function toggleActive(row: LeadStatus) {
  if (!row.id) return;

  const next = !Boolean(row.is_active);

  // optimistic UI
  setItems((prev) =>
    prev.map((x) => (x.id === row.id ? { ...x, is_active: next } : x))
  );

  const toastId = toast.loading(next ? "Enabling status..." : "Disabling status...");

  try {
    // ✅ correct API for STATUS
    await api.updateLeadStatus(row.id, { is_active: next });

    toast.success(next ? "Status enabled successfully" : "Status disabled successfully", {
      id: toastId,
    });
  } catch (e: any) {
    // rollback
    setItems((prev) =>
      prev.map((x) => (x.id === row.id ? { ...x, is_active: !next } : x))
    );

    toast.error(e?.message || "Failed to update status", { id: toastId });
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
  async function load() {
    setErr(null);
    setLoading(true);
    try {
      const rows = await api.listLeadStatus();
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
    const q = search.toLowerCase().trim();
    if (!q) return items;
    return items.filter((s) => s.name?.toLowerCase().includes(q));
  }, [items, search]);

  function openAdd() {
    setErr(null);
    setMode("add");
    setEditingId(null);
    setName("");
    setColor(defaultColor);
    setIsActive(true); // ✅ new
    setOpen(true);
  }

  function openEdit(row: LeadStatus) {
    setErr(null);
    setMode("edit");
    setEditingId(row.id ?? null);
    setName(row.name || "");
    setIsActive(Boolean(row.is_active)); // ✅ new
    setColor(row.color || defaultColor);
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
  }

  async function onDelete(id: number | string | undefined) {
    if (!id) return;
    if (!confirm("Delete this status?")) return;

    try {
      await api.removeLeadStatus(id);
      await load();
      toast.success("Status deleted successfully");
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    }
  }

  async function onSubmit() {
    setErr(null);
    if (!name.trim()) return setErr("Status name is required");

    setBusy(true);
    try {
      if (mode === "add") {
        await api.createLeadStatus({ name: name.trim(), color, is_active: isActive });
      } else {
        if (!editingId) throw new Error("Missing status id");
        await api.updateLeadStatus(editingId, { name: name.trim(), color, is_active: isActive });
      }

      setOpen(false);
      setName("");
      setColor(defaultColor);
      setEditingId(null);
      await load();
    } catch (e: any) {
      setErr(e?.message || (mode === "add" ? "Failed to create" : "Failed to update"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full">
      {/* ✅ NEW HEADER LIKE IMAGE */}
      <PageHeader
        title="Lead Status"
        subtitle="Create and manage status labels & colors"
        total={filtered.length}
        search={search}
        onSearch={setSearch}
        icon={<Palette size={18} />}
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
              Add Status
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
            Loading statuses...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <div className="w-14 h-14 mx-auto rounded-md bg-slate-50 border border-slate-200 flex items-center justify-center">
              <Tag size={22} className="text-slate-600" />
            </div>
            <div className="mt-3 text-lg font-semibold text-slate-900">
              No statuses found
            </div>
            <div className="text-sm text-slate-600 mt-1">
              Click <span className="font-semibold">Add Status</span> to create one.
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-left">
                  <th className="px-5 py-3 text-xs font-semibold text-slate-600">
                    S.No
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold text-slate-600">
                    Status
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold text-slate-600">
                    Color
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
                      idx % 2 === 0 ? "bg-white" : "bg-slate-50/30"
                    )}
                  >
                    {/* ✅ S.No */}
                    <td className="px-5 py-3 text-slate-700 font-semibold">
                      {idx + 1}
                    </td>

                    <td className="px-5 py-3">
                      <StatusPill name={s.name} color={s.color || defaultColor} />
                    </td>

                    <td className="px-5 py-3 text-slate-600 font-mono text-xs">
                      {s.color || "—"}
                    </td>
                    <td className="px-5 py-3">
                    <ToggleSwitch
                      checked={Boolean(s.is_active)}
                      onChange={() => toggleActive(s)}
                    />
                  </td>

                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(s)}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-slate-200 bg-white hover:bg-slate-50
                          text-sm font-semibold text-slate-800 shadow-sm"
                          title="Edit"
                          type="button"
                        >
                          <Pencil size={16} />
                          Edit
                        </button>

                        <button
                          onClick={() => onDelete(s.id)}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-red-200 bg-white hover:bg-red-50 text-sm font-semibold text-red-700 shadow-sm"
                          title="Delete"
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

      {/* Add/Edit Modal */}
      <Modal
        open={open}
        title={mode === "add" ? "Add Status" : "Edit Status"}
        subtitle={
          mode === "add"
            ? "Create a new lead status with color."
            : `Update status #${editingId ?? ""}`
        }
        onClose={closeModal}
        onSubmit={onSubmit}
        submitText={mode === "add" ? "Create Status" : "Save Changes"}
        busy={busy}
      >
        {err && (
          <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-100 px-3 py-2 rounded-md">
            {err}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Status Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Open"
              className="w-full px-3 py-2.5 rounded-md border border-slate-200 bg-white
              focus:outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-300 transition"
            />
            <div className="mt-2 text-xs text-slate-500 flex items-center gap-2">
              Preview: <StatusPill name={name.trim() || "Example"} color={color} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Color
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-14 h-11 rounded-md border border-slate-200 p-1 cursor-pointer bg-white"
              />
              <div className="text-xs text-slate-500">
                Used for badge + lead row highlight.
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Presets
            </label>
            <div className="flex flex-wrap gap-2">
              {presets.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "w-9 h-9 rounded-md border transition shadow-sm",
                    color === c ? "border-slate-900" : "border-slate-200"
                  )}
                  style={{ background: c }}
                  title={c}
                />
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
