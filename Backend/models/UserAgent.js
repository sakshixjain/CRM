// models/Agent.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Agent = sequelize.define("Agent", {
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

  contact_no: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },

  email: {
    type: DataTypes.STRING(120),
    allowNull: false,
    unique: true,
  },

  role_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false, 
    defaultValue: true,
  },
  city: {
    type: DataTypes.STRING(100),
    allowNull: true,
    defaultValue: null,
  },
}, {
  tableName: "agents",
  timestamps: true,
  underscored: true, // created_at, updated_at
});

module.exports = Agent;
