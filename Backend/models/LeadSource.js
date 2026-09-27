// models/LeadSource.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const LeadSource = sequelize.define("LeadSource", {
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
    unique: true,
  },
  description: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: "lead_sources",
});

module.exports = LeadSource;
