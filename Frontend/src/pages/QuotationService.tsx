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

function cn(...cls: Array<string | boolean | undefined | null>) {
  return cls.filter(Boolean).join(" ");
}

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
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative flex max-h-[calc(100vh-32px)] w-full max-w-2xl flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-xl">
        <div className="shrink-0 flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div>
            <div className="text-lg font-bold text-slate-900">{title}</div>
            {subtitle ? <div className="text-sm text-slate-600">{subtitle}</div> : null}
          </div>

          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-white transition hover:bg-slate-50"
            title="Close"
            type="button"
          >
            <X size={18} className="text-slate-700" />
          </button>
        </div>

        <div className="sidebar-scroll min-h-0 flex-1 overflow-y-auto p-5">{children}</div>

        <div className="shrink-0 flex items-center justify-end gap-2 border-t border-slate-200 bg-white px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-md border border-slate-200 bg-white px-4 py-2.5 font-medium text-slate-800 shadow-sm transition hover:bg-slate-50"
            type="button"
          >
            Cancel
          </button>

          <button
            disabled={busy}
            onClick={onSubmit}
            className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-5 py-2.5 font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : null}
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
    <div className="w-full">
      <PageHeader
        title="Quotation Service"
        subtitle="Manage reusable service options for quotation creation"
        total={filtered.length}
        search={q}
        onSearch={setQ}
        icon={<Settings2 size={18} />}
        rightActions={
          <>
            <button
              onClick={() => void load()}
              className="inline-flex items-center gap-2 rounded-md border border-[#233a47] bg-[#233a47] px-4 py-2.5 font-semibold text-white shadow-sm transition hover:bg-[#1c303b]"
              type="button"
            >
              <RefreshCcw size={16} />
              Refresh
            </button>

            <button
              onClick={openAdd}
              className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2.5 font-semibold text-white shadow-sm transition hover:bg-slate-800"
              type="button"
            >
              <Plus size={18} />
              Add Service
            </button>
          </>
        }
      />

      {err ? (
        <div className="mb-5 rounded-md border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
          {err}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-md border border-slate-200/70 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-slate-600">
            <Loader2 className="animate-spin" size={18} />
            Loading quotation services...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-md border border-slate-200 bg-slate-50">
              <Settings2 size={22} className="text-slate-600" />
            </div>
            <div className="mt-3 text-lg font-semibold text-slate-900">No quotation services found</div>
            <div className="mt-1 text-sm text-slate-600">
              Click <span className="font-semibold">Add Service</span> to create one.
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr className="text-left">
                  <th className="px-5 py-3 text-xs font-semibold text-slate-600">S.No</th>
                  <th className="px-5 py-3 text-xs font-semibold text-slate-600">Service Name</th>
                  <th className="px-5 py-3 text-xs font-semibold text-slate-600">Description Points</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filtered.map((item, idx) => {
                  const descriptionLines = normalizeDescriptionForEditor(item.description)
                    .split(/\r?\n/)
                    .map((line) => line.trim())
                    .filter(Boolean);

                  return (
                    <tr
                      key={String(item.id ?? idx)}
                      className={cn(
                        "transition hover:bg-slate-50",
                        idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"
                      )}
                    >
                      <td className="px-5 py-4 font-semibold text-slate-700">{idx + 1}</td>
                      <td className="px-5 py-4 align-top">
                        <div className="font-semibold text-slate-900">{item.name}</div>
                      </td>
                      <td className="px-5 py-4">
                        {descriptionLines.length > 0 ? (
                          <div className="space-y-1 text-slate-700">
                            {descriptionLines.map((line, lineIdx) => (
                              <div key={`${item.id}-${lineIdx}`} className="rounded-md bg-slate-50 px-3 py-2">
                                {line}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400">No description</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => openEdit(item)}
                            className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
                            type="button"
                            title="Edit"
                          >
                            <Pencil size={16} className="text-slate-700" />
                            Edit
                          </button>

                          <button
                            onClick={() => void onDelete(item.id)}
                            className="inline-flex items-center gap-2 rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-50"
                            type="button"
                            title="Delete"
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

      <Modal
        open={open}
        title={mode === "add" ? "Add Quotation Service" : "Edit Quotation Service"}
        subtitle={
          mode === "add"
            ? "Create a reusable quotation service template."
            : `Update quotation service #${editId ?? ""}`
        }
        onClose={closeModal}
        onSubmit={() => void onSubmit()}
        submitText={mode === "add" ? "Create Service" : "Save Changes"}
        busy={busy}
      >
        {err ? (
          <div className="mb-4 rounded-md border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
            {err}
          </div>
        ) : null}

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Service Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Cyber Investigation"
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 transition focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Description Points</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={"Enter one point per line\nField verification\nBackground checks"}
              rows={8}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 transition focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
            <div className="mt-2 text-xs text-slate-500">
              Each new line will be stored as a separate description point.
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
