// models/EmailTemplate.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const EmailTemplate = sequelize.define(
  "EmailTemplate",
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
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    subject: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    body_html: {
      type: DataTypes.TEXT("long"),
      allowNull: false,
    },
    category: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: "general",
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: "email_templates",
    timestamps: true,
    underscored: true,
  }
);

module.exports = EmailTemplate;
