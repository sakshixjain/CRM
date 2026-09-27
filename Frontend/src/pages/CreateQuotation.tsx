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

function buildServiceTemplate(input: {
  duration: string;
  base_amount: string;
  gst_rate: number;
  advance_percent: number;
  selectedServiceHtml: string;
}) {
  const durationHtml = buildDurationHtml(input.duration);
  const pricingHtml = buildPricingSummaryHtml({
    base_amount: input.base_amount,
    gst_rate: input.gst_rate,
    advance_percent: input.advance_percent,
  });

  return `
    ${normalizeHtml(input.selectedServiceHtml)}
    ${durationHtml}
    ${pricingHtml}
  `;
}

function buildDurationHtml(duration: string) {
  return `<p data-quotation-duration="true"><strong>Estimated Duration:</strong> ${duration || "-"}</p>`;
}

function buildPricingSummaryHtml(input: {
  base_amount: string;
  gst_rate: number;
  advance_percent: number;
}) {
  const amount = Number(input.base_amount || 0);
  const gstAmount = amount * (Number(input.gst_rate || 0) / 100);
  const totalAmount = amount + gstAmount;
  const advanceAmount = totalAmount * (Number(input.advance_percent || 0) / 100);
  const balanceAmount = totalAmount - advanceAmount;
  const remainPercent = 100 - Number(input.advance_percent || 0);

  return `<p data-quotation-pricing="true" style="font-size: 13px; color: #555; line-height: 1.4; margin-top: 10px;"><em>
      The base price for the service is ${toCurrency(amount)}, with GST (${input.gst_rate}%) of ${toCurrency(gstAmount)},
      making the total payable amount ${toCurrency(totalAmount)}. To start the work you need to pay
      ${input.advance_percent}% as an advance (${toCurrency(advanceAmount)}), and the remaining ${remainPercent}%
      (${toCurrency(balanceAmount)}) of the professional fee shall be payable upon completion of investigative efforts,
      prior to the delivery of the final findings or report. Completion refers to the conclusion of assigned investigative
      activities and not to any guaranteed outcome or result. All fees paid are strictly non-refundable once investigative
      planning, resource allocation, or field activity has commenced, irrespective of the outcome, findings, client
      satisfaction, or case resolution by other means. This document and all related communications are confidential and
      intended solely for the recipient. Any unauthorized sharing, reproduction, or disclosure may result in legal action.
    </em></p>`;
}

function syncQuotationDynamicContent(
  html: string,
  input: {
    duration: string;
    base_amount: string;
    gst_rate: number;
    advance_percent: number;
  }
) {
  if (typeof document === "undefined") return normalizeHtml(html);

  const container = document.createElement("div");
  container.innerHTML = normalizeHtml(html);

  const durationHtml = buildDurationHtml(input.duration);
  const pricingHtml = buildPricingSummaryHtml({
    base_amount: input.base_amount,
    gst_rate: input.gst_rate,
    advance_percent: input.advance_percent,
  });

  const durationNode = container.querySelector("[data-quotation-duration='true']");
  const pricingNode = container.querySelector("[data-quotation-pricing='true']");

  const paragraphs = Array.from(container.querySelectorAll("p"));
  const legacyDurationNode =
    durationNode ||
    paragraphs.find((node) => /estimated duration:/i.test(node.textContent || ""));
  const legacyPricingNode =
    pricingNode ||
    paragraphs.find((node) => /the base price for the service is/i.test(node.textContent || ""));

  if (legacyDurationNode) {
    legacyDurationNode.outerHTML = durationHtml;
  } else {
    container.insertAdjacentHTML("beforeend", durationHtml);
  }

  if (legacyPricingNode) {
    legacyPricingNode.outerHTML = pricingHtml;
  } else {
    container.insertAdjacentHTML("beforeend", pricingHtml);
  }

  return normalizeHtml(container.innerHTML);
}

