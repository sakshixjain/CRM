const { Op } = require("sequelize");
const sequelize = require("../config/db");
const Admin = require("../models/Admin");
const Agent = require("../models/UserAgent");
const ActivitySession = require("../models/ActiveSession");
const ActivityEventBatch = require("../models/ActivityEventBatch");
const ActivityPageStat = require("../models/ActivityPageStat");

/**
 * Safely get client IP
 */
function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || req.ip || "";
}

/**
 * Validate allowed status
 */
function normalizeStatus(status) { 
  const allowed = ["active", "idle", "hidden", "closed"];
  return allowed.includes(status) ? status : "active";
}

/**
 * Convert to valid date or null
 */
function toDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Safe integer conversion
 */
function toNumber(value, defaultValue = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : defaultValue;
}

async function buildUserLookup(userIds) {
  const ids = Array.from(
    new Set(
      userIds
        .filter((value) => value !== undefined && value !== null && value !== "")
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value))
    )
  );

  if (ids.length === 0) return new Map();

  const [admins, agents] = await Promise.all([
    Admin.findAll({
      where: { id: { [Op.in]: ids } },
      attributes: ["id", "name", "email"],
    }),
    Agent.findAll({
      where: { id: { [Op.in]: ids } },
      attributes: ["id", "name", "email"],
    }),
  ]);

  const lookup = new Map();

  for (const row of agents) {
    lookup.set(String(row.id), {
      user_name: row.name || null,
      user_email: row.email || null,
    });
  }

  for (const row of admins) {
    lookup.set(String(row.id), {
      user_name: row.name || null,
      user_email: row.email || null,
    });
  }

  return lookup;
}

function attachUserIdentity(row, lookup) {
  if (!row) return row;

  const plain = typeof row.get === "function" ? row.get({ plain: true }) : { ...row };
  const user = lookup.get(String(plain.user_id || ""));

  return {
    ...plain,
    user_name: user?.user_name || null,
    user_email: user?.user_email || null,
  };
}

/**
 * POST /api/activity/session/start
 * Start a new activity session
 */
exports.startSession = async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId;

    const {
      sessionId,
      loginAt,
      currentPath = "/",
      userAgent = "",
      openTabs = 1,
      meta = {},
    } = req.body;

    if (!userId || !sessionId || !loginAt) {
      return res.status(400).json({
        success: false,
        message: "userId, sessionId and loginAt are required",
      });
    }

    const parsedLoginAt = toDate(loginAt);
    if (!parsedLoginAt) {
      return res.status(400).json({
        success: false,
        message: "Invalid loginAt value",
      });
    }

    const existingSession = await ActivitySession.findOne({
      where: { session_id: sessionId },
    });

    if (existingSession) {
      return res.status(200).json({
        success: true,
        message: "Session already exists",
        data: existingSession,
      });
    }

    const session = await ActivitySession.create({
      user_id: userId,
      session_id: sessionId,
      login_at: parsedLoginAt,
      logout_at: null,
      last_seen_at: new Date(),
      status: "active",

      active_ms: 0,
      visible_ms: 0,
      idle_ms: 0,

      total_mouse_moves: 0,
      total_clicks: 0,
      total_scrolls: 0,
      total_keydowns: 0,

      open_tabs_peak: toNumber(openTabs, 1),
      current_open_tabs: toNumber(openTabs, 1),

      current_path: currentPath,
      user_agent: userAgent || req.headers["user-agent"] || "",
      ip_address: getClientIp(req),

      referrer: meta?.referrer || "",
      screen_width: toNumber(meta?.screen?.width, 0),
      screen_height: toNumber(meta?.screen?.height, 0),
      timezone: meta?.timezone || "",
    });

    return res.status(201).json({
      success: true,
      message: "Activity session started successfully",
      data: session,
    });
  } catch (error) {
    console.error("startSession error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to start activity session",
      error: error.message,
    });
  }
};

/**
 * POST /api/activity/heartbeat
 * Receive heartbeat batch and update summary tables
 */
