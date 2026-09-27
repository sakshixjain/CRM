// models/ActivityEventBatch.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const ActivityEventBatch = sequelize.define(
  "ActivityEventBatch",
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },

    user_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
    },

    session_id: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },

    tab_id: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },

    sent_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },

    is_final: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    status: {
      type: DataTypes.ENUM("active", "idle", "hidden", "closed"),
      allowNull: false,
    },

    current_path: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },

    interval_start: {
      type: DataTypes.DATE,
      allowNull: false,
    },

    interval_end: {
      type: DataTypes.DATE,
      allowNull: false,
    },

    active_ms: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
    },

    visible_ms: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
    },

    idle_ms: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
    },

    mouse_moves: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
    },

    clicks: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
    },

    scrolls: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
    },

    keydowns: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
    },

    open_tabs: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 1,
    },

    page_stats: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    tableName: "activity_event_batches",
    underscored: true,
    indexes: [
      { fields: ["user_id"] },
      { fields: ["session_id"] },
      { fields: ["tab_id"] },
      { fields: ["sent_at"] },
    ],
  }
);

module.exports = ActivityEventBatch;