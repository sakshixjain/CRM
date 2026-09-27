/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, Plus, RefreshCcw, Settings2, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import PageHeader from "./Header";

type QuotationServiceRow = {
  id?: number | string;
  name: string;
  description: string;
  created_at?: string;
  updated_at?: string;
};


function normalizeDescriptionForEditor(value?: string) {
  if (!value) return "";

  try {
    const parsed = JSON.parse(value);

    if (typeof parsed === "string") return parsed;

    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => {
          if (typeof item === "string") return item.trim();
          if (item && typeof item === "object") {
            return String(
              (item as any).description ??
                (item as any).text ??
                (item as any).label ??
                ""
            ).trim();
          }
          return "";
        })
        .filter(Boolean)
        .join("\n");
    }

    if (parsed && typeof parsed === "object") {
      const content = String(
        (parsed as any).description ??
          (parsed as any).html ??
          (parsed as any).content ??
          ""
      ).trim();

      if (!content) return "";

      if (/<li[\s>]/i.test(content)) {
        if (typeof window !== "undefined") {
          const container = window.document.createElement("div");
          container.innerHTML = content;
          const items = Array.from(container.querySelectorAll("li"))
            .map((item) => item.textContent?.trim() || "")
            .filter(Boolean);

          if (items.length > 0) {
            return items.join("\n");
          }
        }

        return content
          .replace(/<\/li>/gi, "\n")
          .replace(/<[^>]+>/g, "")
          .split(/\r?\n/)
          .map((item) => item.trim())
          .filter(Boolean)
          .join("\n");
      }

      return content.replace(/<[^>]+>/g, "").trim();
    }
  } catch {
    return value;
  }

  return value;
}

