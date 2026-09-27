const XLSX = require("xlsx");
const csv = require("csvtojson");
const path = require("path");

// ✅ change these to your sequelize models
const { Lead, LeadStatus, LeadSource, Agent } = require("../models");

// ✅ allowed fields in your Lead table
// NOTE: Sequelize expects createdAt/updatedAt on JS side (even if DB has created_at/updated_at)
const ALLOWED_FIELDS = [
  "name",
  "email",
  "contact_no",
  "contact_no1",
  "whatsapp_chat",
  "call_status",
  "address",
  "city",
  "state",
  "country",
  "pincode",
  "case_type",
  "source_id",
  "status_id",
  "assign_to",
  "description",
  "is_active",

  // ✅ timestamps (JS side)
  "createdAt",
  "updatedAt",

  // ✅ accept DB-style too (in case sheet uses these headers)
  "created_at",
  "updated_at",
];

// ✅ FIX: normalize phone so sequelize validation doesn't fail
function normalizePhone(v) {
  if (v === null || v === undefined) return "";

  let s = String(v).trim();
  if (!s) return "";

  // ❌ Reject if contains letters
  if (/[a-zA-Z]/.test(s)) return "";

  // remove trailing .0 from Excel (9876543210.0)
  s = s.replace(/\.0$/, "");

  // handle scientific notation (9.87654E+09)
  if (/e\+?/i.test(s)) {
    const n = Number(s);
    if (!Number.isNaN(n)) s = String(Math.trunc(n));
  }

  // ✅ Must contain at least one digit
  if (!/\d/.test(s)) return "";

  return s; // return exactly as entered
}

function normalizeKey(k) {
  return String(k || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function normalizeValue(v) {
  return String(v ?? "").trim();
}

// ✅ FIXED: safeNum should NOT convert ""/"   " into 0
function safeNum(v) {
  if (v === null || v === undefined) return null;

  if (typeof v === "string") {
    const t = v.trim();
    if (!t) return null; // "" or "   " => null
    v = t;
  }

  const n = Number(v);

  // reject NaN, 0, negative
  if (!Number.isFinite(n) || n <= 0) return null;

  return Math.trunc(n);
}

// ✅ parse date coming from CSV/Excel (string / excel serial / numeric string)
// ✅ IMPORTANT: treat "dd/mm/yyyy" first (India) to avoid US flip
function parseImportedDate(v) {
  if (v === null || v === undefined || v === "") return null;

  // Excel serial date (number)
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    return new Date(d.y, d.m - 1, d.d, d.H || 0, d.M || 0, d.S || 0);
  }

  let s = String(v).trim();
  if (!s) return null;

  // numeric string -> excel serial
  if (/^\d+(\.\d+)?$/.test(s)) {
    const num = Number(s);
    const d = XLSX.SSF.parse_date_code(num);
    if (d) return new Date(d.y, d.m - 1, d.d, d.H || 0, d.M || 0, d.S || 0);
  }

  // ✅ FIRST: dd/mm/yyyy OR dd-mm-yyyy (India) with optional time
  const m = s.match(
    /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/
  );
  if (m) {
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    let yy = Number(m[3]);
    if (yy < 100) yy += 2000;

    const hh = Number(m[4] || 0);
    const mi = Number(m[5] || 0);
    const ss = Number(m[6] || 0);

    const out = new Date(yy, mm - 1, dd, hh, mi, ss);
    if (!Number.isNaN(out.getTime())) return out;
  }

  // ✅ ISO only (safe). DO NOT do `new Date("1/2/1900")`
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const dt = new Date(s);
    if (!Number.isNaN(dt.getTime())) return dt;
  }

  return null;
}

async function parseFile(file) {
  const name = (file.originalname || "").toLowerCase();

  if (name.endsWith(".csv")) {
    return await csv().fromString(file.buffer.toString("utf-8"));
  }

  const wb = XLSX.read(file.buffer, { type: "buffer" });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];

  // ✅ FIX: read formatted date strings (dd/mm/yyyy) instead of Excel serial numbers
  return XLSX.utils.sheet_to_json(sheet, {
    defval: "",
    raw: false,
    dateNF: "dd/mm/yyyy",
  });
}

/**
 * Build lookup maps so we can convert:
 * status "New" -> status_id
 * source "Facebook" -> source_id
 * agent "Rahul" / "rahul@gmail.com" -> assign_to
 */
