require("dotenv").config();
const cron = require("node-cron");
const { Op } = require("sequelize");
const ActivityEventBatch = require("../models/ActivityEventBatch");

const RETENTION_DAYS = 30;
const CLEANUP_SCHEDULE = process.env.ACTIVITY_EVENT_BATCH_CLEANUP_CRON || "30 2 * * *";
const CLEANUP_TIMEZONE = process.env.CRON_TIMEZONE || "Asia/Kolkata";

function getRetentionCutoff(now = new Date()) {
  return new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

async function runActivityEventBatchCleanup() {
  const cutoff = getRetentionCutoff();

  const deletedCount = await ActivityEventBatch.destroy({
    where: {
      sent_at: {
        [Op.lt]: cutoff,
      },
    },
  });

  console.log(
    `[activity-event-batch-cleanup] deleted=${deletedCount}, cutoff=${cutoff.toISOString()}`
  );

  return deletedCount;
}

function startActivityEventBatchCleanupCron() {
  cron.schedule(
    CLEANUP_SCHEDULE,
    async () => {
      try {
        await runActivityEventBatchCleanup();
      } catch (error) {
        console.error("[activity-event-batch-cleanup] failed:", error);
      }
    },
    {
      timezone: CLEANUP_TIMEZONE,
    }
  );

  console.log(
    `[activity-event-batch-cleanup] scheduled "${CLEANUP_SCHEDULE}" (${CLEANUP_TIMEZONE})`
  );
}

module.exports = {
  getRetentionCutoff,
  runActivityEventBatchCleanup,
  startActivityEventBatchCleanupCron,
};

if (require.main === module) {
  runActivityEventBatchCleanup()
    .then((deletedCount) => {
      console.log(
        `[activity-event-batch-cleanup] completed at ${new Date().toISOString()}, deleted=${deletedCount}`
      );
      process.exit(0);
    })
    .catch((error) => {
      console.error("[activity-event-batch-cleanup] failed:", error);
      process.exit(1);
    });
}
