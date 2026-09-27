// models/index.js
const sequelize = require("../config/db");

const Admin = require("./Admin");          // users/admin table
const Lead = require("./Leads");          // leads table
const LeadStatus = require("./LeadStatus");
const LeadSource = require("./LeadSource");
const Agent = require("./UserAgent");     // your agent details table (id,name,contact_no,email,role_id)
const UserRole = require("./UserRole");   // roles table
const QuotationService = require("./QuotationService");
const Webhook = require("./Webhook");
const FieldWork = require("./FieldWork");
const Quotation = require("./Quotation");
const EmailTemplate = require("./EmailTemplate");
const SmtpSetting = require("./SmtpSetting");

/* -------------------- Roles -------------------- */

// Role -> Users
UserRole.hasMany(Admin, { foreignKey: "role_id", as: "users" });
Admin.belongsTo(UserRole, { foreignKey: "role_id", as: "role" });

// Role -> Agents (only if Agent has role_id)
UserRole.hasMany(Agent, { foreignKey: "role_id", as: "agents" });
Agent.belongsTo(UserRole, { foreignKey: "role_id", as: "role" });


QuotationService.hasMany(Quotation, { foreignKey: "service_type", as: "quotations" });
Quotation.belongsTo(QuotationService, { foreignKey: "service_type", as: "service" });


FieldWork.belongsTo(Lead, {foreignKey: "lead_id",as: "lead",});
Lead.hasMany(FieldWork, {foreignKey: "lead_id",as: "field_works",});


module.exports = {
  sequelize,
  Admin,
  Lead,
  LeadStatus,
  LeadSource,
  FieldWork,
  Agent,
  UserRole,
  QuotationService,
  Quotation,
  Webhook,
  EmailTemplate,
  SmtpSetting,
};
