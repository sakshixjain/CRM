const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Company = sequelize.define(
  "Company",
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },

    company_name: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },

    email: {
      type: DataTypes.STRING(191),
      allowNull: false,
      validate: {
        isEmail: true,
      },
    },

    contact_no: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },

    website: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    city: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    state: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    country: {
      type: DataTypes.STRING(100),
      allowNull: true,
      defaultValue: "India",
    },

    pincode: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },

    logo_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    db_name: {
      type: DataTypes.STRING(120),
      allowNull: false,
      unique: "uniq_db_name",
    },

    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: "company_details",
    timestamps: true,
  }
);

module.exports = Company;