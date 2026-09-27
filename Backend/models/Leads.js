const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");
const LeadStatus = require("./LeadStatus");
const LeadSource = require("./LeadSource");
const Agent = require("./UserAgent");
const FieldWork = require("./FieldWork");
const Admin = require("./Admin");

const Lead = sequelize.define(
  "Lead",
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
      type: DataTypes.STRING(80),
      allowNull: false,
      trim: true,
    },

    email: {
      type: DataTypes.STRING(120),
      allowNull: true,
     
    },
   case_type: {
      type: DataTypes.STRING(100),
      allowNull: true,
    }, 

changed_by:{
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "admins",
        key: "id",
      },
},

    contact_no: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique:true,
      validate: {
        is: /^[0-9+\-\s()]{8,20}$/,
      },
    },
contact_no1:{
   type: DataTypes.STRING(20),
      allowNull: true,
      validate: {
        is: /^[0-9+\-\s()]{8,20}$/,
      },
},
whatsapp_chat:{
  type:DataTypes.STRING(50),
  allowNull:true,
},
call_status: {
  type: DataTypes.STRING(500),
  allowNull: true,
},

    address: DataTypes.STRING(255),
    state: DataTypes.STRING(100),
    city: DataTypes.STRING(100),
    pincode: DataTypes.STRING(20),

    source_id: {
      type: DataTypes.INTEGER,                    // ← Fixed here
      allowNull: true,
      comment: "Lead source: website, referral, ad, manual, etc.",
      references: {
        model: "lead_sources",
        key: "id",
      },
    },

    status_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "lead_statuses",
        key: "id",
      },
    },

    assign_to: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "User ID of the assigned sales/support person",
      references: {
        model: "agents",
        key: "id",
      },
      onDelete: "SET NULL",
    },

    description: DataTypes.TEXT,

    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
    },

    country: {
      type: DataTypes.STRING(100),
      allowNull: true,
      defaultValue: "India",
    },

    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },

    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "lead",
    timestamps: true,
    underscored: true,
    paranoid: false,
  }
  
);
Lead.belongsTo(LeadStatus, { foreignKey: "status_id", as: "status" });
Lead.belongsTo(LeadSource, { foreignKey: "source_id", as: "source" });
Lead.belongsTo(Agent, { foreignKey: "assign_to", as: "assignedTo" });
Lead.belongsTo(Admin,{foreignKey:"changed_by",as:"changedByAdmin"});
Lead.hasMany(FieldWork, {
  foreignKey: "lead_id",
});


module.exports = Lead;