exports.receiveHeartbeat = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const userId = req.user?.id || req.body.userId;

    const {
      sessionId,
      tabId,
      sentAt,
      isFinal = false,
      payload = {},
    } = req.body;

    if (!userId || !sessionId || !tabId || !sentAt) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "userId, sessionId, tabId and sentAt are required",
      });
    }

    const status = normalizeStatus(payload.status);

    const heartbeatRow = await ActivityEventBatch.create(
      {
        user_id: userId,
        session_id: sessionId,
        tab_id: tabId,
        sent_at: toDate(sentAt) || new Date(),
        is_final: Boolean(isFinal),

        status,
        current_path: payload.currentPath || "/",

        interval_start: toDate(payload.intervalStart) || new Date(),
        interval_end: toDate(payload.intervalEnd) || new Date(),

        active_ms: toNumber(payload.activeMs, 0),
        visible_ms: toNumber(payload.visibleMs, 0),
        idle_ms: toNumber(payload.idleMs, 0),

        mouse_moves: toNumber(payload.mouseMoves, 0),
        clicks: toNumber(payload.clicks, 0),
        scrolls: toNumber(payload.scrolls, 0),
        keydowns: toNumber(payload.keydowns, 0),

        open_tabs: toNumber(payload.openTabs, 1),
        page_stats: Array.isArray(payload.pageStats) ? payload.pageStats : [],
      },
      { transaction }
    );

    const session = await ActivitySession.findOne({
      where: { session_id: sessionId, user_id: userId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!session) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Activity session not found",
      });
    }

    const nextCurrentTabs = toNumber(
      payload.openTabs,
      session.current_open_tabs || 1
    );

    const nextPeakTabs = Math.max(
      toNumber(session.open_tabs_peak, 1),
      nextCurrentTabs
    );

    await session.update(
      {
        last_seen_at: new Date(),
        status: isFinal ? "closed" : status,
        current_path: payload.currentPath || session.current_path,

        active_ms:
          toNumber(session.active_ms, 0) + toNumber(payload.activeMs, 0),
        visible_ms:
          toNumber(session.visible_ms, 0) + toNumber(payload.visibleMs, 0),
        idle_ms: toNumber(session.idle_ms, 0) + toNumber(payload.idleMs, 0),

        total_mouse_moves:
          toNumber(session.total_mouse_moves, 0) +
          toNumber(payload.mouseMoves, 0),

        total_clicks:
          toNumber(session.total_clicks, 0) + toNumber(payload.clicks, 0),

        total_scrolls:
          toNumber(session.total_scrolls, 0) + toNumber(payload.scrolls, 0),

        total_keydowns:
          toNumber(session.total_keydowns, 0) + toNumber(payload.keydowns, 0),

        current_open_tabs: isFinal ? 0 : nextCurrentTabs,
        open_tabs_peak: nextPeakTabs,

        logout_at: isFinal ? new Date() : session.logout_at,
      },
      { transaction }
    );

    if (Array.isArray(payload.pageStats) && payload.pageStats.length > 0) {
      for (const stat of payload.pageStats) {
        const path = stat?.path || "/";
        const activeMs = toNumber(stat?.activeMs, 0);
        const visibleMs = toNumber(stat?.visibleMs, 0);
        const idleMs = toNumber(stat?.idleMs, 0);
        const visits = toNumber(stat?.visits, 0);

        const existingPageStat = await ActivityPageStat.findOne({
          where: {
            session_id: sessionId,
            user_id: userId,
            path,
          },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        if (existingPageStat) {
          await existingPageStat.update(
            {
              active_ms: toNumber(existingPageStat.active_ms, 0) + activeMs,
              visible_ms: toNumber(existingPageStat.visible_ms, 0) + visibleMs,
              idle_ms: toNumber(existingPageStat.idle_ms, 0) + idleMs,
              visits: toNumber(existingPageStat.visits, 0) + visits,
            },
            { transaction }
          );
        } else {
          await ActivityPageStat.create(
            {
              session_id: sessionId,
              user_id: userId,
              path,
              active_ms: activeMs,
              visible_ms: visibleMs,
              idle_ms: idleMs,
              visits,
            },
            { transaction }
          );
        }
      }
    }

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Heartbeat stored successfully",
      data: heartbeatRow,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("receiveHeartbeat error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to store heartbeat",
      error: error.message,
    });
  }
};

