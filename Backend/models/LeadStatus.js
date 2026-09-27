// models/LeadStatus.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const LeadStatus = sequelize.define(
  "LeadStatus",
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
      type: DataTypes.STRING(50),
      allowNull: false,


    },
    color: {
      type: DataTypes.STRING(255),
      allowNull: true,

    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: false, // true for won/lost
    },
  },
  {
    tableName: "lead_statuses",
  },
);

module.exports = LeadStatus;
