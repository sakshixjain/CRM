import React, { useEffect, useState } from "react";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import { useAuth } from "../auth/AuthContext";
import { api } from "../lib/api";
import { storage } from "../lib/storage";
import Field from "../ui/Field";
import toast from "react-hot-toast";
import Button from "../ui/Button";
import PageHeader from "../pages/Header";
import { useSources } from "../store/sourceStore";
import { useStatuses } from "../store/statusStore";
import { useAgents } from "../store/agentStore";
import {
  Globe,
  RefreshCcw,
  Loader2,
  PlusCircle,
  Download,
  Upload,
  X,
  UserPlus,
} from "lucide-react";

type Lead = {
  id?: number;
  name: string;
  email: string;
  contact_no: string;     // only local number
  contact_no1?: string;   // only local number
  call_status: string;
  call_description: string;
  country_code: string;   // example: "1", "91"
  alt_country_code: string;
  address: string;
  state: string;
  city: string;
  pincode: string;
  country: string;
  source_id: number;
  case_type: string;
  status_id: number;
  assign_to: number;
  description: string;
  is_active: boolean;
  createdAt?: string;
};

const initialForm: Lead = {
  name: "",
  email: "",
  contact_no: "",
  contact_no1: "",
  call_status: "",
  call_description: "",
  country_code: "91",
  alt_country_code: "91",
  address: "",
  state: "",
  city: "",
  case_type: "",
  pincode: "",
  country: "",
  source_id: 0,
  assign_to: 0,
  status_id: 0,
  description: "",
  is_active: true,
};

function cn(...cls: Array<string | boolean | undefined | null>) {
  return cls.filter(Boolean).join(" ");
}

const DOWNLOAD_DUMMY_URL = "/api/import/dummy-sheet";
const IMPORT_URL = "/api/import";

function digitsOnly(value: string) {
  return String(value || "").replace(/\D/g, "");
}

function stripCountryCode(fullValue: string, dialCode: string) {
  const onlyDigits = digitsOnly(fullValue);
  const cc = digitsOnly(dialCode);

  if (cc && onlyDigits.startsWith(cc)) {
    return onlyDigits.slice(cc.length);
  }
  return onlyDigits;
}

function composeCallStatus(status?: string | null, description?: string | null) {
  const normalizedStatus = String(status || "").trim().toLowerCase();
  const normalizedDescription = String(description || "").trim();

  if (!normalizedStatus) return "";
  if (!normalizedDescription) return normalizedStatus;

  return `${normalizedStatus}, ${normalizedDescription}`;
}

function buildDescriptionHistory(
  description?: string,
  actorName?: string | null,
  actorEmail?: string | null
) {
  const text = String(description || "").trim();
  if (!text) return "";

  return JSON.stringify([
    {
      name: String(actorName || actorEmail || "User").trim(),
      description: text,
      createdAt: new Date().toISOString(),
    },
  ]);
}

