const { Op } = require("sequelize");

const Lead = require("../models/Leads");
const Admin = require("../models/Admin");
const Agent = require("../models/UserAgent");
const LeadSource = require("../models/LeadSource");
const LeadStatus = require("../models/LeadStatus");
const Webhook = require("../models/Webhook");
const LeadHistory = require("../models/LeadHistory");

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

// Parse complex payloads (Meta Lead Ads, Google Ads, WhatsApp Cloud API, etc.)
function extractFieldsFromPayload(body = {}) {
  const extracted = {};

  // 1. Meta / Facebook Lead Ads Webhook field_data format:
  // field_data: [{ name: "full_name", values: ["..."] }, { name: "phone_number", values: ["..."] }, ...]
  if (Array.isArray(body.field_data)) {
    body.field_data.forEach((f) => {
      const key = String(f.name || "").toLowerCase();
      const val = Array.isArray(f.values) ? f.values[0] : f.value || "";
      if (key.includes("name")) extracted.name = val;
      if (key.includes("phone") || key.includes("contact") || key.includes("mobile")) extracted.contact_no = val;
      if (key.includes("email") || key.includes("mail")) extracted.email = val;
      if (key.includes("city")) extracted.city = val;
      if (key.includes("state")) extracted.state = val;
      if (key.includes("message") || key.includes("comment") || key.includes("note")) extracted.description = val;
      if (key.includes("service") || key.includes("case")) extracted.case_type = val;
    });
    extracted.source = "Meta Ads";
  }

  // 2. Meta WhatsApp Cloud API Webhook payload format
  if (body.entry?.[0]?.changes?.[0]?.value) {
    const val = body.entry[0].changes[0].value;
    if (val.contacts?.[0]) {
      extracted.name = val.contacts[0].profile?.name || "WhatsApp User";
      extracted.contact_no = val.contacts[0].wa_id;
    }
    if (val.messages?.[0]) {
      extracted.contact_no = extracted.contact_no || val.messages[0].from;
      extracted.description = val.messages[0].text?.body || "WhatsApp Message";
      extracted.whatsapp_chat = "yes";
    }
    extracted.source = "WhatsApp";
  }

  // 3. Google Ads Lead Form Webhook format:
  // user_column_data: [{ string_value: "...", column_id: "FULL_NAME" }, ...]
  if (Array.isArray(body.user_column_data)) {
    body.user_column_data.forEach((col) => {
      const cid = String(col.column_id || col.column_name || "").toUpperCase();
      const val = col.string_value || col.value || "";
      if (cid.includes("NAME")) extracted.name = val;
      if (cid.includes("PHONE")) extracted.contact_no = val;
      if (cid.includes("EMAIL")) extracted.email = val;
      if (cid.includes("CITY")) extracted.city = val;
      if (cid.includes("STATE")) extracted.state = val;
      if (cid.includes("POSTAL") || cid.includes("ZIP")) extracted.pincode = val;
    });
    extracted.source = "Google Ads";
  }

  return extracted;
}

