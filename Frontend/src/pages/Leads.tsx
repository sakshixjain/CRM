import React, { useEffect, useMemo, useState } from "react";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import {
  parsePhoneNumberFromString,
  validatePhoneNumberLength,
} from "libphonenumber-js";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import PageHeader from "../pages/Header";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useStatuses } from "../store/statusStore";
import { useAgents } from "../store/agentStore";
import { useAuth } from "../auth/AuthContext";
import { useSources } from "../store/sourceStore";
import {
  Pencil,
  X,
  User,
  Phone,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Users,
  FileText,
  Loader2,
  ListChecks,
  Circle,
  RefreshCcw,
  Trash2,
  EyeOff,
  Eye,
  CheckCircle2,
} from "lucide-react";

type MiniUser = { id: number; name?: string; email?: string };

export type Lead = {
  id: number;
  name: string;
  email: string;
  contact_no: string;
  contact_no1?: string;
  whatsapp_chat?: string | null;
  call_status?: string | null;
  address: string;
  city: string;
  case_type: string;
  state: string;
  country: string;
  pincode: string;
  description: string;
  source_id: number | null;
  status_id: number | null;
  is_active: boolean;
  createdAt: string;
  updatedAt: string;
  assign_to: number | null;
  agent_id: number | null;
  changed_by: number | null;

  assignedAgent?: MiniUser | null;
  assignedTo?: MiniUser | null;

  changedByAdmin?: MiniUser | null;
};

type DescItem = { name?: string; description?: string; createdAt?: string };

// const WHATSAPP_OPTIONS = [
//   { value: "yes", label: "Yes" },
//   { value: "no", label: "No" },
//   { value: "only whatsapp chats", label: "Only WhatsApp Chats" },
// ] as const;

const CALL_OPTIONS = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
] as const;

// function normalizeWhatsapp(value?: string | null) {
//   const v = String(value || "").trim().toLowerCase();
//   if (v === "yes") return "yes";
//   if (v === "no") return "no";
//   if (v === "only whatsapp chats") return "only whatsapp chats";
//   return "";
// }

function normalizeCallStatus(value?: string | null) {
  const v = String(value || "").trim().toLowerCase();
  if (v === "yes") return "yes";
  if (v === "no") return "no";
  if (v.startsWith("yes,")) return "yes";
  if (v.startsWith("no,")) return "no";
  return "";
}

function getCallDescription(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const match = raw.match(/^(yes|no)\s*,\s*(.*)$/i);
  if (match) return String(match[2] || "").trim();
  return "";
}

function composeCallStatus(status?: string | null, description?: string | null) {
  const normalizedStatus = normalizeCallStatus(status);
  const normalizedDescription = String(description || "").trim();

  if (!normalizedStatus) return "";
  if (!normalizedDescription) return normalizedStatus;

  return `${normalizedStatus}, ${normalizedDescription}`;
}

// Helpers
function cn(...cls: Array<string | false | null | undefined>) {
  return cls.filter(Boolean).join(" ");
}

function getErrorMessage(error: unknown, fallback = "Something went wrong") {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  if (error && typeof error === "object") {
    const maybeError = error as { message?: unknown; error?: unknown };
    if (typeof maybeError.message === "string" && maybeError.message.trim()) {
      return maybeError.message;
    }
    if (typeof maybeError.error === "string" && maybeError.error.trim()) {
      return maybeError.error;
    }
  }
  return fallback;
}

function fmtDate(d?: string) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtDateTime(d?: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  return dt.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPhone(phone?: string | null) {
  if (!phone) return "—";

  try {
    let raw = String(phone).trim();

    if (!raw.startsWith("+")) {
      const digitsOnly = raw.replace(/\D/g, "");
      if (digitsOnly.length > 10) {
        raw = `+${digitsOnly}`;
      } else {
        return phone;
      }
    }

    const phoneNumber = parsePhoneNumberFromString(raw);
    if (!phoneNumber) return phone;

    return phoneNumber.formatInternational();
  } catch {
    return phone;
  }
}

function maskPhone(phone?: string | null) {
  if (!phone) return "-";
  const digits = String(phone).replace(/\D/g, "");
  if (!digits) return "-";
  if (digits.length <= 7) return digits;
  return `${digits.slice(0, 3)}XXXX${digits.slice(-5)}`;
}

function digitsOnly(value?: string | null) {
  return String(value || "").replace(/\D/g, "");
}

const NATIONAL_PHONE_MAX_DIGITS: Record<string, number> = {
  in: 10,
  us: 10,
  ca: 10,
  tr: 10,
  ae: 9,
  au: 9,
  sg: 8,
  my: 10,
  pk: 10,
  np: 10,
};

const COUNTRY_CODE_PHONE_MAX_DIGITS: Record<string, number> = {
  "1": 10,
  "91": 10,
  "90": 10,
  "971": 9,
  "61": 9,
  "65": 8,
  "60": 10,
  "92": 10,
  "977": 10,
};

function getMaxNationalPhoneDigits(
  countryCode?: string | null,
  countryIso2?: string | null
) {
  const iso = String(countryIso2 || "").trim().toLowerCase();
  const code = digitsOnly(countryCode);
  return NATIONAL_PHONE_MAX_DIGITS[iso] || COUNTRY_CODE_PHONE_MAX_DIGITS[code] || null;
}

function getPhoneLengthIssue(
  countryCode?: string | null,
  phoneNumber?: string | null,
  countryIso2?: string | null
) {
  const code = digitsOnly(countryCode);
  const number = digitsOnly(phoneNumber);
  if (!code || !number) return null;

  const country = String(countryIso2 || "").trim().toUpperCase();
  const countryArg = /^[A-Z]{2}$/.test(country) ? (country as any) : undefined;

  try {
    return validatePhoneNumberLength(`+${code}${number}`, countryArg) || null;
  } catch {
    try {
      return validatePhoneNumberLength(`+${code}${number}`) || null;
    } catch {
      return null;
    }
  }
}

function isPhoneTooLong(
  countryCode?: string | null,
  phoneNumber?: string | null,
  countryIso2?: string | null
) {
  const maxDigits = getMaxNationalPhoneDigits(countryCode, countryIso2);
  if (maxDigits && digitsOnly(phoneNumber).length > maxDigits) return true;
  return getPhoneLengthIssue(countryCode, phoneNumber, countryIso2) === "TOO_LONG";
}

function clampPhoneNumberToCountry(
  countryCode?: string | null,
  phoneNumber?: string | null,
  countryIso2?: string | null
) {
  let next = digitsOnly(phoneNumber);
  while (next && isPhoneTooLong(countryCode, next, countryIso2)) {
    next = next.slice(0, -1);
  }
  return next;
}

function getFallbackCountryCode(country?: string | null) {
  const normalizedCountry = String(country || "").trim().toLowerCase();
  const countryCodeMap: Record<string, string> = {
    india: "91",
    "united states": "1",
    usa: "1",
    us: "1",
    canada: "1",
    australia: "61",
    "united kingdom": "44",
    uk: "44",
    england: "44",
    uae: "971",
    "united arab emirates": "971",
    germany: "49",
    france: "33",
    singapore: "65",
    malaysia: "60",
    pakistan: "92",
    nepal: "977",
  };

  return countryCodeMap[normalizedCountry] || "91";
}

function normalizeLeadPhoneParts(
  phone?: string | null,
  fallbackCountryCode = "91",
  fallbackCountryIso2 = "in"
) {
  const digits = digitsOnly(phone);
  const fallbackCode = digitsOnly(fallbackCountryCode) || "91";
  const fallbackIso = String(fallbackCountryIso2 || "in").toLowerCase() || "in";

  if (!digits) {
    return {
      countryCode: fallbackCode,
      phoneNumber: "",
      fullPhoneNumber: "",
      countryCodeDisplay: `+${fallbackCode}`,
      countryIso2: fallbackIso,
    };
  }

  // If number already starts with selected country code, split it.
  if (digits.startsWith(fallbackCode) && digits.length > fallbackCode.length) {
    return {
      countryCode: fallbackCode,
      phoneNumber: digits.slice(fallbackCode.length),
      fullPhoneNumber: digits,
      countryCodeDisplay: `+${fallbackCode}`,
      countryIso2: fallbackIso,
    };
  }

  // Treat normal local mobile numbers as local first. Otherwise numbers like
  // 90xxxxxxxx can be incorrectly parsed as Turkey (+90) instead of India.
  if (digits.length <= 10) {
    return {
      countryCode: fallbackCode,
      phoneNumber: digits,
      fullPhoneNumber: `${fallbackCode}${digits}`,
      countryCodeDisplay: `+${fallbackCode}`,
      countryIso2: fallbackIso,
    };
  }

  try {
    const parsed = parsePhoneNumberFromString(`+${digits}`);

    if (parsed?.countryCallingCode && parsed?.nationalNumber) {
      return {
        countryCode: parsed.countryCallingCode,
        phoneNumber: parsed.nationalNumber,
        fullPhoneNumber: digits,
        countryCodeDisplay: `+${parsed.countryCallingCode}`,
        countryIso2: parsed.country?.toLowerCase() || fallbackIso,
      };
    }
  } catch {
    // Ignore parse issues and use fallback country.
  }

  // Otherwise treat digits as local number and prefix selected country code.
  return {
    countryCode: fallbackCode,
    phoneNumber: digits,
    fullPhoneNumber: `${fallbackCode}${digits}`,
    countryCodeDisplay: `+${fallbackCode}`,
    countryIso2: fallbackIso,
  };
}

function getLeadPrimaryPhone(lead: Lead | null) {
  if (!lead) return "";
  const rawLead = lead as any;
  return (
    rawLead.contact_no ??
    rawLead.full_phone_number ??
    rawLead.phone_number ??
    rawLead.mobile ??
    rawLead.phone ??
    ""
  );
}

function getLeadAlternatePhone(lead: Lead | null) {
  if (!lead) return "";
  const rawLead = lead as any;
  return (
    rawLead.contact_no1 ??
    rawLead.alt_full_phone_number ??
    rawLead.alt_phone_number ??
    rawLead.alternate_contact_no ??
    rawLead.alternate_phone ??
    ""
  );
}

function getCountryIso2(phone?: string | null, fallbackCountry?: string | null) {
  const raw = String(phone || "").trim();

  try {
    if (raw) {
      const digits = digitsOnly(raw);
      const parsed = parsePhoneNumberFromString(
        raw.startsWith("+") ? raw : digits.length > 10 ? `+${digits}` : raw
      );
      if (parsed?.country) return parsed.country.toLowerCase();
    }
  } catch {
    // Ignore parse issues and fall back to country text.
  }

  const normalizedCountry = String(fallbackCountry || "").trim().toLowerCase();
  const countryMap: Record<string, string> = {
    india: "in",
    "united states": "us",
    usa: "us",
    canada: "ca",
    australia: "au",
    "united kingdom": "gb",
    uk: "gb",
    england: "gb",
    uae: "ae",
    "united arab emirates": "ae",
    germany: "de",
    france: "fr",
    singapore: "sg",
    malaysia: "my",
    pakistan: "pk",
    nepal: "np",
  };

  return countryMap[normalizedCountry] || "";
}

function flagFromIso2(iso2?: string | null) {
  const code = String(iso2 || "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return null;
  return String.fromCodePoint(
    ...code.split("").map((char) => 127397 + char.charCodeAt(0))
  );
}

function parseDescString(desc: any): DescItem[] {
  if (!desc) return [];
  if (Array.isArray(desc)) return desc;

  if (typeof desc === "string") {
    try {
      const parsed = JSON.parse(desc);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [{ name: "system", description: desc }];
    }
  }
  return [];
}

function safeHex(c?: string | null) {
  if (!c) return undefined;
  const s = String(c).trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s)) return s;
  return undefined;
}

