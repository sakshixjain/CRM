const Lead = require("../models/Leads");
const { Op } = require("sequelize");
const Agent = require("../models/UserAgent");
const LeadSource = require("../models/LeadSource");
const LeadStatus = require("../models/LeadStatus");
const Admin = require("../models/Admin");

function normalizePhoneNumber(phone) {
  if (phone == null) return "";

  let value = String(phone).trim();

  // remove all non-digits
  value = value.replace(/\D/g, "");

  // remove leading zeros
  while (value.startsWith("0")) {
    value = value.slice(1);
  }

  // If already Indian with 91 prefix and valid 10-digit local number
  if (
    value.length === 12 &&
    value.startsWith("91") &&
    /^[6-9]\d{9}$/.test(value.slice(2))
  ) {
    return value;
  }

  // If only 10-digit Indian mobile, prepend 91
  if (value.length === 10 && /^[6-9]\d{9}$/.test(value)) {
    return `91${value}`;
  }

  // fallback: return cleaned value as-is for non-Indian/other long numbers
  return value;
}

function normalizeWhatsappChat(value) {
  const v = String(value ?? "").trim().toLowerCase();
  if (v === "yes") return "yes";
  if (v === "no") return "no";
  if (v === "only whatsapp chats" || v === "only whatsapp_chat chats") {
    return "only whatsapp chats";
  }
  return v;
}

function normalizeCallStatus(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  const match = raw.match(/^(yes|no)(?:\s*,\s*(.*))?$/i);
  if (!match) return raw.toLowerCase();

  const status = String(match[1] || "").trim().toLowerCase();
  const description = String(match[2] || "").trim();

  return description ? `${status}, ${description}` : status;
}
  
exports.getChangedByOptions = async (req, res) => {
  try {
    const companyId = req.user?.company_id;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const admins = await Admin.findAll({
      where: {
        company_id: companyId,
        is_active: true,
      },
      attributes: ["id", "name", "email"],
      order: [["name", "ASC"]],
    });

    return res.status(200).json({
      success: true,
      data: admins,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Error fetching changed by options",
    });
  }
};

exports.createLead = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    const adminId = req.user?.id;

    if (!companyId || !adminId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const {
      name,
      email,
      contact_no,
      contact_no1,
      whatsapp_chat,
      call_status,
      call,
      address,
      state,
      city,
      pincode,
      case_type,
      source_id,
      assign_to,
      status_id,
      description,
      is_active,
      country,
    } = req.body;

    const normalizedEmail =
      email && String(email).trim().length > 0 ? String(email).trim() : null;

    const normalizedContactNo = normalizePhoneNumber(contact_no);
    const normalizedContactNo1 = contact_no1
      ? normalizePhoneNumber(contact_no1)
      : null;

    if (!name || !String(name).trim()) {
      return res.status(400).json({
        success: false,
        message: "Name is required",
      });
    }

    if (!normalizedContactNo) {
      return res.status(400).json({
        success: false,
        message: "Contact number is required",
      });
    }

    if (normalizedContactNo.length < 10 || normalizedContactNo.length > 15) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid contact number",
      });
    }

    const existingLead = await Lead.findOne({
      where: {
        contact_no: normalizedContactNo,
        company_id: companyId,
      },
    });

    if (existingLead) {
      return res.status(400).json({
        success: false,
        message: "Contact number already exists",
      });
    }

    if (normalizedEmail) {
      const existingEmailLead = await Lead.findOne({
        where: {
          email: normalizedEmail,
          company_id: companyId,
        },
      });

      if (existingEmailLead) {
        return res.status(400).json({
          success: false,
          message: "Email already exists",
        });
      }
    }

    const lead = await Lead.create({
      company_id: companyId,
      name: String(name).trim(),
      email: normalizedEmail,
      contact_no: normalizedContactNo,
      contact_no1: normalizedContactNo1 || null,
      whatsapp_chat: whatsapp_chat ?? null,
      call_status: normalizeCallStatus(call_status ?? call) || null,
      address,
      state,
      city,
      pincode,
      case_type,
      source_id,
      assign_to,
      status_id,
      description,
      is_active: is_active !== undefined ? is_active : true,
      country: country || "India",
      changed_by: adminId,
    });

    const createdLead = await Lead.findOne({
      where: {
        id: lead.id,
        company_id: companyId,
      },
      include: [
        {
          model: LeadStatus,
          as: "status",
          attributes: ["id", "name", "color"],
          required: false,
        },
        {
          model: Agent,
          as: "assignedTo",
          attributes: ["id", "name", "email"],
          required: false,
        },
        {
          model: Admin,
          as: "changedByAdmin",
          attributes: ["id", "name", "email"],
          required: false,
        },
      ],
    });

    return res.status(201).json({
      success: true,
      data: createdLead,
      message: "Lead created successfully",
    });
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(400).json({
        success: false,
        message: "Contact number or email already exists",
      });
    }

    if (error.name === "SequelizeValidationError") {
      return res.status(400).json({
        success: false,
        message: error.errors.map((e) => e.message).join(", "),
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Error creating lead",
    });
  }
};