/**
 * POST /api/activity/session/end
 * Explicitly end a session, usually on logout
 */
exports.endSession = async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId;
    const { sessionId, logoutAt } = req.body;

    if (!userId || !sessionId) {
      return res.status(400).json({
        success: false,
        message: "userId and sessionId are required",
      });
    }

    const session = await ActivitySession.findOne({
      where: {
        session_id: sessionId,
        user_id: userId,
      },
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Session not found",
      });
    }

    await session.update({
      status: "closed",
      logout_at: toDate(logoutAt) || new Date(),
      last_seen_at: new Date(),
      current_open_tabs: 0,
    });

    return res.status(200).json({
      success: true,
      message: "Session ended successfully",
      data: session,
    });
  } catch (error) {
    console.error("endSession error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to end session",
      error: error.message,
    });
  }
};

/**
 * GET /api/activity/live
 * Show currently active / recently seen users
 */
exports.getLiveUsers = async (req, res) => {
  try {
    const minutes = toNumber(req.query.minutes, 2);
    const threshold = new Date(Date.now() - minutes * 60 * 1000);

    const sessions = await ActivitySession.findAll({
      where: {
        last_seen_at: {
          [Op.gte]: threshold,
        },
        status: {
          [Op.in]: ["active", "idle", "hidden"],
        },
      },
      order: [["last_seen_at", "DESC"]],
    });

    const userLookup = await buildUserLookup(sessions.map((session) => session.user_id));
    const data = sessions.map((session) => attachUserIdentity(session, userLookup));

    return res.status(200).json({
      success: true,
      message: "Live users fetched successfully",
      data,
    });
  } catch (error) {
    console.error("getLiveUsers error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch live users",
      error: error.message,
    });
  }
};

/**
 * GET /api/activity/user/:userId/sessions
 * Get session history of a user
 */
exports.getUserSessions = async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = toNumber(req.query.limit, 20);

    const sessions = await ActivitySession.findAll({
      where: { user_id: userId },
      order: [["login_at", "DESC"]],
      limit,
    });

    const userLookup = await buildUserLookup(sessions.map((session) => session.user_id));
    const data = sessions.map((session) => attachUserIdentity(session, userLookup));

    return res.status(200).json({
      success: true,
      message: "User sessions fetched successfully",
      data,
    });
  } catch (error) {
    console.error("getUserSessions error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch user sessions",
      error: error.message,
    });
  }
};

/**
 * GET /api/activity/session/:sessionId
 * Get one session summary + page stats + heartbeat logs
 */
exports.getSessionDetails = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await ActivitySession.findOne({
      where: { session_id: sessionId },
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Session not found",
      });
    }

    const pageStats = await ActivityPageStat.findAll({
      where: { session_id: sessionId },
      order: [["active_ms", "DESC"]],
    });

    const eventBatches = await ActivityEventBatch.findAll({
      where: { session_id: sessionId },
      order: [["sent_at", "ASC"]],
    });

    const userLookup = await buildUserLookup([session.user_id]);
    const sessionWithIdentity = attachUserIdentity(session, userLookup);

    return res.status(200).json({
      success: true,
      message: "Session details fetched successfully",
      data: {
        session: sessionWithIdentity,
        pageStats,
        eventBatches,
      },
    });
  } catch (error) {
    console.error("getSessionDetails error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch session details",
      error: error.message,
    });
  }
};

/**
 * POST /api/activity/mark-stale-closed
 * Optional utility endpoint / cron support
 * Mark old open sessions as closed
 */
exports.closeStaleSessions = async (req, res) => {
  try {
    const staleMinutes = toNumber(req.body.staleMinutes, 2);
    const threshold = new Date(Date.now() - staleMinutes * 60 * 1000);

    const [affectedCount] = await ActivitySession.update(
      {
        status: "closed",
        logout_at: new Date(),
        current_open_tabs: 0,
      },
      {
        where: {
          status: {
            [Op.in]: ["active", "idle", "hidden"],
          },
          last_seen_at: {
            [Op.lt]: threshold,
          },
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: "Stale sessions closed successfully",
      affectedCount,
    });
  } catch (error) {
    console.error("closeStaleSessions error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to close stale sessions",
      error: error.message,
    });
  }
};