export default function CreateQuotation() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const editorRef = useRef<HTMLDivElement | null>(null);
  const editId = Number(searchParams.get("id") || 0);
  const isEdit = Number.isFinite(editId) && editId > 0;

  const [form, setForm] = useState(initialDraft);
  const [serviceRows, setServiceRows] = useState<QuotationServiceRow[]>([]);
  const [durationOptions, setDurationOptions] = useState<string[]>(() =>
    readArray(DURATION_KEY, defaultDurations)
  );
  const [optionPanelOpen, setOptionPanelOpen] = useState(false);
  const [newDurationOption, setNewDurationOption] = useState("");
  const [loadingServices, setLoadingServices] = useState(false);
  const [editorHtml, setEditorHtml] = useState(initialDraft.service_desc);
  const [selectedServiceHtml, setSelectedServiceHtml] = useState("");
  const [descriptionTouched, setDescriptionTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedService = useMemo(
    () => serviceRows.find((row) => String(row.id) === String(form.service_type)) || null,
    [form.service_type, serviceRows]
  );

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== editorHtml) {
      editorRef.current.innerHTML = editorHtml;
    }
  }, [editorHtml]);

  useEffect(() => {
    setDurationOptions(readArray(DURATION_KEY, defaultDurations));
  }, []);

  useEffect(() => {
    const loadServices = async () => {
      setLoadingServices(true);
      try {
        const rows = await api.listQuotationServices({ page: 1, limit: 200 });
        setServiceRows(Array.isArray(rows) ? rows : []);
      } catch (error: any) {
        toast.error(error?.message || "Failed to load quotation services");
        setServiceRows([]);
      } finally {
        setLoadingServices(false);
      }
    };

    void loadServices();
  }, []);

  useEffect(() => {
    if (!isEdit) {
      setForm((prev) => ({
        ...prev,
        duration: prev.duration || durationOptions[0] || "15-20 days",
      }));
      return;
    }

    const loadQuotation = async () => {
      try {
        const draft = (await api.getQuotation(editId)) as QuotationDraft & {
          service?: { id: number; name: string } | null;
          advance_amount?: string | number;
          total_amount?: string | number;
        };

        const total = Number(draft.total_amount || 0);
        const advance = Number(draft.advance_amount || 0);
        const advancePercent =
          total > 0 ? Math.max(0, Math.min(100, Math.round((advance / total) * 100))) : 60;

        setForm({
          client_name: draft.client_name || "",
          client_mobile: draft.client_mobile || "",
          service_type: String(draft.service_type || ""),
          service_name: draft.service?.name || draft.service_name || "",
          base_amount: String(draft.base_amount || ""),
          gst_rate: Number(draft.gst_rate || 18),
          duration: draft.duration || "15-20 days",
          service_desc: normalizeHtml(draft.service_desc),
          advance_percent: advancePercent,
        });
        setEditorHtml(normalizeHtml(draft.service_desc));
        setSelectedServiceHtml("");
        setDescriptionTouched(true);
      } catch (error: any) {
        toast.error(error?.message || "Failed to load quotation");
      }
    };

    void loadQuotation();
  }, [durationOptions, editId, isEdit]);

  useEffect(() => {
    if (!selectedServiceHtml || descriptionTouched) return;

    const nextHtml = buildServiceTemplate({
      duration: form.duration,
      base_amount: form.base_amount,
      gst_rate: form.gst_rate,
      advance_percent: form.advance_percent,
      selectedServiceHtml,
    });

    setEditorHtml(nextHtml);
    setForm((prev) => ({ ...prev, service_desc: nextHtml }));
  }, [
    descriptionTouched,
    form.advance_percent,
    form.base_amount,
    form.duration,
    form.gst_rate,
    selectedServiceHtml,
  ]);

  useEffect(() => {
    const currentHtml = normalizeHtml(editorRef.current?.innerHTML || editorHtml || form.service_desc);
    const hasGeneratedPricing = /the base price for the service is/i.test(currentHtml);
    const hasGeneratedDuration = /estimated duration:/i.test(currentHtml);

    if (!selectedServiceHtml && !isEdit && !hasGeneratedPricing && !hasGeneratedDuration) {
      return;
    }

    const nextHtml = syncQuotationDynamicContent(currentHtml, {
      duration: form.duration,
      base_amount: form.base_amount,
      gst_rate: form.gst_rate,
      advance_percent: form.advance_percent,
    });

    if (nextHtml === currentHtml) return;

    setEditorHtml(nextHtml);
    setForm((prev) => (prev.service_desc === nextHtml ? prev : { ...prev, service_desc: nextHtml }));
  }, [editorHtml, form.advance_percent, form.base_amount, form.duration, form.gst_rate, form.service_desc, isEdit, selectedServiceHtml]);

  const amount = Number(form.base_amount || 0);
  const gstAmount = useMemo(() => amount * (Number(form.gst_rate || 0) / 100), [amount, form.gst_rate]);
  const totalAmount = useMemo(() => amount + gstAmount, [amount, gstAmount]);
  const advanceAmount = useMemo(
    () => totalAmount * (Number(form.advance_percent || 0) / 100),
    [form.advance_percent, totalAmount]
  );
  const balanceAmount = useMemo(() => totalAmount - advanceAmount, [advanceAmount, totalAmount]);

  const setField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const addDurationOption = () => {
    const normalized = newDurationOption.trim();
    if (!normalized) return toast.error("Enter a duration");
    if (durationOptions.includes(normalized)) return toast.error("Duration already exists");
    const next = [...durationOptions, normalized];
    setDurationOptions(next);
    writeArray(DURATION_KEY, next);
    setField("duration", normalized);
    setNewDurationOption("");
    toast.success("Duration option added");
  };

  const applyServiceTemplate = (serviceId: string) => {
    const row = serviceRows.find((item) => String(item.id) === serviceId);
    if (!row) return;

    const serviceHtml = parseServiceDescription(row.description);
    const nextHtml = buildServiceTemplate({
      duration: form.duration,
      base_amount: form.base_amount,
      gst_rate: form.gst_rate,
      advance_percent: form.advance_percent,
      selectedServiceHtml: serviceHtml,
    });

    setField("service_type", String(row.id));
    setField("service_name", row.name);
    setField("service_desc", nextHtml);
    setEditorHtml(nextHtml);
    setSelectedServiceHtml(serviceHtml);
    setDescriptionTouched(false);
  };

  const refreshDescriptionTemplate = () => {
    if (!selectedService) {
      toast.error("Select a service first");
      return;
    }
    applyServiceTemplate(String(selectedService.id));
  };

  const execCommand = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    const nextHtml = normalizeHtml(editorRef.current?.innerHTML);
    setEditorHtml(nextHtml);
    setField("service_desc", nextHtml);
  };

  const onEditorInput = () => {
    const nextHtml = normalizeHtml(editorRef.current?.innerHTML);
    setEditorHtml(nextHtml);
    setField("service_desc", nextHtml);
    setDescriptionTouched(true);
  };

  const saveDraft = async () => {
    if (!form.client_name.trim()) {
      toast.error("Client name is required");
      return null;
    }
    if (!form.client_mobile.trim()) {
      toast.error("Client mobile is required");
      return null;
    }
    if (!form.service_type.trim()) {
      toast.error("Please select a service");
      return null;
    }
    if (!form.base_amount.trim()) {
      toast.error("Base amount is required");
      return null;
    }

    const payload = {
      client_name: form.client_name.trim(),
      client_mobile: form.client_mobile.trim(),
      service_type: Number(form.service_type),
      base_amount: amount,
      amount,
      gst_rate: form.gst_rate,
      gst_amount: gstAmount,
      total_amount: totalAmount,
      advance_amount: advanceAmount,
      remaining_amount: balanceAmount,
      duration: form.duration,
      service_desc: normalizeHtml(editorRef.current?.innerHTML || form.service_desc),
      status: "pending",
    };

    setSaving(true);
    try {
      const response = isEdit
        ? await api.updateQuotation(editId, payload)
        : await api.createQuotation(payload);

      const savedId = response?.data?.id;
      if (savedId) {
        setSearchParams({ id: String(savedId) }, { replace: true });
      }

      toast.success(response?.message || (isEdit ? "Quotation updated successfully" : "Quotation created successfully"));
      return Number(savedId || editId || 0);
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
    <div className="w-full">
      <PageHeader
        title={isEdit ? "Edit Quotation" : "Create Quotation"}
        subtitle=""
        icon={<FileText size={18} />}
        rightActions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setOptionPanelOpen(true)}
              className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15"
            >
              <Settings2 size={16} />
              Manage Duration
            </button>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
            >
              <X size={16} />
              Close
            </button>
          </div>
        }
      />

      <div className="rounded-md border border-slate-200 bg-white shadow-sm">
        <div className="space-y-3 p-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Client Name</span>
              <input
                value={form.client_name}
                onChange={(e) => setField("client_name", e.target.value)}
                className="h-11 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                placeholder="Client name"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Client Mobile</span>
              <input
                value={form.client_mobile}
                onChange={(e) => setField("client_mobile", e.target.value)}
                className="h-11 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                placeholder="+91xxxxxxxxxx"
              />
            </label>

            <label className="block md:col-span-2">
              <span className="mb-1 block text-sm font-medium text-slate-700">Service</span>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto]">
                <select
                  value={form.service_type}
                  onChange={(e) => applyServiceTemplate(e.target.value)}
                  className="h-11 rounded-md border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  disabled={loadingServices}
                >
                  <option value="">{loadingServices ? "Loading services..." : "Select a service"}</option>
                  {serviceRows.map((item) => (
                    <option key={item.id} value={String(item.id)}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={refreshDescriptionTemplate}
                  className="inline-flex h-11 items-center justify-center rounded-md border border-slate-200 px-4 text-slate-700 transition hover:bg-slate-50"
                  title="Reload selected service data"
                >
                  <RefreshCcw size={16} />
                </button>
              </div>
              {selectedService ? (
                <p className="mt-2 text-sm text-slate-500">
                  Selected service: <span className="font-medium text-slate-700">{selectedService.name}</span>
                </p>
              ) : null}
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Base Price</span>
              <input
                type="text"
                min="0"
                step="0.01"
                value={form.base_amount}
                onChange={(e) => setField("base_amount", e.target.value)}
                className="h-11 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                placeholder="0.00"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">GST Rate</span>
              <select
                value={form.gst_rate}
                onChange={(e) => setField("gst_rate", Number(e.target.value))}
                className="h-11 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-slate-300"
              >
                {[5, 12, 18, 28].map((item) => (
                  <option key={item} value={item}>
                    {item}%
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Advance Percentage</span>
              <select
                value={form.advance_percent}
                onChange={(e) => setField("advance_percent", Number(e.target.value))}
                className="h-11 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-slate-300"
              >
                {[50, 60, 70, 100].map((item) => (
                  <option key={item} value={item}>
                    {item}%
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Estimated Duration</span>
              <div className="space-y-2">
                <select
                  value={durationOptions.includes(form.duration) ? form.duration : ""}
                  onChange={(e) => {
                    if (e.target.value) {
                      setField("duration", e.target.value);
                    }
                  }}
                  className="h-11 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                >
                  <option value="">Select saved duration</option>
                  {durationOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>

                <input
                  value={form.duration}
                  onChange={(e) => setField("duration", e.target.value)}
                  className="h-11 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  placeholder="Enter manual duration, e.g. 25 days"
                />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                You can choose a saved duration or type a custom one manually.
              </p>
            </label>

            <div className="md:col-span-2">
              <span className="mb-1 block text-sm font-medium text-slate-700">Service Description</span>
              <div className="overflow-hidden rounded-md border border-slate-200">
                <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 px-2 py-2">
                  <select
                    className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm"
                  onChange={(e) => execCommand("formatBlock", e.target.value)}
                  defaultValue="p"
                >
                  <option value="p">Paragraph</option>
                    <option value="h1">Heading 1</option>
                    <option value="h2">Heading 2</option>
                    <option value="h3">Heading 3</option>
                  </select>
                  <button type="button" onClick={() => execCommand("bold")} className="rounded-md p-2 hover:bg-white">
                    <Bold size={16} />
                  </button>
                  <button type="button" onClick={() => execCommand("italic")} className="rounded-md p-2 hover:bg-white">
                    <Italic size={16} />
                  </button>
                  <button type="button" onClick={() => execCommand("underline")} className="rounded-md p-2 hover:bg-white">
                    <Underline size={16} />
                  </button>
                  <button type="button" onClick={() => execCommand("insertUnorderedList")} className="rounded-md p-2 hover:bg-white">
                    <List size={16} />
                  </button>
                  <button type="button" onClick={() => execCommand("insertOrderedList")} className="rounded-md p-2 hover:bg-white">
                    <ListOrdered size={16} />
                  </button>
                  <button type="button" onClick={() => execCommand("formatBlock", "blockquote")} className="rounded-md p-2 hover:bg-white">
                    <Quote size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const url = window.prompt("Enter link URL");
                      if (url) execCommand("createLink", url);
                    }}
                    className="rounded-md p-2 hover:bg-white"
                  >
                    <LinkIcon size={16} />
                  </button>
                  <button type="button" onClick={() => execCommand("undo")} className="rounded-md p-2 hover:bg-white">
                    <Undo2 size={16} />
                  </button>
                  <button type="button" onClick={() => execCommand("redo")} className="rounded-md p-2 hover:bg-white">
                    <Redo2 size={16} />
                  </button>
                </div>

                <div
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={onEditorInput}
                  className="min-h-[360px] px-3 py-3 text-sm leading-7 outline-none [&_blockquote]:border-l-4 [&_blockquote]:border-slate-300 [&_blockquote]:pl-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-6"
                />
              </div>
            </div>
          </div>

          <div className="rounded-md border border-slate-200 bg-cyan-50 p-2">
            <div className="space-y-2">
              {[
                ["Total Amount", toCurrency(totalAmount)],
                [`Advance (${form.advance_percent}%)`, toCurrency(advanceAmount)],
                ["Remaining", toCurrency(balanceAmount)],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-baseline rounded-md px-2 py-1">
                  <span className="text-sm text-slate-600">{label}</span>
                  <span className="pl-4 text-sm font-semibold text-slate-900">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setForm(initialDraft);
                setEditorHtml(initialDraft.service_desc);
                setSelectedServiceHtml("");
                setDescriptionTouched(false);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <RefreshCcw size={16} />
              Reset
            </button>
            <button
              type="button"
              onClick={() => void printQuotation()}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <Printer size={16} />
              {saving ? "Saving..." : "Save & Print Quotation"}
            </button>
          </div>
        </div>
      </div>

      {optionPanelOpen ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-slate-950/45" onClick={() => setOptionPanelOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-md border-l border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Manage Duration</h3>
                <p className="text-sm text-slate-500">Add extra duration choices.</p>
              </div>
              <button
                type="button"
                onClick={() => setOptionPanelOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-md border border-slate-200 text-slate-700 transition hover:bg-slate-50"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-6 p-5">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">Add Duration</h4>
                <div className="mt-3 flex gap-2">
                  <input
                    value={newDurationOption}
                    onChange={(e) => setNewDurationOption(e.target.value)}
                    className="h-11 flex-1 rounded-md border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                    placeholder="20-25 days"
                  />
                  <button
                    type="button"
                    onClick={addDurationOption}
                    className="rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                <h4 className="text-sm font-semibold text-slate-900">Available Services</h4>
                <div className="mt-3 flex flex-wrap gap-2">
                  {serviceRows.map((item) => (
                    <span key={item.id} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700">
                      {item.name}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                <h4 className="text-sm font-semibold text-slate-900">Available Durations</h4>
                <div className="mt-3 flex flex-wrap gap-2">
                  {durationOptions.map((item) => (
                    <span key={item} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