exports.getAllLeads = async (req, res) => {
  try {
    const companyId = req.user?.company_id;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const {
      page = 1,
      limit = 10,
      status_id,
      is_active,
      search,
      assign_to,
      assign_status,
      changed_by,
      whatsapp_chat,
      call_status,
      call,
      source_id,
      case_type,
      city,
      state,
      country,
      sortBy,
      sortOrder = "DESC",
      fromDate,
      toDate,
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);
    const whereClause = {
      company_id: companyId,
    };

    if (status_id) whereClause.status_id = status_id;
    if (is_active !== undefined) whereClause.is_active = is_active === "true";
    const isAgent =
      req.user?.type === "agent" ||
      (req.user?.role_id !== undefined && Number(req.user.role_id) !== 1);

    if (isAgent) {
      // STRICT Agent Isolation: Agents only see leads assigned directly to them
      whereClause.assign_to = req.user.id;
    } else {
      // Admin filter options
      if (assign_status === "assigned") {
        whereClause.assign_to = {
          [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: 0 }],
        };
      } else if (assign_status === "unassigned") {
        whereClause[Op.or] = [{ assign_to: null }, { assign_to: 0 }];
      } else if (assign_status === "my_leads") {
        whereClause.assign_to = req.user.id;
      } else if (assign_to) {
        whereClause.assign_to = assign_to;
      }
    }
    if (source_id) whereClause.source_id = source_id;
    if (case_type) whereClause.case_type = case_type;
    if (changed_by) whereClause.changed_by = changed_by;
    if (whatsapp_chat) {
      const normalizedWhatsapp = normalizeWhatsappChat(whatsapp_chat);
      if (normalizedWhatsapp === "only whatsapp chats") {
        whereClause.whatsapp_chat = {
          [Op.in]: ["only whatsapp chats", "only whatsapp_chat chats"],
        };
      } else {
        whereClause.whatsapp_chat = normalizedWhatsapp;
      }
    }
    if (call_status || call) {
      const normalizedCall = normalizeCallStatus(call_status ?? call);
      if (normalizedCall) {
        const prefix = normalizedCall.split(",")[0].trim();
        whereClause.call_status = {
          [Op.like]: `${prefix}%`,
        };
      }
    }
    if (city) whereClause.city = { [Op.like]: `%${city}%` };
    if (state) whereClause.state = { [Op.like]: `%${state}%` };
    if (country) whereClause.country = { [Op.like]: `%${country}%` };

    const resolvedSortBy = sortBy || (changed_by ? "updatedAt" : "createdAt");

    if (fromDate || toDate) {
      const start = fromDate ? new Date(`${fromDate}T00:00:00.000`) : null;
      const end = toDate ? new Date(`${toDate}T23:59:59.999`) : null;
      const dateField = changed_by ? "updatedAt" : "createdAt";

      whereClause[dateField] = {};
      if (start) whereClause[dateField][Op.gte] = start;
      if (end) whereClause[dateField][Op.lte] = end;
    }

    if (search) {
      const likeSearch = `%${search}%`;
      whereClause[Op.or] = [
        { name: { [Op.like]: likeSearch } },
        { email: { [Op.like]: likeSearch } },
        { contact_no: { [Op.like]: likeSearch } },
        { contact_no1: { [Op.like]: likeSearch } },
        { call_status: { [Op.like]: likeSearch } },
        { whatsapp_chat: { [Op.like]: likeSearch } },
        { case_type: { [Op.like]: likeSearch } },
        { address: { [Op.like]: likeSearch } },
        { city: { [Op.like]: likeSearch } },
        { state: { [Op.like]: likeSearch } },
        { country: { [Op.like]: likeSearch } },
        { pincode: { [Op.like]: likeSearch } },
        { description: { [Op.like]: likeSearch } },
        { "$source.name$": { [Op.like]: likeSearch } },
        { "$status.name$": { [Op.like]: likeSearch } },
        { "$assignedTo.name$": { [Op.like]: likeSearch } },
        { "$assignedTo.email$": { [Op.like]: likeSearch } },
        { "$changedByAdmin.name$": { [Op.like]: likeSearch } },
        { "$changedByAdmin.email$": { [Op.like]: likeSearch } },
      ];
    }

    const { count, rows } = await Lead.findAndCountAll({
      where: whereClause,
      distinct: true,
      subQuery: false,
      limit: Number(limit),
      offset,
      order: [[resolvedSortBy, String(sortOrder).toUpperCase()]],
      include: [
        {
          model: LeadSource,
          as: "source",
          attributes: ["id", "name"],
          required: false,
        },
        {
          model: LeadStatus,
          as: "status",
          attributes: ["id", "name", "color"],
          required: false,
        },
        {
          model: Agent,
          as: "assignedTo",
          attributes: ["id", "name", "email"],
          required: false,
        },
        {
          model: Admin,
          as: "changedByAdmin",
          attributes: ["id", "name", "email"],
          required: false,
        },
      ],
    });

    return res.status(200).json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(count / Number(limit)),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Error fetching leads",
    });
  }
};