function mapWebhookBodyToLead(body = {}, webhook = {}) {
  const extracted = extractFieldsFromPayload(body);

  // Combine flat body with extracted fields
  const name = firstValue(
    extracted.name,
    body.name,
    body.full_name,
    body.fullName,
    body.lead_name,
    body.client_name,
    body.first_name ? `${body.first_name} ${body.last_name || ""}`.trim() : "",
    "Webhook Lead",
  );

  const email = firstValue(extracted.email, body.email, body.mail);

  const contact_no = firstValue(
    extracted.contact_no,
    body.contact_no,
    body.contactNo,
    body.phone,
    body.mobile,
    body.contact,
    body.client_mobile,
    body.phoneNumber,
  );

  const contact_no1 = firstValue(
    body.contact_no1,
    body.contactNo1,
    body.alternate_contact_no,
    body.alternate_phone,
    body.alt_phone,
  );

  const whatsapp_chat = firstValue(
    extracted.whatsapp_chat,
    body.whatsapp_chat,
    body.whatsapp,
    body.is_whatsapp ? "yes" : "",
  );

  const call_status = firstValue(body.call_status, body.call);
  const address = firstValue(body.address, body.location);
  const state = firstValue(extracted.state, body.state, body.region);
  const city = firstValue(extracted.city, body.city, body.district, body.town);
  const pincode = firstValue(extracted.pincode, body.pincode, body.zip, body.postal_code);
  const country = firstValue(body.country, "India");
  const case_type = firstValue(extracted.case_type, body.case_type, body.caseType, body.service, body.requirement);

  // Source detection: payload > webhook platform > webhook name
  let rawSource = firstValue(
    extracted.source,
    body.source_id,
    body.source,
    body.lead_source,
    body.platform,
    body.utm_source,
    webhook.platform,
    webhook.name,
    "Webhook",
  );

  const status = firstValue(body.status_id, body.status, body.lead_status);
  const agent = firstValue(body.assign_to, body.agent_id, body.agent, body.assigned_to);

  const description = firstValue(
    extracted.description,
    body.description,
    body.message,
    body.notes,
    body.remark,
    body.comments,
    body.query,
  );

  return {
    name,
    email,
    contact_no,
    contact_no1,
    whatsapp_chat,
    call_status,
    address,
    state,
    city,
    pincode,
    country,
    case_type,
    source: rawSource,
    status,
    agent,
    description,
  };
}

// Auto-resolve or create LeadSource
async function getOrCreateLeadSource(companyId, sourceInput) {
  if (!sourceInput) return null;

  const num = Number(sourceInput);
  if (Number.isInteger(num) && num > 0) return num;

  let cleanName = String(sourceInput).trim();
  const lower = cleanName.toLowerCase();

  if (lower.includes("whatsapp") || lower.includes("wa")) cleanName = "WhatsApp";
  else if (lower.includes("google") || lower.includes("gads") || lower.includes("adwords")) cleanName = "Google Ads";
  else if (lower.includes("meta") || lower.includes("fb") || lower.includes("facebook") || lower.includes("insta")) cleanName = "Meta Ads";
  else if (lower.includes("website") || lower.includes("web") || lower.includes("portal")) cleanName = "Website Form";

  let source = await LeadSource.findOne({
    where: {
      company_id: companyId,
      name: { [Op.like]: cleanName },
    },
  });

  if (!source) {
    source = await LeadSource.create({
      company_id: companyId,
      name: cleanName,
      is_active: true,
    });
  }

  return source.id;
}

// Auto-resolve or get default LeadStatus
async function getOrCreateLeadStatus(companyId, statusInput) {
  if (statusInput) {
    const num = Number(statusInput);
    if (Number.isInteger(num) && num > 0) return num;

    const clean = String(statusInput).trim();
    const existing = await LeadStatus.findOne({
      where: {
        company_id: companyId,
        name: { [Op.like]: clean },
      },
    });
    if (existing) return existing.id;
  }

  // Fallback to first active status or "New"
  const defaultStatus = await LeadStatus.findOne({
    where: { company_id: companyId, is_active: true },
    order: [["id", "ASC"]],
  });

  return defaultStatus?.id || null;
}

