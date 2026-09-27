const { Op } = require("sequelize");

const Lead = require("../models/Leads");
const Admin = require("../models/Admin");
const Agent = require("../models/UserAgent");
const LeadSource = require("../models/LeadSource");
const LeadStatus = require("../models/LeadStatus");
const Webhook = require("../models/Webhook");

function firstValue(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return "";
}

function normalizePhoneNumber(phone) {
  if (phone == null) return "";

  let value = String(phone).trim().replace(/\D/g, "");

  while (value.startsWith("0")) {
    value = value.slice(1);
  }

  if (
    value.length === 12 &&
    value.startsWith("91") &&
    /^[6-9]\d{9}$/.test(value.slice(2))
  ) {
    return value;
  }

  if (value.length === 10 && /^[6-9]\d{9}$/.test(value)) {
    return `91${value}`;
  }

  return value;
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

async function resolveIdByName(Model, companyId, value) {
  if (value === undefined || value === null || value === "") return null;

  const numericId = Number(value);
  if (Number.isInteger(numericId) && numericId > 0) return numericId;

  const name = String(value).trim();
  if (!name) return null;

  const row = await Model.findOne({
    where: {
      company_id: companyId,
      name: { [Op.like]: name },
    },
    attributes: ["id"],
  });

  return row?.id ?? null;
}

function mapWebhookBodyToLead(body) {
  return {
    name: firstValue(
      body.name,
      body.full_name,
      body.fullName,
      body.lead_name,
      body.client_name,
      "Webhook Lead",
    ),
    email: firstValue(body.email, body.mail),
    contact_no: firstValue(
      body.contact_no,
      body.contactNo,
      body.phone,
      body.mobile,
      body.contact,
      body.client_mobile,
    ),
    contact_no1: firstValue(
      body.contact_no1,
      body.contactNo1,
      body.alternate_contact_no,
      body.alternate_phone,
      body.alt_phone,
    ),
    whatsapp_chat: firstValue(body.whatsapp_chat, body.whatsapp),
    call_status: firstValue(body.call_status, body.call),
    address: firstValue(body.address, body.location),
    state: firstValue(body.state),
    city: firstValue(body.city),
    pincode: firstValue(body.pincode, body.zip, body.postal_code),
    country: firstValue(body.country, "India"),
    case_type: firstValue(body.case_type, body.caseType, body.service),
    source: firstValue(body.source_id, body.source, body.lead_source),
    status: firstValue(body.status_id, body.status, body.lead_status),
    agent: firstValue(body.assign_to, body.agent_id, body.agent, body.assigned_to),
    description: firstValue(
      body.description,
      body.message,
      body.notes,
      body.remark,
      body.comments,
    ),
  };
}

exports.createLeadFromWebhook = async (req, res) => {
  try {
    const token = String(req.params.token || req.query.token || "").trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Webhook token is required in URL",
      });
    }

    const webhook = await Webhook.findOne({
      where: {
        token,
        is_active: true,
      },
    });

    if (!webhook) {
      return res.status(401).json({
        success: false,
        message: "Invalid webhook token",
      });
    }

    const companyId = webhook.company_id;
    const mapped = mapWebhookBodyToLead(req.body || {});
    const normalizedContactNo = normalizePhoneNumber(mapped.contact_no);
    const normalizedContactNo1 = normalizePhoneNumber(mapped.contact_no1);

    if (!normalizedContactNo) {
      return res.status(400).json({
        success: false,
        message: "contact_no is required",
      });
    }

    if (normalizedContactNo.length < 10 || normalizedContactNo.length > 15) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid contact_no",
      });
    }

    const existingLead = await Lead.findOne({
      where: {
        company_id: companyId,
        contact_no: normalizedContactNo,
      },
    });

    if (existingLead) {
      return res.status(200).json({
        success: true,
        duplicate: true,
        message: "Lead already exists",
        data: existingLead,
      });
    }

    const [sourceId, statusId, assignTo, changedByAdmin] = await Promise.all([
      resolveIdByName(LeadSource, companyId, mapped.source),
      resolveIdByName(LeadStatus, companyId, mapped.status),
      resolveIdByName(Agent, companyId, mapped.agent),
      Admin.findOne({
        where: {
          company_id: companyId,
          is_active: true,
        },
        attributes: ["id"],
        order: [["id", "ASC"]],
      }),
    ]);

    const lead = await Lead.create({
      company_id: companyId,
      name: String(mapped.name || "Webhook Lead").trim(),
      email: mapped.email ? String(mapped.email).trim() : null,
      contact_no: normalizedContactNo,
      contact_no1: normalizedContactNo1 || null,
      whatsapp_chat: mapped.whatsapp_chat || null,
      call_status: normalizeCallStatus(mapped.call_status) || null,
      address: mapped.address || null,
      state: mapped.state || null,
      city: mapped.city || null,
      pincode: mapped.pincode || null,
      country: mapped.country || "India",
      case_type: mapped.case_type || null,
      source_id: sourceId || null,
      status_id: statusId || null,
      assign_to: assignTo || null,
      description: mapped.description || null,
      is_active: true,
      changed_by: changedByAdmin?.id || null,
    });

    return res.status(201).json({
      success: true,
      duplicate: false,
      message: "Lead created from webhook",
      data: lead,
    });
  } catch (error) {
    console.error("createLeadFromWebhook error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Webhook failed",
    });
  }
};