function isConversionStatusName(name?: string | null) {
  const normalized = String(name || "").trim().toLowerCase();
  return normalized.includes("convert") || normalized === "won";
}

function hexToRgba(hex: string, alpha = 0.1) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((x) => x + x).join("") : h;
  const num = parseInt(full, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function pageNumbers(current: number, total: number) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const out: (number | "...")[] = [];
  const left = Math.max(1, current - 1);
  const right = Math.min(total, current + 1);

  out.push(1);
  if (left > 2) out.push("...");

  for (let p = left; p <= right; p++) {
    if (p !== 1 && p !== total) out.push(p);
  }

  if (right < total - 1) out.push("...");
  out.push(total);

  return out.filter((v, i) => out.indexOf(v) === i);
}

// UI Bits (GLOBAL)
function StatusBadge({ statusId }: { statusId: number | null }) {
  const { statuses } = useStatuses();
  const status = statuses.find((s) => s.id === statusId);
  const color = safeHex(status?.color ?? undefined) || "#94a3b8";

  return (
    <span
      className={cn(
        "inline-flex items-center px-3 py-1 text-xs font-semibold border rounded-full"
      )}
      style={{
        backgroundColor: hexToRgba(color, 0.12),
        borderColor: color,
        color: color,
      }}
    >
      <span
        className="w-2 h-2 rounded-full mr-2"
        style={{ backgroundColor: color }}
      />
      {status?.name || "Unassigned"}
    </span>
  );
}

function SourceBadge({ sourceId }: { sourceId: number | null }) {
  const { sources } = useSources();

  if (sourceId == null) {
    return (
      <span className="inline-flex items-center px-3 py-1 text-xs font-semibold border rounded-full bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700">
        <Circle className="w-2 h-2 mr-2" />
        Unassigned
      </span>
    );
  }

  const source = sources.find((s) => s.id === sourceId);

  return (
    <span className="inline-flex items-center px-3 py-1 text-xs font-semibold border rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800">
      <Circle className="w-2 h-2 mr-2" />
      {source?.name || "Unknown"}
    </span>
  );
}

function AgentDisplay({
  agentId,
  agentObj,
}: {
  agentId: number | null;
  agentObj?: MiniUser | null;
}) {
  const { agents } = useAgents();

  const agent: any =
    agentObj || agents.find((a: any) => a.id === agentId) || null;

  if (!agentId && !agent) {
    return (
      <div className="flex items-center text-slate-500 text-xs">
        <Users size={14} className="mr-2" />
        Unassigned
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex items-center text-slate-700 text-xs font-semibold">
        <Users size={14} className="mr-2" />
        ID: {agentId}
      </div>
    );
  }

  return (
    <div className="flex items-center text-xs">
      <div className="w-7 h-7 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-xs font-semibold mr-2 text-slate-800 dark:text-slate-200">
        {agent.name?.[0]?.toUpperCase() || "A"}
      </div>
      <span className="font-semibold text-slate-900 dark:text-slate-200">
        {agent.name || agent.email}
      </span>
    </div>
  );
}

function ChangedByDisplay({
  changedById,
  changedByObj,
}: {
  changedById: number | null;
  changedByObj?: MiniUser | null;
}) {
  const admin = changedByObj || null;

  if (!changedById && !admin) {
    return <div className="text-slate-500 text-xs">—</div>;
  }

  if (!admin) {
    return (
      <div className="text-slate-700 text-xs font-semibold">
        ID: {changedById}
      </div>
    );
  }

  return (
    <div className="flex items-center text-xs">
      <div className="w-7 h-7 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-xs font-semibold mr-2 text-slate-800 dark:text-slate-200">
        {admin.name?.[0]?.toUpperCase() || "A"}
      </div>
      <span className="font-semibold text-slate-900 dark:text-slate-200">
        {admin.name || admin.email}
      </span>
    </div>
  );
}

