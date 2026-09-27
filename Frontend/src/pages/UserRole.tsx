import React, { useEffect, useMemo, useRef, useState } from "react";
import  PageHeader from "../pages/Header.tsx"; // adjust path

import { api } from "../lib/api";
import {
  Plus,
  Pencil,
  Trash2,
  RefreshCcw,
  X,
  Loader2,
  Shield,
} from "lucide-react";
import toast from "react-hot-toast";

type UserRoleRow = {
  id?: number | string;
  role?: string;
  created_at?: string;
  updated_at?: string;
  createdAt?: string;
  updatedAt?: string;
};

function cn(...cls: Array<string | boolean | undefined | null>) {
  return cls.filter(Boolean).join(" ");
}

function useOutsideClick<T extends HTMLElement>(
  ref: React.RefObject<T | null>,
  handler: () => void
) {
  useEffect(() => {
    const listener = (e: PointerEvent) => {
      const el = ref.current;
      if (!el) return;

      const path = (e as any).composedPath?.() as EventTarget[] | undefined;
      const clickedInside = path
        ? path.includes(el)
        : el.contains(e.target as Node);

      if (!clickedInside) handler();
    };

    document.addEventListener("pointerdown", listener);
    return () => document.removeEventListener("pointerdown", listener);
  }, [ref, handler]);
}


function formatDate(v?: string) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* =========================
   Modal (same like Status page)
========================= */
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
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, () => open && onClose());

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]" onClick={onClose} />

      <div
        ref={ref}
        className="relative flex max-h-[calc(100vh-32px)] w-full max-w-xl flex-col overflow-hidden rounded-md border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
      >
        {/* header theme */}
        <div className="shrink-0 px-5 py-4 bg-gradient-to-r from-[#0b2533] via-[#123b52] to-[#0b2533] border-b border-white/10">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-lg font-bold text-white">{title}</div>
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
            disabled={busy}
            className="px-4 py-2.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 transition text-slate-800 font-semibold shadow-sm disabled:opacity-60"
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

