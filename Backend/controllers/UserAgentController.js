const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Agent = require("../models/UserAgent");
const Admin = require("../models/Admin");
const LeadHistory = require("../models/LeadHistory");
const sequelize = require("../config/db"); // ✅ your sequelize instance
const Lead = require("../models/Leads");
const transporter = require("../config/emailConfig");
const { welcomeEmailTemplate } = require("../utils/emailTemplates");

function pickSafe(row) {
  if (!row) return null;
  const obj = row.toJSON ? row.toJSON() : row;
  delete obj.password;
  return obj;
}

const signAccessToken = (adminId, companyId) => {
  return jwt.sign({ id: adminId, company_id: companyId }, process.env.JWT_SECRET, {
    expiresIn: "12h",
  });
};

function generateRandomPassword(length = 8) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// ✅ CREATE: Agent + Admin + Send Password Email
exports.createAgent = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const companyId = req.user?.company_id;

    if (!companyId) {
      await t.rollback();
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { name, contact_no, email, role_id, city } = req.body;

    if (!name || !contact_no || !email || !role_id) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "name, contact_no, email, role_id are required",
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    // ✅ Duplicate check inside same company
    const existsAgent = await Agent.findOne({
      where: { email: cleanEmail, company_id: companyId },
      transaction: t,
    });

    const existsAdmin = await Admin.findOne({
      where: { email: cleanEmail, company_id: companyId },
      transaction: t,
    });

    if (existsAgent || existsAdmin) {
      await t.rollback();
      return res.status(409).json({
        success: false,
        message: "Email already exists",
      });
    }

    // ✅ Generate random password
    const plainPassword = generateRandomPassword(8);

    // ✅ Hash password
    const hashed = await bcrypt.hash(plainPassword, 10);

    // ✅ Create Agent
    const createdAgent = await Agent.create(
      {
        company_id: companyId,
        name,
        contact_no,
        email: cleanEmail,
        city: city ? String(city).trim() : null,
        role_id: Number(role_id),
        is_active: true,
      },
      { transaction: t }
    );

    // ✅ Create Admin
    const createdAdmin = await Admin.create(
      {
        company_id: companyId,
        name,
        contact_no,
        email: cleanEmail,
        password: hashed,
        role_id: Number(role_id),
      },
      { transaction: t }
    );

    // ✅ Generate token
    const token = signAccessToken(createdAdmin.id, companyId);
    createdAdmin.token = token;
    await createdAdmin.save({ transaction: t });

    const loginUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/login`;

    // -------------------------------------------------------------------------
    // 📧 LOCAL DEV: Agent credentials console mein print ho rahe hain (SMTP commented)
    // -------------------------------------------------------------------------
    console.log("\n============================================================");
    console.log("👤 NEW AGENT CREATED (LOCAL DEVELOPMENT)");
    console.log("------------------------------------------------------------");
    console.log(`Agent Name: ${name}`);
    console.log(`Email:      ${cleanEmail}`);
    console.log(`Password:   ${plainPassword}`);
    console.log(`Login URL:  ${loginUrl}`);
    console.log("============================================================\n");

    /* UNCOMMENT FOR PRODUCTION SMTP:
    await transporter.sendMail({
      from: `"CRM System" <${process.env.SMTP_USER}>`,
      to: cleanEmail,
      subject: "Your CRM Account Credentials",
      html: welcomeEmailTemplate({
        userName: name,
        email: cleanEmail,
        password: plainPassword,
        role: "Agent",
        loginUrl,
      }),
    });
    */

    await t.commit();

    return res.status(201).json({
      success: true,
      message: "Agent created successfully.",
      tempPassword: plainPassword,
      data: createdAgent,
    });
  } catch (err) {
    try {
      await t.rollback();
    } catch {}
    console.error("createAgent error:", err);
    return res.status(500).json({
      success: false,
      message: err?.message || "Server error",
    });
  }
};

// ✅ READ ALL (Agent table only)
exports.getAllAgents = async (req, res) => {
  try {
    const companyId = req.user?.company_id;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const agents = await Agent.findAll({
      where: { company_id: companyId },
      order: [["id", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      data: agents,
    });
  } catch (err) {
    console.error("getAllAgents error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ✅ READ ONE (Agent table only)
exports.getAgentById = async (req, res) => {
  try {
    const companyId = req.user?.company_id;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { id } = req.params;

    const agent = await Agent.findOne({
      where: {
        id,
        company_id: companyId,
      },
    });

    if (!agent) {
      return res.status(404).json({ success: false, message: "Agent not found" });
    }

    return res.status(200).json({ success: true, data: agent });
  } catch (err) {
    console.error("getAgentById error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.updateAgent = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const companyId = req.user?.company_id;

    if (!companyId) {
      await t.rollback();
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { id } = req.params;
    const { name, contact_no, email, password, role_id, is_active, city } = req.body;

    const agent = await Agent.findOne({
      where: {
        id,
        company_id: companyId,
      },
      transaction: t,
    });

    if (!agent) {
      await t.rollback();
      return res.status(404).json({ success: false, message: "Agent not found" });
    }

    const oldEmail = agent.email;

    const admin = await Admin.findOne({
      where: {
        email: oldEmail,
        company_id: companyId,
      },
      transaction: t,
    });

    if (!admin) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Admin account not found for this agent",
      });
    }

    // ✅ If email changes, check duplicates in both tables inside same company
    if (email && String(email).trim().toLowerCase() !== oldEmail) {
      const newEmail = String(email).trim().toLowerCase();

      const existsInAgents = await Agent.findOne({
        where: { email: newEmail, company_id: companyId },
        transaction: t,
      });

      const existsInAdmins = await Admin.findOne({
        where: { email: newEmail, company_id: companyId },
        transaction: t,
      });

      if (
        (existsInAgents && existsInAgents.id !== agent.id) ||
        (existsInAdmins && existsInAdmins.id !== admin.id)
      ) {
        await t.rollback();
        return res.status(409).json({ success: false, message: "Email already exists" });
      }
    }

    // ✅ Agent update (no password/token)
    const agentUpdate = {};
    if (name !== undefined) agentUpdate.name = name;
    if (contact_no !== undefined) agentUpdate.contact_no = contact_no;
    if (email !== undefined) agentUpdate.email = String(email).trim().toLowerCase();
    if (role_id !== undefined) agentUpdate.role_id = Number(role_id);
    if (is_active !== undefined) agentUpdate.is_active = Boolean(is_active);
    if (city !== undefined) agentUpdate.city = city ? String(city).trim() : null;

    // ✅ Admin update (same fields + optional password)
    const adminUpdate = { ...agentUpdate };

    let passwordChanged = false;

    const pass = typeof password === "string" ? password.trim() : "";
    if (pass) {
      adminUpdate.password = await bcrypt.hash(pass, 10); // ✅ simple model
      adminUpdate.token = null; // ✅ FORCE LOGOUT after password update
      passwordChanged = true;
    }

    await agent.update(agentUpdate, { transaction: t });
    await admin.update(adminUpdate, { transaction: t });

    await t.commit();

    const updatedAgent = await Agent.findOne({
      where: {
        id,
        company_id: companyId,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Agent updated successfully",
      forceLogout: passwordChanged, // ✅ frontend can logout if true
      data: updatedAgent,
    });
  } catch (err) {
    console.error("updateAgent error:", err);
    try {
      await t.rollback();
    } catch {}
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.reassignLeads = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const companyId = req.user?.company_id;

    if (!companyId) {
      await t.rollback();
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { from_agent_id, to_agent_id } = req.body;

    if (!from_agent_id || !to_agent_id) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "from_agent_id and to_agent_id are required",
      });
    }

    if (Number(from_agent_id) === Number(to_agent_id)) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Both agents cannot be the same",
      });
    }

    // ✅ Check if agents exist inside same company
    const fromAgent = await Agent.findOne({
      where: {
        id: from_agent_id,
        company_id: companyId,
      },
      transaction: t,
    });

    const toAgent = await Agent.findOne({
      where: {
        id: to_agent_id,
        company_id: companyId,
      },
      transaction: t,
    });

    if (!fromAgent || !toAgent) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "One or both agents not found",
      });
    }

    // ✅ Count leads
    const leadsCount = await Lead.count({
      where: {
        assign_to: from_agent_id,
        company_id: companyId,
      }, // change if field name different
      transaction: t,
    });

    if (leadsCount === 0) {
      await t.rollback();
      return res.status(200).json({
        success: true,
        message: "No leads found to reassign",
        reassignedLeads: 0,
      });
    }

    // ✅ Update leads
    const [updatedCount] = await Lead.update(
      { assign_to: to_agent_id }, // change if needed
      {
        where: {
          assign_to: from_agent_id,
          company_id: companyId,
        },
        transaction: t,
      }
    );

    await t.commit();

    return res.status(200).json({
      success: true,
      message: "Leads reassigned successfully",
      from_agent_id,
      to_agent_id,
      reassignedLeads: updatedCount,
    });

  } catch (err) {
    console.error("reassignLeads error:", err);
    try { await t.rollback(); } catch {}
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.deleteAgent = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const companyId = req.user?.company_id;

    if (!companyId) {
      await t.rollback();
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { id } = req.params;
    const reassignRaw = req.body?.reassign_to ?? req.query?.reassign_to;
    const reassignTo = reassignRaw ? Number(reassignRaw) : null;

    const agent = await Agent.findOne({
      where: {
        id,
        company_id: companyId,
      },
      transaction: t,
    });

    if (!agent) {
      await t.rollback();
      return res.status(404).json({ success: false, message: "Agent not found" });
    }

    // ✅ Count assigned leads
    const leadsCount = await Lead.count({
      where: {
        assign_to: id,
        company_id: companyId,
      },
      transaction: t,
    });

    // ✅ If leads exist -> must provide reassign_to
    if (leadsCount > 0) {
      if (!reassignTo || Number.isNaN(reassignTo)) {
        await t.rollback();
        return res.status(409).json({
          success: false,
          message: "This agent has assigned leads. Provide reassign_to to move leads before deleting.",
          leadsCount,
          required: ["reassign_to"],
        });
      }

      if (Number(id) === reassignTo) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: "reassign_to must be a different agent",
        });
      }

      // ✅ Validate new agent exists in same company
      const newAgent = await Agent.findOne({
        where: {
          id: reassignTo,
          company_id: companyId,
        },
        transaction: t,
      });

      if (!newAgent) {
        await t.rollback();
        return res.status(404).json({
          success: false,
          message: "Reassign agent not found",
        });
      }

      // ✅ Move all leads
      await Lead.update(
        { assign_to: reassignTo },
        {
          where: {
            assign_to: id,
            company_id: companyId,
          },
          transaction: t,
        }
      );
    }

    // ✅ delete admin by agent.email inside same company
    const admin = await Admin.findOne({
      where: {
        email: agent.email,
        company_id: companyId,
      },
      transaction: t,
    });

    if (!admin) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Admin account not found for this agent",
      });
    }

    // ✅ clear lead history references before deleting the agent to avoid FK restriction
    await LeadHistory.update(
      { changed_by: null },
      {
        where: {
          changed_by: id,
          company_id: companyId,
        },
        transaction: t,
      }
    );

    await admin.destroy({ transaction: t });
    await agent.destroy({ transaction: t });

    await t.commit();

    return res.status(200).json({
      success: true,
      message:
        leadsCount > 0
          ? "Agent deleted (Agent + Admin) and leads reassigned"
          : "Agent deleted (Agent + Admin)",
      leadsReassigned: leadsCount > 0 ? leadsCount : 0,
      reassignedTo: leadsCount > 0 ? reassignTo : null,
    });
  } catch (err) {
    console.error("deleteAgent error:", err);
    try {
      await t.rollback();
    } catch {}
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
