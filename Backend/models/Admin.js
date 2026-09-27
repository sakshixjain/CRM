// models/Admin.js
const { DataTypes } = require("sequelize");
const bcrypt = require("bcryptjs");
const sequelize = require("../config/db");

const Admin = sequelize.define(
  "Admin",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    company_id:{
      type:DataTypes.INTEGER,
      allowNull:false,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    // db_name:{
    //   type:DataTypes.STRING(100),
    //   allowNull:false,
    // },

    email: {
      type: DataTypes.STRING(120),
      allowNull: false,
      // unique: true,
      validate: { isEmail: true },
    },

    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },

    contact_no: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },

    role_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },

    token: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    is_verified:{
    type:DataTypes.BOOLEAN,
    allowNull:true,
    defaultValue:0,
    },
    otp:{
      type:DataTypes.INTEGER,
      allowNull:true,
      defaultValue:null,
    },

    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    verification_expire_at:{
      type:DataTypes.DATE,
      allowNull:true,
    },
  },
  {
    tableName: "admins",
    timestamps: true,
    underscored: true,
  }
);

module.exports = Admin;
