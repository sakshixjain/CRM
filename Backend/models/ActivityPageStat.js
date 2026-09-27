// models/ActivityPageStat.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const ActivityPageStat = sequelize.define(
  "ActivityPageStat",
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },

    session_id: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },

    user_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
    },

    path: {
      type: DataTypes.STRING(500),
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

    visits: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: "activity_page_stats",
    underscored: true,
    indexes: [
      { fields: ["session_id"] },
      { fields: ["user_id"] },
      { fields: ["path"] },
      { unique: true, fields: ["session_id", "path"] },
    ],
  }
);

module.exports = ActivityPageStat;