const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");
const Lead = require("./Leads");
const Agent = require("./UserAgent");
const Admin = require("./Admin");

const Ticket = sequelize.define(
  "Ticket",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    ticket_number: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      trim: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    category: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: "General",
      comment: "Technical, Billing, Service, Sales, Inquiry, Bug, General",
    },
    priority: {
      type: DataTypes.ENUM("Low", "Medium", "High", "Urgent"),
      allowNull: false,
      defaultValue: "Medium",
    },
    status: {
      type: DataTypes.ENUM("Open", "In Progress", "Pending", "Resolved", "Closed"),
      allowNull: false,
      defaultValue: "Open",
    },
    lead_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "lead",
        key: "id",
      },
      onDelete: "SET NULL",
    },
    customer_name: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    customer_email: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    customer_phone: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },
    assigned_to: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "agents",
        key: "id",
      },
      onDelete: "SET NULL",
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "admins",
        key: "id",
      },
      onDelete: "SET NULL",
    },
    due_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    resolution_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    resolved_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "tickets",
    timestamps: true,
    underscored: true,
  }
);

Ticket.belongsTo(Lead, { foreignKey: "lead_id", as: "lead" });
Ticket.belongsTo(Agent, { foreignKey: "assigned_to", as: "assignedAgent" });
Ticket.belongsTo(Admin, { foreignKey: "created_by", as: "creator" });

module.exports = Ticket;
