require("dotenv").config();
const cron = require("node-cron");
const { Op } = require("sequelize");
const Payment = require("../models/Payment");

function parseDurationDays(value) {
  const matches = String(value || "").match(/\d+/g);
  if (!matches || matches.length === 0) return null;

  const days = matches.map((item) => Number(item)).filter(Number.isFinite);
  if (days.length === 0) return null;

  return Math.max(...days);
}

function addDays(date, days) {
  const out = new Date(date);
  out.setDate(out.getDate() + days);
  return out;
}

async function runPaymentDurationReminderCheck() {
  const now = new Date();

  const payments = await Payment.findAll({
    where: {
      duration: {
        [Op.ne]: null,
      },
    },
    order: [["date", "ASC"]],
    limit: 500,
  });

  const duePayments = payments
    .map((payment) => {
      const row = payment.get({ plain: true });
      const status = String(row.status || "").trim().toLowerCase();
      if (status === "done" || status === "closed") return null;

      const days = parseDurationDays(row.duration);
      const startDate = row.date ? new Date(row.date) : null;
      if (!days || !startDate || Number.isNaN(startDate.getTime())) return null;

      const dueAt = addDays(startDate, days);
      if (dueAt > now) return null;

      return {
        id: row.id,
        company_id: row.company_id,
        lead_name: row.lead_name,
        contact_no: row.contact_no,
        duration: row.duration,
        due_at: dueAt,
      };
    })
    .filter(Boolean);

  if (duePayments.length > 0) {
    console.log(
      `[payment-duration-cron] ${duePayments.length} payment duration reminder(s) due`,
      duePayments
    );
  }

  return duePayments;
}

function startPaymentDurationReminderCron() {
  cron.schedule("*/10 * * * *", async () => {
    try {
      await runPaymentDurationReminderCheck();
    } catch (error) {
      console.error("[payment-duration-cron] failed:", error);
    }
  });

  console.log("[payment-duration-cron] scheduled every 10 minutes");
}

module.exports = {
  runPaymentDurationReminderCheck,
  startPaymentDurationReminderCron,
};

if (require.main === module) {
  runPaymentDurationReminderCheck()
    .then((duePayments) => {
      console.log(
        `[payment-duration-cron] completed at ${new Date().toISOString()}, due=${duePayments.length}`
      );
      process.exit(0);
    })
    .catch((error) => {
      console.error("[payment-duration-cron] failed:", error);
      process.exit(1);
    });
}
