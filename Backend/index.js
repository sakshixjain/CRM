const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });
const express = require("express");
const cors = require("cors");
const { sequelize } = require("./models");

const AuthRoutes = require("./routes/AuthRoute");
const LeadRoute = require("./routes/LeadRoute");
const {
  startActivityEventBatchCleanupCron,
} = require("./cron/activityEventBatchCleanupCron");
const {
  startPaymentDurationReminderCron,
} = require("./cron/paymentDurationReminderCron");
const app = express();

async function ensureLeadTableColumns() {
  try {
    const queryInterface = sequelize.getQueryInterface();
    const table = await queryInterface.describeTable("lead");

    if (!table.call_status) {
      await queryInterface.addColumn("lead", "call_status", {
        type: require("sequelize").DataTypes.STRING(500),
        allowNull: true,
      });
      console.log('Added missing "call_status" column to lead table');
    } else {
      await queryInterface.changeColumn("lead", "call_status", {
        type: require("sequelize").DataTypes.STRING(500),
        allowNull: true,
      });
    }

  } catch (error) {
    console.error('Unable to ensure "call_status" column on lead table:', error.message);
  }
}

async function ensurePaymentTableColumns() {
  try {
    const queryInterface = sequelize.getQueryInterface();
    const DataTypes = require("sequelize").DataTypes;
    const table = await queryInterface.describeTable("payments");

    if (!table.duration) {
      await queryInterface.addColumn("payments", "duration", {
        type: DataTypes.STRING(100),
        allowNull: true,
      });
      console.log('Added missing "duration" column to payments table');
    }

    if (!table.field_work) {
      await queryInterface.addColumn("payments", "field_work", {
        type: DataTypes.ENUM("Yes", "No"),
        allowNull: false,
        defaultValue: "No",
      });
      console.log('Added missing "field_work" column to payments table');
    }

    const indexes = await queryInterface.showIndex("payments");
    const hasContactUniqueIndex = indexes.some(
      (index) => index.name === "payments_company_contact_no_unique",
    );

    if (!hasContactUniqueIndex) {
      await queryInterface.addIndex("payments", ["company_id", "contact_no"], {
        name: "payments_company_contact_no_unique",
        unique: true,
      });
      console.log('Added unique index "payments_company_contact_no_unique"');
    }
  } catch (error) {
    console.error('Unable to ensure payments table columns/indexes:', error.message);
  }
}

async function ensureWebhookTable() {
  try {
    const queryInterface = sequelize.getQueryInterface();
    const DataTypes = require("sequelize").DataTypes;
    const tables = await queryInterface.showAllTables();
    const normalizedTables = tables.map((table) =>
      typeof table === "string" ? table : table.tableName || table.name,
    );

    if (!normalizedTables.includes("webhook")) {
      await queryInterface.createTable("webhook", {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        company_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        name: {
          type: DataTypes.STRING(100),
          allowNull: true,
          defaultValue: null,
        },
        platform: {
          type: DataTypes.STRING(100),
          allowNull: true,
          defaultValue: null,
        },
        webhook_url: {
          type: DataTypes.STRING(500),
          allowNull: false,
        },
        token: {
          type: DataTypes.STRING(128),
          allowNull: false,
          unique: true,
        },
        is_active: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        created_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
        updated_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
      });
      console.log('Created missing "webhook" table');
    } else {
      const table = await queryInterface.describeTable("webhook");
      if (table.name && table.name.allowNull === false) {
        await queryInterface.changeColumn("webhook", "name", {
          type: DataTypes.STRING(100),
          allowNull: true,
          defaultValue: null,
        });
      }
      if (table.platform && table.platform.allowNull === false) {
        await queryInterface.changeColumn("webhook", "platform", {
          type: DataTypes.STRING(100),
          allowNull: true,
          defaultValue: null,
        });
      }
    }
  } catch (error) {
    console.error('Unable to ensure "webhook" table:', error.message);
  }
}

async function ensureAgentTableColumns() {
  try {
    const queryInterface = sequelize.getQueryInterface();
    const table = await queryInterface.describeTable("agents");
    if (!table.city) {
      await queryInterface.addColumn("agents", "city", {
        type: require("sequelize").DataTypes.STRING(100),
        allowNull: true,
        defaultValue: null,
      });
      console.log('Added missing "city" column to agents table');
    }
  } catch (error) {
    console.error('Unable to ensure "city" column on agents table:', error.message);
  }
}

async function ensureEmailTables() {
  try {
    const EmailTemplate = require("./models/EmailTemplate");
    const SmtpSetting = require("./models/SmtpSetting");
    await EmailTemplate.sync();
    await SmtpSetting.sync();
    console.log("Email templates & SMTP settings tables synced OK");
  } catch (error) {
    console.error("Unable to sync email tables:", error.message);
  }
}

async function ensureTicketTable() {
  try {
    const Ticket = require("./models/Ticket");
    await Ticket.sync();
    console.log('Tickets table synced OK');
  } catch (error) {
    console.error("Unable to sync tickets table:", error.message);
  }
}

app.use(
  cors({
    origin: ['http://localhost:5173', 'https://owss.in'],
    credentials: true,
  }),
);
app.use(express.json());

// Routes
const EmailRoutes = require("./routes/EmailRoute");
const TicketRoutes = require("./routes/TicketRoute");
app.use("/", AuthRoutes);
app.use("/api/", LeadRoute);
app.use("/api/email", EmailRoutes);
app.use("/api/tickets", TicketRoutes);

// Health check
app.get("/health", (req, res) =>
  res.json({ status: "ok", env: process.env.NODE_ENV }),
);

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: "Something broke!" });
});

async function start() {
  try {
    await sequelize.authenticate();
    console.log("Database connection OK");
    await ensureLeadTableColumns();
    await ensurePaymentTableColumns();
    await ensureWebhookTable();
    await ensureAgentTableColumns();
    await ensureEmailTables();
    await ensureTicketTable();

    if (process.env.NODE_ENV !== "production") {
      console.log("Tables synced (development mode)");
    }

    // Insert default roles if they don't exist
    const UserRole = require('./models/UserRole');

    const defaultRoles = [
      { id: 1, role: 'admin' },
      { id: 2, role: 'agent' },
    ];

    for (const roleData of defaultRoles) {
      const [role, created] = await UserRole.findOrCreate({
        where: { id: roleData.id },
        defaults: {
          ...roleData,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      if (created) {
        console.log(`Role "${role.role}" created successfully`);
      } else {
        console.log(`Role "${role.role}" already exists`);
      }
    }

    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT} ✅`);
    });
    startActivityEventBatchCleanupCron();
    startPaymentDurationReminderCron();
  } catch (e) {
    console.error("Failed to start server:", e);
    process.exit(1);
  }
}

start();
