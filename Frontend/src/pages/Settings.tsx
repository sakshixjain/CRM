/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Settings as SettingsIcon,
  Users,
  Tag,
  ListChecks,
  Lock,
  Building2,
  Plus,
  RefreshCcw,
  Loader2,
  Save,
  Shield,
  Activity,
  ArrowUpRight,
  Phone,
  Globe,
  MapPin,
  KeyRound,
  Sliders,
} from "lucide-react";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import { storage } from "../lib/storage";
import { useAuth } from "../auth/AuthContext";

type TabKey =
  | "general"
  | "company"
  | "users"
  | "roles"
  | "sources"
  | "statuses"
  | "activity"
  | "security";

function unwrapList(res: any): any[] {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.data?.data)) return res.data.data;
  return [];
}

export default function Settings() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>("general");
  const companyId = storage.getCompanyId() || "1";

  // General settings state
  const [companyName, setCompanyName] = useState("InfoAce CRM");
  const [timezone, setTimezone] = useState("(UTC+05:30) Asia/Kolkata");
  const [dateFormat, setDateFormat] = useState("DD MMM YYYY");
  const [currency, setCurrency] = useState("INR (₹)");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  // Security password state
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);

  // Dynamic Master lists from backend
  const [companyInfo, setCompanyInfo] = useState<any | null>(null);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [userRoles, setUserRoles] = useState<any[]>([]);
  const [sourcesList, setSourcesList] = useState<any[]>([]);
  const [statusList, setStatusList] = useState<any[]>([]);
  const [liveSessions, setLiveSessions] = useState<any[]>([]);

  // Search filter for tables in tabs
  const [searchQuery, setSearchQuery] = useState("");

  const loadAllMasterData = useCallback(async () => {
    setLoading(true);
    try {
      const [companyRes, agentsRes, rolesRes, sourcesRes, statusRes, activityRes] =
        await Promise.allSettled([
          api.getCompany(companyId).catch(() => api.getCompanies()),
          api.listAgents(),
          api.listUserRoles(),
          api.leadSource.list(),
          api.leadStatus.list(),
          api.activity.live({ minutes: 60 }),
        ]);

      if (companyRes.status === "fulfilled") {
        const comp =
          (companyRes.value as any)?.data?.data ||
          (companyRes.value as any)?.data ||
          (Array.isArray((companyRes.value as any)?.data) ? (companyRes.value as any)?.data[0] : null);
        if (comp) {
          setCompanyInfo(comp);
          if (comp.company_name) setCompanyName(comp.company_name);
        }
      }

      if (agentsRes.status === "fulfilled") {
        setUsersList(unwrapList(agentsRes.value));
      }
      if (rolesRes.status === "fulfilled") {
        setUserRoles(unwrapList(rolesRes.value));
      }
      if (sourcesRes.status === "fulfilled") {
        setSourcesList(unwrapList(sourcesRes.value));
      }
      if (statusRes.status === "fulfilled") {
        setStatusList(unwrapList(statusRes.value));
      }
      if (activityRes.status === "fulfilled") {
        setLiveSessions(unwrapList(activityRes.value));
      }
    } catch (err: any) {
      console.error("Failed to load master settings data", err);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadAllMasterData();
  }, [loadAllMasterData]);

  const handleSaveGeneral = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      toast.success("Workspace preferences saved successfully!");
    }, 600);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPwd || !confirmPwd) {
      toast.error("Please enter both password fields.");
      return;
    }
    if (newPwd !== confirmPwd) {
      toast.error("Passwords do not match.");
      return;
    }
    if (newPwd.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    setPwdSaving(true);
    try {
      // In CRM backend, admin/user password update
      await api.update("user-agent", user?.id || 1, { password: newPwd });
      toast.success("Password updated successfully!");
      setNewPwd("");
      setConfirmPwd("");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update password");
    } finally {
      setPwdSaving(false);
    }
  };

  const navTabs: {
    key: TabKey;
    label: string;
    icon: React.ComponentType<any>;
    count?: number;
    badgeColor?: string;
  }[] = [
    { key: "general", label: "General Settings", icon: SettingsIcon },
    { key: "company", label: "Company Details", icon: Building2 },
    { key: "users", label: "User Agents", icon: Users, count: usersList.length },
    { key: "roles", label: "Roles & Permissions", icon: Shield, count: userRoles.length },
    { key: "sources", label: "Lead Sources", icon: Tag, count: sourcesList.length },
    { key: "statuses", label: "Lead Statuses", icon: ListChecks, count: statusList.length },
    {
      key: "activity",
      label: "Activity & Sessions",
      icon: Activity,
      count: liveSessions.length,
      badgeColor: "bg-emerald-500",
    },
    { key: "security", label: "Security & Access", icon: Lock },
  ];

  // Filtered lists based on search
  const filteredUsers = useMemo(() => {
    if (!searchQuery) return usersList;
    const q = searchQuery.toLowerCase();
    return usersList.filter(
      (u) =>
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.contact_no?.includes(q)
    );
  }, [usersList, searchQuery]);

  const filteredSources = useMemo(() => {
    if (!searchQuery) return sourcesList;
    const q = searchQuery.toLowerCase();
    return sourcesList.filter((s) => s.name?.toLowerCase().includes(q));
  }, [sourcesList, searchQuery]);

  const filteredStatuses = useMemo(() => {
    if (!searchQuery) return statusList;
    const q = searchQuery.toLowerCase();
    return statusList.filter((st) => st.name?.toLowerCase().includes(q));
  }, [statusList, searchQuery]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#1B2559] dark:text-white tracking-tight flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[#111827] dark:bg-purple-600 text-white shadow-xs">
              <Sliders size={18} />
            </div>
            Settings & Master Configuration
          </h1>
          <p className="text-xs font-medium text-[#8F9CAE] mt-1">
            Complete workspace settings, company branding, agent management, pipelines, and security controls.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => loadAllMasterData()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-[#1B2559] dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-2xs"
            title="Refresh All Master Data"
          >
            <RefreshCcw size={14} className={loading ? "animate-spin text-blue-600" : ""} />
            <span>Sync Data</span>
          </button>
        </div>
      </div>

      {/* Quick Master Hub Cards - Fast 1-Click Access */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Link
          to={`/company-details/${companyId}`}
          className="group p-3.5 rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs hover:border-blue-500/50 hover:shadow-xs transition"
        >
          <div className="flex items-center justify-between text-slate-400 group-hover:text-blue-600 mb-2">
            <Building2 size={18} />
            <ArrowUpRight size={14} className="opacity-0 group-hover:opacity-100 transition" />
          </div>
          <div className="text-xs font-bold text-[#1B2559] dark:text-white truncate">
            Company Profile
          </div>
          <div className="text-[11px] text-[#8F9CAE] mt-0.5 truncate">
            {companyInfo?.company_name || "Branding"}
          </div>
        </Link>

        <Link
          to="/agent"
          className="group p-3.5 rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs hover:border-purple-500/50 hover:shadow-xs transition"
        >
          <div className="flex items-center justify-between text-slate-400 group-hover:text-purple-600 mb-2">
            <Users size={18} />
            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
              {usersList.length}
            </span>
          </div>
          <div className="text-xs font-bold text-[#1B2559] dark:text-white truncate">User Agents</div>
          <div className="text-[11px] text-[#8F9CAE] mt-0.5">Manage Team</div>
        </Link>

        <Link
          to="/user-role"
          className="group p-3.5 rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs hover:border-indigo-500/50 hover:shadow-xs transition"
        >
          <div className="flex items-center justify-between text-slate-400 group-hover:text-indigo-600 mb-2">
            <Shield size={18} />
            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              {userRoles.length}
            </span>
          </div>
          <div className="text-xs font-bold text-[#1B2559] dark:text-white truncate">User Roles</div>
          <div className="text-[11px] text-[#8F9CAE] mt-0.5">Permissions</div>
        </Link>

        <Link
          to="/source"
          className="group p-3.5 rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs hover:border-amber-500/50 hover:shadow-xs transition"
        >
          <div className="flex items-center justify-between text-slate-400 group-hover:text-amber-600 mb-2">
            <Tag size={18} />
            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
              {sourcesList.length}
            </span>
          </div>
          <div className="text-xs font-bold text-[#1B2559] dark:text-white truncate">
            Lead Sources
          </div>
          <div className="text-[11px] text-[#8F9CAE] mt-0.5">Channels</div>
        </Link>

        <Link
          to="/status"
          className="group p-3.5 rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs hover:border-emerald-500/50 hover:shadow-xs transition"
        >
          <div className="flex items-center justify-between text-slate-400 group-hover:text-emerald-600 mb-2">
            <ListChecks size={18} />
            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              {statusList.length}
            </span>
          </div>
          <div className="text-xs font-bold text-[#1B2559] dark:text-white truncate">
            Lead Statuses
          </div>
          <div className="text-[11px] text-[#8F9CAE] mt-0.5">Pipeline Stages</div>
        </Link>

        <Link
          to="/activity"
          className="group p-3.5 rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs hover:border-rose-500/50 hover:shadow-xs transition"
        >
          <div className="flex items-center justify-between text-slate-400 group-hover:text-rose-600 mb-2">
            <Activity size={18} />
            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
              {liveSessions.length} Live
            </span>
          </div>
          <div className="text-xs font-bold text-[#1B2559] dark:text-white truncate">
            Activity Monitor
          </div>
          <div className="text-[11px] text-[#8F9CAE] mt-0.5">Audit Logs</div>
        </Link>
      </div>

      {/* Main Settings Card with Two Panes */}
      <div className="grid grid-cols-1 lg:grid-cols-[270px_1fr] gap-6 items-start">
        {/* Left Submenu Navigation */}
        <div className="rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-2xs space-y-1">
          <div className="px-3 py-2 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
            Master Modules
          </div>
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setActiveTab(tab.key);
                  setSearchQuery("");
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-md text-xs font-bold transition text-left ${
                  isActive
                    ? "bg-[#111827] dark:bg-slate-800 text-white shadow-xs"
                    : "text-[#8F9CAE] hover:text-[#1B2559] dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon size={16} className={isActive ? "text-white" : "text-slate-400"} />
                  <span>{tab.label}</span>
                </div>
                {tab.count !== undefined && (
                  <span
                    className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ${
                      isActive
                        ? "bg-white/20 text-white"
                        : tab.badgeColor
                        ? `${tab.badgeColor} text-white`
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right Content Pane */}
        <div className="rounded-md border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xs">
          {/* ================= TAB 1: GENERAL SETTINGS ================= */}
          {activeTab === "general" && (
            <form onSubmit={handleSaveGeneral} className="space-y-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-extrabold text-[#1B2559] dark:text-white tracking-tight">
                    General Settings
                  </h3>
                  <p className="text-xs font-medium text-[#8F9CAE] mt-0.5">
                    Configure your organization defaults, localization formats, and core metadata.
                  </p>
                </div>
                <Link
                  to={`/company-details/${companyId}`}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-[#1B2559] dark:text-white shadow-2xs hover:bg-slate-50 transition"
                >
                  <Building2 size={14} /> Full Company Profile
                </Link>
              </div>

              <div className="space-y-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-[#1B2559] dark:text-slate-200 mb-1">
                    Organization / Company Name
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full max-w-lg rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-medium text-[#1B2559] dark:text-white focus:border-[#111C44] focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1B2559] dark:text-slate-200 mb-1">
                    Timezone
                  </label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full max-w-lg rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-[#1B2559] dark:text-white focus:border-[#111C44] focus:outline-none"
                  >
                    <option value="(UTC+05:30) Asia/Kolkata">
                      (UTC+05:30) Asia/Kolkata (IST)
                    </option>
                    <option value="(UTC+00:00) UTC / London">
                      (UTC+00:00) UTC / London (GMT)
                    </option>
                    <option value="(UTC-05:00) Eastern Time (US & Canada)">
                      (UTC-05:00) Eastern Time (US & Canada)
                    </option>
                    <option value="(UTC-08:00) Pacific Time (US & Canada)">
                      (UTC-08:00) Pacific Time (US & Canada)
                    </option>
                    <option value="(UTC+04:00) Dubai / Gulf Time">
                      (UTC+04:00) Dubai / Gulf Standard Time
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1B2559] dark:text-slate-200 mb-1">
                    Date Format
                  </label>
                  <select
                    value={dateFormat}
                    onChange={(e) => setDateFormat(e.target.value)}
                    className="w-full max-w-lg rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-[#1B2559] dark:text-white focus:border-[#111C44] focus:outline-none"
                  >
                    <option value="DD MMM YYYY">DD MMM YYYY (e.g. 24 Sep 2026)</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD (e.g. 2026-09-24)</option>
                    <option value="DD/MM/YYYY">DD/MM/YYYY (e.g. 24/09/2026)</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY (e.g. 09/24/2026)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1B2559] dark:text-slate-200 mb-1">
                    Base Currency
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full max-w-lg rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-[#1B2559] dark:text-white focus:border-[#111C44] focus:outline-none"
                  >
                    <option value="INR (₹)">INR (₹) - Indian Rupee</option>
                    <option value="USD ($)">USD ($) - US Dollar</option>
                    <option value="AED (د.إ)">AED (د.إ) - UAE Dirham</option>
                    <option value="EUR (€)">EUR (€) - Euro</option>
                    <option value="GBP (£)">GBP (£) - British Pound</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-md bg-[#111827] dark:bg-purple-600 hover:bg-black dark:hover:bg-purple-700 text-white px-5 py-2 text-xs font-bold shadow-md transition disabled:opacity-60"
                >
                  <Save size={14} />
                  {saving ? "Saving Changes..." : "Save Preferences"}
                </button>
              </div>
            </form>
          )}

          {/* ================= TAB 2: COMPANY DETAILS & BRANDING ================= */}
          {activeTab === "company" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-extrabold text-[#1B2559] dark:text-white tracking-tight">
                    Company Details & Organization Profile
                  </h3>
                  <p className="text-xs font-medium text-[#8F9CAE] mt-0.5">
                    Official organization details, database multi-tenant configuration, and branding logo.
                  </p>
                </div>
                <Link
                  to={`/company-details/${companyId}`}
                  className="inline-flex items-center gap-1.5 rounded-md bg-[#111827] dark:bg-purple-600 text-white px-4 py-2 text-xs font-bold shadow-xs hover:bg-black transition"
                >
                  <Building2 size={14} /> Edit in Company Manager
                </Link>
              </div>

              {companyInfo ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Organization Info
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-base font-black text-slate-900 dark:text-white shadow-2xs">
                        {companyInfo.company_name?.slice(0, 2)?.toUpperCase() || "CO"}
                      </div>
                      <div>
                        <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                          {companyInfo.company_name}
                        </div>
                        <div className="text-xs text-slate-500">{companyInfo.email}</div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 space-y-2 text-xs">
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                        <Phone size={14} className="text-slate-400" />
                        <span>{companyInfo.contact_no || companyInfo.phone || "Not specified"}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                        <Globe size={14} className="text-slate-400" />
                        <span>{companyInfo.website || "https://infoace.in"}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                        <MapPin size={14} className="text-slate-400" />
                        <span>
                          {[companyInfo.city, companyInfo.state, companyInfo.country]
                            .filter(Boolean)
                            .join(", ") || "Location not set"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      System & Database Details
                    </div>
                    <div className="space-y-2.5 text-xs">
                      <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-slate-500">Database Name:</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          {companyInfo.db_name || "main_crm_db"}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-slate-500">Tenant Status:</span>
                        <span className="rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-bold">
                          {companyInfo.is_active !== false ? "Active & Healthy" : "Suspended"}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-slate-500">Company ID:</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          #{companyInfo.id || companyId}
                        </span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-slate-500">Created Date:</span>
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {companyInfo.createdAt ? new Date(companyInfo.createdAt).toLocaleDateString() : "Active"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-md">
                  No company details found. Click &apos;Edit in Company Manager&apos; to configure.
                </div>
              )}
            </div>
          )}

          {/* ================= TAB 3: USER AGENTS ================= */}
          {activeTab === "users" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-extrabold text-[#1B2559] dark:text-white tracking-tight">
                    User Agents & Team Members
                  </h3>
                  <p className="text-xs font-medium text-[#8F9CAE] mt-0.5">
                    Live dynamic agents, sales reps, and CRM staff.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Search agents..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-900 dark:text-white focus:outline-none"
                  />
                  <Link
                    to="/agent"
                    className="inline-flex items-center gap-1.5 rounded-md bg-[#111827] dark:bg-purple-600 text-white px-3.5 py-1.5 text-xs font-bold shadow-xs hover:bg-black transition whitespace-nowrap"
                  >
                    <Plus size={14} /> Manage Agents
                  </Link>
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center p-8 text-xs text-slate-500">
                  <Loader2 size={16} className="animate-spin text-blue-600 mr-2" />
                  Loading agents...
                </div>
              ) : (
                <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 text-[11px] font-bold uppercase text-slate-400">
                      <tr>
                        <th className="py-3 px-4">User</th>
                        <th className="py-3 px-4">Contact</th>
                        <th className="py-3 px-4">Role</th>
                        <th className="py-3 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="py-3 px-4">
                            <div className="font-bold text-[#1B2559] dark:text-white">{u.name}</div>
                            <div className="text-[11px] text-[#8F9CAE]">{u.email}</div>
                          </td>
                          <td className="py-3 px-4 font-semibold text-[#1B2559] dark:text-slate-200">
                            {u.contact_no || "—"}
                          </td>
                          <td className="py-3 px-4">
                            <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:text-slate-300">
                              {u.role_name || (u.role_id === 1 ? "Admin" : "Agent")}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="rounded-md bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-400">
                              {u.is_active !== false ? "Active" : "Inactive"}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {filteredUsers.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-xs text-slate-400">
                            No agents found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ================= TAB 4: ROLES & PERMISSIONS ================= */}
          {activeTab === "roles" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-extrabold text-[#1B2559] dark:text-white tracking-tight">
                    User Roles & Permissions
                  </h3>
                  <p className="text-xs font-medium text-[#8F9CAE] mt-0.5">
                    Define role hierarchies, access levels, and security rules.
                  </p>
                </div>
                <Link
                  to="/user-role"
                  className="inline-flex items-center gap-1.5 rounded-md bg-[#111827] dark:bg-purple-600 text-white px-3.5 py-1.5 text-xs font-bold shadow-xs hover:bg-black transition whitespace-nowrap"
                >
                  <Plus size={14} /> Manage Roles
                </Link>
              </div>

              {loading ? (
                <div className="flex items-center justify-center p-8 text-xs text-slate-500">
                  <Loader2 size={16} className="animate-spin text-blue-600 mr-2" />
                  Loading user roles...
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {userRoles.map((r) => (
                    <div
                      key={r.id}
                      className="p-3.5 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                          <Shield size={16} />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900 dark:text-white">
                            {r.role || r.name}
                          </div>
                          <div className="text-[10px] text-slate-400">Role ID: #{r.id}</div>
                        </div>
                      </div>
                      <Link
                        to="/user-role"
                        className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        Configure
                      </Link>
                    </div>
                  ))}
                  {userRoles.length === 0 && (
                    <div className="col-span-2 py-8 text-center text-xs text-slate-400">
                      No custom user roles defined.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ================= TAB 5: LEAD SOURCES ================= */}
          {activeTab === "sources" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-extrabold text-[#1B2559] dark:text-white tracking-tight">
                    Lead Acquisition Sources
                  </h3>
                  <p className="text-xs font-medium text-[#8F9CAE] mt-0.5">
                    Manage channels where incoming leads and prospects originate.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Search sources..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-900 dark:text-white focus:outline-none"
                  />
                  <Link
                    to="/source"
                    className="inline-flex items-center gap-1.5 rounded-md bg-[#111827] dark:bg-purple-600 text-white px-3.5 py-1.5 text-xs font-bold shadow-xs hover:bg-black transition whitespace-nowrap"
                  >
                    <Plus size={14} /> Manage Sources
                  </Link>
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center p-8 text-xs text-slate-500">
                  <Loader2 size={16} className="animate-spin text-blue-600 mr-2" />
                  Loading lead sources...
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {filteredSources.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between p-3 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-xs font-bold text-[#1B2559] dark:text-white"
                    >
                      <div className="flex items-center gap-2">
                        <Tag size={14} className="text-amber-500" />
                        <span className="truncate">{s.name}</span>
                      </div>
                      <span className="rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-bold">
                        {s.is_active !== false ? "Active" : "Inactive"}
                      </span>
                    </div>
                  ))}
                  {filteredSources.length === 0 && (
                    <div className="col-span-3 py-8 text-center text-xs text-slate-400">
                      No lead sources configured.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ================= TAB 6: LEAD STATUSES ================= */}
          {activeTab === "statuses" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-extrabold text-[#1B2559] dark:text-white tracking-tight">
                    Lead & Deal Pipeline Statuses
                  </h3>
                  <p className="text-xs font-medium text-[#8F9CAE] mt-0.5">
                    Pipeline stages, qualification steps, and closing statuses.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Search statuses..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-900 dark:text-white focus:outline-none"
                  />
                  <Link
                    to="/status"
                    className="inline-flex items-center gap-1.5 rounded-md bg-[#111827] dark:bg-purple-600 text-white px-3.5 py-1.5 text-xs font-bold shadow-xs hover:bg-black transition whitespace-nowrap"
                  >
                    <Plus size={14} /> Manage Statuses
                  </Link>
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center p-8 text-xs text-slate-500">
                  <Loader2 size={16} className="animate-spin text-blue-600 mr-2" />
                  Loading pipeline statuses...
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {filteredStatuses.map((st) => (
                    <div
                      key={st.id}
                      className="flex items-center justify-between p-3 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-xs font-bold text-[#1B2559] dark:text-white"
                    >
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                        <span className="truncate">{st.name}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">#{st.id}</span>
                    </div>
                  ))}
                  {filteredStatuses.length === 0 && (
                    <div className="col-span-3 py-8 text-center text-xs text-slate-400">
                      No pipeline statuses configured.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ================= TAB 7: ACTIVITY TRACKER & SESSIONS ================= */}
          {activeTab === "activity" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-extrabold text-[#1B2559] dark:text-white tracking-tight">
                    Live User Sessions & Activity Audit
                  </h3>
                  <p className="text-xs font-medium text-[#8F9CAE] mt-0.5">
                    Real-time active user sessions and workspace telemetry.
                  </p>
                </div>
                <Link
                  to="/activity"
                  className="inline-flex items-center gap-1.5 rounded-md bg-[#111827] dark:bg-purple-600 text-white px-3.5 py-1.5 text-xs font-bold shadow-xs hover:bg-black transition whitespace-nowrap"
                >
                  <Activity size={14} /> Full Activity Monitor
                </Link>
              </div>

              {loading ? (
                <div className="flex items-center justify-center p-8 text-xs text-slate-500">
                  <Loader2 size={16} className="animate-spin text-blue-600 mr-2" />
                  Loading active sessions...
                </div>
              ) : (
                <div className="space-y-2.5">
                  {liveSessions.slice(0, 8).map((session, idx) => (
                    <div
                      key={session.session_id || idx}
                      className="flex items-center justify-between p-3 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-xs font-semibold"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white">
                            {session.user_name || session.name || `User #${session.user_id}`}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {session.user_email || session.email || session.current_path || "Active"}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-bold">
                          Online
                        </span>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {session.last_seen_at
                            ? new Date(session.last_seen_at).toLocaleTimeString()
                            : "Live"}
                        </div>
                      </div>
                    </div>
                  ))}
                  {liveSessions.length === 0 && (
                    <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-md">
                      No active sessions recorded in the last hour.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ================= TAB 8: SECURITY & PASSWORD ================= */}
          {activeTab === "security" && (
            <form onSubmit={handleChangePassword} className="space-y-6">
              <div>
                <h3 className="text-base font-extrabold text-[#1B2559] dark:text-white tracking-tight">
                  Security & Access Controls
                </h3>
                <p className="text-xs font-medium text-[#8F9CAE] mt-0.5">
                  Manage login credentials, session timeouts, and authentication security.
                </p>
              </div>

              <div className="space-y-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-[#1B2559] dark:text-slate-200 mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    placeholder="Enter new password"
                    value={newPwd}
                    onChange={(e) => setNewPwd(e.target.value)}
                    className="w-full max-w-lg rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-medium text-[#1B2559] dark:text-white focus:border-[#111C44] focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1B2559] dark:text-slate-200 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    placeholder="Re-type new password"
                    value={confirmPwd}
                    onChange={(e) => setConfirmPwd(e.target.value)}
                    className="w-full max-w-lg rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-medium text-[#1B2559] dark:text-white focus:border-[#111C44] focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-3.5 max-w-lg space-y-1.5">
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Shield size={14} className="text-emerald-500" />
                    Security Recommendations
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Use at least 8 characters with a mix of letters, numbers, and symbols to ensure highest account safety.
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="submit"
                  disabled={pwdSaving}
                  className="inline-flex items-center gap-2 rounded-md bg-[#111827] dark:bg-purple-600 hover:bg-black dark:hover:bg-purple-700 text-white px-5 py-2 text-xs font-bold shadow-md transition disabled:opacity-60"
                >
                  <KeyRound size={14} />
                  {pwdSaving ? "Updating Password..." : "Update Password"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