exports.getLeadById = async (req, res) => {
  try {
    const companyId = req.user?.company_id;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const lead = await Lead.findOne({
      where: {
        id: req.params.id,
        company_id: companyId,
      },
      include: [
        {
          model: LeadStatus,
          as: "status",
          attributes: ["id", "name", "color"],
          required: false,
        },
        {
          model: Agent,
          as: "assignedTo",
          attributes: ["id", "name", "email"],
          required: false,
        },
        {
          model: Admin,
          as: "changedByAdmin",
          attributes: ["id", "name", "email"],
          required: false,
        },
      ],
    });

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: lead,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Error fetching lead",
    });
  }
};

exports.updateLead = async (req, res) => {
  try {
    const companyId = req.user?.company_id;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const lead = await Lead.findOne({
      where: {
        id: req.params.id,
        company_id: companyId,
      },
    });

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    const {
      name,
      email,
      contact_no,
      contact_no1,
      whatsapp_chat,
      call_status,
      call,
      address,
      state,
      city,
      pincode,
      source_id,
      status_id,
      assign_to,
      case_type,
      description,
      is_active,
      country,
    } = req.body;

    const adminId = req.user?.id;

    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const normalizedEmail =
      email && String(email).trim().length > 0 ? String(email).trim() : null;

    const normalizedContactNo =
      contact_no !== undefined
        ? normalizePhoneNumber(contact_no)
        : lead.contact_no;

    const normalizedContactNo1 =
      contact_no1 !== undefined
        ? (contact_no1 ? normalizePhoneNumber(contact_no1) : null)
        : lead.contact_no1;

    if (normalizedEmail && normalizedEmail !== lead.email) {
      const existingLead = await Lead.findOne({
        where: {
          email: normalizedEmail,
          company_id: companyId,
          id: { [Op.ne]: lead.id },
        },
      });

      if (existingLead) {
        return res.status(400).json({
          success: false,
          message: "Email already exists",
        });
      }
    }

    if (normalizedContactNo && normalizedContactNo !== lead.contact_no) {
      const existingContactLead = await Lead.findOne({
        where: {
          contact_no: normalizedContactNo,
          company_id: companyId,
          id: { [Op.ne]: lead.id },
        },
      });

      if (existingContactLead) {
        return res.status(400).json({
          success: false,
          message: "Contact number already exists",
        });
      }
    }

    await lead.update({
      name: name ?? lead.name,
      email: normalizedEmail ?? lead.email,
      contact_no: normalizedContactNo ?? lead.contact_no,
      contact_no1: normalizedContactNo1,
      whatsapp_chat: whatsapp_chat ?? lead.whatsapp_chat,
      call_status:
        call_status !== undefined || call !== undefined
          ? normalizeCallStatus(call_status ?? call) || null
          : lead.call_status,
      address: address ?? lead.address,
      state: state ?? lead.state,
      city: city ?? lead.city,
      case_type: case_type ?? lead.case_type,
      pincode: pincode ?? lead.pincode,
      source_id: source_id ?? lead.source_id,
      status_id: status_id ?? lead.status_id,
      assign_to: assign_to ?? lead.assign_to,
      description: description ?? lead.description,
      is_active: is_active ?? lead.is_active,
      country: country ?? lead.country,
      changed_by: adminId,
    });

    const updatedLead = await Lead.findOne({
      where: {
        id: lead.id,
        company_id: companyId,
      },
      include: [
        {
          model: LeadStatus,
          as: "status",
          attributes: ["id", "name", "color"],
          required: false,
        },
        {
          model: Agent,
          as: "assignedTo",
          attributes: ["id", "name", "email"],
          required: false,
        },
        {
          model: Admin,
          as: "changedByAdmin",
          attributes: ["id", "name", "email"],
          required: false,
        },
      ],
    });

    return res.status(200).json({
      success: true,
      data: updatedLead,
      message: "Lead updated successfully",
    });
  } catch (error) {
    if (error.name === "SequelizeValidationError") {
      return res.status(400).json({
        success: false,
        message: error.errors.map((e) => e.message).join(", "),
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Error updating lead",
    });
  }
};

exports.deleteLead = async (req, res) => {
  try {
    const companyId = req.user?.company_id;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const lead = await Lead.findOne({
      where: {
        id: req.params.id,
        company_id: companyId,
      },
    });

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    await lead.destroy();

    return res.status(200).json({
      success: true,
      message: "Lead deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Error deleting lead",
    });
  }
};

exports.bulkAssignLeads = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    const userId = req.user?.id;
    const { lead_ids, assign_to } = req.body;

    if (!companyId || !userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!Array.isArray(lead_ids) || lead_ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "lead_ids array is required",
      });
    }

    let agentName = "Unassigned";
    let targetAssignTo = null;

    if (assign_to) {
      const agent = await Agent.findOne({
        where: { id: assign_to, company_id: companyId },
      });
      if (!agent) {
        return res.status(404).json({
          success: false,
          message: "Selected agent not found",
        });
      }
      agentName = agent.name;
      targetAssignTo = agent.id;
    }

    const [updatedCount] = await Lead.update(
      {
        assign_to: targetAssignTo,
        changed_by: userId,
      },
      {
        where: {
          id: { [Op.in]: lead_ids },
          company_id: companyId,
        },
      }
    );

    return res.status(200).json({
      success: true,
      updatedCount,
      message: `${updatedCount} lead(s) successfully assigned to ${agentName}`,
    });
  } catch (error) {
    console.error("bulkAssignLeads error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error bulk assigning leads",
    });
  }
};

exports.getLeadStats = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const isAgent =
      req.user?.type === "agent" ||
      (req.user?.role_id !== undefined && Number(req.user.role_id) !== 1);

    if (isAgent) {
      const myCount = await Lead.count({
        where: { company_id: companyId, assign_to: req.user.id },
      });
      return res.status(200).json({
        success: true,
        data: {
          total: myCount,
          assigned: myCount,
          unassigned: 0,
          myLeads: myCount,
        },
      });
    }

    const [total, assigned, unassigned, myLeads] = await Promise.all([
      Lead.count({ where: { company_id: companyId } }),
      Lead.count({
        where: {
          company_id: companyId,
          assign_to: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: 0 }] },
        },
      }),
      Lead.count({
        where: {
          company_id: companyId,
          [Op.or]: [{ assign_to: null }, { assign_to: 0 }],
        },
      }),
      Lead.count({ where: { company_id: companyId, assign_to: req.user.id } }),
    ]);

    return res.status(200).json({
      success: true,
      data: { total, assigned, unassigned, myLeads },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Error fetching lead stats",
    });
  }
};
