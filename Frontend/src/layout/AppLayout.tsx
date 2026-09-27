/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useTheme } from "../theme/ThemeContext";
import { toast } from "react-hot-toast";
import { api } from "../lib/api";
import { storage } from "../lib/storage";
import {
  Home,
  BarChart2,
  Bell,
  PieChart,
  Box,
  Users,
  UserCheck,
  Building2,
  Briefcase,
  CheckSquare,
  Calendar as CalendarIcon,
  Megaphone,
  Settings as SettingsIcon,
  FileText,
  LogOut,
  Search,
  ChevronDown,
  ChevronRight,
  User,
  Key,
  X,
  Loader2,
  Calculator,
  Clock3,
  Menu,
  Phone,
  Settings2,
  Sun,
  Moon,
  BellRing,
} from "lucide-react";
import ActivityTracker from "../activity/ActivityTracker";

type NavItem = {
  label: string;
  to: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  badgeCount?: number;
  children?: NavItem[];
};

type CompanyInfo = {
  id?: number | string;
  company_name?: string;
  logo_url?: string;
  email?: string;
};

type ReminderAlert = {
  id: number;
  type?: "followup" | "payment_duration";
  lead_id?: number;
  followup_date?: string;
  reminder_at?: string;
  remark?: string;
  date?: string;
  lead_name?: string;
  contact_no?: string;
  case_type?: string;
  duration?: string;
  duration_days?: number;
  due_at?: string;
  lead?: {
    id?: number;
    name?: string;
    contact_no?: string;
  };
  status?: {
    id?: number;
    name?: string;
  };
  changed_by?: number | string | null;
  changedBy?: {
    id?: number;
    name?: string;
    email?: string;
  };
  changedByAdmin?: {
    id?: number;
    name?: string;
    email?: string;
  };
};

function cn(...cls: Array<string | boolean | undefined | null>) {
  return cls.filter(Boolean).join(" ");
}

const REMINDER_SEEN_KEY = "crm_seen_reminder_alerts";
const PAYMENT_REMINDER_ALLOWED_USER_IDS = new Set([5]);
const PAYMENT_REMINDER_ALLOWED_EMAILS = new Set(["sara@infoace.in"]);

function getSeenReminderKeys() {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.sessionStorage.getItem(REMINDER_SEEN_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function setSeenReminderKeys(keys: string[]) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(REMINDER_SEEN_KEY, JSON.stringify(keys.slice(-200)));
}

function getReminderKey(item: ReminderAlert) {
  if (item.type === "payment_duration") {
    const dueDate = String(item.due_at || item.reminder_at || "").slice(0, 10);
    return `payment_duration:${item.id}:${dueDate}`;
  }

  return `${item.type || "followup"}:${item.id}`;
}

function formatReminderDateTime(value?: string) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getReminderCreatorName(item: ReminderAlert) {
  return (
    item.changedByAdmin?.name ||
    item.changedByAdmin?.email ||
    item.changedBy?.name ||
    item.changedBy?.email ||
    (item.changed_by ? `Agent #${item.changed_by}` : "") ||
    "Not assigned"
  );
}

function sortReminderAlerts(rows: ReminderAlert[]) {
  return [...rows].sort((a, b) => {
    const timeA = new Date(a.followup_date || a.due_at || a.reminder_at || 0).getTime();
    const timeB = new Date(b.followup_date || b.due_at || b.reminder_at || 0).getTime();

    if (timeA !== timeB) return timeA - timeB;
    return Number(a.id || 0) - Number(b.id || 0);
  });
}

function canViewPaymentReminders(
  user?: { id?: number | string; email?: string; role_id?: number; type?: string } | null
) {
  const userId = Number(user?.id);
  const email = String(user?.email || "").trim().toLowerCase();
  return (
    user?.role_id === 1 ||
    user?.type === "admin" ||
    PAYMENT_REMINDER_ALLOWED_USER_IDS.has(userId) ||
    PAYMENT_REMINDER_ALLOWED_EMAILS.has(email)
  );
}

function mergeReminderAlerts(prev: ReminderAlert[], incoming: ReminderAlert[]) {
  const map = new Map<string, ReminderAlert>();

  for (const row of prev) {
    map.set(getReminderKey(row), row);
  }

  for (const row of incoming) {
    map.set(getReminderKey(row), row);
  }

  return sortReminderAlerts(Array.from(map.values()));
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
      const clickedInside = path ? path.includes(el) : el.contains(e.target as Node);

      if (clickedInside) return;
      handler();
    };

    document.addEventListener("pointerdown", listener);
    return () => document.removeEventListener("pointerdown", listener);
  }, [ref, handler]);
}

type GlobalSearchResponse = {
  success: boolean;
  query: string;
  results: Record<string, any[]>;
};

