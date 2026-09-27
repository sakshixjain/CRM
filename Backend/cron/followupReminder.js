const { Op } = require("sequelize");
const fs = require("fs");
const path = require("path");

const LeadHistory = require("../models/LeadHistory");
const Lead = require("../models/Leads");

require("../config/db");

const LOG_FILE =
  process.env.CRON_LOG_FILE || "/home/owss-crm/logs/followupReminder-debug.log";

function writeLog(message) {
  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    fs.appendFileSync(
      LOG_FILE,
      `[${new Date().toISOString()}] ${message}\n`
    );
  } catch (err) {
    console.error("Log write failed:", err.message);
  }
}

async function runFollowupReminder() {
  try {
    const now = new Date();

    writeLog(`Cron started`);
    writeLog(`Now ISO: ${now.toISOString()}`);
    writeLog(`Now Local: ${now.toString()}`);

    const pendingRows = await LeadHistory.findAll({
      where: {
        is_reminder_sent: false,
        reminder_at: {
          [Op.ne]: null,
        },
      },
      attributes: ["id", "lead_id", "followup_date", "reminder_at", "is_reminder_sent"],
      order: [["id", "DESC"]],
      limit: 10,
    });

    writeLog(`Pending rows count: ${pendingRows.length}`);

    for (const row of pendingRows) {
      writeLog(
        `Pending row => id=${row.id}, lead_id=${row.lead_id}, followup_date=${row.followup_date}, reminder_at=${row.reminder_at}, is_reminder_sent=${row.is_reminder_sent}`
      );
    }

    const reminders = await LeadHistory.findAll({
      where: {
        reminder_at: {
          [Op.lte]: now,
          [Op.ne]: null,
        },
        is_reminder_sent: false,
      },
      include: [
        {
          model: Lead,
          as: "lead",
          attributes: ["id", "name", "contact_no", "assign_to"],
          required: false,
        },
      ],
      order: [["id", "ASC"]],
    });

    writeLog(`Matched reminders: ${reminders.length}`);

    for (const item of reminders) {
      try {
        writeLog(
          `Processing reminder ID=${item.id}, lead=${item.lead?.name || "N/A"}, reminder_at=${item.reminder_at}`
        );

        // actual action here
        writeLog(
          `Reminder triggered for ${item.lead?.name || "Unknown Lead"} at ${item.reminder_at}`
        );

        item.is_reminder_sent = true;
        await item.save();

        writeLog(`Marked sent: ${item.id}`);
      } catch (err) {
        writeLog(`Item error for reminder ID=${item.id}: ${err.message}`);
        console.error("Item error:", err);
      }
    }

    writeLog("Cron finished successfully");
  } catch (error) {
    writeLog(`Cron error: ${error.stack || error.message}`);
    console.error("Cron error:", error);
  } finally {
    process.exit(0);
  }
}

runFollowupReminder();