export default function UserRolePage() {
  const [items, setItems] = useState<UserRoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // search
  const [q, setQ] = useState("");

  // modal state
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"add" | "edit">("add");
  const [editId, setEditId] = useState<number | string | null>(null);

  // form fields
  const [role, setRole] = useState("");

  async function load() {
    setErr(null);
    setLoading(true);
    try {
      const rows = await api.listUserRoles();
      setItems(Array.isArray(rows) ? rows : []);
    } catch (e: any) {
      setItems([]);
      setErr(e?.message || "Failed to fetch roles");
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
    return items.filter((r) => {
      const text = `${r.id ?? ""} ${r.role ?? ""}`.toLowerCase();
      return text.includes(s);
    });
  }, [items, q]);

  function openAdd() {
    setErr(null);
    setMode("add");
    setEditId(null);
    setRole("");
    setOpen(true);
  }

  function openEdit(r: UserRoleRow) {
    setErr(null);
    setMode("edit");
    setEditId((r.id as any) ?? null);
    setRole((r.role || "").trim());
    setOpen(true);
  }

  function closeModal() {
    if (busy) return;
    setOpen(false);
  }

  async function onSubmit() {
    setErr(null);
    const val = role.trim().toLowerCase();
    if (!val) return setErr("Role is required");

    setBusy(true);
    try {
      if (mode === "add") {
        await api.createUserRole({ role: val });
      } else {
        if (!editId) throw new Error("Missing role id");

        const hasUpdate = (api as any).updateUserRole;
        if (hasUpdate) {
          await (api as any).updateUserRole(editId, { role: val });
        } else {
          // fallback if your api helper doesn't have update
          const BASE_URL =
            import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
          const token =
            localStorage.getItem("token") ||
            localStorage.getItem("accessToken") ||
            "";

          const headers: Record<string, string> = { "Content-Type": "application/json" };
          if (token) headers["Authorization"] = `Bearer ${token}`;

          const tryReq = async (method: "PUT" | "PATCH") => {
            const res = await fetch(`${BASE_URL}/api/user-role/${editId}`, {
              method,
              headers,
              body: JSON.stringify({ role: val }),
            });
            const t = await res.text();
            let d: any = {};
            try {
              d = t ? JSON.parse(t) : {};
            } catch {}
            if (!res.ok) throw new Error(d?.message || d?.error || "Update failed");
            return d;
          };

          try {
            await tryReq("PUT");
          } catch {
            await tryReq("PATCH");
          }
        }
      }

      setOpen(false);
      setRole("");
      setEditId(null);
      await load();
    } catch (e: any) {
      setErr(
        e?.message || (mode === "add" ? "Failed to add role" : "Failed to update role")
      );
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: number | string | undefined) {
    if (!id) return;
    if (!confirm("Delete this role?")) return;

    try {
      await api.deleteUserRole(id);
      await load();
      toast.success("Role deleted successfully");
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    }
  }

  return (
    <div className="w-full">
      {/* Header (same like Status/Source pages) */}


<PageHeader
  title="User Roles"
  subtitle="Create and manage roles for your CRM users"
  total={filtered.length}
  search={q}
  onSearch={setQ}
  icon={<Shield size={18} />}
  rightActions={
    <>
      <button
        onClick={load}
        className="
          px-4 py-2.5 rounded-md border border-[#233a47] bg-[#233a47] hover:bg-[#1c303b]
          text-sm font-semibold text-white flex items-center gap-2 shadow-sm
        "
        type="button"
      >
        <RefreshCcw size={16} />
        Refresh
      </button>

      <button
        onClick={openAdd}
        className="
          px-4 py-2.5 rounded-md bg-slate-900 text-white hover:bg-slate-800
          text-sm font-semibold flex items-center gap-2 shadow-sm
        "
        type="button"
      >
        <Plus size={16} />
        Add Role
      </button>
    </>
  }
/>

      {/* Table card */}
      <div className="bg-white rounded-md border border-slate-200/70 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 flex items-center justify-center gap-2 text-slate-600">
            <Loader2 className="animate-spin" size={18} />
            Loading roles...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <div className="w-14 h-14 mx-auto rounded-md bg-slate-50 border border-slate-200 flex items-center justify-center">
              <Shield size={22} className="text-slate-600" />
            </div>
            <div className="mt-3 text-lg font-bold text-slate-900">
              No roles found
            </div>
            <div className="text-sm text-slate-600 mt-1">
              Click <span className="font-semibold">Add Role</span> to create one.
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
                    Role
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold text-slate-600">
                    Created
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold text-slate-600">
                    Updated
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-slate-600">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filtered.map((r, idx) => {
                  const created = r.created_at || r.createdAt;
                  const updated = r.updated_at || r.updatedAt;

                  return (
                    <tr
                      key={String(r.id ?? idx)}
                      className={cn(
                        "hover:bg-slate-50 transition",
                        idx % 2 === 0 ? "bg-white" : "bg-slate-50/30"
                      )}
                    >
                      <td className="px-5 py-3 text-slate-700">{r.id ?? "—"}</td>

                      <td className="px-5 py-3">
                        <span className="inline-flex items-center px-3 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
                          {r.role ?? "—"}
                        </span>
                      </td>

                      <td className="px-5 py-3 text-slate-600">{formatDate(created)}</td>
                      <td className="px-5 py-3 text-slate-600">{formatDate(updated)}</td>

                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEdit(r)}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-slate-200 bg-white hover:bg-slate-50
                            text-sm font-semibold text-slate-800 shadow-sm"
                            type="button"
                          >
                            <Pencil size={16} />
                            Edit
                          </button>

                          <button
                            onClick={() => onDelete(r.id)}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-red-200 bg-white hover:bg-red-50 text-sm font-semibold text-red-700 shadow-sm"
                            type="button"
                          >
                            <Trash2 size={16} />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        open={open}
        title={mode === "add" ? "Add Role" : "Edit Role"}
        subtitle={
          mode === "add"
            ? "Create a new role (example: admin, agent)"
            : `Update role #${editId ?? ""}`
        }
        onClose={closeModal}
        onSubmit={onSubmit}
        submitText={mode === "add" ? "Create Role" : "Save Changes"}
        busy={busy}
      >
        {err && (
          <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-100 px-3 py-2 rounded-md">
            {err}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            Role Name
          </label>
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="agent"
            className="w-full px-3 py-2.5 rounded-md border border-slate-200 bg-white
            focus:outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-300 transition"
          />
          <div className="mt-2 text-[12px] text-slate-500">
            Tip: keep lowercase. Example: <code>admin</code>, <code>agent</code>
          </div>
        </div>
      </Modal>
    </div>
  );
}
