const LeadHistory = require("../models/LeadHistory");
const Lead = require("../models/Leads");
const LeadStatus = require("../models/LeadStatus");
const UserAgent = require("../models/UserAgent");
const Admin = require("../models/Admin");
const { Op } = require("sequelize");

const KOLKATA_TIME_ZONE = "Asia/Kolkata";

function pad2(value) {
  return String(value).padStart(2, "0");
}

function normalizeDatePart(value) {
  const trimmed = String(value || "").trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return null;

  return `${match[1]}-${match[2]}-${match[3]}`;
}

function normalizeTimePart(value) {
  const trimmed = String(value || "00:00:00").trim();
  const match = trimmed.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);

  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] || "00");

  if (
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59
  ) {
    return null;
  }

  return `${pad2(hour)}:${pad2(minute)}:${pad2(second)}`;
}

function buildDateTimeString(followupDate, followupTime) {
  const date = normalizeDatePart(followupDate);
  const time = normalizeTimePart(followupTime);

  if (!date || !time) return null;

  return `${date} ${time}`;
}

function getReminderAtFromFollowup(followupDate, followupTime) {
  const combined = buildDateTimeString(followupDate, followupTime);
  if (!combined) return null;

  const [date, time] = combined.split(" ");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute, second] = time.split(":").map(Number);

  const reminderDate = new Date(year, month - 1, day, hour, minute, second);
  reminderDate.setMinutes(reminderDate.getMinutes() - 10);

  return [
    reminderDate.getFullYear(),
    pad2(reminderDate.getMonth() + 1),
    pad2(reminderDate.getDate()),
  ].join("-") + ` ${pad2(reminderDate.getHours())}:${pad2(reminderDate.getMinutes())}:${pad2(reminderDate.getSeconds())}`;
}

function splitFollowupDateTime(value) {
  if (!value) return { date: "", time: "" };

  if (value instanceof Date) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: KOLKATA_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(value);

    const map = Object.fromEntries(
      parts
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value])
    );

    return {
      date: `${map.year}-${map.month}-${map.day}`,
      time: `${map.hour}:${map.minute}:${map.second}`,
    };
  }

  const normalized = String(value).replace("T", " ").trim();
  const [date = "", time = ""] = normalized.split(" ");
  return { date, time: time.slice(0, 8) };
}

function getFollowupIncludes(companyId, options = {}) {
  const includes = [];

  if (options.withLead) {
    includes.push({
      model: Lead,
      as: "lead",
      attributes: options.leadAttributes || ["id", "name", "email", "contact_no"],
      required: Boolean(options.leadRequired),
      where: {
        company_id: companyId,
        ...(options.leadWhere || {}),
      },
    });
  }

  includes.push(
    {
      model: UserAgent,
      as: "changedBy",
      attributes: ["id", "name", "email"],
      required: false,
      where: {
        company_id: companyId,
      },
    },
    {
      model: LeadStatus,
      as: "status",
      attributes: ["id", "name"],
      required: false,
      where: {
        company_id: companyId,
      },
    }
  );

  return includes;
}

function normalizeFollowupRow(row) {
  if (!row) return row;

  const obj = row.toJSON ? row.toJSON() : row;
  obj.changedBy = obj.changedBy || null;
  return obj;
}

function normalizeFollowupRows(rows) {
  return rows.map(normalizeFollowupRow);
}

async function getCurrentFollowupAgent(req) {
  const companyId = req.user?.company_id;
  const userId = req.user?.id ? Number(req.user.id) : null;

  if (!companyId || !userId) return null;

  if (req.user?.type === "agent") {
    return UserAgent.findOne({
      where: {
        id: userId,
        company_id: companyId,
      },
      attributes: ["id", "name", "email"],
    });
  }

  const admin = await Admin.findOne({
    where: {
      id: userId,
      company_id: companyId,
    },
    attributes: ["id", "name", "email"],
  });

  if (!admin?.email) return null;

  return UserAgent.findOne({
    where: {
      email: admin.email,
      company_id: companyId,
    },
    attributes: ["id", "name", "email"],
  });
}