// Intelligent Auto-Assignment Engine: City Matching + Round Robin
async function autoAssignLead(companyId, explicitAgentInput, leadCity) {
  // 1. If explicit agent specified in payload
  if (explicitAgentInput) {
    const num = Number(explicitAgentInput);
    if (Number.isInteger(num) && num > 0) {
      const ag = await Agent.findOne({ where: { id: num, company_id: companyId, is_active: true } });
      if (ag) return { agentId: ag.id, reason: "Explicit Assignment" };
    }

    const ag = await Agent.findOne({
      where: {
        company_id: companyId,
        is_active: true,
        name: { [Op.like]: String(explicitAgentInput).trim() },
      },
    });
    if (ag) return { agentId: ag.id, reason: "Explicit Agent Match" };
  }

  // Fetch all active agents for this company
  const activeAgents = await Agent.findAll({
    where: { company_id: companyId, is_active: true },
  });

  if (!activeAgents || activeAgents.length === 0) {
    return { agentId: null, reason: "No active agents available" };
  }

  // 2. City-based Auto-Assignment Match
  if (leadCity && String(leadCity).trim()) {
    const cleanCity = String(leadCity).trim().toLowerCase();

    // Check if any agent has matching city
    const cityMatchedAgents = activeAgents.filter((agent) => {
      if (!agent.city) return false;
      const agentCity = String(agent.city).trim().toLowerCase();
      return (
        agentCity === cleanCity ||
        cleanCity.includes(agentCity) ||
        agentCity.includes(cleanCity)
      );
    });

    if (cityMatchedAgents.length > 0) {
      // If multiple agents match city, pick the one with lowest assigned leads
      const agentIds = cityMatchedAgents.map((a) => a.id);
      const leadCounts = await Promise.all(
        agentIds.map((id) =>
          Lead.count({ where: { company_id: companyId, assign_to: id } })
        )
      );

      let minIdx = 0;
      for (let i = 1; i < leadCounts.length; i++) {
        if (leadCounts[i] < leadCounts[minIdx]) minIdx = i;
      }

      return {
        agentId: cityMatchedAgents[minIdx].id,
        reason: `City Matched (${leadCity})`,
      };
    }
  }

  // 3. Round-Robin Fallback among all active agents based on least workload
  const agentIds = activeAgents.map((a) => a.id);
  const leadCounts = await Promise.all(
    agentIds.map((id) =>
      Lead.count({ where: { company_id: companyId, assign_to: id } })
    )
  );

  let minIdx = 0;
  for (let i = 1; i < leadCounts.length; i++) {
    if (leadCounts[i] < leadCounts[minIdx]) minIdx = i;
  }

  return {
    agentId: activeAgents[minIdx].id,
    reason: "Auto Round-Robin Distribution",
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
        message: "Invalid or inactive webhook token",
      });
    }

    const companyId = webhook.company_id;
    const mapped = mapWebhookBodyToLead(req.body || {}, webhook);
    const normalizedContactNo = normalizePhoneNumber(mapped.contact_no);
    const normalizedContactNo1 = normalizePhoneNumber(mapped.contact_no1);

    if (!normalizedContactNo) {
      return res.status(400).json({
        success: false,
        message: "contact_no is required (could not parse phone number)",
      });
    }

    if (normalizedContactNo.length < 10 || normalizedContactNo.length > 15) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid 10-15 digit contact number",
      });
    }

    // Check duplicate lead
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
        message: "Lead already exists in CRM",
        data: existingLead,
      });
    }

    // Resolve Source, Status, and Auto-Assignment
    const [sourceId, statusId, assignment, changedByAdmin] = await Promise.all([
      getOrCreateLeadSource(companyId, mapped.source),
      getOrCreateLeadStatus(companyId, mapped.status),
      autoAssignLead(companyId, mapped.agent, mapped.city),
      Admin.findOne({
        where: { company_id: companyId, is_active: true },
        attributes: ["id"],
        order: [["id", "ASC"]],
      }),
    ]);

    const lead = await Lead.create({
      company_id: companyId,
      name: String(mapped.name || "Inbound Lead").trim(),
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
      assign_to: assignment.agentId || null,
      description: mapped.description
        ? JSON.stringify([
            {
              name: "System Webhook",
              description: mapped.description,
              createdAt: new Date().toISOString(),
            },
          ])
        : null,
      is_active: true,
      changed_by: changedByAdmin?.id || null,
    });

    // Record History Log
    try {
      await LeadHistory.create({
        company_id: companyId,
        lead_id: lead.id,
        status_id: statusId || null,
        changed_by: assignment.agentId || changedByAdmin?.id || 1,
        remark: `Lead auto-captured via ${mapped.source || "Webhook"}. Auto-assigned: ${assignment.reason}.`,
        followup_date: new Date(),
        reminder_at: new Date(),
        is_reminder_sent: false,
      });
    } catch (histErr) {
      console.warn("LeadHistory logging warning:", histErr.message);
    }

    return res.status(201).json({
      success: true,
      duplicate: false,
      message: `Lead auto-captured and assigned successfully (${assignment.reason})`,
      data: lead,
    });
  } catch (error) {
    console.error("createLeadFromWebhook error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Webhook lead ingestion failed",
    });
  }
};
