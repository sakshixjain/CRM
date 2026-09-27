const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const UserRole = sequelize.define("UserRole", {
  id: { 
    type: DataTypes.INTEGER, 
    autoIncrement: true,
     primaryKey: true 
    },
     company_id:{
      type:DataTypes.INTEGER,
      allowNull:false,
    },
  role: { 
    type: DataTypes.ENUM("admin", "agent"),
     defaultValue: "agent"
     },
}, {
   tableName: "user_roles" 
  });

module.exports = UserRole;
