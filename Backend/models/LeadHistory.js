const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");
const UserAgent = require("./UserAgent");
const LeadStatus = require("./LeadStatus");
const Lead = require("./Leads");

const LeadHistory = sequelize.define(
  "LeadHistory",
  {
    id: {
      type: DataTypes.INTEGER(11),
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
    },
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    lead_id: {
      type: DataTypes.INTEGER(11),
      allowNull: false,
    },
    followup_date: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
    reminder_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
    is_reminder_sent: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    status_id: {
      type: DataTypes.INTEGER(11),
      allowNull: true,
      defaultValue: null,
    },
    changed_by: {
      type: DataTypes.INTEGER(11),
      allowNull: true,
      defaultValue: null,
      references: {
        model: "agents",
        key: "id",
      },
    },
    remark: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: null,
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
  },
  {
    tableName: "lead_history",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    underscored: true,
  }
);

LeadHistory.belongsTo(UserAgent, {
  foreignKey: "changed_by",
  as: "changedBy",
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});
LeadHistory.belongsTo(LeadStatus, { foreignKey: "status_id", as: "status" });
LeadHistory.belongsTo(Lead, { foreignKey: "lead_id", as: "lead" });

module.exports = LeadHistory;
