const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Quotation = sequelize.define(
  "Quotation",
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
    client_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    client_mobile: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    service_type: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "quotation_services",
        key: "id",
      },
    },
    base_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    gst_rate: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    gst_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    total_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    advance_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    remaining_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    duration: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    service_desc: {
      type: DataTypes.TEXT("long"),
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: "pending",
    },
    first_payment_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    second_payment_date: {
      type: DataTypes.DATE,
      allowNull: true,
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
    tableName: "quotations",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    underscored: true,
  }
);

module.exports = Quotation;
