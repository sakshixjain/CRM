// models/ActivitySession.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const ActivitySession = sequelize.define(
  "ActivitySession",
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },

    user_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      index: true,
    },

    session_id: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },

    login_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },

    logout_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    last_seen_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    status: {
      type: DataTypes.ENUM("active", "idle", "hidden", "closed"),
      allowNull: false,
      defaultValue: "active",
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

    total_mouse_moves: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
    },

    total_clicks: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
    },

    total_scrolls: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
    },

    total_keydowns: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
    },

    open_tabs_peak: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 1,
    },

    current_open_tabs: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 1,
    },

    current_path: {
      type: DataTypes.STRING(500),
      allowNull: false,
      defaultValue: "/",
    },

    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    ip_address: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    referrer: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    screen_width: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    screen_height: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    timezone: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
  },
  {
    tableName: "activity_sessions",
    underscored: true,
    indexes: [
      { fields: ["user_id"] },
      { fields: ["session_id"], unique: true },
      { fields: ["last_seen_at"] },
      { fields: ["status"] },
    ],
  }
);

module.exports = ActivitySession;