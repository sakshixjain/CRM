// models/SmtpSetting.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const SmtpSetting = sequelize.define(
  "SmtpSetting",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
    },
    host: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    port: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 587,
    },
    secure: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    username: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    from_email: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    from_name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: "smtp_settings",
    timestamps: true,
    underscored: true,
  }
);

module.exports = SmtpSetting;
