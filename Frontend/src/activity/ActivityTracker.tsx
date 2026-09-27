import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { API_BASE_URL, api } from "../lib/api";
import { storage } from "../lib/storage";

type TrackerUser = {
  id?: number | string;
};

type PageStat = {
  visits: number;
};

const HEARTBEAT_MS = 15000;
const IDLE_MS = 60000;
const SESSION_KEY = "crm_activity_session_id";
const TAB_KEY = "crm_activity_tab_id";

function randomId(prefix: string) {
  const seed =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${seed}`;
}

function getOrCreateStorageValue(key: string, prefix: string, store: Storage) {
  const existing = store.getItem(key);
  if (existing) return existing;
  const next = randomId(prefix);
  store.setItem(key, next);
  return next;
}

function currentStatus(lastActivityAt: number) {
  if (document.hidden) return "hidden";
  return Date.now() - lastActivityAt >= IDLE_MS ? "idle" : "active";
}

function screenMeta() {
  return {
    referrer: document.referrer || "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    screen: {
      width: window.screen?.width || 0,
      height: window.screen?.height || 0,
    },
  };
}

async function sendWithKeepalive(path: string, body: Record<string, any>) {
  const token = storage.getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      keepalive: true,
    });
  } catch {
    // Ignore unload-time failures.
  }
}

export default function ActivityTracker({ user }: { user: TrackerUser | null }) {
  const location = useLocation();
  const startedRef = useRef(false);
  const loginAtRef = useRef("");
  const lastFlushAtRef = useRef(Date.now());
  const lastActivityAtRef = useRef(Date.now());
  const currentPathRef = useRef("");
  const pageStatsRef = useRef<Record<string, PageStat>>({});
  const countsRef = useRef({
    mouseMoves: 0,
    clicks: 0,
    scrolls: 0,
    keydowns: 0,
  });

  const sessionIdRef = useRef("");
  const tabIdRef = useRef("");

  useEffect(() => {
    if (!user?.id) return;

    sessionIdRef.current = getOrCreateStorageValue(
      `${SESSION_KEY}_${user.id}`,
      "session",
      localStorage
    );
    tabIdRef.current = getOrCreateStorageValue(TAB_KEY, "tab", sessionStorage);

    if (!loginAtRef.current) loginAtRef.current = new Date().toISOString();
    currentPathRef.current = `${location.pathname}${location.search}` || "/";

    const startPath = currentPathRef.current || "/";
    if (!pageStatsRef.current[startPath]) {
      pageStatsRef.current[startPath] = {
        visits: 1,
      };
    }

    if (startedRef.current) return;
    startedRef.current = true;

    api.activity
      .startSession({
        userId: user.id,
        sessionId: sessionIdRef.current,
        loginAt: loginAtRef.current,
        currentPath: startPath,
        userAgent: navigator.userAgent,
        openTabs: 1,
        meta: screenMeta(),
      })
      .catch(() => {
        startedRef.current = false;
      });
  }, [location.pathname, location.search, user?.id]);

  useEffect(() => {
    if (!user?.id || !startedRef.current) return;

    const nextPath = `${location.pathname}${location.search}` || "/";
    const prevPath = currentPathRef.current || nextPath;

    if (prevPath === nextPath) return;

    flushHeartbeat();

    currentPathRef.current = nextPath;
    pageStatsRef.current[nextPath] = {
      visits: (pageStatsRef.current[nextPath]?.visits || 0) + 1,
    };
  }, [location.pathname, location.search, user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    const markActivity = (type?: keyof typeof countsRef.current) => {
      lastActivityAtRef.current = Date.now();
      if (type) countsRef.current[type] += 1;
    };

    const flushOnVisibility = () => {
      flushHeartbeat();
    };

    const flushOnPageHide = () => {
      flushHeartbeat(true);
    };

    const onMouseMove = () => markActivity("mouseMoves");
    const onClick = () => markActivity("clicks");
    const onScroll = () => markActivity("scrolls");
    const onKeyDown = () => markActivity("keydowns");

    const interval = window.setInterval(() => {
      flushHeartbeat();
    }, HEARTBEAT_MS);

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("click", onClick, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("visibilitychange", flushOnVisibility);
    window.addEventListener("pagehide", flushOnPageHide);
    window.addEventListener("beforeunload", flushOnPageHide);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("click", onClick);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("visibilitychange", flushOnVisibility);
      window.removeEventListener("pagehide", flushOnPageHide);
      window.removeEventListener("beforeunload", flushOnPageHide);
    };
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) return;

    startedRef.current = false;
    loginAtRef.current = "";
    currentPathRef.current = "/";
    pageStatsRef.current = {};
    countsRef.current = {
      mouseMoves: 0,
      clicks: 0,
      scrolls: 0,
      keydowns: 0,
    };
    sessionIdRef.current = "";
    tabIdRef.current = "";
  }, [user?.id]);

  function buildPayload() {
    const now = Date.now();
    const intervalStart = lastFlushAtRef.current;
    const intervalEnd = now;
    const duration = Math.max(0, intervalEnd - intervalStart);
    const status = currentStatus(lastActivityAtRef.current);
    const path = currentPathRef.current || "/";
    const pageStat = pageStatsRef.current[path] || { visits: 0 };
    lastFlushAtRef.current = now;

    const payload = {
      status,
      currentPath: path,
      intervalStart: new Date(intervalStart).toISOString(),
      intervalEnd: new Date(intervalEnd).toISOString(),
      activeMs: status === "active" ? duration : 0,
      visibleMs: status !== "hidden" ? duration : 0,
      idleMs: status === "active" ? 0 : duration,
      mouseMoves: countsRef.current.mouseMoves,
      clicks: countsRef.current.clicks,
      scrolls: countsRef.current.scrolls,
      keydowns: countsRef.current.keydowns,
      openTabs: 1,
      pageStats: [
        {
          path,
          activeMs: status === "active" ? duration : 0,
          visibleMs: status !== "hidden" ? duration : 0,
          idleMs: status === "active" ? 0 : duration,
          visits: pageStat.visits,
        },
      ],
    };

    countsRef.current = {
      mouseMoves: 0,
      clicks: 0,
      scrolls: 0,
      keydowns: 0,
    };
    pageStatsRef.current[path] = { visits: 0 };

    return payload;
  }

  function flushHeartbeat(isFinal = false) {
    if (!user?.id || !startedRef.current || !sessionIdRef.current || !tabIdRef.current) {
      return;
    }

    const body = {
      userId: user.id,
      sessionId: sessionIdRef.current,
      tabId: tabIdRef.current,
      sentAt: new Date().toISOString(),
      isFinal,
      payload: buildPayload(),
    };

    if (isFinal) {
      void sendWithKeepalive(`/api/activity/heartbeat`, body);
      return;
    }

    void api.activity.heartbeat(body).catch(() => {
      // Ignore transient tracking errors.
    });
  }

  return null;
}
