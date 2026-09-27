/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import PageHeader from "./Header";
import {
  Bold,
  FileText,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Printer,
  Quote,
  Redo2,
  RefreshCcw,
  Settings2,
  Underline,
  Undo2,
  X,
  Plus,
} from "lucide-react";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import { openQuotationPrintWindow } from "../lib/quotationPrint";

type QuotationServiceRow = {
  id: number | string;
  name: string;
  description: string;
};

type QuotationDraft = {
  id: number;
  client_name: string;
  client_mobile: string;
  service_type: string;
  service_name: string;
  base_amount: string;
  gst_rate: number;
  duration: string;
  service_desc: string;
  advance_percent: number;
  created_at: string;
  updated_at: string;
};
const DURATION_KEY = "crm_quotation_duration_options";

const defaultDurations = ["10-12 days", "7-10 days", "15-20 days", "1-2 days"];

const initialDraft = {
  client_name: "",
  client_mobile: "",
  service_type: "",
  service_name: "",
  base_amount: "",
  gst_rate: 18,
  duration: "15-20 days",
  service_desc: "<p>Please select a service to view the quotation.</p>",
  advance_percent: 60,
};

function readArray(key: string, fallback: string[]) {
  if (typeof window === "undefined") return fallback;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function writeArray(key: string, value: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function toCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function normalizeHtml(value?: string | null) {
  return String(value || "").trim() || "<p></p>";
}

function withQuotationIncludesHeading(value: string) {
  const html = normalizeHtml(value);
  if (/quotation includes/i.test(html)) return html;
  return `<p><strong>Quotation Includes:</strong></p>${html}`;
}

function parseServiceDescription(description: unknown) {
  if (typeof description !== "string") return "<p></p>";

  const trimmed = description.trim();
  if (!trimmed) return "<p></p>";

  try {
    const parsed = JSON.parse(trimmed);

    if (typeof parsed === "string") return normalizeHtml(parsed);

    if (Array.isArray(parsed)) {
      const items = parsed
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
        .filter(Boolean);

      if (items.length > 0) {
        return `<p><strong>Quotation Includes:</strong></p><ol>${items
          .map((item) => `<li>${item}</li>`)
          .join("")}</ol>`;
      }
    }

    if (parsed && typeof parsed === "object") {
      const html = String(
        (parsed as any).html ??
          (parsed as any).description ??
          (parsed as any).content ??
          ""
      ).trim();
      if (html) return withQuotationIncludesHeading(html);
    }
  } catch {
    return withQuotationIncludesHeading(trimmed);
  }

  return "<p><strong>Quotation Includes:</strong></p><p></p>";
}

function buildDurationHtml(duration: string) {
  const clean = duration.trim();
  if (!clean) return "";
  return `<p><strong>Project Duration:</strong> Approximately ${clean} from the date of final brief, content, and partial payment.</p>`;
}

function buildServiceTemplate(input: {
  duration: string;
  base_amount: string;
  gst_rate: number;
  advance_percent: number;
  selectedServiceHtml: string;
}) {
  const durationHtml = buildDurationHtml(input.duration);
  const serviceHtml = input.selectedServiceHtml.trim() || "<p></p>";

  if (!durationHtml) return serviceHtml;

  return `${serviceHtml}${durationHtml}`;
}

export default function CreateQuotation() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const quoteIdParam = searchParams.get("id");
  const editId = quoteIdParam ? Number(quoteIdParam) : null;
  const isEdit = Boolean(editId);

  const [form, setForm] = useState(initialDraft);
  const [serviceRows, setServiceRows] = useState<QuotationServiceRow[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [saving, setSaving] = useState(false);
  const [durationOptions, setDurationOptions] = useState<string[]>(() =>
    readArray(DURATION_KEY, defaultDurations)
  );
  const [optionPanelOpen, setOptionPanelOpen] = useState(false);
  const [newDurationOption, setNewDurationOption] = useState("");
  const [editorHtml, setEditorHtml] = useState(initialDraft.service_desc);
  const editorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    writeArray(DURATION_KEY, durationOptions);
  }, [durationOptions]);

  const loadServices = async () => {
    setLoadingServices(true);
    try {
      const response = await api.listQuotationServices({ page: 1, limit: 100 });
      const list = Array.isArray(response)
        ? response
        : Array.isArray((response as any)?.data)
          ? (response as any).data
          : [];
      setServiceRows(list);
    } catch (error: any) {
      toast.error(error?.message || "Failed to load quotation services");
      setServiceRows([]);
    } finally {
      setLoadingServices(false);
    }
  };

  useEffect(() => {
    void loadServices();
  }, []);

  const selectedService = useMemo(() => {
    return serviceRows.find((item) => String(item.id) === String(form.service_type)) || null;
  }, [form.service_type, serviceRows]);

  const amount = Number(form.base_amount || 0);
  const gstAmount = amount * (Number(form.gst_rate || 0) / 100);
  const totalAmount = amount + gstAmount;
  const advanceAmount = totalAmount * (Number(form.advance_percent || 0) / 100);
  const balanceAmount = totalAmount - advanceAmount;

  const setField = (key: string, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    if (!editorRef.current) return;
    if (editorRef.current.innerHTML !== editorHtml) {
      editorRef.current.innerHTML = editorHtml;
    }
  }, [editorHtml]);

  const loadDraft = async (id: number) => {
    try {
      const draft: QuotationDraft = await api.getQuotation(id);
      if (!draft) return;

      const nextDesc = draft.service_desc || "<p></p>";
      const nextDuration = draft.duration || "15-20 days";

      setForm({
        client_name: draft.client_name || "",
        client_mobile: draft.client_mobile || "",
        service_type: String(draft.service_type || ""),
        service_name: draft.service_name || "",
        base_amount: String(draft.base_amount ?? ""),
        gst_rate: Number(draft.gst_rate ?? 18),
        duration: nextDuration,
        service_desc: nextDesc,
        advance_percent: draft.advance_percent ? Number(draft.advance_percent) : 60,
      });

      setEditorHtml(nextDesc);
    } catch (error: any) {
      toast.error(error?.message || "Failed to load quotation draft");
    }
  };

  useEffect(() => {
    if (editId) {
      void loadDraft(editId);
    }
  }, [editId]);

  const applyServiceTemplate = (serviceId: string) => {
    const matched = serviceRows.find((item) => String(item.id) === String(serviceId));
    setField("service_type", serviceId);
    setField("service_name", matched?.name || "");

    const parsed = parseServiceDescription(matched?.description);

    const fullTemplate = buildServiceTemplate({
      duration: form.duration,
      base_amount: form.base_amount,
      gst_rate: form.gst_rate,
      advance_percent: form.advance_percent,
      selectedServiceHtml: parsed,
    });

    setEditorHtml(fullTemplate);
    setField("service_desc", fullTemplate);
  };

  const refreshDescriptionTemplate = () => {
    if (!selectedService) return;
    const parsed = parseServiceDescription(selectedService.description);

    const fullTemplate = buildServiceTemplate({
      duration: form.duration,
      base_amount: form.base_amount,
      gst_rate: form.gst_rate,
      advance_percent: form.advance_percent,
      selectedServiceHtml: parsed,
    });

    setEditorHtml(fullTemplate);
    setField("service_desc", fullTemplate);
    toast.success("Description template updated");
  };

  const execCommand = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      setEditorHtml(html);
      setField("service_desc", html);
    }
  };

  const onEditorInput = () => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      setEditorHtml(html);
      setField("service_desc", html);
    }
  };

  const addDurationOption = () => {
    const clean = newDurationOption.trim();
    if (!clean) return;
    if (!durationOptions.includes(clean)) {
      setDurationOptions((prev) => [...prev, clean]);
    }
    setField("duration", clean);
    setNewDurationOption("");
  };

  const saveDraft = async (): Promise<number | null> => {
    if (!form.client_name.trim()) {
      toast.error("Client name is required");
      return null;
    }
    if (!form.client_mobile.trim()) {
      toast.error("Client mobile is required");
      return null;
    }
    if (!form.service_type) {
      toast.error("Select a service");
      return null;
    }

    setSaving(true);
    try {
      const payload = {
        client_name: form.client_name.trim(),
        client_mobile: form.client_mobile.trim(),
        service_type: form.service_type,
        service_name: form.service_name || selectedService?.name || "",
        base_amount: Number(form.base_amount || 0),
        gst_rate: Number(form.gst_rate || 0),
        gst_amount: gstAmount,
        total_amount: totalAmount,
        advance_amount: advanceAmount,
        remaining_amount: balanceAmount,
        duration: form.duration || "",
        service_desc: normalizeHtml(editorRef.current?.innerHTML || form.service_desc),
      };

      let result: any;
      if (editId) {
        result = await api.updateQuotation(editId, payload);
        toast.success("Quotation updated successfully");
      } else {
        result = await api.createQuotation(payload);
        toast.success("Quotation created successfully");
      }

      const id = result?.data?.id || result?.id || editId;
      return typeof id === "number" ? id : null;
    } catch (error: any) {
      toast.error(error?.message || "Failed to save quotation");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const printQuotation = async () => {
    const savedId = await saveDraft();
    if (!savedId) return;
    const opened = openQuotationPrintWindow({
      id: savedId,
      client_name: form.client_name,
      client_mobile: form.client_mobile,
      service_name: form.service_name || selectedService?.name || "",
      created_at: new Date().toISOString(),
      service_desc: normalizeHtml(editorRef.current?.innerHTML || form.service_desc),
      base_amount: amount,
      gst_rate: form.gst_rate,
      gst_amount: gstAmount,
      total_amount: totalAmount,
      advance_amount: advanceAmount,
      remaining_amount: balanceAmount,
      duration: form.duration,
    });
    if (!opened) {
      toast.error("Allow popups to print quotation");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={isEdit ? "Edit Quotation" : "Create Quotation"}
        subtitle="Generate formatted service proposals, calculate GST & advance splits, and export printable invoices."
        icon={<FileText size={18} />}
        rightActions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOptionPanelOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-2xs"
            >
              <Settings2 size={14} />
              Durations
            </button>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-2xs"
            >
              <X size={14} />
              Cancel
            </button>
          </div>
        }
      />

      {/* Main Quotation Form Card */}
      <div className="rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs transition-colors p-6">
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                Client Name <span className="text-rose-500">*</span>
              </label>
              <input
                value={form.client_name}
                onChange={(e) => setField("client_name", e.target.value)}
                className="w-full rounded-md border border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60 px-3.5 py-2 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-500"
                placeholder="Client / Prospect name"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                Client Mobile <span className="text-rose-500">*</span>
              </label>
              <input
                value={form.client_mobile}
                onChange={(e) => setField("client_mobile", e.target.value)}
                className="w-full rounded-md border border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60 px-3.5 py-2 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-500"
                placeholder="+91 9876543210"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                Service <span className="text-rose-500">*</span>
              </label>
              <div className="flex gap-2">
                <select
                  value={form.service_type}
                  onChange={(e) => applyServiceTemplate(e.target.value)}
                  className="w-full rounded-md border border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60 px-3.5 py-2 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-500"
                  disabled={loadingServices}
                >
                  <option value="" className="dark:bg-slate-900">
                    {loadingServices ? "Loading services..." : "Select a service template"}
                  </option>
                  {serviceRows.map((item) => (
                    <option key={item.id} value={String(item.id)} className="dark:bg-slate-900">
                      {item.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={refreshDescriptionTemplate}
                  className="inline-flex items-center justify-center rounded-md border border-slate-200/80 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                  title="Reload template"
                >
                  <RefreshCcw size={14} />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                Base Price (₹)
              </label>
              <input
                type="text"
                value={form.base_amount}
                onChange={(e) => setField("base_amount", e.target.value)}
                className="w-full rounded-md border border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60 px-3.5 py-2 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-500"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                GST Rate
              </label>
              <select
                value={form.gst_rate}
                onChange={(e) => setField("gst_rate", Number(e.target.value))}
                className="w-full rounded-md border border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60 px-3.5 py-2 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-500"
              >
                {[5, 12, 18, 28].map((item) => (
                  <option key={item} value={item} className="dark:bg-slate-900">
                    {item}% GST
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                Advance Split (%)
              </label>
              <select
                value={form.advance_percent}
                onChange={(e) => setField("advance_percent", Number(e.target.value))}
                className="w-full rounded-md border border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60 px-3.5 py-2 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-500"
              >
                {[50, 60, 70, 100].map((item) => (
                  <option key={item} value={item} className="dark:bg-slate-900">
                    {item}% Advance Payment
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                Estimated Duration
              </label>
              <div className="space-y-2">
                <select
                  value={durationOptions.includes(form.duration) ? form.duration : ""}
                  onChange={(e) => {
                    if (e.target.value) {
                      setField("duration", e.target.value);
                    }
                  }}
                  className="w-full rounded-md border border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60 px-3.5 py-2 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-500"
                >
                  <option value="" className="dark:bg-slate-900">Select saved duration</option>
                  {durationOptions.map((item) => (
                    <option key={item} value={item} className="dark:bg-slate-900">
                      {item}
                    </option>
                  ))}
                </select>

                <input
                  value={form.duration}
                  onChange={(e) => setField("duration", e.target.value)}
                  className="w-full rounded-md border border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60 px-3.5 py-2 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-500"
                  placeholder="Or enter custom duration, e.g. 25 days"
                />
              </div>
            </div>

            {/* Rich Editor */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                Service Scope & Quotation Details
              </label>
              <div className="overflow-hidden rounded-md border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-900">
                <div className="flex flex-wrap items-center gap-1 border-b border-slate-200/80 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-3 py-2 text-slate-700 dark:text-slate-200">
                  <select
                    className="h-8 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs text-slate-900 dark:text-white"
                    onChange={(e) => execCommand("formatBlock", e.target.value)}
                    defaultValue="p"
                  >
                    <option value="p">Paragraph</option>
                    <option value="h1">Heading 1</option>
                    <option value="h2">Heading 2</option>
                    <option value="h3">Heading 3</option>
                  </select>
                  <button type="button" onClick={() => execCommand("bold")} className="rounded p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700">
                    <Bold size={14} />
                  </button>
                  <button type="button" onClick={() => execCommand("italic")} className="rounded p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700">
                    <Italic size={14} />
                  </button>
                  <button type="button" onClick={() => execCommand("underline")} className="rounded p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700">
                    <Underline size={14} />
                  </button>
                  <button type="button" onClick={() => execCommand("insertUnorderedList")} className="rounded p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700">
                    <List size={14} />
                  </button>
                  <button type="button" onClick={() => execCommand("insertOrderedList")} className="rounded p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700">
                    <ListOrdered size={14} />
                  </button>
                  <button type="button" onClick={() => execCommand("formatBlock", "blockquote")} className="rounded p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700">
                    <Quote size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const url = window.prompt("Enter link URL");
                      if (url) execCommand("createLink", url);
                    }}
                    className="rounded p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700"
                  >
                    <LinkIcon size={14} />
                  </button>
                  <button type="button" onClick={() => execCommand("undo")} className="rounded p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700">
                    <Undo2 size={14} />
                  </button>
                  <button type="button" onClick={() => execCommand("redo")} className="rounded p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700">
                    <Redo2 size={14} />
                  </button>
                </div>

                <div
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={onEditorInput}
                  className="min-h-[300px] px-4 py-3 text-xs leading-relaxed outline-none text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 [&_blockquote]:border-l-4 [&_blockquote]:border-slate-300 [&_blockquote]:pl-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mb-2.5 [&_ul]:list-disc [&_ul]:pl-6"
                />
              </div>
            </div>
          </div>

          {/* Pricing Split Summary */}
          <div className="rounded-md border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center sm:text-left">
              <div className="p-2.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 shadow-2xs">
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Total Quoted (incl. {form.gst_rate}% GST)</div>
                <div className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">{toCurrency(totalAmount)}</div>
              </div>
              <div className="p-2.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 shadow-2xs">
                <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">Advance Required ({form.advance_percent}%)</div>
                <div className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">{toCurrency(advanceAmount)}</div>
              </div>
              <div className="p-2.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 shadow-2xs">
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Balance on Delivery</div>
                <div className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">{toCurrency(balanceAmount)}</div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setForm(initialDraft);
                setEditorHtml(initialDraft.service_desc);
              }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
            >
              <RefreshCcw size={14} />
              Reset Form
            </button>
            <button
              type="button"
              onClick={() => void printQuotation()}
              disabled={saving}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-md bg-[#111827] dark:bg-purple-600 hover:bg-black dark:hover:bg-purple-700 px-6 py-2.5 text-xs font-bold text-white transition shadow-xs disabled:opacity-60"
            >
              <Printer size={14} />
              {saving ? "Saving Quotation..." : "Save & Print Invoice"}
            </button>
          </div>
        </div>
      </div>

      {/* Duration Drawer Panel */}
      {optionPanelOpen ? (
        <div className="fixed inset-0 z-50 animate-fade-in">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-xs" onClick={() => setOptionPanelOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-md border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Duration Presets</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Configure reusable estimated timeframes.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOptionPanelOpen(false)}
                  className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-5 pt-5">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1 block">
                    Add New Duration Preset
                  </label>
                  <div className="flex gap-2">
                    <input
                      value={newDurationOption}
                      onChange={(e) => setNewDurationOption(e.target.value)}
                      className="flex-1 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white outline-none"
                      placeholder="e.g. 20-25 days"
                    />
                    <button
                      type="button"
                      onClick={addDurationOption}
                      className="rounded-md bg-[#111827] dark:bg-purple-600 px-4 py-2 text-xs font-bold text-white hover:bg-black transition"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>

                <div className="rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-4">
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2">
                    Active Duration Options
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {durationOptions.map((item) => (
                      <span key={item} className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setOptionPanelOpen(false)}
              className="w-full rounded-md bg-slate-100 dark:bg-slate-800 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
            >
              Done
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