export default function AppLayout() {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [profileOpen, setProfileOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    quotations:
      location.pathname.startsWith("/create-quotation") ||
      location.pathname.startsWith("/quotation-dashboard") ||
      location.pathname.startsWith("/quotations") ||
      location.pathname.startsWith("/quotation-service"),
  });

  // Sidebar expanded / collapsed state
  const [sidebarExpanded, setSidebarExpanded] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const saved = window.localStorage.getItem("crm_sidebar_expanded");
    return saved == null ? true : saved === "true";
  });

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);
  useOutsideClick(profileRef, () => setProfileOpen(false));

  // Search states
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [results, setResults] = useState<Record<string, any[]>>({});
  const [activeIndex, setActiveIndex] = useState(0);

  const searchWrapRef = useRef<HTMLDivElement>(null);
  useOutsideClick(searchWrapRef, () => setSearchOpen(false));

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Change Password Modal
  const [pwdOpen, setPwdOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwdErr, setPwdErr] = useState<string | null>(null);
  const [pwdLoading, setPwdLoading] = useState(false);
  const pwdRef = useRef<HTMLDivElement>(null);
  useOutsideClick(pwdRef, () => {
    if (pwdOpen) closePwdModal();
  });

  const companyId = storage.getCompanyId();
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [reminderAlerts, setReminderAlerts] = useState<ReminderAlert[]>([]);
  const [reminderOpen, setReminderOpen] = useState(false);
  const reminderOpenRef = useRef(false);
  const reminderAudioRef = useRef<HTMLAudioElement | null>(null);
  const [paymentReminderAlerts, setPaymentReminderAlerts] = useState<ReminderAlert[]>([]);
  const [paymentReminderOpen, setPaymentReminderOpen] = useState(false);
  const paymentReminderOpenRef = useRef(false);

  const isAdmin = user?.role_id === 1;

  useEffect(() => {
    reminderOpenRef.current = reminderOpen;
  }, [reminderOpen]);

  useEffect(() => {
    paymentReminderOpenRef.current = paymentReminderOpen;
  }, [paymentReminderOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("crm_sidebar_expanded", String(sidebarExpanded));
  }, [sidebarExpanded]);

  // Navigation Items matching the sleek minimalist design
  const navItems: NavItem[] = useMemo(
    () => [
      { label: "Dashboard", to: "/dashboard", icon: Home },
      { label: "Revenue", to: "/payments", icon: BarChart2 },
      {
        label: "Notifications",
        to: "/followups",
        icon: Bell,
        badgeCount: reminderAlerts.length + paymentReminderAlerts.length,
      },
      { label: "Analytics", to: "/reports", icon: PieChart },
      { label: "Leads", to: "/leads", icon: Box },
      { label: "Contacts", to: "/contacts", icon: UserCheck },
      { label: "Companies", to: "/companies", icon: Building2 },
      { label: "Deals", to: "/deals", icon: Briefcase },
      { label: "Tasks", to: "/tasks", icon: CheckSquare },
      { label: "Calendar", to: "/calendar", icon: CalendarIcon },
      { label: "Marketing", to: "/marketing", icon: Megaphone },
      {
        label: "Quotations",
        to: "/quotations",
        icon: FileText,
        children: [
          { label: "Quotation Dashboard", to: "/quotation-dashboard", icon: FileText },
          { label: "Create Quotation", to: "/create-quotation", icon: FileText },
          { label: "Quotations List", to: "/quotations", icon: FileText },
          { label: "Quotation Service", to: "/quotation-service", icon: Settings2 },
        ],
      },
      { label: "Field Work", to: "/field-works", icon: Users },
      { label: "GST Calculator", to: "/calculator", icon: Calculator },

      { label: "Settings", to: "/settings", icon: SettingsIcon },
    ],
    [reminderAlerts.length, paymentReminderAlerts.length]
  );

  useEffect(() => {
    if (
      location.pathname.startsWith("/quotation-dashboard") ||
      location.pathname.startsWith("/create-quotation") ||
      location.pathname.startsWith("/quotations") ||
      location.pathname.startsWith("/quotation-service")
    ) {
      setOpenGroups((prev) => ({ ...prev, quotations: true }));
    }
  }, [location.pathname]);

  const flatNavItems = useMemo(
    () =>
      navItems.flatMap((item) =>
        Array.isArray(item.children) && item.children.length > 0 ? item.children : [item]
      ),
    [navItems]
  );

  const pageTitle = useMemo(() => {
    const found = flatNavItems.find((i) => location.pathname.startsWith(i.to));
    return found?.label || "Dashboard";
  }, [flatNavItems, location.pathname]);

  const initials = useMemo(() => {
    const email = user?.email || "U";
    return email.slice(0, 2).toUpperCase();
  }, [user?.email]);

  const displayName = useMemo(() => {
    return companyInfo?.company_name || user?.name || "Duck UI";
  }, [companyInfo?.company_name, user?.name]);

  const displayEmail = useMemo(() => {
    return user?.email || "Duckui@demo.com";
  }, [user?.email]);

  async function loadCompanyInfo() {
    if (!companyId) return;

    try {
      const res = await (api as any).getCompany(companyId);
      const row = res?.data?.data ?? res?.data ?? null;
      setCompanyInfo(row);
    } catch (err) {
      console.error("Failed to load company info:", err);
      setCompanyInfo(null);
    }
  }

  useEffect(() => {
    loadCompanyInfo();
  }, [companyId]);

  useEffect(() => {
    if (!user) {
      setReminderAlerts([]);
      setReminderOpen(false);
      setPaymentReminderAlerts([]);
      setPaymentReminderOpen(false);
      return;
    }

    let cancelled = false;

    const pollReminderAlerts = async () => {
      try {
        const canViewPaymentReminder = canViewPaymentReminders(user);
        const [followupRes, paymentRes] = await Promise.all([
          api.getReminderAlerts(),
          canViewPaymentReminder
            ? api.getPaymentDurationReminderAlerts()
            : Promise.resolve({ data: [] }),
        ]);
        const followupRows = Array.isArray(followupRes?.data)
          ? (followupRes.data as ReminderAlert[]).map((row) => ({
            ...row,
            type: "followup" as const,
          }))
          : [];
        const paymentRows = Array.isArray(paymentRes?.data)
          ? (paymentRes.data as ReminderAlert[]).map((row) => ({
            ...row,
            type: "payment_duration" as const,
          }))
          : [];
        const rows = sortReminderAlerts(followupRows);
        const paymentReminderRows = sortReminderAlerts(paymentRows);
        const seenKeys = new Set(getSeenReminderKeys());
        const unseenRows = rows.filter((row) => !seenKeys.has(getReminderKey(row)));
        const unseenPaymentRows = paymentReminderRows.filter(
          (row) => !seenKeys.has(getReminderKey(row))
        );

        if (cancelled) return;

        if (unseenRows.length > 0) {
          setReminderAlerts((prev) => mergeReminderAlerts(prev, unseenRows));
          if (!reminderOpenRef.current) {
            setReminderOpen(true);
          }
        }

        if (unseenPaymentRows.length > 0) {
          setPaymentReminderAlerts((prev) => mergeReminderAlerts(prev, unseenPaymentRows));
          if (!paymentReminderOpenRef.current) {
            setPaymentReminderOpen(true);
          }
        }
      } catch (error) {
        console.error("Failed to fetch reminder alerts:", error);
      }
    };

    void pollReminderAlerts();
    const intervalId = window.setInterval(() => {
      void pollReminderAlerts();
    }, 10 * 60 * 1000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [user]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!reminderOpen || reminderAlerts.length === 0) {
      const existingAudio = reminderAudioRef.current;
      if (existingAudio) {
        existingAudio.pause();
        existingAudio.currentTime = 0;
      }
      return;
    }

    const audio = reminderAudioRef.current || new Audio("/notification.wav");
    reminderAudioRef.current = audio;
    audio.loop = true;
    audio.volume = 1;

    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch((error) => {
        console.error("Failed to play reminder audio:", error);
      });
    }

    return () => {
      audio.pause();
      audio.currentTime = 0;
    };
  }, [reminderAlerts.length, reminderOpen]);

  const doLogout = () => {
    setProfileOpen(false);
    logout();
    navigate("/login");
  };

  function openPwdModal() {
    setProfileOpen(false);
    setPwdErr(null);
    setNewPassword("");
    setConfirmPassword("");
    setPwdOpen(true);
  }

  function closePwdModal() {
    setPwdOpen(false);
    setPwdErr(null);
    setNewPassword("");
    setConfirmPassword("");
    setPwdLoading(false);
  }

  function dismissReminder(item: ReminderAlert) {
    const key = getReminderKey(item);
    const nextSeen = Array.from(new Set([...getSeenReminderKeys(), key]));
    setSeenReminderKeys(nextSeen);

    setReminderAlerts((prev) => {
      const next = prev.filter((row) => getReminderKey(row) !== key);
      if (next.length === 0) {
        setReminderOpen(false);
      }
      return next;
    });
  }

  function dismissPaymentReminder(item: ReminderAlert) {
    const key = getReminderKey(item);
    const nextSeen = Array.from(new Set([...getSeenReminderKeys(), key]));
    setSeenReminderKeys(nextSeen);

    setPaymentReminderAlerts((prev) => {
      const next = prev.filter((row) => getReminderKey(row) !== key);
      if (next.length === 0) {
        setPaymentReminderOpen(false);
      }
      return next;
    });
  }

  function dismissAllReminders() {
    const nextSeen = Array.from(
      new Set([...getSeenReminderKeys(), ...reminderAlerts.map((item) => getReminderKey(item))])
    );
    setSeenReminderKeys(nextSeen);
    setReminderAlerts([]);
    setReminderOpen(false);
  }

  function dismissAllPaymentReminders() {
    const nextSeen = Array.from(
      new Set([
        ...getSeenReminderKeys(),
        ...paymentReminderAlerts.map((item) => getReminderKey(item)),
      ])
    );
    setSeenReminderKeys(nextSeen);
    setPaymentReminderAlerts([]);
    setPaymentReminderOpen(false);
  }

  function openReminderLead(item: ReminderAlert) {
    dismissReminder(item);
    if (item.type === "payment_duration") {
      navigate("/payments");
      return;
    }
    const leadId = item.lead?.id || item.lead_id;
    if (!leadId) return;
    navigate(`/lead-history/${leadId}`);
  }

  function openPaymentReminder(item: ReminderAlert) {
    dismissPaymentReminder(item);
    navigate(`/payments?highlightPaymentId=${item.id}`);
  }

  async function submitChangePassword(e?: React.FormEvent) {
    e?.preventDefault();
    const np = newPassword.trim();
    const cp = confirmPassword.trim();

    if (np.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (np !== cp) {
      toast.error("New Password and Confirm Password do not match.");
      return;
    }

    try {
      setPwdErr(null);
      setPwdLoading(true);
      if (!user?.id) {
        toast.error("User id missing. Please login again.");
        return;
      }

      await api.changePassword({ newPassword: np, confirmPassword: cp });
      toast.success("Password updated successfully. Please login again.");
      navigate("/login");
      closePwdModal();
    } catch (err: any) {
      toast.error(err?.message || "Failed to change password");
    } finally {
      setPwdLoading(false);
    }
  }

  const flatItems = useMemo(() => {
    const items: Array<{ group: string; item: any; label: string; sub?: string }> = [];

    const pushGroup = (group: string, labelKey = "name") => {
      const arr = results?.[group] || [];
      for (const it of arr) {
        const label =
          it?.[labelKey] ||
          it?.lead_name ||
          it?.email ||
          it?.contact_no ||
          it?.contact_no1 ||
          `#${it?.id}`;

        const subParts = [
          it?.email,
          it?.contact_no ? `Primary: ${it.contact_no}` : "",
          it?.contact_no1 ? `Alt: ${it.contact_no1}` : "",
          it?.case_type,
          it?.case_location,
          it?.city || it?.state ? [it?.city, it?.state].filter(Boolean).join(", ") : "",
        ].filter(Boolean);

        items.push({ group, item: it, label: String(label), sub: subParts.join(" | ") });
      }
    };

    pushGroup("leads");
    pushGroup("agents");
    pushGroup("admins");
    pushGroup("payments", "lead_name");
    pushGroup("sources", "name");
    pushGroup("statuses", "name");

    return items;
  }, [results]);

  useEffect(() => {
    const q = search.trim();

    if (q.length < 2) {
      setResults({});
      setSearchOpen(false);
      setActiveIndex(0);
      return;
    }

    const t = setTimeout(async () => {
      try {
        setSearchLoading(true);
        const res = await api.search(q);
        const data = (res as GlobalSearchResponse)?.results || {};
        setResults(data);
        setSearchOpen(true);
        setActiveIndex(0);
      } catch (e) {
        setResults({});
        setSearchOpen(false);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(t);
  }, [search]);

  function onPick(x: (typeof flatItems)[number]) {
    const path = x?.item?.path;
    if (!path) {
      toast.error("Path missing from search result");
      return;
    }

    setSearchOpen(false);
    setSearch("");
    setResults({});
    setActiveIndex(0);
    navigate(path);
  }

  function onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!searchOpen || flatItems.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((p) => Math.min(p + 1, flatItems.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((p) => Math.max(p - 1, 0));
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const picked = flatItems[activeIndex];
      if (picked) onPick(picked);
    }
  }

  return (
    <div className="h-screen overflow-hidden bg-[#F8F9FB] dark:bg-[#0F172A] text-[#1E293B] dark:text-slate-100 flex font-sans transition-colors duration-200">
      <ActivityTracker user={user} />

      {/* ======================= SIDEBAR (Minimalist Duck UI Style) ======================= */}
      <aside
        onClick={() => {
          if (!sidebarExpanded) setSidebarExpanded(true);
        }}
        className={cn(
          "hidden lg:flex flex-col shrink-0 h-full bg-white dark:bg-[#1E293B] border-r border-slate-200/70 dark:border-slate-800 transition-all duration-300 ease-in-out select-none z-40 relative",
          sidebarExpanded ? "w-[260px]" : "w-[76px] cursor-pointer"
        )}
      >
        {/* TOP BRANDING / PROFILE */}
        <div
          onClick={() => setSidebarExpanded((prev) => !prev)}
          className={cn(
            "shrink-0 flex items-center p-4 cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group",
            sidebarExpanded ? "gap-3" : "justify-center"
          )}
          title={sidebarExpanded ? "Click to collapse" : "Click to expand"}
        >
          {/* Logo Badge (Dark rounded container with lavender character) */}
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#111827] dark:bg-[#1E293B] shadow-sm ring-1 ring-black/5 group-hover:scale-105 transition-transform overflow-hidden">
            {companyInfo?.logo_url ? (
              <img
                src={companyInfo.logo_url}
                alt={displayName}
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-[#DDD6FE]"
              >
                {/* Modern Duck Character Icon */}
                <path
                  d="M8.5 15C11.5 15 14 12.5 14 9.5C14 7 12.5 5 10 5C7.5 5 6 7 6 9.5C6 11 5 12 3.5 12C3 12 2.5 12.2 2.5 12.5C2.5 13.9 3.6 15 5 15H8.5Z"
                  fill="currentColor"
                />
                <path
                  d="M8.5 15C13 15 16.5 17 18 19C19 20.3 20.5 21 22 21H6C4 21 2.5 19.5 2.5 17.5C2.5 16 3.5 15 5 15H8.5Z"
                  fill="currentColor"
                  fillOpacity="0.85"
                />
                <circle cx="9" cy="8.5" r="1" fill="#111827" />
              </svg>
            )}
          </div>

          {/* Expanded Name & Email */}
          {sidebarExpanded && (
            <div className="min-w-0 flex-1 animate-fade-in flex items-center justify-between">
              <div className="min-w-0 flex-1 mr-1">
                <div className="truncate text-sm font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {displayName}
                </div>
                <div className="truncate text-[11px] font-medium text-slate-400 dark:text-slate-500">
                  {displayEmail}
                </div>
              </div>

            </div>
          )}
        </div>

        {/* SEARCH BAR (Pill shape) */}
        <div className="px-3.5 pt-1 pb-2">
          {sidebarExpanded ? (
            <div className="relative" ref={searchWrapRef}>
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
              />
              <input
                ref={searchInputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => {
                  if (flatItems.length > 0) setSearchOpen(true);
                }}
                onKeyDown={onSearchKeyDown}
                placeholder="Search..."
                className="w-full rounded-md border-0 bg-[#F4F5F7] dark:bg-slate-800/80 py-2.5 pl-10 pr-8 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-700 transition"
              />
              {searchLoading && (
                <Loader2
                  size={14}
                  className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400"
                />
              )}

              {/* Search dropdown results */}
              {searchOpen && (
                <div className="absolute left-0 right-0 top-full mt-2 overflow-hidden rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl z-50">
                  <div className="max-h-[300px] overflow-auto">
                    {search.trim().length < 2 ? (
                      <div className="px-4 py-3 text-xs text-slate-400">
                        Type at least 2 letters...
                      </div>
                    ) : flatItems.length === 0 ? (
                      <div className="px-4 py-3 text-xs text-slate-400">
                        {searchLoading ? "Searching..." : "No results found"}
                      </div>
                    ) : (
                      flatItems.map((x, i) => (
                        <button
                          key={`${x.group}-${x.item?.id}-${i}`}
                          type="button"
                          onClick={() => onPick(x)}
                          onMouseEnter={() => setActiveIndex(i)}
                          className={cn(
                            "w-full px-4 py-2.5 text-left transition border-b border-slate-100 dark:border-slate-800 last:border-0",
                            i === activeIndex
                              ? "bg-slate-50 dark:bg-slate-800/80"
                              : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate text-xs font-bold text-slate-900 dark:text-white">
                                {x.label}
                              </div>
                              {x.sub ? (
                                <div className="truncate text-[10px] text-slate-400">{x.sub}</div>
                              ) : null}
                            </div>
                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                              {x.group}
                            </span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => setSidebarExpanded(true)}
              className="flex h-10 w-full items-center justify-center rounded-md bg-[#F4F5F7] dark:bg-slate-800/80 text-slate-400 hover:text-slate-800 dark:hover:text-white transition"
              title="Search"
            >
              <Search size={17} />
            </button>
          )}
        </div>

        {/* NAVIGATION LINKS */}
        <nav className="sidebar-scroll min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const hasChildren = Array.isArray(item.children) && item.children.length > 0;
            const groupKey = item.label.toLowerCase().replace(/\s+/g, "-");
            const groupOpen = Boolean(openGroups[groupKey]);
            const groupActive = hasChildren
              ? item.children!.some((child) => location.pathname.startsWith(child.to))
              : location.pathname.startsWith(item.to);

            if (hasChildren) {
              return (
                <div key={item.to} className="space-y-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (!sidebarExpanded) setSidebarExpanded(true);
                      setOpenGroups((prev) => ({ ...prev, [groupKey]: !groupOpen }));
                    }}
                    className={cn(
                      "group flex w-full items-center rounded-md py-2.5 transition-all duration-150 text-left relative",
                      sidebarExpanded ? "px-3.5 justify-between" : "justify-center px-0",
                      groupActive
                        ? "bg-slate-100 dark:bg-slate-800/80 text-slate-900 dark:text-white font-bold"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white"
                    )}
                    title={item.label}
                  >
                    <span
                      className={cn(
                        "flex items-center",
                        sidebarExpanded ? "gap-3" : "justify-center"
                      )}
                    >
                      <Icon
                        size={19}
                        className={cn(
                          "transition shrink-0",
                          groupActive
                            ? "text-slate-900 dark:text-white"
                            : "text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white"
                        )}
                      />
                      {sidebarExpanded && (
                        <span className="text-xs font-semibold">{item.label}</span>
                      )}
                    </span>

                    {sidebarExpanded &&
                      (groupOpen ? (
                        <ChevronDown size={14} className="text-slate-400" />
                      ) : (
                        <ChevronRight size={14} className="text-slate-400" />
                      ))}
                  </button>

                  {/* Children dropdown */}
                  {sidebarExpanded && groupOpen ? (
                    <div className="space-y-0.5 pl-7 border-l-2 border-slate-100 dark:border-slate-800 ml-5 my-1">
                      {item.children!.map((child) => {
                        const ChildIcon = child.icon;
                        return (
                          <NavLink
                            key={child.to}
                            to={child.to}
                            className={({ isActive }) =>
                              cn(
                                "group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs transition-all duration-150",
                                isActive
                                  ? "bg-slate-100 dark:bg-slate-800/80 text-slate-900 dark:text-white font-bold"
                                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40"
                              )
                            }
                          >
                            <ChildIcon size={14} className="shrink-0 opacity-70" />
                            <span className="truncate">{child.label}</span>
                          </NavLink>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            }

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "group flex items-center rounded-md py-2.5 transition-all duration-150 relative",
                    sidebarExpanded ? "px-3.5 justify-between" : "justify-center px-0",
                    isActive
                      ? "bg-slate-100 dark:bg-slate-800/80 text-slate-900 dark:text-white font-bold shadow-2xs"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white"
                  )
                }
                title={item.label}
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={cn(
                        "flex items-center",
                        sidebarExpanded ? "gap-3" : "justify-center"
                      )}
                    >
                      <Icon
                        size={19}
                        className={cn(
                          "transition shrink-0",
                          isActive
                            ? "text-slate-900 dark:text-white"
                            : "text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white"
                        )}
                      />
                      {sidebarExpanded && (
                        <span className="text-xs font-semibold">{item.label}</span>
                      )}
                    </span>

                    {/* Badge Count if available */}
                    {item.badgeCount && item.badgeCount > 0 ? (
                      sidebarExpanded ? (
                        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white shadow-xs">
                          {item.badgeCount}
                        </span>
                      ) : (
                        <span className="absolute top-1.5 right-3 h-2 w-2 rounded-full bg-rose-500" />
                      )
                    ) : null}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

      </aside>

      {/* ======================= MAIN CONTENT VIEWPORT ======================= */}
      <div className="flex flex-1 flex-col min-w-0 h-full overflow-hidden bg-[#F8F9FB] dark:bg-[#0F172A]">
        {/* TOPBAR */}
        <header className="shrink-0 border-b border-slate-200/70 dark:border-slate-800 bg-white/80 dark:bg-[#1E293B]/80 backdrop-blur-md z-30 transition-colors">
          <div className="px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-4">
              {/* Left Title & Collapse Button */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSidebarExpanded((prev) => !prev)}
                  className="hidden lg:inline-flex items-center justify-center rounded-md border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-slate-700 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-slate-700 shadow-2xs"
                  type="button"
                  title={sidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}
                >
                  {sidebarExpanded ? <X size={17} /> : <Menu size={17} />}
                </button>

                <button
                  onClick={() => setMobileMenuOpen((prev) => !prev)}
                  className="inline-flex lg:hidden items-center justify-center rounded-md border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-slate-700 dark:text-slate-200 transition"
                  type="button"
                  title={mobileMenuOpen ? "Close menu" : "Open menu"}
                >
                  {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
                </button>

                <div>
                  <h1 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight sm:text-xl">
                    {pageTitle}
                  </h1>
                </div>
              </div>

              {/* Right Controls */}
              <div className="flex items-center gap-2.5 sm:gap-3">
                {/* Dark Mode Toggle Button */}
                <button
                  type="button"
                  onClick={toggleTheme}
                  title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-2xs"
                >
                  {isDark ? (
                    <Sun size={17} className="text-amber-400" />
                  ) : (
                    <Moon size={17} className="text-slate-600 dark:text-slate-300" />
                  )}
                </button>

                {/* Reminders Notification Button */}
                <button
                  type="button"
                  onClick={() => setReminderOpen(true)}
                  title="Follow-up Reminders"
                  className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-2xs"
                >
                  <Bell size={17} />
                  {reminderAlerts.length > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-xs ring-2 ring-white dark:ring-slate-900">
                      {reminderAlerts.length}
                    </span>
                  )}
                </button>

                {/* Profile Dropdown */}
                <div className="relative" ref={profileRef}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setProfileOpen((p) => !p);
                    }}
                    className="inline-flex items-center gap-2.5 rounded-full border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 py-1 pl-1.5 pr-3 shadow-2xs transition hover:bg-slate-50 dark:hover:bg-slate-700"
                    type="button"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#111827] dark:bg-purple-600 text-[11px] font-bold text-white shadow-xs">
                      {initials}
                    </div>
                    <div className="hidden text-left sm:block">
                      <div className="text-xs font-bold leading-4 text-slate-900 dark:text-white">
                        {user?.name || (user?.email ? user.email.split("@")[0] : "User")}
                      </div>
                      <div className="text-[10px] font-medium text-slate-400">
                        {isAdmin ? "Admin" : "Agent"}
                      </div>
                    </div>
                    <ChevronDown size={14} className="text-slate-400" />
                  </button>

                  {profileOpen && (
                    <div className="absolute right-0 mt-2 w-60 overflow-hidden rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl z-50 animate-scale-in">
                      <div className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 p-4">
                        <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {user?.name || user?.email || "User"}
                        </div>
                        <div className="text-xs font-semibold text-purple-600 dark:text-purple-400 mt-0.5">
                          {isAdmin ? "Administrator" : "Agent"}
                        </div>
                      </div>

                      <div className="p-2 space-y-1">
                        <button
                          onClick={openPwdModal}
                          className="w-full flex items-center gap-3 rounded-md px-3 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-200 transition hover:bg-slate-100 dark:hover:bg-slate-800"
                          type="button"
                        >
                          <Key size={15} className="text-slate-400" />
                          Change Password
                        </button>

                        <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                        <button
                          onClick={doLogout}
                          className="w-full flex items-center gap-3 rounded-md px-3 py-2 text-left text-xs font-medium text-rose-600 dark:text-rose-400 transition hover:bg-rose-50 dark:hover:bg-rose-950/30"
                          type="button"
                        >
                          <LogOut size={15} />
                          Logout
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* MAIN BODY OUTLET */}
        <main className="min-h-0 flex-1 overflow-auto p-4 sm:p-6 lg:p-7 transition-colors">
          <Outlet />
        </main>
      </div>

      {/* ======================= MOBILE DRAWER ======================= */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative flex flex-col w-[270px] bg-white dark:bg-[#0E131F] h-full shadow-2xl z-50 p-4">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#111827] dark:bg-[#1E293B] text-white">
                  <span className="font-bold text-sm">CRM</span>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    {displayName}
                  </div>
                  <div className="text-[10px] text-slate-400">{displayEmail}</div>
                </div>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="p-1 text-slate-400">
                <X size={18} />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto py-3 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-md text-xs font-medium transition",
                        isActive
                          ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                          : "text-slate-600 dark:text-slate-400"
                      )
                    }
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={doLogout}
                className="flex items-center gap-3 px-3 py-2 text-xs font-semibold text-rose-600 w-full"
              >
                <LogOut size={16} /> Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================= MODALS ======================= */}

      {/* Follow-up Reminder Modal */}
      {reminderOpen && reminderAlerts.length > 0 && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center px-4 py-6">
          <div
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={dismissAllReminders}
          />

          <div className="relative w-full max-w-3xl overflow-hidden rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F172A] shadow-2xl">
            <div className="border-b border-slate-100 dark:border-slate-800 bg-[#111827] dark:bg-[#1E293B] px-5 py-4 text-white">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 ring-1 ring-white/20">
                    <BellRing size={20} className="text-purple-300" />
                  </div>
                  <div>
                    <div className="text-lg font-bold">Follow-up Reminder</div>
                    <div className="mt-0.5 text-xs text-purple-200">
                      {reminderAlerts.length} active reminder{reminderAlerts.length > 1 ? "s" : ""}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={dismissAllReminders}
                  className="rounded-md border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
                >
                  Dismiss all
                </button>
              </div>
            </div>

            <div className="max-h-[72vh] overflow-auto bg-slate-50 dark:bg-slate-900/50 p-4 sm:p-5">
              <div className="space-y-3.5">
                {reminderAlerts.map((item) => (
                  <div
                    key={getReminderKey(item)}
                    className="overflow-hidden rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm"
                  >
                    <div className="border-l-4 border-purple-600 p-4 sm:p-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-purple-50 dark:bg-purple-950/60 px-2.5 py-0.5 text-[10px] font-bold uppercase text-purple-600 dark:text-purple-400">
                              {item.type === "payment_duration" ? "Duration complete" : "Due soon"}
                            </span>
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                              {item.type === "payment_duration"
                                ? `Payment due ${formatReminderDateTime(item.due_at || item.reminder_at)}`
                                : `Follow-up at ${formatReminderDateTime(item.followup_date)}`}
                            </span>
                          </div>

                          <div className="mt-2 truncate text-lg font-bold text-slate-900 dark:text-white">
                            {item.type === "payment_duration"
                              ? item.lead_name || `Payment #${item.id}`
                              : item.lead?.name || `Lead #${item.lead?.id || item.lead_id || item.id}`}
                          </div>

                          <div className="mt-3 grid gap-2.5 text-xs text-slate-600 dark:text-slate-300 sm:grid-cols-2">
                            <div className="flex items-center gap-2 rounded-md bg-slate-50 dark:bg-slate-800/60 px-3 py-2">
                              <User size={15} className="text-purple-500" />
                              <span>
                                {item.type === "payment_duration" ? "Payment case: " : "Added by: "}
                                <span className="font-semibold text-slate-900 dark:text-white">
                                  {item.type === "payment_duration"
                                    ? item.case_type || "Not set"
                                    : getReminderCreatorName(item)}
                                </span>
                              </span>
                            </div>

                            <div className="flex items-center gap-2 rounded-md bg-slate-50 dark:bg-slate-800/60 px-3 py-2">
                              <Phone size={15} className="text-purple-500" />
                              <span>
                                {item.type === "payment_duration"
                                  ? item.contact_no
                                  : item.lead?.contact_no || "Contact not available"}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 rounded-md bg-slate-50 dark:bg-slate-800/60 px-3 py-2">
                              <Clock3 size={15} className="text-purple-500" />
                              <span>
                                {item.type === "payment_duration"
                                  ? `Duration: ${item.duration || ""}`
                                  : `Reminder: ${formatReminderDateTime(item.reminder_at)}`}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 rounded-md bg-slate-50 dark:bg-slate-800/60 px-3 py-2">
                              <BellRing size={15} className="text-purple-500" />
                              <span>
                                {item.type === "payment_duration"
                                  ? `Started: ${formatReminderDateTime(item.date)}`
                                  : item.status?.name || "Status not set"}
                              </span>
                            </div>
                          </div>

                          {item.type !== "payment_duration" && item.remark ? (
                            <div className="mt-3 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-3.5 py-2 text-xs text-slate-600 dark:text-slate-300">
                              {item.remark}
                            </div>
                          ) : null}
                        </div>

                        <div className="flex shrink-0 gap-2 sm:flex-col">
                          <button
                            type="button"
                            onClick={() => openReminderLead(item)}
                            className="rounded-md bg-purple-600 hover:bg-purple-700 px-4 py-2 text-xs font-semibold text-white transition shadow-sm"
                          >
                            {item.type === "payment_duration" ? "Open Payments" : "Open Lead"}
                          </button>

                          <button
                            type="button"
                            onClick={() => dismissReminder(item)}
                            className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-slate-700"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Duration Reminder Modal */}
      {paymentReminderOpen && paymentReminderAlerts.length > 0 && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center px-4 py-6">
          <div
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={dismissAllPaymentReminders}
          />

          <div className="relative flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-md border border-amber-300 dark:border-amber-800/60 bg-white dark:bg-[#0F172A] shadow-2xl">
            <div className="border-b border-amber-200 dark:border-amber-800/50 bg-gradient-to-r from-amber-500/15 to-orange-500/10 px-6 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-lg font-bold text-slate-900 dark:text-white">
                    Payment Duration Reminder
                  </div>
                  <div className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
                    {paymentReminderAlerts.length} payment duration completed
                  </div>
                </div>

                <button
                  type="button"
                  onClick={dismissAllPaymentReminders}
                  className="rounded-md border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 transition hover:bg-amber-50"
                >
                  Dismiss all
                </button>
              </div>
            </div>

            <div className="overflow-auto bg-slate-50 dark:bg-slate-900/50 p-5">
              <div className="space-y-3.5">
                {paymentReminderAlerts.map((item) => (
                  <div
                    key={getReminderKey(item)}
                    className="rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                          Duration complete
                        </div>
                        <div className="mt-1 truncate text-base font-bold text-slate-900 dark:text-white">
                          {item.lead_name || `Payment #${item.id}`}
                        </div>
                      </div>
                      <div className="shrink-0 rounded-md bg-amber-100 dark:bg-amber-950/60 px-2.5 py-1 text-xs font-bold text-amber-800 dark:text-amber-300">
                        {item.duration || "-"}
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2.5 text-xs text-slate-600 dark:text-slate-300 sm:grid-cols-2">
                      <div className="rounded-md bg-slate-50 dark:bg-slate-800/60 px-3 py-2">
                        Contact:{" "}
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {item.contact_no || "-"}
                        </span>
                      </div>
                      <div className="rounded-md bg-slate-50 dark:bg-slate-800/60 px-3 py-2">
                        Case:{" "}
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {item.case_type || "-"}
                        </span>
                      </div>
                      <div className="rounded-md bg-slate-50 dark:bg-slate-800/60 px-3 py-2">
                        Started:{" "}
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {formatReminderDateTime(item.date)}
                        </span>
                      </div>
                      <div className="rounded-md bg-slate-50 dark:bg-slate-800/60 px-3 py-2">
                        Due:{" "}
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {formatReminderDateTime(item.due_at || item.reminder_at)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => dismissPaymentReminder(item)}
                        className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-slate-700"
                      >
                        Dismiss
                      </button>
                      <button
                        type="button"
                        onClick={() => openPaymentReminder(item)}
                        className="rounded-md bg-purple-600 hover:bg-purple-700 px-3.5 py-2 text-xs font-semibold text-white transition shadow-sm"
                      >
                        Open Payments
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Password Change Modal */}
      {pwdOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={closePwdModal}
          />

          <div
            ref={pwdRef}
            className="relative w-full max-w-md overflow-hidden rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-5 py-4">
              <div>
                <div className="text-base font-bold text-slate-900 dark:text-white">
                  Change Password
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Update your account password securely.
                </div>
              </div>

              <button
                type="button"
                onClick={closePwdModal}
                className="grid h-8 w-8 place-items-center rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                title="Close"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={submitChangePassword} className="space-y-4 p-5">
              {pwdErr && (
                <div className="rounded-md border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-3.5 py-2.5 text-xs text-red-600 dark:text-red-400">
                  {pwdErr}
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="mt-1 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="mt-1 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closePwdModal}
                  className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 transition hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={pwdLoading}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-xs font-semibold text-white transition shadow-sm",
                    pwdLoading
                      ? "cursor-not-allowed bg-slate-400"
                      : "bg-purple-600 hover:bg-purple-700"
                  )}
                >
                  {pwdLoading && <Loader2 size={14} className="animate-spin" />}
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