exports.followup = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    const userId = req.user?.id;

    const { id } = req.params;
    const { followup_date, followup_time, status_id, remark } = req.body;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!id || !followup_date || !followup_time) {
      return res.status(400).json({
        success: false,
        message: "lead id, followup_date and followup_time are required",
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: user not found (token missing/invalid)",
      });
    }

    const lead = await Lead.findOne({
      where: {
        id,
        company_id: companyId,
      },
    });

    if (!lead) {
      return res.status(404).json({ success: false, message: "Lead not found" });
    }

    let statusRemark = "";
    if (status_id) {
      const st = await LeadStatus.findOne({
        where: {
          id: Number(status_id),
          company_id: companyId,
        },
      });

      if (!st) {
        return res.status(400).json({
          success: false,
          message: "Invalid status_id",
        });
      }

      statusRemark = ``;
    }

    const cleanRemark = typeof remark === "string" ? remark.trim() : "";
    const finalRemark = cleanRemark ? cleanRemark : statusRemark;

    const combined = buildDateTimeString(followup_date, followup_time);
    const reminderAt = getReminderAtFromFollowup(followup_date, followup_time);

    if (!combined || !reminderAt) {
      return res.status(400).json({
        success: false,
        message: "Invalid followup date or time format",
      });
    }

    const changedByAgent = await getCurrentFollowupAgent(req);

    if (!changedByAgent) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: logged-in agent not found",
      });
    }

    const followup = await LeadHistory.create({
      company_id: companyId,
      lead_id: Number(id),
      followup_date: combined,
      reminder_at: reminderAt,
      is_reminder_sent: false,
      status_id: status_id ? Number(status_id) : null,
      changed_by: changedByAgent.id,
      remark: finalRemark || null,
    });

    const saved = await LeadHistory.findOne({
      where: {
        id: followup.id,
        company_id: companyId,
      },
      include: getFollowupIncludes(companyId),
    });

    return res.status(201).json({
      success: true,
      message: "Follow-up added successfully",
      followup: normalizeFollowupRow(saved),
    });
  } catch (error) {
    console.error("Followup Error:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

exports.getFollowupsByLead = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    const { id } = req.params;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!id) {
      return res.status(400).json({ success: false, message: "lead id is required" });
    }

    const lead = await Lead.findOne({
      where: {
        id,
        company_id: companyId,
      },
      include: [
        {
          model: LeadStatus,
          as: "status",
          attributes: ["id", "name"],
          required: false,
        },
      ],
    });

    if (!lead) {
      return res.status(404).json({ success: false, message: "Lead not found" });
    }

    const rows = await LeadHistory.findAll({
      where: {
        lead_id: Number(id),
        company_id: companyId,
      },
      include: getFollowupIncludes(companyId),
      order: [
        ["followup_date", "DESC"],
        ["id", "DESC"],
      ],
    });

    return res.json({
      success: true,
      lead,
      data: normalizeFollowupRows(rows),
    });
  } catch (error) {
    console.error("getFollowupsByLead Error:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

exports.getAllFollowups = async (req, res) => {
  try {
    const companyId = req.user?.company_id;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { from, to, status_id, changed_by, search } = req.query;

    const whereClause = {
      company_id: companyId,
    };

    if (from && to) {
      whereClause.followup_date = {
        [Op.between]: [`${from} 00:00:00`, `${to} 23:59:59`],
      };
    } else if (from) {
      whereClause.followup_date = { [Op.gte]: `${from} 00:00:00` };
    } else if (to) {
      whereClause.followup_date = { [Op.lte]: `${to} 23:59:59` };
    }

    if (status_id) whereClause.status_id = status_id;
    if (changed_by) whereClause.changed_by = changed_by;

    const isAgent =
      req.user?.type === "agent" ||
      (req.user?.role_id !== undefined && Number(req.user.role_id) !== 1);

    if (isAgent) {
      whereClause[Op.or] = [
        { changed_by: req.user.id },
        { "$lead.assign_to$": req.user.id },
      ];
    }

    if (search) {
      whereClause[Op.or] = [
        { remark: { [Op.like]: `%${search}%` } },
        { "$lead.name$": { [Op.like]: `%${search}%` } },
        { "$lead.email$": { [Op.like]: `%${search}%` } },
        { "$lead.contact_no$": { [Op.like]: `%${search}%` } },
      ];
    }

    const rows = await LeadHistory.findAll({
      where: whereClause,
      include: getFollowupIncludes(companyId, { withLead: true }),
      order: [["followup_date", "DESC"], ["id", "DESC"]],
      distinct: true,
      subQuery: false,
    });

    return res.json({ success: true, data: normalizeFollowupRows(rows) });
  } catch (error) {
    console.error("getAllFollowups Error:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

exports.getActiveReminderAlerts = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    const userId = req.user?.id ? Number(req.user.id) : null;
    const isAdmin = req.user?.role_id === 1 || req.user?.type === "admin";

    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const now = new Date();
    const graceWindowStart = new Date(now.getTime() - 10 * 60 * 1000);

    const rows = await LeadHistory.findAll({
      where: {
        company_id: companyId,
        reminder_at: {
          [Op.lte]: now,
        },
        followup_date: {
          [Op.gte]: graceWindowStart,
        },
      },
      include: getFollowupIncludes(companyId, {
        withLead: true,
        leadRequired: true,
        leadAttributes: ["id", "name", "contact_no", "assign_to"],
        leadWhere: isAdmin ? {} : { assign_to: userId },
      }),
      order: [
        ["followup_date", "ASC"],
        ["id", "ASC"],
      ],
    });

    return res.json({
      success: true,
      data: normalizeFollowupRows(rows),
    });
  } catch (error) {
    console.error("getActiveReminderAlerts Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

exports.updateFollowup = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    const userId = req.user?.id;
    const { id } = req.params;
    const { followup_date, followup_time, status_id, remark } = req.body;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: user not found (token missing/invalid)",
      });
    }

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Followup id is required",
      });
    }

    const existingFollowup = await LeadHistory.findOne({
      where: {
        id,
        company_id: companyId,
      },
    });

    if (!existingFollowup) {
      return res.status(404).json({
        success: false,
        message: "Followup not found",
      });
    }

    let statusRemark = "";
    let validStatusId = existingFollowup.status_id;

    if (status_id !== undefined && status_id !== null && status_id !== "") {
      const st = await LeadStatus.findOne({
        where: {
          id: Number(status_id),
          company_id: companyId,
        },
      });

      if (!st) {
        return res.status(400).json({
          success: false,
          message: "Invalid status_id",
        });
      }

      validStatusId = Number(status_id);
      statusRemark = ``;
    } else if (status_id === null || status_id === "") {
      validStatusId = null;
    }

    let combinedFollowupDate = existingFollowup.followup_date;
    let reminderAt = existingFollowup.reminder_at;

    if (followup_date || followup_time) {
      const { date: oldDate, time: oldTime } = splitFollowupDateTime(
        existingFollowup.followup_date
      );

      const finalDate = followup_date || oldDate;
      const finalTime = followup_time || oldTime || "00:00:00";

      combinedFollowupDate = buildDateTimeString(finalDate, finalTime);
      reminderAt = getReminderAtFromFollowup(finalDate, finalTime);

      if (!combinedFollowupDate || !reminderAt) {
        return res.status(400).json({
          success: false,
          message: "Invalid followup date or time format",
        });
      }
    }

    const cleanRemark = typeof remark === "string" ? remark.trim() : "";
    const finalRemark =
      cleanRemark || (statusRemark ? statusRemark : existingFollowup.remark);
    const changedByAgent = await getCurrentFollowupAgent(req);

    if (!changedByAgent) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: logged-in agent not found",
      });
    }

    await LeadHistory.update(
      {
        followup_date: combinedFollowupDate,
        reminder_at: reminderAt,
        is_reminder_sent: false,
        status_id: validStatusId,
        changed_by: changedByAgent.id,
        remark: finalRemark || null,
      },
      {
        where: {
          id,
          company_id: companyId,
        },
      }
    );

    const updatedFollowup = await LeadHistory.findOne({
      where: {
        id,
        company_id: companyId,
      },
      include: getFollowupIncludes(companyId),
    });

    return res.json({
      success: true,
      message: "Followup updated successfully",
      followup: normalizeFollowupRow(updatedFollowup),
    });
  } catch (error) {
    console.error("updateFollowup Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

exports.deleteFollowup = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    const userId = req.user?.id;
    const { id } = req.params;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: user not found",
      });
    }

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Followup id is required",
      });
    }

    const followup = await LeadHistory.findOne({
      where: {
        id,
        company_id: companyId,
      },
    });

    if (!followup) {
      return res.status(404).json({
        success: false,
        message: "Followup not found",
      });
    }

    await LeadHistory.destroy({
      where: {
        id,
        company_id: companyId,
      },
    });

    return res.json({
      success: true,
      message: "Followup deleted successfully",
    });
  } catch (error) {
    console.error("deleteFollowup Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};
