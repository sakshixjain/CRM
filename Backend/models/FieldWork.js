const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");


const FieldWork = sequelize.define(
  "FieldWork",
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    lead_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
    },
    days: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    number: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    report_submit: {
      type: DataTypes.ENUM("yes", "no"),
      allowNull: false,
      defaultValue: "no",
    },
    recheck: {
      type: DataTypes.ENUM("yes", "no"),
      allowNull: false,
      defaultValue: "no",
    },
    proof: {
      type: DataTypes.ENUM("yes", "no"),
      allowNull: false,
      defaultValue: "no",
    },
    case_type: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
    },
  },
  {
    tableName: "field_works",
    timestamps: true,
    underscored: true,
  }
);

module.exports = FieldWork;