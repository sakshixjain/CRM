import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  Activity as ActivityIcon,
  Clock3,
  Eye,
  Monitor,
  MousePointerClick,
  RefreshCcw,
  TimerReset,
} from "lucide-react";
import PageHeader from "./Header";
import { api } from "../lib/api";
import { useAuth } from "../auth/AuthContext";

const PAGE_SIZE = 10;

type ActivitySession = {
  user_id?: number | string;
  user_name?: string | null;
  user_email?: string | null;
  name?: string | null;
  email?: string | null;
  session_id: string;
  login_at?: string;
  last_seen_at?: string | null;
  status?: string;
  active_ms?: number;
  visible_ms?: number;
  idle_ms?: number;
  total_clicks?: number;
  total_scrolls?: number;
  mouse_moves?:number;
  total_keydowns?: number;
  current_path?: string;
  current_open_tabs?: number;
  open_tabs_peak?: number;
  ip_address?: string;
};

type PageStat = {
  path: string;
  active_ms?: number;
  visible_ms?: number;
  idle_ms?: number;
  visits?: number;
};

type EventBatch = {
  id: number;
  sent_at?: string;
  status?: string;
  current_path?: string;
  clicks?: number;
  scrolls?: number;
  keydowns?: number;
};

type UserRow = { id: number | string; name?: string; email?: string };