function buildDescriptionPayload(value: string) {
  const lines = value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

  return lines.map((description) => ({ description }));
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={onClose} />
      <div className="relative flex max-h-[calc(100vh-32px)] w-full max-w-2xl flex-col overflow-hidden rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl">
        <div className="shrink-0 flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 px-6 py-4">
          <div>
            <div className="text-base font-extrabold text-slate-900 dark:text-white">{title}</div>
            {subtitle ? <div className="text-xs font-medium text-slate-400 mt-0.5">{subtitle}</div> : null}
          </div>

          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-white transition"
            title="Close"
            type="button"
          >
            <X size={16} />
          </button>
        </div>

        <div className="sidebar-scroll min-h-0 flex-1 overflow-y-auto p-6 space-y-4">{children}</div>

        <div className="shrink-0 flex items-center justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
            type="button"
          >
            Cancel
          </button>

          <button
            disabled={busy}
            onClick={onSubmit}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#111827] dark:bg-purple-600 px-5 py-2 text-xs font-bold text-white hover:bg-black dark:hover:bg-purple-700 transition shadow-xs disabled:opacity-60"
            type="button"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : null}
            {submitText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function QuotationServicePage() {
  const [items, setItems] = useState<QuotationServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<"add" | "edit">("add");
  const [editId, setEditId] = useState<number | string | null>(null);

  async function load() {
    setErr(null);
    setLoading(true);
    try {
      const response = await api.quotationServices.list({ page: 1, limit: 200, q: q.trim() });
      setItems(Array.isArray(response?.data) ? response.data : []);
    } catch (error: any) {
      setItems([]);
      setErr(error?.message || "Failed to load quotation services");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [q]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) => {
      const haystack = `${item.name} ${normalizeDescriptionForEditor(item.description)}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [items, q]);

  function openAdd() {
    setErr(null);
    setMode("add");
    setEditId(null);
    setName("");
    setDescription("");
    setOpen(true);
  }

  function openEdit(row: QuotationServiceRow) {
    setErr(null);
    setMode("edit");
    setEditId(row.id ?? null);
    setName(row.name || "");
    setDescription(normalizeDescriptionForEditor(row.description));
    setOpen(true);
  }

  function closeModal() {
    if (busy) return;
    setOpen(false);
  }

  async function onSubmit() {
    setErr(null);

    if (!name.trim()) {
      setErr("Service name is required");
      return;
    }

    setBusy(true);
    try {
      const payload = {
        name: name.trim(),
        description: buildDescriptionPayload(description),
      };

      if (mode === "add") {
        await api.quotationServices.create(payload);
        toast.success("Quotation service created");
      } else {
        if (!editId) throw new Error("Missing quotation service id");
        await api.quotationServices.update(editId, payload);
        toast.success("Quotation service updated");
      }

      setOpen(false);
      setName("");
      setDescription("");
      setEditId(null);
      setMode("add");
      await load();
    } catch (error: any) {
      setErr(error?.message || "Failed to save quotation service");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: number | string | undefined) {
    if (!id) return;
    if (!window.confirm("Delete this quotation service?")) return;

    try {
      await api.quotationServices.remove(id);
      toast.success("Quotation service deleted");
      await load();
    } catch (error: any) {
      toast.error(error?.message || "Delete failed");
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Quotation Services"
        subtitle="Manage reusable scope templates, service descriptions, and deliverables for quotation creation."
        total={filtered.length}
        search={q}
        onSearch={setQ}
        icon={<Settings2 size={18} />}
        rightActions={
          <div className="flex items-center gap-2">
            <button
              onClick={openAdd}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#111827] dark:bg-purple-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-black dark:hover:bg-purple-700 transition shadow-2xs"
              type="button"
            >
              <Plus size={14} />
              Add Service
            </button>
            <button
              onClick={() => void load()}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-2xs"
              type="button"
            >
              <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        }
      />

      {err ? (
        <div className="rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-xs font-semibold text-red-700 dark:text-red-400">
          {err}
        </div>
      ) : null}

      {/* Table Card */}
      <div className="overflow-hidden rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs transition-colors">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <Loader2 className="animate-spin text-blue-600" size={18} />
            Loading quotation services...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-500">
              <Settings2 size={20} />
            </div>
            <div className="mt-3 text-sm font-bold text-slate-900 dark:text-white">No quotation services found</div>
            <div className="mt-1 text-xs text-slate-400">
              Click &apos;Add Service&apos; to create your first quotation template.
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-xs border-collapse">
              <thead className="border-b border-slate-200/70 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3.5 w-16">S.No</th>
                  <th className="px-5 py-3.5 w-64">Service Name</th>
                  <th className="px-5 py-3.5">Description Deliverables</th>
                  <th className="px-5 py-3.5 text-right w-36">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {filtered.map((item, idx) => {
                  const descriptionLines = normalizeDescriptionForEditor(item.description)
                    .split(/\r?\n/)
                    .map((line) => line.trim())
                    .filter(Boolean);

                  return (
                    <tr
                      key={String(item.id ?? idx)}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition"
                    >
                      <td className="px-5 py-4 font-bold text-slate-500 dark:text-slate-400">{idx + 1}</td>
                      <td className="px-5 py-4 align-top">
                        <div className="font-bold text-slate-900 dark:text-white">{item.name}</div>
                      </td>
                      <td className="px-5 py-4">
                        {descriptionLines.length > 0 ? (
                          <div className="space-y-1.5">
                            {descriptionLines.map((line, lineIdx) => (
                              <div key={`${item.id}-${lineIdx}`} className="rounded-md bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 px-3 py-1.5 text-slate-700 dark:text-slate-300">
                                {line}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">No description points configured</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right align-top">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => openEdit(item)}
                            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-2xs"
                            type="button"
                            title="Edit"
                          >
                            <Pencil size={14} />
                            Edit
                          </button>

                          <button
                            onClick={() => void onDelete(item.id)}
                            className="inline-flex items-center gap-1.5 rounded-md border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition shadow-2xs"
                            type="button"
                            title="Delete"
                          >
                            <Trash2 size={14} />
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

      <Modal
        open={open}
        title={mode === "add" ? "Add Quotation Service" : "Edit Quotation Service"}
        subtitle={
          mode === "add"
            ? "Create a reusable quotation service template with deliverables."
            : `Update quotation service #${editId ?? ""}`
        }
        onClose={closeModal}
        onSubmit={() => void onSubmit()}
        submitText={mode === "add" ? "Create Service" : "Save Changes"}
        busy={busy}
      >
        {err ? (
          <div className="rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-3.5 py-2.5 text-xs font-semibold text-red-700 dark:text-red-400 mb-4">
            {err}
          </div>
        ) : null}

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-200">
              Service Name <span className="text-rose-500">*</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Cyber Investigation & Forensics"
              className="w-full rounded-md border border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60 px-3.5 py-2 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-200">
              Deliverable Description Points (One per line)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={"Enter one point per line\nField verification & analysis\nComprehensive report generation"}
              rows={6}
              className="w-full rounded-md border border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60 px-3.5 py-2 text-xs font-medium text-slate-900 dark:text-white outline-none focus:border-blue-500 resize-none"
            />
            <div className="mt-1.5 text-[11px] text-slate-400">
              Each new line will be parsed and formatted cleanly in quotation documents.
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