async function buildLookups() {
  const [statuses, sources, agents] = await Promise.all([
    LeadStatus ? LeadStatus.findAll({ attributes: ["id", "name"] }) : [],
    LeadSource ? LeadSource.findAll({ attributes: ["id", "name"] }) : [],
    Agent ? Agent.findAll({ attributes: ["id", "name", "email"] }) : [],
  ]);

  const statusByName = new Map();
  const sourceByName = new Map();
  const agentByName = new Map();
  const agentByEmail = new Map();
  const agentIds = new Set(); // ✅ for FK validation

  for (const s of statuses || []) {
    statusByName.set(String(s.name || "").trim().toLowerCase(), s.id);
  }
  for (const s of sources || []) {
    sourceByName.set(String(s.name || "").trim().toLowerCase(), s.id);
  }
  for (const a of agents || []) {
    const id = Number(a.id);
    if (Number.isFinite(id) && id > 0) agentIds.add(id);

    const nameKey = String(a.name || "").trim().toLowerCase();
    const emailKey = String(a.email || "").trim().toLowerCase();
    if (nameKey) agentByName.set(nameKey, a.id);
    if (emailKey) agentByEmail.set(emailKey, a.id);
  }

  return { statusByName, sourceByName, agentByName, agentByEmail, agentIds };
}