// Delete Modal (GLOBAL)
function DeleteLeadModal({
  open,
  lead,
  loading,
  onClose,
  onConfirm,
}: {
  open: boolean;
  lead: Lead | null;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open || !lead) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px]"
        onClick={loading ? undefined : onClose}
      />

      <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-6">
        <div className="w-full max-w-md rounded-md border border-slate-200 bg-white shadow-[0_25px_80px_-30px_rgba(0,0,0,0.35)] overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-start justify-between gap-3">
            <div>
              <div className="text-lg font-extrabold text-slate-900">
                Delete Lead
              </div>
              <div className="text-xs text-slate-600 mt-1">
                This action cannot be undone.
              </div>
            </div>

            <button
              onClick={onClose}
              disabled={loading}
              className="h-10 w-10 rounded-md border border-slate-200 bg-white hover:bg-slate-50 grid place-items-center disabled:opacity-60"
              type="button"
            >
              <X size={16} />
            </button>
          </div>

          <div className="p-5">
            <div className="rounded-md border border-slate-200 bg-white p-4">
              <div className="text-xs font-bold text-slate-600">Lead</div>
              <div className="mt-1 font-extrabold text-slate-900">
                {lead.name || "—"}
              </div>
              <div className="mt-1 text-xs text-slate-600">
                {formatPhone(lead.contact_no)}
              </div>
              {lead.email ? (
                <div className="text-xs text-slate-600">{lead.email}</div>
              ) : null}
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2.5 rounded-md border border-slate-200 text-xs font-bold hover:bg-slate-50 disabled:opacity-60"
                type="button"
              >
                Cancel
              </button>

              <button
                onClick={onConfirm}
                disabled={loading}
                className="px-5 py-2.5 rounded-md text-xs font-extrabold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 inline-flex items-center gap-2"
                type="button"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 size={16} />
                )}
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConversionCongratsModal({
  open,
  name,
  context,
  onClose,
}: {
  open: boolean;
  name?: string | null;
  context?: string | null;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden">
      <style>{`
        @keyframes crm-sparkle-float {
          0% { transform: translate3d(0, 28px, 0) scale(0.75) rotate(0deg); opacity: 0; }
          18% { opacity: 1; }
          100% { transform: translate3d(var(--spark-x), -92vh, 0) scale(1.2) rotate(260deg); opacity: 0; }
        }
        @keyframes crm-pop-in {
          0% { transform: translateY(18px) scale(0.94); opacity: 0; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes crm-pulse-ring {
          0%, 100% { transform: scale(1); opacity: 0.62; }
          50% { transform: scale(1.16); opacity: 0.18; }
        }
        @keyframes crm-shine {
          0% { transform: translateX(-130%) rotate(18deg); opacity: 0; }
          28% { opacity: 0.45; }
          100% { transform: translateX(150%) rotate(18deg); opacity: 0; }
        }
        @keyframes crm-badge-bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
      `}</style>
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-md" onClick={onClose} />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_25%,rgba(16,185,129,0.28),transparent_32%),radial-gradient(circle_at_18%_70%,rgba(251,191,36,0.18),transparent_26%),radial-gradient(circle_at_82%_72%,rgba(56,189,248,0.18),transparent_28%)]" />
      <div className="pointer-events-none absolute inset-0">
        {Array.from({ length: 34 }).map((_, index) => (
          <span
            key={index}
            className="absolute rounded-full shadow-[0_0_18px_rgba(251,191,36,0.85)]"
            style={{
              width: `${5 + (index % 3) * 2}px`,
              height: `${5 + (index % 4)}px`,
              borderRadius: index % 4 === 0 ? "2px" : "999px",
              backgroundColor: ["#fbbf24", "#34d399", "#38bdf8", "#f472b6"][index % 4],
              left: `${(index * 37) % 100}%`,
              bottom: index < 14 ? `${8 + (index * 7) % 78}%` : `${-8 - (index % 5) * 7}%`,
              opacity: index < 14 ? 0.9 : undefined,
              animation: `crm-sparkle-float ${3.6 + (index % 6) * 0.35}s linear ${index < 14 ? -index * 0.22 : index * 0.08}s infinite`,
              ["--spark-x" as any]: `${index % 2 === 0 ? "" : "-"}${18 + (index % 7) * 9}px`,
            }}
          />
        ))}
      </div>
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className="relative w-full max-w-[520px] overflow-hidden rounded-md border border-white/50 bg-white shadow-[0_34px_120px_rgba(0,0,0,0.45)]"
          role="dialog"
          aria-modal="true"
          style={{ animation: "crm-pop-in 260ms ease-out" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-amber-400 via-emerald-400 to-sky-400" />
          <div className="pointer-events-none absolute -left-16 top-0 h-full w-24 bg-white/60 blur-sm" style={{ animation: "crm-shine 2.8s ease-in-out infinite" }} />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-full border border-white/70 bg-white/80 text-slate-500 shadow-sm transition hover:bg-white hover:text-slate-900"
            aria-label="Close congratulations modal"
          >
            <X size={16} />
          </button>
          <div className="relative overflow-hidden bg-[linear-gradient(135deg,#ecfdf5_0%,#ffffff_48%,#fffbeb_100%)] px-7 pb-7 pt-10 text-center">
            <div className="absolute -left-16 -top-16 h-36 w-36 rounded-full bg-emerald-200/45 blur-2xl" />
            <div className="absolute -right-12 top-24 h-32 w-32 rounded-full bg-amber-200/45 blur-2xl" />
            <div className="absolute left-8 top-8 text-2xl font-black text-amber-400">+</div>
            <div className="absolute right-12 top-16 text-xl font-black text-emerald-400">+</div>
            <div className="absolute bottom-10 left-12 text-lg font-black text-sky-400">+</div>
            <div className="absolute bottom-16 right-9 h-2 w-8 rotate-12 rounded-full bg-pink-300/80" />
            <div className="relative mx-auto grid h-24 w-24 place-items-center">
              <div
                className="absolute inset-0 rounded-full bg-emerald-300"
                style={{ animation: "crm-pulse-ring 1.8s ease-in-out infinite" }}
              />
              <div className="absolute inset-2 rounded-full border border-emerald-200 bg-white" />
              <div
                className="relative grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-emerald-500 via-teal-600 to-teal-800 text-white shadow-[0_18px_42px_rgba(16,185,129,0.48)] ring-8 ring-white"
                style={{ animation: "crm-badge-bob 2.4s ease-in-out infinite" }}
              >
                <CheckCircle2 size={42} />
              </div>
            </div>
            <div className="mx-auto mt-6 inline-flex rounded-full border border-emerald-200 bg-white/90 px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.22em] text-emerald-700 shadow-[0_8px_22px_rgba(16,185,129,0.12)]">
              Lead Converted
            </div>
            <h3 className="mt-4 text-[28px] font-black leading-tight text-slate-950 sm:text-4xl">
              Congratulations, you did it!
            </h3>
            <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-slate-600">
              {name ? `${name}, ` : ""}you converted {context || "this lead"}.
              This one is a win. Keep the momentum going.
            </p>
      
          </div>
          <div className="border-t border-slate-100 bg-gradient-to-b from-white to-slate-50 px-7 py-5">
            <button
              type="button"
              onClick={onClose}
              className="h-12 w-full rounded-md bg-gradient-to-r from-emerald-600 via-teal-600 to-teal-800 px-4 text-sm font-extrabold text-white shadow-[0_14px_28px_rgba(15,118,110,0.26)] transition hover:translate-y-[-1px] hover:from-emerald-700 hover:to-teal-900"
            >
              Celebrate
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CallStatusModal({
  open,
  lead,
  value,
  description,
  saving,
  onValueChange,
  onDescriptionChange,
  onClose,
  onConfirm,
  locked = false,
}: {
  open: boolean;
  lead: Lead | null;
  value: string;
  description: string;
  saving: boolean;
  onValueChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  locked?: boolean;
}) {
  if (!open || !lead) return null;

  return (
    <div className="fixed inset-0 z-50" data-call-modal="true">
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px]"
        onClick={saving || locked ? undefined : onClose}
      />

      <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-6">
        <div className="w-full max-w-md rounded-md border border-slate-200 bg-white shadow-[0_25px_80px_-30px_rgba(0,0,0,0.35)] overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-start justify-between gap-3">
            <div>
              <div className="text-lg font-extrabold text-slate-900">
                Update Call Status
              </div>
              <div className="text-xs text-slate-600 mt-1">{lead.name || "Lead"}</div>
            </div>

            <button
              onClick={onClose}
              disabled={saving || locked}
              className="h-10 w-10 rounded-md border border-slate-200 bg-white hover:bg-slate-50 grid place-items-center disabled:opacity-60"
              type="button"
            >
              <X size={16} />
            </button>
          </div>

          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Call
              </label>
              <select
                value={value}
                onChange={(e) => onValueChange(e.target.value)}
                disabled={saving}
                className="w-full h-10 border border-slate-200 bg-white px-3 text-sm rounded-md outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-60"
              >
                <option value="">Select call status</option>
                {CALL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Call Description
              </label>
              <textarea
                value={description}
                onChange={(e) => onDescriptionChange(e.target.value)}
                disabled={saving}
                className="w-full border border-slate-200 bg-white px-3 py-2 text-sm rounded-md outline-none focus:ring-2 focus:ring-slate-300 resize-none h-16 disabled:opacity-60"
                placeholder={`Write why call is ${value || "selected"}...`}
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={onClose}
                disabled={saving || locked}
                className="px-4 py-2.5 rounded-md border border-slate-200 text-xs font-bold hover:bg-slate-50 disabled:opacity-60"
                type="button"
              >
                Cancel
              </button>

              <button
                onClick={onConfirm}
                disabled={saving}
                className="px-5 py-2.5 rounded-md text-xs font-extrabold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-60 inline-flex items-center gap-2"
                type="button"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  rightText,
  icon,
  children,
}: {
  title: string;
  rightText?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-slate-700">{icon}</span>
          <h3 className="text-xs font-black text-slate-900">{title}</h3>
        </div>
        {rightText ? (
          <span className="text-[11px] text-slate-500">{rightText}</span>
        ) : null}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// Edit Modal (GLOBAL)
function EditLeadModal({
  open,
  lead,
  onClose,
  onSave,
  currentUserId,
  currentUserName,
}: {
  open: boolean;
  lead: Lead | null;
  onClose: () => void;
  currentUserId: number | null;
  currentUserName?: string | null;
  onSave: (
    payload: Partial<Lead> & {
      description: string;
      agent_id: number | null;
      status_id: number | null;
      source_id?: number | null;
      changed_by?: number | null;
      call_status?: string | null;
      country_code?: string;
      phone_number?: string;
      full_phone_number?: string;
      alt_country_code?: string;
      alt_phone_number?: string;
      alt_full_phone_number?: string;
    }
  ) => Promise<void>;
}) {
  const { statuses } = useStatuses();
  const { agents } = useAgents();
  const { sources } = useSources();

  const [form, setForm] = useState({
    name: "",
    email: "",
    contact_no: "",
    contact_no1: "",
    contact_no_full: "",
    contact_no1_full: "",
    country_code: "91",
    alt_country_code: "91",
    phone_country: "in",
    alt_phone_country: "in",
    call_status: "",
    call_description: "",
    address: "",
    city: "",
    state: "",
    country: "India",
    pincode: "",
    changed_by: "",
    case_type: "",
    source_id: null as number | null,
    is_active: true,
  });

  const [newNote, setNewNote] = useState("");
  const [agentId, setAgentId] = useState<number | null>(null);
  const [statusId, setStatusId] = useState<number | null>(null);
  const [sourceId, setSourceId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !lead) return;

    setNewNote("");

    const leadCountryCode = getFallbackCountryCode(lead.country);
    const leadCountryIso2 =
      getCountryIso2(getLeadPrimaryPhone(lead), lead.country) || "in";

    const primaryPhone = normalizeLeadPhoneParts(
      getLeadPrimaryPhone(lead),
      leadCountryCode,
      leadCountryIso2
    );

    const alternatePhone = normalizeLeadPhoneParts(
      getLeadAlternatePhone(lead),
      leadCountryCode,
      leadCountryIso2
    );

    setForm({
      name: lead.name ?? "",
      email: lead.email ?? "",
      contact_no: primaryPhone.phoneNumber,
      contact_no1: alternatePhone.phoneNumber,
      contact_no_full: primaryPhone.fullPhoneNumber,
      contact_no1_full: alternatePhone.fullPhoneNumber,
      country_code: primaryPhone.countryCode,
      alt_country_code: alternatePhone.countryCode,
      phone_country: primaryPhone.countryIso2,
      alt_phone_country: alternatePhone.countryIso2,
      call_status: normalizeCallStatus(lead.call_status),
      call_description: getCallDescription(lead.call_status),
      address: lead.address ?? "",
      city: lead.city ?? "",
      state: lead.state ?? "",
      changed_by: (lead.changed_by as any) ?? "",
      country: lead.country ?? "India",
      pincode: lead.pincode ?? "",
      case_type: lead.case_type ?? "",
      source_id: (lead.source_id ?? null) as any,
      is_active: Boolean(lead.is_active),
    });

    setAgentId((lead.agent_id ?? lead.assign_to) ?? null);
    setStatusId(lead.status_id ?? null);
    setSourceId(lead.source_id ?? null);
  }, [
    open,
    lead?.id,
    lead?.contact_no,
    lead?.contact_no1,
    lead?.country,
    (lead as any)?.full_phone_number,
    (lead as any)?.phone_number,
    (lead as any)?.alt_full_phone_number,
    (lead as any)?.alt_phone_number,
  ]);

  if (!open || !lead) return null;

  const history = parseDescString(lead.description);
  const selectedStatus = statuses.find((s) => s.id === statusId);
  const selectedHex = safeHex(selectedStatus?.color ?? undefined);

  const setField = (key: keyof typeof form, value: any) => {
    setForm((p) => ({ ...p, [key]: value }));
  };

  const handleSave = async () => {
    if (saving) return;

    let updatedDesc = history;

    if (newNote.trim()) {
      updatedDesc = [
        ...history,
        {
          name: currentUserName || "User",
          description: newNote.trim(),
          createdAt: new Date().toISOString(),
        },
      ];
    }

    if (form.call_status && !form.call_description.trim()) {
      toast.error("Please enter call description");
      return;
    }

    const primaryPhone = normalizeLeadPhoneParts(
      `${form.country_code}${form.contact_no}`,
      form.country_code,
      form.phone_country
    );

    const alternatePhone = normalizeLeadPhoneParts(
      `${form.alt_country_code}${form.contact_no1}`,
      form.alt_country_code,
      form.alt_phone_country
    );

    const alternateRawDigits = digitsOnly(form.contact_no1);
    const hasValidAlternatePhone = alternateRawDigits.length >= 8;

    try {
      setSaving(true);

      await onSave({
        name: form.name.trim(),
        email: form.email.trim(),

        contact_no: primaryPhone.fullPhoneNumber,
        contact_no1: hasValidAlternatePhone
          ? alternatePhone.fullPhoneNumber || undefined
          : undefined,

        country_code: primaryPhone.countryCodeDisplay,
        phone_number: primaryPhone.phoneNumber,
        full_phone_number: primaryPhone.fullPhoneNumber
          ? `+${primaryPhone.fullPhoneNumber}`
          : "",

        alt_country_code: hasValidAlternatePhone
          ? alternatePhone.countryCodeDisplay
          : undefined,
        alt_phone_number: hasValidAlternatePhone
          ? alternatePhone.phoneNumber
          : undefined,
        alt_full_phone_number:
          hasValidAlternatePhone && alternatePhone.fullPhoneNumber
            ? `+${alternatePhone.fullPhoneNumber}`
            : undefined,

        call_status:
          composeCallStatus(form.call_status, form.call_description) || undefined,

        address: form.address.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        country: form.country.trim(),
        pincode: form.pincode.trim(),
        case_type: form.case_type.trim(),
        is_active: form.is_active,
        changed_by: currentUserId,
        agent_id: agentId,
        source_id: sourceId,
        status_id: statusId,
        description: JSON.stringify(updatedDesc),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={saving ? undefined : onClose}
      />

      <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-6">
        <div
          className="relative w-full max-w-6xl max-h-[92vh] overflow-hidden bg-white border border-slate-200 shadow-xl flex flex-col rounded-md"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="shrink-0 bg-gradient-to-b from-slate-50 to-white">
            <div className="px-5 py-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <div
                    className="h-11 w-11 rounded-xl grid place-items-center bg-white"
                    style={
                      selectedHex
                        ? {
                            boxShadow: `0 0 0 5px ${hexToRgba(
                              selectedHex,
                              0.12
                            )}`,
                          }
                        : undefined
                    }
                  >
                    <User className="w-5 h-5 text-slate-800" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg sm:text-xl font-black tracking-tight text-slate-950">
                        Edit Lead
                      </h2>

                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold border"
                        style={{
                          background: selectedHex
                            ? hexToRgba(selectedHex, 0.12)
                            : "rgba(2,6,23,.06)",
                          borderColor: selectedHex
                            ? hexToRgba(selectedHex, 0.25)
                            : "rgba(2,6,23,.10)",
                          color: selectedHex || "#0f172a",
                        }}
                      >
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ background: selectedHex || "#0f172a" }}
                        />
                        {selectedStatus?.name || "No Status"}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-600">
                      <span className="font-semibold truncate">
                        {form.name || "—"}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="truncate">{form.email || "—"}</span>
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={onClose}
                disabled={saving}
                className="h-10 w-10 rounded-md border border-slate-200 bg-white hover:bg-slate-50 grid place-items-center disabled:opacity-60"
                type="button"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div
              className="h-1 w-full"
              style={{ background: selectedHex || "#0f172a" }}
            />
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="p-4 sm:p-5">
              <div className="grid grid-cols-12 gap-5">
                <div className="col-span-12 lg:col-span-7">
                  <div className="border border-slate-200 rounded-md bg-white">
                    <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                      <div className="text-md font-bold text-slate-900">
                        <span className="flex gap-2">
                          <FileText className="w-5 h-5" /> Lead Information
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Update details
                      </div>
                    </div>

                    <div className="p-4">
                      <div className="grid grid-cols-12 gap-4">
                        <Field label="Name" className="col-span-12 md:col-span-6">
                          <input
                            value={form.name}
                            onChange={(e) => setField("name", e.target.value)}
                            className="w-full h-10 border border-slate-200 bg-white px-3 text-sm rounded-md outline-none focus:ring-2 focus:ring-slate-300"
                            placeholder="Lead name"
                          />
                        </Field>

                        <Field label="Email" className="col-span-12 md:col-span-6">
                          <input
                            value={form.email}
                            onChange={(e) => setField("email", e.target.value)}
                            className="w-full h-10 border border-slate-200 bg-white px-3 text-sm rounded-md outline-none focus:ring-2 focus:ring-slate-300"
                            placeholder="Lead email"
                          />
                        </Field>

                        <Field
                          label="Contact No"
                          className="col-span-12 md:col-span-6"
                        >
                          <div className="grid grid-cols-[118px_1fr] ">
                            <PhoneInput
                              country={form.phone_country || "in"}
                              value={form.country_code}
                              onChange={(_, country: any) => {
                                const countryCode = digitsOnly(country?.dialCode || "");
                                const phoneCountry = String(
                                  country?.countryCode || form.phone_country || "in"
                                ).toLowerCase();
                                setForm((p) => ({
                                  ...p,
                                  country_code: countryCode,
                                  contact_no: clampPhoneNumberToCountry(
                                    countryCode,
                                    p.contact_no,
                                    phoneCountry
                                  ),
                                  contact_no_full: `${countryCode}${clampPhoneNumberToCountry(
                                    countryCode,
                                    p.contact_no,
                                    phoneCountry
                                  )}`,
                                  phone_country: phoneCountry,
                                  country: country?.name || p.country,
                                }));
                              }}
                              enableSearch
                              countryCodeEditable={false}
                              inputProps={{ readOnly: true }}
                              inputStyle={{
                                width: "90%",
                                height: "40px",
                                borderRadius: "6px",
                                border: "1px solid #e2e8f0",
                                fontSize: "14px",
                                cursor: "pointer",
                                background: "#fff",
                              }}
                              buttonStyle={{
                                borderTopLeftRadius: "6px",
                                borderBottomLeftRadius: "6px",
                                border: "1px solid #e2e8f0",
                                background: "#fff",
                              }}
                              containerStyle={{ width: "100%" }}
                              dropdownStyle={{ width: "300px" }}
                            />
                            <input
                              value={form.contact_no}
                              onChange={(e) => {
                                const contactNo = digitsOnly(e.target.value);
                                if (
                                  isPhoneTooLong(
                                    form.country_code,
                                    contactNo,
                                    form.phone_country
                                  )
                                ) {
                                  return;
                                }
                                setForm((p) => ({
                                  ...p,
                                  contact_no: contactNo,
                                  contact_no_full: `${p.country_code}${contactNo}`,
                                }));
                              }}
                              className="w-full h-10 border border-slate-200 bg-white px-3 text-sm rounded-md outline-none focus:ring-2 focus:ring-slate-300"
                              placeholder="Contact number"
                              inputMode="numeric"
                            />
                          </div>
                        </Field>

                        <Field
                          label="Alt Contact No"
                          className="col-span-12 md:col-span-6"
                        >
                          <div className="grid grid-cols-[118px_1fr] gap-2">
                            <PhoneInput
                              country={form.alt_phone_country || "in"}
                              value={form.alt_country_code}
                              onChange={(_, country: any) => {
                                const countryCode = digitsOnly(country?.dialCode || "");
                                const phoneCountry = String(
                                  country?.countryCode || form.alt_phone_country || "in"
                                ).toLowerCase();
                                setForm((p) => ({
                                  ...p,
                                  alt_country_code: countryCode,
                                  contact_no1: clampPhoneNumberToCountry(
                                    countryCode,
                                    p.contact_no1,
                                    phoneCountry
                                  ),
                                  contact_no1_full: `${countryCode}${clampPhoneNumberToCountry(
                                    countryCode,
                                    p.contact_no1,
                                    phoneCountry
                                  )}`,
                                  alt_phone_country: phoneCountry,
                                }));
                              }}
                              enableSearch
                              countryCodeEditable={false}
                              inputProps={{ readOnly: true }}
                              inputStyle={{
                                width: "100%",
                                height: "40px",
                                borderRadius: "6px",
                                border: "1px solid #e2e8f0",
                                fontSize: "14px",
                                cursor: "pointer",
                                background: "#fff",
                              }}
                              buttonStyle={{
                                borderTopLeftRadius: "6px",
                                borderBottomLeftRadius: "6px",
                                border: "1px solid #e2e8f0",
                                background: "#fff",
                              }}
                              containerStyle={{ width: "100%" }}
                              dropdownStyle={{ width: "300px" }}
                            />
                            <input
                              value={form.contact_no1}
                              onChange={(e) => {
                                const contactNo = digitsOnly(e.target.value);
                                if (
                                  isPhoneTooLong(
                                    form.alt_country_code,
                                    contactNo,
                                    form.alt_phone_country
                                  )
                                ) {
                                  return;
                                }
                                setForm((p) => ({
                                  ...p,
                                  contact_no1: contactNo,
                                  contact_no1_full: `${p.alt_country_code}${contactNo}`,
                                }));
                              }}
                              className="w-full h-10 border border-slate-200 bg-white px-3 text-sm rounded-md outline-none focus:ring-2 focus:ring-slate-300"
                              placeholder="Optional"
                              inputMode="numeric"
                            />
                          </div>
                        </Field>

                        <Field
                          label="Case Type"
                          className="col-span-12 md:col-span-3"
                        >
                          <input
                            value={form.case_type || ""}
                            onChange={(e) =>
                              setField("case_type", e.target.value)
                            }
                            className="w-full h-10 border border-slate-200 bg-white px-3 text-sm rounded-md outline-none focus:ring-2 focus:ring-slate-300"
                            placeholder="e.g. Matrimonial"
                          />
                        </Field>

                        <Field label="City" className="col-span-12 md:col-span-3">
                          <input
                            value={form.city}
                            onChange={(e) => setField("city", e.target.value)}
                            className="w-full h-10 border border-slate-200 bg-white px-3 text-sm rounded-md outline-none focus:ring-2 focus:ring-slate-300"
                            placeholder="City"
                          />
                        </Field>

                        <Field label="State" className="col-span-12 md:col-span-3">
                          <input
                            value={form.state}
                            onChange={(e) => setField("state", e.target.value)}
                            className="w-full h-10 border border-slate-200 bg-white px-3 text-sm rounded-md outline-none focus:ring-2 focus:ring-slate-300"
                            placeholder="State"
                          />
                        </Field>

                        <Field
                          label="Pincode"
                          className="col-span-12 md:col-span-3"
                        >
                          <input
                            value={form.pincode}
                            onChange={(e) => setField("pincode", e.target.value)}
                            className="w-full h-10 border border-slate-200 bg-white px-3 text-sm rounded-md outline-none focus:ring-2 focus:ring-slate-300"
                            placeholder="Pincode"
                          />
                        </Field>

                        <Field
                          label="Assign To"
                          className="col-span-12 md:col-span-3"
                        >
                          <select
                            value={agentId ?? ""}
                            onChange={(e) =>
                              setAgentId(
                                e.target.value ? Number(e.target.value) : null
                              )
                            }
                            className="w-full h-10 border border-slate-200 bg-white px-3 text-sm rounded-md outline-none focus:ring-2 focus:ring-slate-300"
                          >
                            <option value="">Select agent</option>
                            {agents.map((a: any) => (
                              <option key={a.id} value={a.id}>
                                {a.name || a.email}
                              </option>
                            ))}
                          </select>
                        </Field>

                        <Field
                          label="Lead Status"
                          className="col-span-12 md:col-span-3"
                        >
                          <select
                            value={statusId ?? ""}
                            onChange={(e) =>
                              setStatusId(
                                e.target.value ? Number(e.target.value) : null
                              )
                            }
                            className="w-full h-10 border border-slate-200 bg-white px-3 text-sm rounded-md outline-none focus:ring-2 focus:ring-slate-300"
                          >
                            <option value="">Select status</option>
                            {statuses.map((s: any) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </Field>

                        <Field
                          label="Lead Source"
                          className="col-span-12 md:col-span-3"
                        >
                          <select
                            value={sourceId ?? ""}
                            onChange={(e) =>
                              setSourceId(
                                e.target.value ? Number(e.target.value) : null
                              )
                            }
                            className="w-full h-10 border border-slate-200 bg-white px-3 text-sm rounded-md outline-none focus:ring-2 focus:ring-slate-300"
                          >
                            <option value="">Select source</option>
                            {sources.map((s: any) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </Field>

                        <Field label="Call" className="col-span-12 md:col-span-3">
                          <select
                            value={form.call_status}
                            onChange={(e) =>
                              setField("call_status", e.target.value)
                            }
                            className="w-full h-10 border border-slate-200 bg-white px-3 text-sm rounded-md outline-none focus:ring-2 focus:ring-slate-300"
                          >
                            <option value="">Select call</option>
                            {CALL_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </Field>

                        {form.call_status ? (
                          <div className="col-span-12">
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Call Description
                            </label>
                            <textarea
                              value={form.call_description}
                              onChange={(e) =>
                                setField("call_description", e.target.value)
                              }
                              className="w-full border border-slate-200 bg-white px-3 py-2 text-sm rounded-md outline-none focus:ring-2 focus:ring-slate-300 resize-none h-16"
                              placeholder={`Write why call is ${form.call_status}...`}
                            />
                            <p className="mt-2 text-xs text-slate-500">
                              Updated: {fmtDateTime(lead.updatedAt)}
                            </p>
                          </div>
                        ) : null}

                        <div className="col-span-12">
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Address
                          </label>
                          <textarea
                            value={form.address}
                            onChange={(e) => setField("address", e.target.value)}
                            className="w-full border border-slate-200 bg-white px-2 py-1.5 text-sm rounded-md outline-none focus:ring-2 focus:ring-slate-300 resize-none h-16"
                            placeholder="Full address"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-span-12 lg:col-span-5">
                  <SectionCard
                    title="Notes"
                    rightText={`${history.length} notes`}
                    icon={<ListChecks className="w-4 h-4" />}
                  >
                    <div className="max-h-[320px] overflow-y-auto pr-2">
                      {history.length === 0 ? (
                        <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-600">
                          No notes found
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {history.map((item, idx) => (
                            <div key={idx} className="relative">
                              <div className="rounded-md border border-slate-200 bg-white p-4 shadow-[0_12px_30px_-22px_rgba(2,6,23,.45)]">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="text-xs font-semibold text-slate-900 truncate">
                                      {item.name || "User"}
                                    </div>
                                  </div>
                                  <div className="text-[11px] text-slate-500 shrink-0">
                                    {item.createdAt
                                      ? new Date(item.createdAt).toLocaleString(
                                          "en-IN",
                                          {
                                            day: "2-digit",
                                            month: "short",
                                            year: "numeric",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                          }
                                        )
                                      : "—"}
                                  </div>
                                </div>
                                <p className="mt-2 text-md text-slate-700 whitespace-pre-wrap leading-relaxed">
                                  {item.description || "—"}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold text-slate-900">
                          Add New Note
                        </h4>
                        <span className="text-[11px] text-slate-500">
                          Internal only
                        </span>
                      </div>

                      <textarea
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        className="mt-3 w-full min-h-[130px] rounded-md border border-slate-200 bg-white px-3 py-2.5 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-slate-300"
                        placeholder="Write a note..."
                      />
                    </div>
                  </SectionCard>
                </div>
              </div>
            </div>
          </div>

          <div className="shrink-0 border-t border-slate-200 bg-white">
            <div className="px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
              <button
                onClick={onClose}
                disabled={saving}
                className="h-10 px-4 border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium rounded-md disabled:opacity-60"
                type="button"
              >
                Cancel
              </button>

              <button
                onClick={handleSave}
                disabled={saving}
                className="h-10 px-5 text-xs font-semibold text-white rounded-md hover:opacity-95 disabled:opacity-60 inline-flex items-center gap-2"
                style={{ backgroundColor: selectedHex || "#0f172a" }}
                type="button"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="block text-xs font-semibold text-slate-900 mb-1">{label}</label>
      {children}
    </div>
  );
}

// Leads Table
function LeadsTable({
  loading,
  pageRows,
  page,
  perPage,
  openRowId,
  highlightedLeadId,
  toggleRow,
  onEdit,
  onDelete,
  onCallChange,
  // onWhatsappChange,
  isAdmin,
  total,
}: {
  loading: boolean;
  pageRows: Lead[];
  page: number;
  perPage: number;
  openRowId: number | null;
  highlightedLeadId: number | null;
  toggleRow: (lead: Lead) => void;
  onEdit: (lead: Lead) => void;
  onDelete: (lead: Lead) => void;
  onCallChange: (lead: Lead, value: string) => Promise<void> | void;
  // onWhatsappChange: (lead: Lead, value: string) => Promise<void> | void;
  isAdmin: boolean;
  total: number;
}) {
  const navigate = useNavigate();
  const { statuses } = useStatuses();

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-full">
        <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800">
          <tr>
            <th className="px-2 py-4 text-left text-xs font-bold text-slate-700">S.No</th>
            <th className="px-2 py-4 text-left text-xs font-bold text-slate-700">Actions</th>
            <th className="px-6 py-4 text-left text-xs font-bold text-slate-700">Lead</th>
            <th className="hidden lg:table-cell px-4 py-4 text-left text-xs font-bold text-slate-700">Case Type</th>
            <th className="px-6 py-4 text-left text-xs font-bold text-slate-700">Contact</th>
            <th className="px-4 py-4 text-left text-xs font-bold text-slate-700">Call</th>
            <th className="hidden md:table-cell  py-4 text-left text-xs font-bold text-slate-700">Status</th>
            <th className="hidden xl:table-cell px-3 py-4 text-left text-xs font-bold text-slate-700">Source</th>
            <th className="hidden xl:table-cell px-6 py-4 text-left text-xs font-bold text-slate-700">Agent</th>
            {/* <th className="hidden xl:table-cell px-6 py-4 text-left text-xs font-bold text-slate-700">WhatsApp</th> */}
            <th className="hidden 2xl:table-cell px-6 py-4 text-left text-xs font-bold text-slate-700">Changed By</th>
            <th className="hidden 2xl:table-cell px-6 py-4 text-left text-xs font-bold text-slate-700">Timeline</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {loading ? (
            <tr>
              <td colSpan={11} className="px-6 py-14 text-center">
                <div className="flex flex-col items-center justify-center">
                  <Loader2 className="w-8 h-8 text-slate-700 animate-spin mb-3" />
                  <div className="text-slate-700">Loading leads...</div>
                </div>
              </td>
            </tr>
          ) : pageRows.length === 0 ? (
            <tr>
              <td colSpan={11} className="px-6 py-14 text-center">
                <div className="flex flex-col items-center justify-center">
                  <div className="w-16 h-16 border border-slate-200 dark:border-slate-700 rounded-full flex items-center justify-center mb-4 bg-white dark:bg-slate-800">
                    <Users className="w-8 h-8 text-slate-500" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">No leads found</h3>
                  <p className="text-slate-600 dark:text-slate-400">Try changing filters or search.</p>
                </div>
              </td>
            </tr>
          ) : (
            pageRows.map((r, idx) => {
              const open = openRowId === r.id;
              const highlighted = highlightedLeadId === r.id;
              const countryFlag = flagFromIso2(getCountryIso2(r.contact_no, r.country));
              const sno = total > 0 ? total - ((page - 1) * perPage + idx) : idx + 1;
              const hex = safeHex(statuses.find((d: any) => d.id === r.status_id)?.color);
              const rowStyle = hex ? { backgroundColor: hexToRgba(hex, 0.08) } : undefined;
              const callStatus = normalizeCallStatus(r.call_status);

              return (
                <React.Fragment key={r.id}>
                  <tr
                    id={`lead-row-${r.id}`}
                    data-open-lead-row={r.id}
                    style={rowStyle}
                    className={cn(
                      "transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/60",
                      open ? "bg-slate-50/80 dark:bg-slate-800/80" : "bg-white dark:bg-[#1E293B]",
                      highlighted ? "outline outline-2 outline-blue-500 outline-offset-[-2px]" : ""
                    )}
                  >
                    <td className="px-6 py-4 text-slate-700 dark:text-slate-300 font-semibold">{sno}</td>

                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleRow(r)}
                          data-eye-toggle={r.id}
                          className={cn(
                            "p-2 rounded-md border transition shadow-sm",
                            open
                              ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border-slate-200 dark:border-slate-700"
                              : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700"
                          )}
                          title="Quick details"
                          type="button"
                        >
                          {open ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>

                        <button
                          onClick={() => onEdit(r)}
                          className="p-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-lime-700 dark:text-lime-400 hover:bg-lime-50 dark:hover:bg-lime-950/40 transition shadow-2xs"
                          title="Edit lead"
                          type="button"
                        >
                          <Pencil size={18} />
                        </button>

                        {isAdmin && (
                          <button
                            onClick={() => onDelete(r)}
                            className="p-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition shadow-2xs"
                            title="Delete lead"
                            type="button"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900 dark:text-white">{r.name || "-"}</div>
                      <div className="text-xs text-slate-600 dark:text-slate-400">{r.email || "-"}</div>
                    </td>

                    <td className="hidden lg:table-cell px-4 py-4">
                      <div className="max-w-[180px] truncate text-sm font-semibold text-slate-800 dark:text-slate-200">
                        {r.case_type || "-"}
                      </div>
                    </td>

                    <td className="px-4 md:px-6 py-4">
                      <div className="space-y-1 min-w-[170px]">
                        <div
                          onClick={() => navigate(`/lead-history/${r.id}`)}
                          className="flex items-center gap-2 text-slate-800 dark:text-slate-200 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
                        >
                          <Phone size={14} className="text-slate-500" />
                          {countryFlag ? <span className="text-base leading-none">{countryFlag}</span> : null}
                          <span className="text-sm font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                            {maskPhone(r.contact_no)}
                          </span>
                        </div>
                        {r.contact_no1 && (
                          <div className="flex items-center gap-2 text-slate-600 text-xs">
                            <Phone size={12} className="text-slate-400" />
                            <span>{maskPhone(r.contact_no1)}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="px-4 md:px-2 py-4">
                      <div className="space-y-1 min-w-[180px]">
                        <select
                          value={normalizeCallStatus(r.call_status)}
                          onChange={(e) => onCallChange(r, e.target.value)}
                          className={cn(
                            "min-w-[100px] rounded-md border px-3 py-2 text-sm font-semibold outline-none transition",
                            normalizeCallStatus(r.call_status) === "yes"
                              ? "border-emerald-200 dark:border-emerald-800/80 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                              : normalizeCallStatus(r.call_status) === "no"
                              ? "border-rose-200 dark:border-rose-800/80 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300"
                              : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                          )}
                        >
                          <option value="">Select</option>
                          {CALL_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>

                    <td className="hidden md:table-cell  py-4">
                      <StatusBadge statusId={r.status_id} />
                    </td>

                    <td className="hidden xl:table-cell px-3 py-4">
                      <SourceBadge sourceId={r.source_id} />
                    </td>

                    <td className="hidden xl:table-cell px-6 py-4">
                      <AgentDisplay
                        agentId={(r.agent_id ?? r.assign_to) ?? null}
                        agentObj={(r as any).assignedAgent ?? (r as any).assignedTo ?? null}
                      />
                    </td>

                    {/* <td className="hidden xl:table-cell px-6 py-4">
                      <div className="space-y-1 min-w-[170px]">
                        <select
                          value={normalizeWhatsapp(r.whatsapp_chat)}
                          onChange={(e) => onWhatsappChange(r, e.target.value)}
                          className={cn(
                            "min-w-[170px] rounded-full border px-3 py-2 text-xs font-semibold outline-none transition",
                            normalizeWhatsapp(r.whatsapp_chat) === "yes"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : normalizeWhatsapp(r.whatsapp_chat) === "no"
                              ? "border-rose-200 bg-rose-50 text-rose-700"
                              : normalizeWhatsapp(r.whatsapp_chat) === "only whatsapp chats"
                              ? "border-blue-200 bg-blue-50 text-blue-700"
                              : "border-slate-200 bg-white text-slate-700"
                          )}
                        >
                          <option value="">Select</option>
                          {WHATSAPP_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td> */}

                    <td className="hidden 2xl:table-cell px-6 py-4">
                      <ChangedByDisplay
                        changedById={r.changed_by ?? null}
                        changedByObj={(r as any).changedByAdmin ?? null}
                      />
                    </td>

                    <td className="hidden 2xl:table-cell px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-slate-800 dark:text-slate-200 whitespace-nowrap">
                          <Calendar size={14} className="text-slate-500 shrink-0" />
                          <span className="whitespace-nowrap">Created: {fmtDate(r.createdAt)}</span>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">Updated: {fmtDate(r.updatedAt)}</div>
                      </div>
                    </td>
                  </tr>

                  {open && (
                    <tr className="bg-slate-50/50 dark:bg-slate-900/50">
                      <td colSpan={11} className="px-3 py-4 sm:px-6">
                        <div
                          data-open-details-panel={r.id}
                          className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1E293B] p-4 shadow-sm"
                        >
                          <div className="grid gap-2 xl:grid-cols-[minmax(0,2fr)_minmax(360px,1fr)]">
                            <div className="space-y-2">
                              <div className="grid gap-2 md:grid-cols-4">
                                <div className="rounded-md border border-slate-200 bg-slate-50/70 p-3">
                                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Lead</div>
                                  <div className="mt-1 flex items-center gap-2">
                                    <span className="truncate text-sm font-extrabold text-slate-950">{r.name || "Unnamed Lead"}</span>
                                    <span
                                      className={cn(
                                        "shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase",
                                        r.is_active ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                                      )}
                                    >
                                      {r.is_active ? "Active" : "Inactive"}
                                    </span>
                                  </div>
                                  <div className="mt-1 truncate text-[11px] text-slate-600">{r.email || "No email added"}</div>
                                </div>
                                <div className="rounded-md border border-slate-200 bg-slate-50/70 p-3">
                                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Primary Number</div>
                                  <button
                                    onClick={() => navigate(`/lead-history/${r.id}`)}
                                    className="mt-1 flex items-center gap-1.5 text-left text-xs font-extrabold text-blue-700 hover:text-blue-900"
                                    type="button"
                                  >
                                    <Phone size={13} />
                                    <span>{countryFlag ? `${countryFlag} ` : ""}{formatPhone(r.contact_no)}</span>
                                  </button>
                                </div>
                                <div className="rounded-md border border-slate-200 bg-slate-50/70 p-3">
                                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Alternate Number</div>
                                  <div className="mt-1 text-xs font-semibold text-slate-900">
                                    {r.contact_no1 ? formatPhone(r.contact_no1) : "-"}
                                  </div>
                                </div>
                                <div className="rounded-md border border-slate-200 bg-slate-50/70 p-3">
                                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Case Type</div>
                                  <div className="mt-1 text-xs font-semibold text-slate-900">{r.case_type || "-"}</div>
                                </div>
                              </div>

                              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                                <div className="rounded-md border border-slate-200 bg-white p-3">
                                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Status</div>
                                  <div className="mt-1.5">
                                    <StatusBadge statusId={r.status_id} />
                                  </div>
                                </div>
                                <div className="rounded-md border border-slate-200 bg-white p-3">
                                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Source</div>
                                  <div className="mt-1.5">
                                    <SourceBadge sourceId={r.source_id} />
                                  </div>
                                </div>
                              <div className="rounded-md border border-slate-200 bg-white p-3">
                                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Call Status</div>
                                <div
                                  className={cn(
                                    "mt-1.5 inline-flex w-fit rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase",
                                    callStatus === "yes"
                                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                      : callStatus === "no"
                                      ? "border-rose-200 bg-rose-50 text-rose-700"
                                      : "border-slate-200 bg-slate-50 text-slate-500"
                                  )}
                                >
                                  {callStatus || "No call"}
                                </div>
                              </div>
                            
                              <div className="rounded-md border border-slate-200 bg-white p-3">
                                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Timeline</div>
                                <div className="mt-2 flex flex-col gap-2">
                                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                                    <Calendar size={13} className="text-slate-500" />
                                    <span>Created: {fmtDateTime(r.createdAt)}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                                    <RefreshCcw size={13} className="text-slate-500" />
                                    <span>Updated: {fmtDateTime(r.updatedAt)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            </div>

                            <div className="rounded-md border border-slate-200 bg-white p-3">
                              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Call Description</div>
                              <div className="mt-1 flex h-full min-h-[96px] flex-col justify-between gap-3">
                                <p className="whitespace-pre-wrap break-words text-xs leading-5 text-slate-700">
                                  {getCallDescription(r.call_status) || "-"}
                                </p>
                                <div className="text-[11px] text-slate-500">Updated: {fmtDateTime(r.updatedAt)}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

// Page
export default function Leads() {
  const { statuses } = useStatuses();
  const { agents } = useAgents();
  const { sources } = useSources();
  const { user } = useAuth();
  const isAdmin = user?.role_id === 1;
  const [searchParams, setSearchParams] = useSearchParams();

  const [rows, setRows] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);

  const [openRowId, setOpenRowId] = useState<number | null>(null);

  const [q, setQ] = useState(() => searchParams.get("search") || "");
  const perPage = 10;
  const [page, setPage] = useState(1);

  const [filterSource, setFilterSource] = useState<number | "">("");
  const [callStatus, setCallStatus] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<number | "">("");
  const [filterAgent, setFilterAgent] = useState<number | "">("");
  // const [filterWhatsapp, setFilterWhatsapp] = useState<string>("");
  const [filterChangedBy, setFilterChangedBy] = useState<number | "">("");
  const [changedByApiOptions, setChangedByApiOptions] = useState<MiniUser[]>([]);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editLead, setEditLead] = useState<Lead | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLeadRow, setDeleteLeadRow] = useState<Lead | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [callModalOpen, setCallModalOpen] = useState(false);
  const [callLeadRow, setCallLeadRow] = useState<Lead | null>(null);
  const [callValue, setCallValue] = useState("");
  const [callDescription, setCallDescription] = useState("");
  const [callSaving, setCallSaving] = useState(false);
  const [callModalLocked, setCallModalLocked] = useState(false);
  const [suppressLeadModalRestore, setSuppressLeadModalRestore] = useState(false);

  const [total, setTotal] = useState(0);
  const [serverTotalPages, setServerTotalPages] = useState(1);
  const [congratsOpen, setCongratsOpen] = useState(false);
  const [congratsContext, setCongratsContext] = useState("");
  const highlightedLeadId = useMemo(() => {
    const raw = searchParams.get("highlightLeadId");
    if (!raw) return null;

    const id = Number(raw);
    return Number.isFinite(id) ? id : null;
  }, [searchParams]);

  const setSidebarCollapsed = () => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("crm_sidebar_open", "false");
    window.dispatchEvent(new CustomEvent("crm-sidebar-toggle", { detail: false }));
  };

  const updateLeadModalQuery = (leadId?: number | null) => {
    const next = new URLSearchParams(searchParams);
    if (leadId) next.set("leadId", String(leadId));
    else next.delete("leadId");
    setSearchParams(next, { replace: true });
  };

  const openEdit = async (lead: Lead) => {
    setEditLead(lead);
    setEditOpen(true);

    try {
      const res = await api.leads.get(lead.id);
      const freshLead = ((res as any)?.data?.data ?? (res as any)?.data ?? lead) as Lead;
      setEditLead({
        ...lead,
        ...freshLead,
        assignedAgent: (freshLead as any).assignedAgent ?? (freshLead as any).assignedTo ?? lead.assignedAgent ?? null,
        changedByAdmin: (freshLead as any).changedByAdmin ?? lead.changedByAdmin ?? null,
      });
    } catch (error) {
      console.error("Failed to load lead before edit:", error);
      toast.error(getErrorMessage(error, "Failed to load latest lead details"));
      setEditLead(lead);
    }
  };

  const closeEdit = () => {
    setEditOpen(false);
    setEditLead(null);
  };

  const openCallModalForLead = (lead: Lead, locked = false) => {
    setSuppressLeadModalRestore(false);
    setSidebarCollapsed();
    setCallLeadRow(lead);
    setCallValue(normalizeCallStatus(lead.call_status));
    setCallDescription(getCallDescription(lead.call_status));
    setCallModalLocked(locked);
    setCallModalOpen(true);
    updateLeadModalQuery(lead.id);
  };

  const requireCallDetailsForLead = (lead: Lead) => {
    openCallModalForLead(lead, true);
  };

  const toggleRow = (lead: Lead) => {
    const activeLead = openRowId != null ? rows.find((row) => row.id === openRowId) ?? null : null;

    if (activeLead && activeLead.id === lead.id) {
      requireCallDetailsForLead(activeLead);
      return;
    }

    if (activeLead && activeLead.id !== lead.id) {
      requireCallDetailsForLead(activeLead);
      return;
    }

    setOpenRowId((prev) => (prev === lead.id ? null : lead.id));
  };

  async function loadAll(p = page) {
    setLoading(true);
    try {
      const res = await api.leads.list({
        page: p,
        limit: perPage,
        search: q || undefined,
        source_id: filterSource || undefined,
        call_status: callStatus || undefined,
        status_id: filterStatus || undefined,
        assign_to: filterAgent || undefined,
        // whatsapp_chat: filterWhatsapp || undefined,
        changed_by: filterChangedBy || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      });

      const data = (res as any)?.data?.data ?? (res as any)?.data ?? [];
      const pg = (res as any)?.data?.pagination ?? (res as any)?.pagination;

      const normalized = Array.isArray(data)
        ? data.map((l: any) => ({
            ...l,
            assignedAgent: l.assignedAgent ?? l.assignedTo ?? null,
            changedByAdmin: l.changedByAdmin ?? null,
          }))
        : [];

      setRows(normalized);
      setTotal(pg?.total ?? 0);
      setServerTotalPages(pg?.totalPages ?? 1);
      setOpenRowId(null);
    } catch (error) {
      console.error("Failed to load leads:", error);
      toast.error(getErrorMessage(error, "Failed to load leads"));
    } finally {
      setLoading(false);
    }
  }

  async function loadChangedByOptions() {
    if (!isAdmin) {
      setChangedByApiOptions([]);
      return;
    }

    try {
      const res = await api.leads.changedByOptions();
      const data = (res as any)?.data ?? [];
      setChangedByApiOptions(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load changed_by options:", error);
      setChangedByApiOptions([]);
    }
  }

  useEffect(() => {
    loadAll(page);
  }, [page, q, filterSource,callStatus, filterStatus, filterAgent, filterChangedBy, fromDate, toDate]);

  useEffect(() => {
    if (!searchParams.has("search")) return;

    const urlSearch = searchParams.get("search") || "";
    if (urlSearch !== q) {
      setQ(urlSearch);
      setPage(1);
    }
  }, [searchParams]);

  useEffect(() => {
    void loadChangedByOptions();
  }, [isAdmin]);

  useEffect(() => {
    setPage(1);
  }, [q, filterSource,callStatus,  filterStatus, filterAgent, filterChangedBy, fromDate, toDate]);

  function parseDateInputLocal(s: string) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  }

  function parseRowDate(dt: any) {
    if (!dt) return null;
    if (dt instanceof Date && !isNaN(dt.getTime())) return dt;

    if (typeof dt === "string") {
      const isoish = dt.includes("T") ? dt : dt.replace(" ", "T");
      const d = new Date(isoish);
      return isNaN(d.getTime()) ? null : d;
    }

    if (typeof dt === "number") {
      const d = new Date(dt);
      return isNaN(d.getTime()) ? null : d;
    }

    return null;
  }

  const pageRows = useMemo(() => {
    let out = rows || [];
    const useUpdatedDateFilter = Boolean(filterChangedBy);

    const from = fromDate ? parseDateInputLocal(fromDate) : null;
    const end = toDate ? parseDateInputLocal(toDate) : null;
    if (end) end.setHours(23, 59, 59, 999);

    if (from) {
      out = out.filter((r) => {
        const d = parseRowDate(
          useUpdatedDateFilter
            ? (r as any).updatedAt ?? (r as any).updated_at
            : (r as any).createdAt ?? (r as any).created_at
        );
        return d ? d >= from : false;
      });
    }

    if (end) {
      out = out.filter((r) => {
        const d = parseRowDate(
          useUpdatedDateFilter
            ? (r as any).updatedAt ?? (r as any).updated_at
            : (r as any).createdAt ?? (r as any).created_at
        );
        return d ? d <= end : false;
      });
    }

    return out;
  }, [filterChangedBy, rows, fromDate, toDate]);

  useEffect(() => {
    if (!highlightedLeadId || loading) return;

    const row = document.getElementById(`lead-row-${highlightedLeadId}`);
    row?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightedLeadId, loading, pageRows]);

  const changedByOptions = useMemo(() => {
    if (isAdmin) {
      return changedByApiOptions;
    }

    const currentUserId = Number(user?.id);
    if (!Number.isFinite(currentUserId) || currentUserId <= 0) return [];

    return [
      {
        id: currentUserId,
        name: user?.name,
        email: user?.email,
      },
    ];
  }, [changedByApiOptions, isAdmin, user?.email, user?.id, user?.name]);

  const isConversionStatusId = (statusId?: number | null) => {
    if (statusId == null) return false;
    const status = statuses.find((s: any) => Number(s.id) === Number(statusId));
    return isConversionStatusName(status?.name);
  };

  const onSaveEdit = async (payload: {
    description: string;
    agent_id: number | null;
    status_id: number | null;
    source_id?: number | null;
    changed_by?: number | null;
    call_status?: string | null;
    country_code?: string;
    phone_number?: string;
    full_phone_number?: string;
    alt_country_code?: string;
    alt_phone_number?: string;
    alt_full_phone_number?: string;
    name?: string;
    email?: string;
    contact_no?: string;
    contact_no1?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    pincode?: string;
    case_type?: string;
    is_active?: boolean;
  }) => {
    if (!editLead?.id) return;

    const id = editLead.id;
    const data = rows.find((d) => d.id === id);
    if (!data) return;
    const previousStatusId = data.status_id ?? null;

    const payloadData = {
      name: payload.name ?? data.name,
      email: payload.email ?? data.email,
      contact_no: payload.contact_no ?? data.contact_no,
      contact_no1: payload.contact_no1 ?? data.contact_no1,
      address: payload.address ?? data.address,
      state: payload.state ?? data.state,
      city: payload.city ?? data.city,
      pincode: payload.pincode ?? data.pincode,
      country: payload.country ?? data.country,
      is_active: payload.is_active ?? data.is_active,
      case_type: payload.case_type ?? data.case_type,
      source_id: payload.source_id ?? data.source_id,
      status_id: payload.status_id ?? data.status_id,
      assign_to: payload.agent_id ?? data.assign_to,
      country_code: payload.country_code,
      phone_number: payload.phone_number,
      full_phone_number: payload.full_phone_number,
      alt_country_code: payload.alt_country_code,
      alt_phone_number: payload.alt_phone_number,
      alt_full_phone_number: payload.alt_full_phone_number,
      changed_by: payload.changed_by ?? user?.id ?? data.changed_by ?? null,
      description: payload.description,
      call_status: payload.call_status ?? data.call_status ?? null,
    };

    const toastId = toast.loading("Updating lead...");
    try {
      await api.leads.update(id, payloadData);
      await loadAll(page);
      closeEdit();
      toast.success("Lead updated successfully", { id: toastId });

      const convertedNow =
        payloadData.status_id !== previousStatusId &&
        isConversionStatusId(payloadData.status_id) &&
        !isConversionStatusId(previousStatusId);

      if (convertedNow) {
        setCongratsContext(data.name || "this lead");
        setCongratsOpen(true);
      }
    } catch (error) {
      console.error("Failed to update lead:", error);
      toast.error(getErrorMessage(error, "Failed to update lead"), { id: toastId });
      throw error;
    }
  };

  // const onWhatsappChange = async (lead: Lead, whatsapp_chat: string) => {
  //   try {
  //     await api.leads.update(lead.id, {
  //       whatsapp_chat: whatsapp_chat || null,
  //     });
  //     await loadAll(page);
  //   } catch (error) {
  //     console.error("Failed to update whatsapp_chat:", error);
  //     alert("Failed to update WhatsApp preference");
  //   }
  // };

  const closeCallModal = () => {
    if (callSaving || callModalLocked) return;
    setSuppressLeadModalRestore(true);
    setCallModalOpen(false);
    setCallLeadRow(null);
    setCallValue("");
    setCallDescription("");
    setCallModalLocked(false);
    updateLeadModalQuery(null);
  };

  const resetCallModal = () => {
    setSuppressLeadModalRestore(true);
    setCallModalOpen(false);
    setCallLeadRow(null);
    setCallValue("");
    setCallDescription("");
    setCallModalLocked(false);
    updateLeadModalQuery(null);
  };

  const onCallChange = async (lead: Lead, value: string) => {
    if (!value) {
      const toastId = toast.loading("Clearing call status...");
      try {
        await api.leads.update(lead.id, { call_status: null });
        await loadAll(page);
        toast.success("Call status cleared", { id: toastId });
      } catch (error) {
        console.error("Failed to clear call_status:", error);
        toast.error(getErrorMessage(error, "Failed to update Call status"), {
          id: toastId,
        });
      }
      return;
    }

    setSuppressLeadModalRestore(false);
    setSidebarCollapsed();
    setCallLeadRow(lead);
    setCallValue(value);
    setCallDescription(getCallDescription(lead.call_status));
    setCallModalLocked(true);
    setCallModalOpen(true);
    updateLeadModalQuery(lead.id);
  };

  const confirmCallModal = async () => {
    if (callSaving) return;
    if (!callLeadRow?.id || !callValue) return;
    if (!callDescription.trim()) {
      toast.error("Call description is required");
      return;
    }

    setCallSaving(true);
    const toastId = toast.loading("Updating call status...");
    try {
      await api.leads.update(callLeadRow.id, {
        call_status: composeCallStatus(callValue, callDescription),
      });
      setOpenRowId(null);
      resetCallModal();
      await loadAll(page);
      toast.success("Call status updated", { id: toastId });
    } catch (error) {
      console.error("Failed to update call_status:", error);
      toast.error(getErrorMessage(error, "Failed to update Call status"), {
        id: toastId,
      });
    } finally {
      setCallSaving(false);
    }
  };

  useEffect(() => {
    if (!openRowId || callModalOpen) return;

    const activeLead = rows.find((row) => row.id === openRowId);
    if (!activeLead) return;

    const onDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const insideDetails = target.closest(`[data-open-details-panel="${openRowId}"]`);
      const insideToggle = target.closest(`[data-eye-toggle="${openRowId}"]`);
      const insideLeadRow = target.closest(`[data-open-lead-row="${openRowId}"]`);
      const insideModal = target.closest('[data-call-modal="true"]');

      if (insideDetails || insideToggle || insideLeadRow || insideModal) return;

      event.preventDefault();
      event.stopPropagation();
      requireCallDetailsForLead(activeLead);
    };

    document.addEventListener("mousedown", onDocumentMouseDown, true);
    return () => {
      document.removeEventListener("mousedown", onDocumentMouseDown, true);
    };
  }, [callModalOpen, openRowId, rows]);

  useEffect(() => {
    const rawLeadId = searchParams.get("leadId");
    if (!rawLeadId) {
      if (suppressLeadModalRestore) {
        setSuppressLeadModalRestore(false);
      }
      return;
    }

    if (suppressLeadModalRestore) return;

    const leadId = Number(rawLeadId);
    if (!Number.isFinite(leadId)) return;

    const existingLead = rows.find((row) => row.id === leadId);
    if (existingLead) {
      if (!callModalOpen || callLeadRow?.id !== leadId) {
        setSidebarCollapsed();
        setCallLeadRow(existingLead);
        setCallValue(normalizeCallStatus(existingLead.call_status));
        setCallDescription(getCallDescription(existingLead.call_status));
        setCallModalLocked(true);
        setCallModalOpen(true);
      }
      return;
    }

    let cancelled = false;

    const loadLead = async () => {
      try {
        const res = await api.leads.get(leadId);
        const row = (res as any)?.data?.data ?? (res as any)?.data ?? null;
        if (!row || cancelled) return;

        const normalizedLead = {
          ...row,
          assignedAgent: row.assignedAgent ?? row.assignedTo ?? null,
          changedByAdmin: row.changedByAdmin ?? null,
        } as Lead;

        setSidebarCollapsed();
        setCallLeadRow(normalizedLead);
        setCallValue(normalizeCallStatus(normalizedLead.call_status));
        setCallDescription(getCallDescription(normalizedLead.call_status));
        setCallModalLocked(true);
        setCallModalOpen(true);
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to restore lead modal:", error);
          updateLeadModalQuery(null);
        }
      }
    };

    void loadLead();

    return () => {
      cancelled = true;
    };
  }, [callLeadRow?.id, callModalOpen, rows, searchParams, suppressLeadModalRestore]);

  const openDelete = (lead: Lead) => {
    setDeleteLeadRow(lead);
    setDeleteOpen(true);
  };

  const closeDelete = () => {
    if (deleting) return;
    setDeleteOpen(false);
    setDeleteLeadRow(null);
  };

  const confirmDelete = async () => {
    if (!deleteLeadRow?.id) return;

    setDeleting(true);
    const toastId = toast.loading("Deleting lead...");
    try {
      const id = deleteLeadRow.id;

      const leadsApi: any = (api as any).leads;
      if (leadsApi?.remove) await leadsApi.remove(id);
      else if (leadsApi?.delete) await leadsApi.delete(id);
      else if (leadsApi?.destroy) await leadsApi.destroy(id);
      else throw new Error("Delete API not found: api.leads.remove/delete/destroy");

      setRows((prev) => prev.filter((r) => r.id !== id));
      setTotal((t) => Math.max(0, t - 1));

      closeDelete();
      toast.success("Lead deleted successfully", { id: toastId });
    } catch (e) {
      console.error(e);
      toast.error(getErrorMessage(e, "Failed to delete lead"), { id: toastId });
    } finally {
      setDeleting(false);
    }
  };

  const deleteLead = (lead: Lead) => openDelete(lead);

  return (
    <div className="w-full">
      <PageHeader
        title="Leads Management"
        subtitle="Manage and track all your leads"
        total={total}
        search={q}
        onSearch={setQ}
        icon={<Users size={18} />}
        rightActions={
          <button
            onClick={() => loadAll(page)}
            className="px-4 py-2.5 rounded-md border border-[#233a47] bg-[#233a47] hover:bg-[#1c303b] text-sm font-semibold text-white shadow-sm inline-flex items-center gap-2"
            type="button"
          >
            <RefreshCcw size={16} />
            Refresh
          </button>
        }
      />

      <div className="bg-white dark:bg-[#1E293B] rounded-md border border-slate-200/70 dark:border-slate-800 shadow-xs p-4 sm:p-5 mb-6 transition-colors">
        <div className="grid grid-cols-1 md:grid-cols-8 gap-3">
          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value ? Number(e.target.value) : "")}
            className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-md px-3 py-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
          >
            <option value="">All Sources</option>
            {sources.map((s: any) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
   <select
  value={callStatus}
  onChange={(e) => setCallStatus(e.target.value)}
  className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-md px-3 py-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
>
  <option value="">Call Status</option>
  {CALL_OPTIONS.map((option) => (
    <option key={option.value} value={option.value}>
      {option.label}
    </option>
  ))}
</select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value ? Number(e.target.value) : "")}
            className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-md px-3 py-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
          >
            <option value="">All Status</option>
            {statuses.map((s: any) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <select
            value={filterAgent}
            onChange={(e) => setFilterAgent(e.target.value ? Number(e.target.value) : "")}
            className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-md px-3 py-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
          >
            <option value="">All Agents</option>
            {agents.map((a: any) => (
              <option key={a.id} value={a.id}>
                {a.name || a.email}
              </option>
            ))}
          </select>

          {/* <select
            value={filterWhatsapp}
            onChange={(e) => setFilterWhatsapp(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            <option value="">All WhatsApp</option>
            {WHATSAPP_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select> */}

          <select
            value={filterChangedBy}
            onChange={(e) =>
              setFilterChangedBy(e.target.value ? Number(e.target.value) : "")
            }
            className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-md px-3 py-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
          >
            <option value="">All Changed By</option>
            {changedByOptions.map((admin) => (
              <option key={admin.id} value={admin.id}>
                {admin.name || admin.email}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-md px-3 py-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
          />

          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-md px-3 py-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
          />

          <button
            onClick={() => {
              setQ("");
              setFilterSource("");
              setFilterStatus("");
              setCallStatus("");
              setFilterAgent("");
              // setFilterWhatsapp("");
              setFilterChangedBy("");
              setFromDate("");
              setToDate("");
              setPage(1);
            }}
            className="px-4 py-2.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 shadow-2xs transition"
            type="button"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1E293B] rounded-md border border-slate-200/70 dark:border-slate-800 shadow-xs overflow-hidden transition-colors">
        <LeadsTable
          loading={loading}
          pageRows={pageRows}
          page={page}
          perPage={perPage}
          openRowId={openRowId}
          highlightedLeadId={highlightedLeadId}
          toggleRow={toggleRow}
          onEdit={openEdit}
          onDelete={deleteLead}
          onCallChange={onCallChange}
          // onWhatsappChange={onWhatsappChange}
          isAdmin={isAdmin}
          total={total}
        />

        <div className="border-t border-slate-200 dark:border-slate-800 p-4 sm:p-5 bg-white dark:bg-[#1E293B]">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-600 dark:text-slate-400">
              Showing <span className="font-bold text-slate-900 dark:text-white">{total === 0 ? 0 : (page - 1) * perPage + 1}-{Math.min(page * perPage, total)}</span> of <span className="font-bold text-slate-900 dark:text-white">{total}</span> leads
            </div>

            <div className="flex items-center gap-1">
              <button
                className="p-2 rounded-md border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-2xs"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                type="button"
              >
                <ChevronLeft size={18} />
              </button>

              <div className="flex items-center gap-1">
                {pageNumbers(page, serverTotalPages).map((v, i) =>
                  v === "..." ? (
                    <span key={`dots-${i}`} className="text-slate-400 px-2">
                      ...
                    </span>
                  ) : (
                    <button
                      key={v}
                      onClick={() => setPage(v)}
                      className={cn(
                        "w-9 h-9 rounded-md text-xs transition shadow-2xs font-semibold",
                        page === v
                          ? "bg-slate-900 dark:bg-blue-600 text-white"
                          : "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700"
                      )}
                      type="button"
                    >
                      {v}
                    </button>
                  )
                )}
              </div>

              <button
                className="p-2 rounded-md border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-2xs"
                disabled={page >= serverTotalPages}
                onClick={() => setPage((p) => Math.min(serverTotalPages, p + 1))}
                type="button"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <EditLeadModal
        open={editOpen}
        lead={editLead}
        onClose={closeEdit}
        onSave={onSaveEdit}
        currentUserId={user?.id != null ? Number(user.id) : null}
        currentUserName={user?.name || user?.email || null}
      />

      <CallStatusModal
        open={callModalOpen}
        lead={callLeadRow}
        value={callValue}
        description={callDescription}
        saving={callSaving}
        onValueChange={setCallValue}
        onDescriptionChange={setCallDescription}
        onClose={closeCallModal}
        onConfirm={confirmCallModal}
        locked={callModalLocked}
      />

      <DeleteLeadModal
        open={deleteOpen}
        lead={deleteLeadRow}
        loading={deleting}
        onClose={closeDelete}
        onConfirm={confirmDelete}
      />

      <ConversionCongratsModal
        open={congratsOpen}
        name={user?.name || user?.email || "Team"}
        context={congratsContext}
        onClose={() => setCongratsOpen(false)}
      />
    </div>
  );
}
