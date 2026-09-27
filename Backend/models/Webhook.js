const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Webhook = sequelize.define(
  "Webhook",
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
  },
  {
    tableName: "webhook",
    timestamps: true,
    underscored: true,
  },
);

module.exports = Webhook;