const msLabel = (value?: number) => {
  const s = Math.floor(Number(value || 0) / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
};

const dateLabel = (value?: string | null) => {
  if (!value) return "-";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const statusClasses = (status?: string) => {
  switch ((status || "").toLowerCase()) {
    case "active":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "idle":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "hidden":
      return "bg-slate-100 text-slate-700 border-slate-200";
    case "closed":
      return "bg-rose-50 text-rose-700 border-rose-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
};

const paginate = <T,>(rows: T[], page: number) =>
  rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

function MetricCard({
  label,
  value,
  help,
  icon,
}: {
  label: string;
  value: string | number;
  help: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-slate-500">{label}</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">{value}</div>
          <div className="mt-1 text-sm text-slate-500">{help}</div>
        </div>
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-slate-100 text-slate-700">{icon}</div>
      </div>
    </div>
  );
}

function DetailBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
      <div className="text-sm font-medium text-slate-500">{label}</div>
      <div className="mt-2 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function Pagination({
  page,
  total,
  onChange,
}: {
  page: number;
  total: number;
  onChange: (n: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (total <= PAGE_SIZE) return null;
  return (
    <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4">
      <div className="text-sm text-slate-500">Page {page} of {pages}</div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onChange(page - 1)} disabled={page <= 1} className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50">Prev</button>
        <button type="button" onClick={() => onChange(page + 1)} disabled={page >= pages} className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50">Next</button>
      </div>
    </div>
  );
}

export default function Activity() {
  const { user, isAdmin } = useAuth();
  const [minutes, setMinutes] = useState(5);
  const [sessionLimit, setSessionLimit] = useState(10);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [loadingLive, setLoadingLive] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [closingStale, setClosingStale] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveSessions, setLiveSessions] = useState<ActivitySession[]>([]);
  const [userSessions, setUserSessions] = useState<ActivitySession[]>([]);
  const [selectedSession, setSelectedSession] = useState<ActivitySession | null>(null);
  const [pageStats, setPageStats] = useState<PageStat[]>([]);
  const [eventBatches, setEventBatches] = useState<EventBatch[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [livePage, setLivePage] = useState(1);
  const [sessionPage, setSessionPage] = useState(1);
  const [pageStatPage, setPageStatPage] = useState(1);
  const [timelinePage, setTimelinePage] = useState(1);

  const userMap = useMemo(() => {
    const map = new Map<string, UserRow>();
    users.forEach((row) => map.set(String(row.id), row));
    if (user?.id) map.set(String(user.id), { id: user.id, name: user.name, email: user.email });
    return map;
  }, [user?.email, user?.id, user?.name, users]);

  const userOptions = useMemo(
    () => Array.from(userMap.values()).sort((a, b) => String(a.name || a.email || a.id).localeCompare(String(b.name || b.email || b.id))),
    [userMap]
  );

  const getUserName = useCallback(
    (
      userId?: number | string,
      session?: Pick<ActivitySession, "user_name" | "user_email" | "name" | "email"> | null
    ) => {
      if (session?.user_name) return session.user_name;
      if (session?.name) return session.name;
      if (session?.user_email) return session.user_email;
      if (session?.email) return session.email;
      if (userId === undefined || userId === null) return "Unknown user";
      const row = userMap.get(String(userId));
      return row?.name || row?.email || `User #${userId}`;
    },
    [userMap]
  );

  const refreshAll = () => setRefreshNonce((x) => x + 1);

  useEffect(() => {
    if (!user?.id || !isAdmin) return;
    let ignore = false;
    const run = async () => {
      setLoadingLive(true);
      try {
        const [liveRes, usersRes] = await Promise.all([api.activity.live({ minutes }), api.listAgents()]);
        if (ignore) return;
        const nextLive = liveRes.data || [];
        setLiveSessions(nextLive);
        setUsers(Array.isArray(usersRes) ? usersRes : []);
        setLivePage(1);
        if (!selectedUserId && nextLive[0]?.user_id) setSelectedUserId(String(nextLive[0].user_id));
      } catch (err: any) {
        if (!ignore) setError(err?.message || "Failed to load activity data");
      } finally {
        if (!ignore) setLoadingLive(false);
      }
    };
    void run();
    return () => {
      ignore = true;
    };
  }, [isAdmin, minutes, refreshNonce, selectedUserId, user?.id]);

  useEffect(() => {
    if (!user?.id || !isAdmin || !selectedUserId) {
      setUserSessions([]);
      setSelectedSessionId("");
      return;
    }
    let ignore = false;
    const run = async () => {
      setLoadingSessions(true);
      try {
        const res = await api.activity.userSessions(selectedUserId, { limit: sessionLimit });
        if (ignore) return;
        const next = res.data || [];
        setUserSessions(next);
        setSessionPage(1);
        if (!next.some((x) => x.session_id === selectedSessionId)) {
          setSelectedSessionId(next[0]?.session_id || "");
        }
      } catch (err: any) {
        if (!ignore) setError(err?.message || "Failed to load user sessions");
      } finally {
        if (!ignore) setLoadingSessions(false);
      }
    };
    void run();
    return () => {
      ignore = true;
    };
  }, [isAdmin, refreshNonce, selectedSessionId, selectedUserId, sessionLimit, user?.id]);

  useEffect(() => {
    if (!user?.id || !isAdmin || !selectedSessionId) {
      setSelectedSession(null);
      setPageStats([]);
      setEventBatches([]);
      return;
    }
    let ignore = false;
    const run = async () => {
      setLoadingDetails(true);
      try {
        const res = await api.activity.sessionDetails(selectedSessionId);
        if (ignore) return;
        setSelectedSession(res.data.session || null);
        setPageStats(res.data.pageStats || []);
        setEventBatches(res.data.eventBatches || []);
        setPageStatPage(1);
        setTimelinePage(1);
      } catch (err: any) {
        if (!ignore) setError(err?.message || "Failed to load session details");
      } finally {
        if (!ignore) setLoadingDetails(false);
      }
    };
    void run();
    return () => {
      ignore = true;
    };
  }, [isAdmin, refreshNonce, selectedSessionId, user?.id]);

  const onUserChange = (userId: string) => {
    setSelectedUserId(userId);
    setSelectedSessionId("");
  };

  const onSessionOpen = (sessionId: string, userId?: number | string) => {
    if (userId !== undefined && userId !== null) setSelectedUserId(String(userId));
    setSelectedSessionId(sessionId);
  };

  const closeStaleSessions = async () => {
    setClosingStale(true);
    try {
      await api.activity.closeStaleSessions({ staleMinutes: minutes });
      refreshAll();
    } finally {
      setClosingStale(false);
    }
  };

  const metrics = useMemo(() => ({
    liveUsers: liveSessions.length,
    openTabs: liveSessions.reduce((s, r) => s + Number(r.current_open_tabs || 0), 0),
    totalActiveTime: liveSessions.reduce((s, r) => s + Number(r.active_ms || 0), 0),
    totalClicks: liveSessions.reduce((s, r) => s + Number(r.total_clicks || 0), 0),
  }), [liveSessions]);

  const loading = loadingLive || loadingSessions || loadingDetails;
  const pagedLiveSessions = useMemo(() => paginate(liveSessions, livePage), [livePage, liveSessions]);
  const pagedUserSessions = useMemo(() => paginate(userSessions, sessionPage), [sessionPage, userSessions]);
  const pagedPageStats = useMemo(() => paginate(pageStats, pageStatPage), [pageStatPage, pageStats]);
  const pagedTimeline = useMemo(() => paginate([...eventBatches].reverse(), timelinePage), [eventBatches, timelinePage]);

  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <div className="w-full">
      <PageHeader
        title="Activity Monitor"
        subtitle="Optimized so only the changed section reloads."
        total={liveSessions.length}
        icon={<ActivityIcon size={18} />}
        rightActions={
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={refreshAll} className="inline-flex items-center gap-2 rounded-md border border-[#233a47] bg-[#233a47] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1c303b]">
              <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
            <button type="button" onClick={() => void closeStaleSessions()} disabled={closingStale} className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:opacity-60">
              <TimerReset size={16} className={closingStale ? "animate-spin" : ""} />
              Close stale
            </button>
          </div>
        }
      />

      {error ? <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div className="mb-2 rounded-md border border-slate-200 bg-white p-5">
        <div className="mb-2">
          <h3 className="text-base font-semibold text-slate-900">Filters</h3>
          <p className="mt-1 text-sm text-slate-500">Choose a time range, session limit, and user.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="rounded-md border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800">
            <option value={2}>Last 2 minutes</option>
            <option value={5}>Last 5 minutes</option>
            <option value={10}>Last 10 minutes</option>
            <option value={15}>Last 15 minutes</option>
          </select>
          <select value={sessionLimit} onChange={(e) => setSessionLimit(Number(e.target.value))} className="rounded-md border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800">
            <option value={5}>Show last 5 sessions</option>
            <option value={10}>Show last 10 sessions</option>
            <option value={20}>Show last 20 sessions</option>
          </select>
          <select value={selectedUserId} onChange={(e) => onUserChange(e.target.value)} className="rounded-md border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800">
            <option value="">Auto select from live users</option>
            {userOptions.map((row) => <option key={String(row.id)} value={String(row.id)}>{row.name || row.email || `User #${row.id}`}</option>)}
          </select>
        </div>
      </div>

      <div className="mb-2 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Live Users" value={metrics.liveUsers} help="Current live users" icon={<Monitor size={18} />} />
        <MetricCard label="Open Tabs" value={metrics.openTabs} help="Tabs across live sessions" icon={<Eye size={18} />} />
        <MetricCard label="Active Time" value={msLabel(metrics.totalActiveTime)} help="Combined active time" icon={<Clock3 size={18} />} />
        <MetricCard label="Clicks" value={metrics.totalClicks} help="Captured clicks" icon={<MousePointerClick size={18} />} />
      </div>

      <div className="mb-2 rounded-md border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="text-lg font-semibold text-slate-900">Live Users</h3>
          <p className="mt-1 text-sm text-slate-500">A quick view of users who were recently active.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50"><tr className="text-left text-sm font-medium text-slate-500"><th className="px-5 py-3">User</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Current Page</th><th className="px-5 py-3">Last Seen</th><th className="px-5 py-3">Open Tabs</th><th className="px-5 py-3">Action</th></tr></thead>
            <tbody>
              {liveSessions.length === 0 ? <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-slate-500">No live users found right now.</td></tr> : pagedLiveSessions.map((row) => (
                <tr key={row.session_id} className="border-t border-slate-100">
                  <td className="px-5 py-4 text-sm font-semibold text-slate-900">{getUserName(row.user_id, row)}</td>
                  <td className="px-5 py-4"><span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusClasses(row.status)}`}>{row.status || "unknown"}</span></td>
                  <td className="px-5 py-4 text-sm text-slate-700">{row.current_path || "-"}</td>
                  <td className="px-5 py-4 text-sm text-slate-700">{dateLabel(row.last_seen_at)}</td>
                  <td className="px-5 py-4 text-sm text-slate-700">{row.current_open_tabs || 0}</td>
                  <td className="px-5 py-4"><button type="button" onClick={() => onSessionOpen(row.session_id, row.user_id)} className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-800">Open</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={livePage} total={liveSessions.length} onChange={setLivePage} />
      </div>

      <div className="space-y-2">
        <section className="rounded-md border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-4">
            <h3 className="text-lg font-semibold text-slate-900">Selected User Sessions</h3>
            <p className="text-sm text-slate-500">{selectedUserId ? `Recent sessions for ${getUserName(selectedUserId, userSessions[0] || liveSessions.find((row) => String(row.user_id) === selectedUserId) || null)}` : "Pick a live user to see session history"}</p>
          </div>
          <div className="p-5">
            {userSessions.length === 0 ? <div className="rounded-md border border-dashed border-slate-200 px-5 py-10 text-center text-sm text-slate-500">No session history found.</div> : <div className="space-y-3">{pagedUserSessions.map((row) => {
              const active = row.session_id === selectedSessionId;
              return (
                <button key={row.session_id} type="button" onClick={() => onSessionOpen(row.session_id, row.user_id)} className={`w-full rounded-md border px-4 py-4 text-left transition ${active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${active ? "border-white/20 bg-white/10 text-white" : statusClasses(row.status)}`}>{row.status || "unknown"}</span>
                        <span className={`text-xs font-medium ${active ? "text-white/75" : "text-slate-500"}`}>Active: {msLabel(row.active_ms)}</span>
                      </div>
                      <div className="mt-3 truncate text-base font-semibold">{row.current_path || "/"}</div>
                      <div className={`mt-2 text-sm ${active ? "text-white/75" : "text-slate-500"}`}>Login: {dateLabel(row.login_at)}</div>
                      <div className={`mt-1 text-sm ${active ? "text-white/75" : "text-slate-500"}`}>Last seen: {dateLabel(row.last_seen_at)}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className={`text-xs font-medium ${active ? "text-white/75" : "text-slate-500"}`}>Tabs peak: {row.open_tabs_peak || 0}</div>
                      <div className={`mt-2 text-xs font-medium ${active ? "text-white/75" : "text-slate-500"}`}>Visible: {msLabel(row.visible_ms)}</div>
                    </div>
                  </div>
                </button>
              );
            })}</div>}
          </div>
          <Pagination page={sessionPage} total={userSessions.length} onChange={setSessionPage} />
        </section>

        <section className="rounded-md border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-4">
            <h3 className="text-lg font-semibold text-slate-900">Selected Session Summary</h3>
            <p className="text-sm text-slate-500">{selectedSession ? "Quick summary of what happened in this session" : "Open a session from the left side"}</p>
          </div>
          {!selectedSession ? <div className="px-5 py-8 text-sm text-slate-500">No session selected yet.</div> : <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 xl:grid-cols-5">
            <DetailBox label="User" value={`${getUserName(selectedSession.user_id, selectedSession)}`} />
            <DetailBox label="Status" value={selectedSession.status || "unknown"} />
            <DetailBox label="Current Page" value={selectedSession.current_path || "-"} />
            <DetailBox label="Login Time" value={dateLabel(selectedSession.login_at)} />
            <DetailBox label="Last Seen" value={dateLabel(selectedSession.last_seen_at)} />
            <DetailBox label="IP Address" value={selectedSession.ip_address || "-"} />
            <DetailBox label="Active Time" value={msLabel(selectedSession.active_ms)} />
            <DetailBox label="Visible Time" value={msLabel(selectedSession.visible_ms)} />
            <DetailBox label="Idle Time" value={msLabel(selectedSession.idle_ms)} />
            <DetailBox label="Mouse move/Clicks / Scrolls / Keys" value={`${selectedSession.mouse_moves || 0} /${selectedSession.total_clicks || 0} / ${selectedSession.total_scrolls || 0} / ${selectedSession.total_keydowns || 0}`} />
          </div>}
        </section>
      </div>

      <div className="mt-2 space-y-2">
        <section className="rounded-md border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-4">
            <h3 className="text-lg font-semibold text-slate-900">Page Stats</h3>
            <p className="mt-1 text-sm text-slate-500">Time spent and visits by page for the selected session.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-50"><tr className="text-left text-sm font-medium text-slate-500"><th className="px-5 py-3">Page</th><th className="px-5 py-3">Visits</th><th className="px-5 py-3">Active</th><th className="px-5 py-3">Visible</th><th className="px-5 py-3">Idle</th></tr></thead>
              <tbody>
                {pageStats.length === 0 ? <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-500">No page stats available.</td></tr> : pagedPageStats.map((row) => (
                  <tr key={row.path} className="border-t border-slate-100">
                    <td className="px-5 py-4 text-sm font-semibold text-slate-900">{row.path}</td>
                    <td className="px-5 py-4 text-sm text-slate-700">{row.visits || 0}</td>
                    <td className="px-5 py-4 text-sm text-slate-700">{msLabel(row.active_ms)}</td>
                    <td className="px-5 py-4 text-sm text-slate-700">{msLabel(row.visible_ms)}</td>
                    <td className="px-5 py-4 text-sm text-slate-700">{msLabel(row.idle_ms)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={pageStatPage} total={pageStats.length} onChange={setPageStatPage} />
        </section>

        <section className="rounded-md border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-4">
            <h3 className="text-lg font-semibold text-slate-900">Activity Timeline</h3>
            <p className="mt-1 text-sm text-slate-500">A simple timeline of activity events in this session.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-50"><tr className="text-left text-sm font-medium text-slate-500"><th className="px-5 py-3">Time</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Page</th><th className="px-5 py-3">Activity</th></tr></thead>
              <tbody>
                {eventBatches.length === 0 ? <tr><td colSpan={4} className="px-5 py-8 text-center text-sm text-slate-500">No timeline available.</td></tr> : pagedTimeline.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-5 py-4 text-sm text-slate-700">{dateLabel(row.sent_at)}</td>
                    <td className="px-5 py-4"><span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusClasses(row.status)}`}>{row.status || "unknown"}</span></td>
                    <td className="px-5 py-4 text-sm text-slate-700">{row.current_path || "-"}</td>
                    <td className="px-5 py-4 text-sm text-slate-700">{row.clicks || 0} clicks, {row.scrolls || 0} scrolls, {row.keydowns || 0} keys</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={timelinePage} total={eventBatches.length} onChange={setTimelinePage} />
        </section>
      </div>
    </div>
  );
}