export default function Create_Lead() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState<Lead>(initialForm);

  const { sources, loadingSources: sourcesLoading, reload: reloadSources } = useSources();
  const { statuses, loading: statusesLoading, reload: reloadStatuses } = useStatuses();
  const { agents, loadingAgents: agentsLoading, reload: reloadAgents } = useAgents();

  const [importOpen, setImportOpen] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [importErr, setImportErr] = useState<string | null>(null);
 const { user } = useAuth();
   const isAdmin = user?.role_id === 1;
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importStatusId, setImportStatusId] = useState<number>(0);
  const [importAssignTo, setImportAssignTo] = useState<number>(0);
  const [importSourceId, setImportSourceId] = useState<number>(0);

  const [headerSearch, setHeaderSearch] = useState("");
  const selectedAgent = agents.find((a: any) => Number(a.id) === Number(form.assign_to)) ?? agents[0];
  const selectedImportAgent =
    agents.find((a: any) => Number(a.id) === Number(importAssignTo)) ?? agents[0];

  function set<K extends keyof Lead>(key: K, value: Lead[K]) {
    setForm((p) => ({ ...p, [key]: value }));
  }

  useEffect(() => {
    if (!form.source_id && sources.length > 0) {
      setForm((p) => ({ ...p, source_id: Number((sources as any)[0]?.id || 0) }));
    }
  }, [sources, form.source_id]);

  useEffect(() => {
    if (!form.status_id && statuses.length > 0) {
      setForm((p) => ({ ...p, status_id: Number((statuses as any)[0]?.id || 0) }));
    }
  }, [statuses, form.status_id]);

  useEffect(() => {
    if (!form.assign_to && agents.length > 0) {
      setForm((p) => ({ ...p, assign_to: Number((agents as any)[0]?.id || 0) }));
    }
  }, [agents, form.assign_to]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (!form.name.trim()) return toast.error("Name is required");
    if (!form.contact_no.trim()) return toast.error("Contact No is required");
    if (!form.source_id) return toast.error("Please select Source");
    if (!form.status_id) return toast.error("Please select status");
    if (!form.assign_to) return toast.error("Please select agent");
    if (form.call_status && !form.call_description.trim()) {
      return toast.error("Please enter call description");
    }

    setBusy(true);
    const tId = toast.loading("Creating lead...");

    try {
      const fullContactNo = `${digitsOnly(form.country_code)}${digitsOnly(form.contact_no)}`;
      const fullAltContactNo = form.contact_no1
        ? `${digitsOnly(form.alt_country_code)}${digitsOnly(form.contact_no1)}`
        : undefined;
        console.log("Full Contact No:", fullContactNo);
        console.log("Full Alt Contact No:", fullAltContactNo);

      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        contact_no: fullContactNo,         // appended here
        contact_no1: fullAltContactNo,
        call_status:
          composeCallStatus(form.call_status, form.call_description) || undefined,
        address: form.address.trim(),
        state: form.state.trim(),
        city: form.city.trim(),
        pincode: form.pincode.trim(),
        case_type: form.case_type.trim(),
        source_id: Number(form.source_id),
        status_id: Number(form.status_id),
        assign_to: Number(form.assign_to),
        description: buildDescriptionHistory(
          form.description,
          (user as any)?.name,
          user?.email
        ),
        is_active: Boolean(form.is_active),
        country: form.country.trim(),
      };

      await api.leads.create(payload);

      toast.success("Lead created successfully ✅", { id: tId });

      setForm((p) => ({
        ...initialForm,
        source_id: p.source_id,
        status_id: p.status_id,
        assign_to: p.assign_to,
      }));
    } catch (e: any) {
      const msg = e?.message || "Failed to create lead";
      setErr(msg);
      toast.error(msg, { id: tId });
    } finally {
      setBusy(false);
    }
  }

  const resetForm = () => {
    setErr(null);
    setForm((p) => ({
      ...initialForm,
      source_id: p.source_id,
      status_id: p.status_id,
      assign_to: p.assign_to,
    }));
    toast("Form reset", { icon: "↩️" });
  };

  const downloadDummy = async () => {
    const tId = toast.loading("Downloading sample...");
    try {
      const base = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
      const token = storage.getToken();

      const res = await fetch(`${base}${DOWNLOAD_DUMMY_URL}`, {
        method: "GET",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || "Failed to download");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;

      const contentType = res.headers.get("content-type") || "";
      const isExcel =
        contentType.includes("spreadsheet") || DOWNLOAD_DUMMY_URL.includes("excel");
      a.download = isExcel ? "lead_import_template.xlsx" : "lead_import_template.csv";

      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      toast.success("Sample downloaded ✅", { id: tId });
    } catch (e: any) {
      const msg = e?.message || "Download failed";
      setErr(msg);
      toast.error(msg, { id: tId });
    }
  };

  const openImport = async () => {
    setImportErr(null);
    setImportOpen(true);
    setImportFile(null);

    setImportSourceId(form.source_id || 0);

    const firstStatus = statuses?.[0]?.id ? Number((statuses as any)[0].id) : 0;
    const firstAgent = agents?.[0]?.id ? Number((agents as any)[0].id) : 0;

    setImportStatusId(firstStatus);
    setImportAssignTo(firstAgent);

    if ((statuses || []).length === 0) reloadStatuses();
    if ((agents || []).length === 0) reloadAgents();
  };

  const closeImport = () => {
    if (importBusy) {
      toast("Import is running... please wait", { icon: "⏳" });
      return;
    }
    setImportOpen(false);
    setImportErr(null);
  };

  const doImport = async () => {
    setImportErr(null);

    if (!importFile) {
      toast.error("Please choose a file (CSV/XLSX)");
      return setImportErr("Please choose a file (CSV/XLSX)");
    }

    setImportBusy(true);

    const tId = toast.loading("Importing leads...");
    try {
      const fd = new FormData();
      fd.append("file", importFile);
      fd.append("status_id", String(importStatusId));
      fd.append("assign_to", String(importAssignTo));
      if (importSourceId) fd.append("source_id", String(importSourceId));

      await api.postMultipart(IMPORT_URL, fd);

      toast.success("Leads imported successfully ✅", { id: tId });

      setImportOpen(false);
      setImportFile(null);
    } catch (e: any) {
      const msg = e?.message || "Import failed";
      setImportErr(msg);
      toast.error(msg, { id: tId });
    } finally {
      setImportBusy(false);
    }
  };

  const refreshAll = async () => {
    const tId = toast.loading("Refreshing dropdowns...");
    try {
      await Promise.all([reloadSources(), reloadStatuses(), reloadAgents()]);
      toast.success("Dropdowns refreshed ✅", { id: tId });
    } catch {
      toast.error("Refresh failed", { id: tId });
    }
  };

  const importLoading = statusesLoading || agentsLoading;

  return (
    <div className="w-full">
      <PageHeader
        title="Create Lead"
        search={headerSearch}
        onSearch={setHeaderSearch}
        icon={<UserPlus size={18} />}
rightActions={
  <>
    {isAdmin && (
      <>
        <button
          type="button"
          onClick={downloadDummy}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 transition shadow-sm text-slate-800 font-semibold"
        >
          <Download size={16} />
          Download Sample
        </button>

        <button
          type="button"
          onClick={openImport}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md border border-white/10 bg-[#0b2533]/90 text-white hover:bg-[#123b52] transition shadow-sm font-semibold"
        >
          <Upload size={16} className="text-white/80" />
          Import Leads
        </button>
      </>
    )}

    <button
      type="button"
      onClick={refreshAll}
      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md border border-white/10 bg-[#0b2533]/90 text-white hover:bg-[#123b52] transition shadow-sm font-semibold"
    >
      <RefreshCcw
        size={16}
        className={cn(
          "text-white/80",
          (sourcesLoading || importLoading) && "animate-spin"
        )}
      />
      Refresh
    </button>
  </>
}
      />

      {err && (
        <div className="mb-4 text-sm text-red-200 bg-red-500/15 border border-red-500/20 px-4 py-3 rounded-md">
          {err}
        </div>
      )}

      <form
        onSubmit={onSubmit}
        className="flex max-h-[calc(100vh-150px)] min-h-0 flex-col overflow-hidden rounded-md border border-white/10 bg-white/95 shadow-[0_14px_40px_rgba(0,0,0,0.22)]"
      >
        <div className="shrink-0 px-4 sm:px-5 py-3 border-b border-black/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center">
              <PlusCircle size={18} className="text-black" />
            </div>
            <div>
              <div className="font-semibold text-black text-lg">Lead Details</div>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-4 space-y-5">
          <div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Field
                label="Name *"
                value={form.name}
                onChange={(v) => set("name", v)}
                placeholder="John Doe"
              />

              <Field
                label="Email"
                value={form.email}
                onChange={(v) => set("email", v)}
                type="email"
                placeholder="john.doe@example.com"
              />

              <div className="md:col-span-1">
                <label className="block text-sm font-semibold text-slate-600 mb-1">
                  Contact No *
                </label>
                <PhoneInput
                  country={"in"}
                  value={`${form.country_code}${form.contact_no}`}
                  onChange={(value, country: any) => {
                    const dialCode = String(country?.dialCode || "");
                    const localNumber = stripCountryCode(value, dialCode);

                    setForm((p) => ({
                      ...p,
                      country_code: dialCode,
                      contact_no: localNumber,
                      country: country?.name || p.country,
                    }));
                  }}
                  inputStyle={{
                    width: "100%",
                    height: "44px",
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                    fontSize: "14px",
                    paddingLeft: "52px",
                  }}
                  buttonStyle={{
                    borderTopLeftRadius: "12px",
                    borderBottomLeftRadius: "12px",
                    border: "1px solid #e2e8f0",
                    background: "#fff",
                  }}
                  containerStyle={{ width: "100%" }}
                  dropdownStyle={{ width: "300px" }}
                  enableSearch
                  countryCodeEditable={false}
                  placeholder="Phone Number"
                />
              </div>

              <div className="md:col-span-1">
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Alt Contact No
                </label>
                <PhoneInput
                  country={"in"}
                  value={`${form.alt_country_code}${form.contact_no1 || ""}`}
                  onChange={(value, country: any) => {
                    const dialCode = String(country?.dialCode || "");
                    const localNumber = stripCountryCode(value, dialCode);

                    setForm((p) => ({
                      ...p,
                      alt_country_code: dialCode,
                      contact_no1: localNumber,
                    }));
                  }}
                  inputStyle={{
                    width: "100%",
                    height: "44px",
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                    fontSize: "14px",
                    paddingLeft: "52px",
                  }}
                  buttonStyle={{
                    borderTopLeftRadius: "12px",
                    borderBottomLeftRadius: "12px",
                    border: "1px solid #e2e8f0",
                    background: "#fff",
                  }}
                  containerStyle={{ width: "100%" }}
                  dropdownStyle={{ width: "300px" }}
                  enableSearch
                  countryCodeEditable={false}
                  placeholder="Optional second number"
                />
              </div>
            </div>
          </div>

          <div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <Field
                label="Case Type"
                value={form.case_type}
                onChange={(v) => set("case_type", v)}
                placeholder="Pre mat, post mat"
              />
              <Field
                label="Country"
                value={form.country}
                onChange={(v) => set("country", v)}
                placeholder="United States"
              />
              <Field
                label="State"
                value={form.state}
                onChange={(v) => set("state", v)}
                placeholder="California"
              />
              <Field
                label="City"
                value={form.city}
                onChange={(v) => set("city", v)}
                placeholder="Los Angeles"
              />
              <Field
                label="Pincode"
                value={form.pincode}
                onChange={(v) => set("pincode", v)}
                placeholder="90001"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1 text-[13px] text-slate-700">
                  Address
                </label>

                <div className="relative">
                  <input
                    value={form.address}
                    onChange={(e) => set("address", e.target.value)}
                    placeholder="123 Main Street"
                    className="w-full px-3 py-2.5 rounded-md border border-slate-200 bg-white
                    focus:outline-none focus:ring-2 focus:ring-[#123b52]/25 focus:border-[#123b52]/40
                    transition text-sm"
                  />
                  <Globe
                    size={16}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Call
                </label>
                <select
                  value={form.call_status}
                  onChange={(e) => set("call_status", e.target.value)}
                  className="w-full px-3 py-2.5 rounded-md border border-slate-200 bg-white
                  focus:outline-none focus:ring-2 focus:ring-[#123b52]/25 focus:border-[#123b52]/40
                  transition text-sm"
                >
                  <option value="">Select call status</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>

              {form.call_status ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Call Description
                  </label>
                  <textarea
                    value={form.call_description}
                    onChange={(e) => set("call_description", e.target.value)}
                    placeholder={`Write why call is ${form.call_status}...`}
                    rows={2}
                    className="w-full px-3 py-2.5 rounded-md border border-slate-200 bg-white
                    focus:outline-none focus:ring-2 focus:ring-[#123b52]/25 focus:border-[#123b52]/40
                    transition text-sm resize-none"
                  />
                </div>
              ) : null}

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Lead Agent *
                </label>
                {isAdmin ? (
                  <select
                    value={form.assign_to ? String(form.assign_to) : ""}
                    onChange={(e) => set("assign_to", Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-md border border-slate-200 bg-white
                    focus:outline-none focus:ring-2 focus:ring-[#123b52]/25 focus:border-[#123b52]/40
                    transition text-sm"
                    disabled={agentsLoading}
                  >
                    <option value="" disabled>
                      {agentsLoading ? "Loading agent..." : "Select agent"}
                    </option>
                    {agents.map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.name || `agent #${s.id}`}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={
                      selectedAgent?.name ||
                      selectedAgent?.email ||
                      (agentsLoading ? "Loading agent..." : "No agent found")
                    }
                    readOnly
                    className="w-full px-3 py-2.5 rounded-md border border-slate-200 bg-slate-50
                    text-slate-800 transition text-sm"
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Lead Status *
                </label>
                <select
                  value={form.status_id ? String(form.status_id) : ""}
                  onChange={(e) => set("status_id", Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-md border border-slate-200 bg-white
                  focus:outline-none focus:ring-2 focus:ring-[#123b52]/25 focus:border-[#123b52]/40
                  transition text-sm"
                  disabled={statusesLoading}
                >
                  <option value="" disabled>
                    {statusesLoading ? "Loading status..." : "Select status"}
                  </option>
                  {statuses.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.name || `status #${s.id}`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Lead Source *
                </label>
                <select
                  value={form.source_id ? String(form.source_id) : ""}
                  onChange={(e) => set("source_id", Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-md border border-slate-200 bg-white
                  focus:outline-none focus:ring-2 focus:ring-[#123b52]/25 focus:border-[#123b52]/40
                  transition text-sm"
                  disabled={sourcesLoading}
                >
                  <option value="" disabled>
                    {sourcesLoading ? "Loading sources..." : "Select source"}
                  </option>
                  {sources.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.name || `Source #${s.id}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block">
              <span className="block text-xs font-semibold text-slate-600 mb-1">
                Description
              </span>
              <textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Interested in demo..."
                rows={3}
                className="w-full px-3 py-2.5 rounded-md border border-slate-200 bg-white
                focus:outline-none focus:ring-2 focus:ring-[#123b52]/25 focus:border-[#123b52]/40 transition resize-y text-sm"
              />
            </label>
          </div>
        </div>

        <div className="shrink-0 px-4 sm:px-5 py-3 bg-white border-t border-slate-200/70 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={resetForm}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-md border border-slate-200 bg-white hover:bg-slate-50 transition text-slate-800 font-semibold text-sm"
          >
            <RefreshCcw size={16} className="text-slate-600" />
            Reset
          </button>

          <Button type="submit" disabled={busy}>
            <span className="inline-flex items-center gap-2">
              {busy && <Loader2 size={16} className="animate-spin" />}
              {busy ? "Saving..." : "Create Lead"}
            </span>
          </Button>
        </div>
      </form>

      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/45" onClick={closeImport} />

          <div className="relative w-[94%] max-w-xl max-h-[90vh] bg-white rounded-md shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="px-4 py-3 bg-gradient-to-r from-[#0b2533] via-[#123b52] to-[#0b2533] text-white flex items-center justify-between shrink-0">
              <div className="font-semibold">Import Leads</div>
              <button
                type="button"
                onClick={closeImport}
                className="p-2 rounded-md hover:bg-white/10 transition"
                disabled={importBusy}
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto">
              {importErr && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-md">
                  {importErr}
                </div>
              )}

              {importLoading ? (
                <div className="flex items-center gap-2 text-slate-700">
                  <Loader2 className="animate-spin" size={18} />
                  Loading dropdowns...
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      File (CSV / XLSX)
                    </label>
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                      className="w-full text-sm file:mr-3 file:px-16 file:py-2 file:rounded-md
                      file:border file:border-slate-200 file:bg-white file:hover:bg-slate-50
                      file:cursor-pointer cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Source (optional)
                    </label>
                    <select
                      value={importSourceId ? String(importSourceId) : ""}
                      onChange={(e) => setImportSourceId(Number(e.target.value))}
                      className="w-full px-3 py-2.5 rounded-md border border-slate-200 bg-white
                      focus:outline-none focus:ring-2 focus:ring-[#123b52]/25 focus:border-[#123b52]/40
                      transition text-sm"
                    >
                      <option value="">Select Source</option>
                      {sources.map((s: any) => (
                        <option key={s.id} value={s.id}>
                          {s.name || `Source #${s.id}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Status(Optional)
                    </label>
                    <select
                      value={importStatusId ? String(importStatusId) : ""}
                      onChange={(e) => setImportStatusId(Number(e.target.value))}
                      className="w-full px-3 py-2.5 rounded-md border border-slate-200 bg-white
                      focus:outline-none focus:ring-2 focus:ring-[#123b52]/25 focus:border-[#123b52]/40
                      transition text-sm"
                    >
                      <option value="">Select status</option>
                      {statuses.map((s: any) => (
                        <option key={s.id} value={s.id}>
                          {s.name || `Status #${s.id}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Assign To(Optional)
                    </label>
                    {isAdmin ? (
                      <select
                        value={importAssignTo ? String(importAssignTo) : ""}
                        onChange={(e) => setImportAssignTo(Number(e.target.value))}
                        className="w-full px-3 py-2.5 rounded-md border border-slate-200 bg-white
                        focus:outline-none focus:ring-2 focus:ring-[#123b52]/25 focus:border-[#123b52]/40
                        transition text-sm"
                      >
                        <option value="">Select agent</option>
                        {agents.map((a: any) => (
                          <option key={a.id} value={a.id}>
                            {a.name ? `${a.name}` : `Agent #${a.id}`}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={
                          selectedImportAgent?.name ||
                          selectedImportAgent?.email ||
                          (agentsLoading ? "Loading agent..." : "No agent found")
                        }
                        readOnly
                        className="w-full px-3 py-2.5 rounded-md border border-slate-200 bg-slate-50
                        text-slate-800 transition text-sm"
                      />
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row gap-2 sm:justify-end shrink-0">
              <button
                type="button"
                onClick={downloadDummy}
                className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-md border border-slate-200 bg-white hover:bg-slate-50 transition text-slate-800 font-semibold text-sm"
              >
                <Download size={16} />
                Download Sample
              </button>

              <button
                type="button"
                onClick={doImport}
                disabled={importBusy || importLoading}
                className={cn(
                  "inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-md",
                  "bg-[#0b2533] text-white font-semibold text-sm hover:bg-[#123b52] transition",
                  (importBusy || importLoading) && "opacity-60 cursor-not-allowed"
                )}
              >
                {importBusy ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload size={16} />
                    Import
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