exports.downloadLeadDummySheet = (req, res) => {
  try {
    const filePath = path.join(__dirname, "..", "dummy_sheet", "dummy_sheet.csv");

    return res.download(filePath, "lead_import_template.csv", (err) => {
      if (err) {
        console.error("Download error:", err);
        if (!res.headersSent) {
          res.status(500).json({ message: "Failed to download dummy sheet" });
        }
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

function isValidDate(d) {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

function cleanRow(row, lookups) {
  const out = {};
  const raw = row || {};

  // first pass: normalize keys
  const kv = {};
  for (const key of Object.keys(raw)) {
    const nk = normalizeKey(key);
    if (!nk) continue;
    kv[nk] = raw[key];
  }

  // ✅ alias map (caller_name used to resolve assign_to)
  const alias = {
    // contact variations
    contact: "contact_no",
    mobile: "contact_no",
    phone: "contact_no",
    contactno: "contact_no",
    contact_no: "contact_no",

    // name variations
    leadname: "name",
    lead_name: "name",
    name: "name",

    // description variations
    remark: "description",
    notes: "description",
    description: "description",
    whatsapp: "whatsapp_chat",
    whatsapp_chat: "whatsapp_chat",
    call: "call_status",
    call_status: "call_status",

    // case type variations
    casetype: "case_type",
    case_type: "case_type",

    // resolver fields (not db fields)
    status: "status",
    source: "source",

    // ✅ caller_name treated as "agent" input for resolver
    caller_name: "assign_to",

    // ids
    agent_id: "assign_to",
    assign_to: "assign_to",
    status_id: "status_id",
    source_id: "source_id",

    // ✅ date headers -> Sequelize timestamp keys
    date: "createdAt",
    created_at: "createdAt",
    createdat: "createdAt",
    created_on: "createdAt",
    createdon: "createdAt",
    created_time: "createdAt",

    updated_at: "updatedAt",
    updatedat: "updatedAt",
    updated_on: "updatedAt",
    updatedon: "updatedAt",
  };

  // 1) Copy direct db fields
  for (const nk of Object.keys(kv)) {
    const finalKey = alias[nk] || nk;

    // only allow real DB fields
    if (!ALLOWED_FIELDS.includes(finalKey)) continue;

    let v = kv[nk];
    if (typeof v === "string") v = v.trim();

    // normalize phone
    if (finalKey === "contact_no") v = normalizePhone(v);

    // ✅ parse timestamp from file (India D/M/Y)
    if (finalKey === "createdAt" || finalKey === "updatedAt") {
      const parsed = parseImportedDate(v);
      v = isValidDate(parsed) ? parsed : null;
    }

    if (["source_id", "status_id", "assign_to"].includes(finalKey)) {
      v = safeNum(v);
    }

    if (finalKey === "is_active") {
      if (v === "" || v == null) v = true;
      if (typeof v === "string") {
        const s = v.toLowerCase();
        v = s === "true" || s === "1" || s === "yes";
      }
      v = Boolean(v);
    }

    out[finalKey] = v;
  }

  // 2) Resolve STATUS by name (optional)
  if ((out.status_id == null || out.status_id === "") && kv.status != null) {
    const sName = normalizeValue(kv.status).toLowerCase();
    const id = lookups?.statusByName?.get(sName);
    if (id) out.status_id = id;
  }

  // 3) Resolve SOURCE by name (optional)
  if ((out.source_id == null || out.source_id === "") && kv.source != null) {
    const sName = normalizeValue(kv.source).toLowerCase();
    const id = lookups?.sourceByName?.get(sName);
    if (id) out.source_id = id;
  }

  // ✅ 4) Resolve assign_to from caller_name/agent (supports id OR email OR name)
  if ((out.assign_to == null || out.assign_to === "") && (kv.agent != null || kv.agent_email != null)) {
    const rawAgent = normalizeValue(kv.agent);
    const aEmail = normalizeValue(kv.agent_email).toLowerCase();

    // numeric -> treat as agent id
    if (rawAgent && /^\d+$/.test(rawAgent)) {
      out.assign_to = safeNum(rawAgent);
    } else {
      let id = null;

      // email first
      if (aEmail) id = lookups?.agentByEmail?.get(aEmail) || null;

      // then name
      if (!id && rawAgent) {
        const aName = rawAgent.toLowerCase();
        id = lookups?.agentByName?.get(aName) || null;
      }

      if (id) out.assign_to = safeNum(id);
    }
  }

  // ✅ FK safety: if assign_to is invalid/not found, set NULL
  if (out.assign_to != null) {
    const id = safeNum(out.assign_to);
    if (!id || !lookups?.agentIds?.has(id)) out.assign_to = null;
    else out.assign_to = id;
  }

  // ✅ minimal validation: skip totally empty rows
  if (!out.name && !out.contact_no && !out.email) return null;

  // ✅ IMPORTANT: reject rows with invalid contact_no so bulkCreate won't fail
  if (!out.contact_no) return null;

  // defaults
  if (out.is_active == null) out.is_active = true;

  // ✅ If file does NOT provide createdAt (null/empty/invalid), fill current date
  if (!isValidDate(out.createdAt)) {
    const now = new Date();
    out.createdAt = now;
    out.updatedAt = now;
  }

  // If createdAt exists but updatedAt missing/invalid, keep updatedAt same
  if (isValidDate(out.createdAt) && !isValidDate(out.updatedAt)) out.updatedAt = out.createdAt;

  return out;
}

exports.importLeadsFile = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "File missing" });

    const selectedSourceId = safeNum(req.body.source_id);
    const selectedStatusId = safeNum(req.body.status_id);
    const selectedAssignTo = safeNum(req.body.assign_to); // ✅ will be null if "" or " "

    const lookups = await buildLookups();
    const raw = await parseFile(req.file);

    const rejectedRows = [];
    const cleaned = [];

    raw.forEach((r, idx) => {
      const out = cleanRow(r, lookups);
      if (!out) rejectedRows.push({ rowIndex: idx + 1, row: r });
      else cleaned.push(out);
    });

    if (!cleaned.length) {
      return res.status(400).json({
        message: "No valid rows found (all rows rejected due to invalid data)",
        rejected: rejectedRows.slice(0, 20),
      });
    }

    // ✅ Apply selected dropdown values to all rows (only if provided + valid)
    for (const row of cleaned) {
      if (selectedSourceId != null) row.source_id = selectedSourceId;
      if (selectedStatusId != null) row.status_id = selectedStatusId;

      // ✅ only set assign_to if dropdown id exists in agents
      if (selectedAssignTo != null && lookups.agentIds.has(selectedAssignTo)) {
        row.assign_to = selectedAssignTo;
      }
    }

    // ✅ bulk insert
    const inserted = await Lead.bulkCreate(cleaned, {
      validate: false,
    });

    return res.json({
      success: true,
      inserted: inserted.length,
      rejectedCount: rejectedRows.length,
      rejectedPreview: rejectedRows.slice(0, 20),
      preview: cleaned.slice(0, 10),
      note:
        "assign_to is now FK-safe. If agent not selected/not found, assign_to becomes NULL. caller_name supports agent ID/name/email.",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: err.message || "Import failed",
    });
  }
};

exports.downloadLeadDummyCSV = async (req, res) => {
  try {
    const headers = [
      "name",
      "contact_no",
      "email",
      "address",
      "city",
      "state",
      "country",
      "pincode",
      "case_type",
      "description",
      "caller_name",
      "is_active",
    ];

    const rows = [
      {
        name: "Raj Kumar",
        contact_no: "9876543210",
        email: "raj@gmail.com",
        address: "Noida Sector 62",
        city: "Noida",
        state: "Uttar Pradesh",
        country: "India",
        pincode: "201301",
        case_type: "Pre Matrimonial",
        description: "Need verification",
        caller_name: "Rahul Sharma", // ✅ can be: 4 OR Rahul Sharma OR rahul@gmail.com
        is_active: "TRUE",
      },
    ];

    // build CSV
    const csvText =
      headers.join(",") +
      "\n" +
      rows
        .map((r) => headers.map((h) => `"${r[h] ?? ""}"`).join(","))
        .join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=lead_import_dummy.csv");

    return res.send(csvText);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to generate dummy file" });
  }
};

exports.downloadLeadDummyExcel = async (req, res) => {
  try {
    const data = [
      {
        name: "Raj Kumar",
        contact_no: "9876543210",
        email: "raj@gmail.com",
        address: "Noida Sector 62",
        city: "Noida",
        state: "Uttar Pradesh",
        country: "India",
        pincode: "201301",
        case_type: "Pre Matrimonial",
        description: "Need verification",
        caller_name: "", // ✅ empty allowed -> assign_to NULL
        is_active: "TRUE",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Leads");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Disposition", "attachment; filename=lead_import_dummy.xlsx");
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    return res.send(buffer);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to generate dummy file" });
  }
};
