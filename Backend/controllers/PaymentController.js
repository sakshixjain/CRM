const Payment = require("../models/Payment");
const XLSX = require("xlsx");
const csv = require("csvtojson");
const path = require("path");
const { Op } = require("sequelize");

function parseDurationDays(value) {
  const matches = String(value || "").match(/\d+/g);
  if (!matches || matches.length === 0) return null;

  const days = matches.map((item) => Number(item)).filter(Number.isFinite);
  if (days.length === 0) return null;

  return Math.max(...days);
}

function addDays(date, days) {
  const out = new Date(date);
  out.setDate(out.getDate() + days);
  return out;
}

function normalizePaymentContact(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length > 10 && digits.startsWith("91")) return digits.slice(2);
  return digits;
}

function getContactLookupValues(value) {
  const digits = String(value || "").replace(/\D/g, "");
  const normalized = normalizePaymentContact(value);
  const values = new Set();

  if (digits) values.add(digits);
  if (normalized) {
    values.add(normalized);
    if (normalized.length === 10) values.add(`91${normalized}`);
  }

  return [...values];
}

async function findDuplicatePayment(companyId, contactNo, excludeId = null) {
  const lookupValues = getContactLookupValues(contactNo);
  if (!lookupValues.length) return null;

  const where = {
    company_id: companyId,
    contact_no: { [Op.in]: lookupValues },
  };

  if (excludeId) {
    where.id = { [Op.ne]: excludeId };
  }

  return Payment.findOne({ where });
}

function isUniqueConstraintError(error) {
  return error?.name === "SequelizeUniqueConstraintError";
}

 // ➕ Create Payment
function normalizeYesNo(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["yes", "y", "true", "1"].includes(normalized)) return "Yes";
  return "No";
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj || {}, key);
}

exports.createPayment = async (req, res) => {
  try {
    const companyId = req.user?.company_id;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const {
      date,
      lead_name,
      caller_id,
      contact_no,
      case_location,
      case_type,
      duration,
      field_work,
      total_amount,
      received_amount,
      status,
    } = req.body;

    if (!lead_name || !contact_no || !case_location || !case_type || !total_amount) {
      return res.status(400).json({
        success: false,
        message: "Required fields are missing",
      }); 
    }

    const normalizedContactNo = normalizePaymentContact(contact_no);
    if (!normalizedContactNo) {
      return res.status(400).json({
        success: false,
        message: "Contact number is required",
      });
    }

    const duplicatePayment = await findDuplicatePayment(companyId, normalizedContactNo);
    if (duplicatePayment) {
      return res.status(409).json({
        success: false,
        message: "Payment entry with this contact number already exists",
      });
    }

    const payment = await Payment.create({
      company_id: companyId,
      date,
      lead_name,
      caller_id,
      contact_no: normalizedContactNo,
      case_location,
      case_type,
      duration: String(duration || "").trim() || null,
      field_work: normalizeYesNo(field_work),
      total_amount,
      received_amount: received_amount || 0,
      status,
    });

    return res.status(201).json({
      success: true,
      message: "Payment created successfully",
      data: payment,
    });
  } catch (error) {
    console.error("Create Payment Error:", error);
    if (isUniqueConstraintError(error)) {
      return res.status(409).json({
        success: false,
        message: "Payment entry with this contact number already exists",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to create payment",
    });
  }
};


// 📄 Get All Payments with Filters
exports.getAllPayments = async (req, res) => {
  try {
    const companyId = req.user?.company_id;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const {
      day_range,
      from_date,
      to_date,
      status,
      caller_id,
      min_amount,
      max_amount,
      search,
    } = req.query;

    const whereClause = {
      company_id: companyId,
    };

    const dayRange = Number(day_range || 0);
    let rangeFromDate = from_date;
    let rangeToDate = to_date;

    if (dayRange > 0) {
      const today = new Date();
      const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const start = new Date(
        end.getFullYear(),
        end.getMonth(),
        end.getDate() - (dayRange - 1)
      );

      if (!rangeFromDate) rangeFromDate = toISODateOnly(start);
      if (!rangeToDate) rangeToDate = toISODateOnly(end);
    }

    // ✅ Date filter
    if (rangeFromDate && rangeToDate) {
      whereClause.date = {
        [Op.between]: [rangeFromDate, rangeToDate],
      };
    } else if (rangeFromDate) {
      whereClause.date = {
        [Op.gte]: rangeFromDate,
      };
    } else if (rangeToDate) {
      whereClause.date = {
        [Op.lte]: rangeToDate,
      };
    }

    // ✅ Status filter
    if (status && status.trim() !== "") {
      whereClause.status = status;
    }

    if (caller_id && String(caller_id).trim() !== "") {
      whereClause.caller_id = caller_id;
    }

    // ✅ Amount filter
    if (min_amount && max_amount) {
      whereClause.total_amount = {
        [Op.between]: [Number(min_amount), Number(max_amount)],
      };
    } else if (min_amount) {
      whereClause.total_amount = {
        [Op.gte]: Number(min_amount),
      };
    } else if (max_amount) {
      whereClause.total_amount = {
        [Op.lte]: Number(max_amount),
      };
    }

    // ✅ Search filter (optional)
    if (search && search.trim() !== "") {
      whereClause[Op.or] = [
        { lead_name: { [Op.like]: `%${search}%` } },
        { caller_id: { [Op.like]: `%${search}%` } },
        { contact_no: { [Op.like]: `%${search}%` } },
        { case_type: { [Op.like]: `%${search}%` } },
        { duration: { [Op.like]: `%${search}%` } },
        { field_work: { [Op.like]: `%${search}%` } },
        { case_location: { [Op.like]: `%${search}%` } },
      ];
    }

    const payments = await Payment.findAll({
      where: whereClause,
      order: [["date", "DESC"]],
    });

    res.json({
      success: true,
      data: payments,
    });
  } catch (error) {
    console.error("Fetch Payments Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch payments",
    });
  }
};

 //🔍 Get Single Payment
exports.getDurationReminderAlerts = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    const isAdmin = req.user?.role_id === 1 || req.user?.type === "admin";
    const userEmail = String(req.user?.email || "").trim().toLowerCase();
    const canViewPaymentReminder =
      isAdmin || Number(req.user?.id) === 5 || userEmail === "sara@infoace.in";

    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!canViewPaymentReminder) {
      return res.json({
        success: true,
        data: [],
      });
    }

    const whereClause = {
      company_id: companyId,
      duration: {
        [Op.ne]: null,
      },
    };

    const payments = await Payment.findAll({
      where: whereClause,
      order: [["date", "ASC"]],
      limit: 200,
    });

    const now = new Date();
    const duePayments = payments
      .map((payment) => {
        const row = payment.get({ plain: true });
        const status = String(row.status || "").trim().toLowerCase();
        if (status === "done" || status === "closed") {
          return null;
        }

        const days = parseDurationDays(row.duration);
        const startDate = row.date ? new Date(row.date) : null;

        if (!days || !startDate || Number.isNaN(startDate.getTime())) {
          return null;
        }

        const dueAt = addDays(startDate, days);
        if (dueAt > now) return null;

        return {
          ...row,
          type: "payment_duration",
          duration_days: days,
          due_at: dueAt,
          reminder_at: dueAt,
        };
      })
      .filter(Boolean)
      .sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime());

    return res.json({
      success: true,
      data: duePayments,
    });
  } catch (error) {
    console.error("getDurationReminderAlerts Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch payment duration reminders",
    });
  }
};

exports.getPaymentById = async (req, res) => {
  try {
    const companyId = req.user?.company_id;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { id } = req.params;

    const payment = await Payment.findOne({
      where: {
        id,
        company_id: companyId,
      },
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    res.json({
      success: true,
      data: payment,
    });
  } catch (error) {
    console.error("Get Payment Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch payment",
    });
  }
};

 // ✏️ Update Payment
exports.updatePayment = async (req, res) => {
  try {
    const companyId = req.user?.company_id;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { id } = req.params;

    const payment = await Payment.findOne({
      where: {
        id,
        company_id: companyId,
      },
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    const bodyKeys = Object.keys(req.body || {});
    const isFieldWorkOnlyUpdate =
      bodyKeys.length > 0 &&
      bodyKeys.every((key) => key === "field_work");

    if (isFieldWorkOnlyUpdate) {
      await payment.update({
        field_work: normalizeYesNo(req.body.field_work),
      });

      return res.json({
        success: true,
        message: "Field work updated successfully",
        data: payment,
      });
    }

    const {
      date,
      lead_name,
      caller_id,
      contact_no,
      case_location,
      case_type,
      duration,
      field_work,
      total_amount,
      received_amount,
      status,
    } = req.body;

    const nextContactNo = hasOwn(req.body, "contact_no")
      ? contact_no
      : payment.contact_no;
    const normalizedContactNo = normalizePaymentContact(nextContactNo);
    if (!normalizedContactNo) {
      return res.status(400).json({
        success: false,
        message: "Contact number is required",
      });
    }

    const duplicatePayment = await findDuplicatePayment(
      companyId,
      normalizedContactNo,
      id,
    );
    if (duplicatePayment) {
      return res.status(409).json({
        success: false,
        message: "Payment entry with this contact number already exists",
      });
    }

    const payload = {};

    if (hasOwn(req.body, "date")) payload.date = date;
    if (hasOwn(req.body, "lead_name")) payload.lead_name = lead_name;
    if (hasOwn(req.body, "caller_id")) payload.caller_id = caller_id;
    if (hasOwn(req.body, "contact_no")) payload.contact_no = normalizedContactNo;
    if (hasOwn(req.body, "case_location")) payload.case_location = case_location;
    if (hasOwn(req.body, "case_type")) payload.case_type = case_type;
    if (hasOwn(req.body, "duration")) {
      payload.duration = String(duration || "").trim() || null;
    }
    if (hasOwn(req.body, "field_work")) payload.field_work = normalizeYesNo(field_work);
    if (hasOwn(req.body, "total_amount")) payload.total_amount = total_amount;
    if (hasOwn(req.body, "received_amount")) payload.received_amount = received_amount;
    if (hasOwn(req.body, "status")) payload.status = status;

    await payment.update(payload);

    res.json({
      success: true,
      message: "Payment updated successfully",
      data: payment,
    });
  } catch (error) {
    console.error("Update Payment Error:", error);
    if (isUniqueConstraintError(error)) {
      return res.status(409).json({
        success: false,
        message: "Payment entry with this contact number already exists",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to update payment",
    });
  }
};

 // âŒ Delete Payment
exports.deletePayment = async (req, res) => {
  try {
    const companyId = req.user?.company_id;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { id } = req.params;

    const payment = await Payment.findOne({
      where: {
        id,
        company_id: companyId,
      },
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    await payment.destroy();

    res.json({
      success: true,
      message: "Payment deleted successfully",
    });
  } catch (error) {
    console.error("Delete Payment Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete payment",
    });
  }
};

var ALLOWED_FIELDS = [
  "date",
  "lead_name",
  "caller_id",
  "contact_no",
  "case_location",
  "case_type",
  "duration",
  "field_work",
  "total_amount",
  "received_amount",
  "pending_amount",
  "status",
  "created_at",
  "updated_at",
];
 // ❌ Delete Payment
exports.deletePayment = async (req, res) => {
  try {
    const companyId = req.user?.company_id;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { id } = req.params;

    const payment = await Payment.findOne({
      where: {
        id,
        company_id: companyId,
      },
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    await payment.destroy();

    res.json({
      success: true,
      message: "Payment deleted successfully",
    });
  } catch (error) {
    console.error("Delete Payment Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete payment",
    });
  }
};

var ALLOWED_FIELDS = [
  "date",
  "lead_name",
  "caller_id",
  "contact_no",
  "case_location",
  "case_type",
  "duration",
  "field_work",
  "total_amount",
  "received_amount",
  "pending_amount",
  "status",
  "created_at",
  "updated_at",
];

// ✅ FIX: normalize phone so sequelize validation doesn't fail
function normalizePhone(v) {
  if (v === null || v === undefined) return "";

  let s = String(v).trim();
  if (!s) return "";

  // remove trailing .0 from excel like 9876543210.0
  s = s.replace(/\.0$/, "");

  // scientific notation from excel e.g. 9.87654E+09
  if (/e\+?/i.test(s)) {
    const n = Number(s);
    if (!Number.isNaN(n)) s = String(Math.trunc(n));
  }

  // keep digits only
  let digits = s.replace(/\D/g, "");

  // remove leading country code 91 if present
  if (digits.length > 10 && digits.startsWith("91")) digits = digits.slice(2);

  // final: India 10 digits
  if (digits.length !== 10) return "";

  return digits;
}

function normalizeKey(k) {
  return String(k || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function isValidDate(d) {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

// ✅ supports: empty/null => current date, excel serial => date, string => date (India D/M/Y)
function normalizeDate(v) {
  if (v === null || v === undefined) return new Date();

  // already a Date
  if (v instanceof Date) return isValidDate(v) ? v : new Date();

  // ✅ excel serial (number) - robust method
  if (typeof v === "number" && Number.isFinite(v)) {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return new Date();
    const out = new Date(d.y, d.m - 1, d.d, d.H || 0, d.M || 0, d.S || 0);
    return isValidDate(out) ? out : new Date();
  }

  const s = String(v).trim();
  if (!s) return new Date();

  // ✅ FIRST: try dd/mm/yyyy or dd-mm-yyyy (India)
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    let yy = Number(m[3]);
    if (yy < 100) yy += 2000;
    const d2 = new Date(yy, mm - 1, dd);
    return isValidDate(d2) ? d2 : new Date();
  }

  // ✅ ONLY allow ISO parsing (safe)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d1 = new Date(s);
    return isValidDate(d1) ? d1 : new Date();
  }

  // ❌ DO NOT use `new Date("1/2/1900")` because it becomes US-style
  return new Date();
}

function toISODateOnly(d) {
  const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function normalizeAmount(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;

  // remove commas, currency symbols, spaces
  const cleaned = s.replace(/[^0-9.\-]/g, "");
  const n = Number(cleaned);
  if (Number.isNaN(n)) return null;

  // if your DB expects INTEGER, use Math.round / trunc here
  return n;
}

//  FILE PARSE
async function parseFile(file) {
  const name = (file.originalname || "").toLowerCase();

  if (name.endsWith(".csv")) {
    return await csv().fromString(file.buffer.toString("utf-8"));
  }

  const wb = XLSX.read(file.buffer, { type: "buffer" });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];

  // ✅ FIX: return formatted strings (dd/mm/yyyy) instead of serial numbers
  // this prevents US/India confusion
  return XLSX.utils.sheet_to_json(sheet, {
    defval: "",
    raw: false,
    dateNF: "dd/mm/yyyy",
  });
}

exports.downloadPaymentDummySheet = (req, res) => {
  try {
    const filePath = path.join(__dirname, "..", "dummy_sheet", "payment_sheet.csv");

    return res.download(filePath, "payment_template.csv", (err) => {
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

function cleanRow(row) {
  const out = {};
  const raw = row || {};

  // first pass: normalize keys
  const kv = {};
  for (const key of Object.keys(raw)) {
    const nk = normalizeKey(key);
    if (!nk) continue;
    kv[nk] = raw[key];
  }

  // ✅ aliases for your NEW allowed fields
  const alias = {
    // date variations
    date: "date",
    call_date: "date",
    lead_date: "date",

    // lead name variations (Employee name)
    lead_name: "lead_name",
    leadname: "lead_name",
    name: "lead_name",
    customer_name: "lead_name",
    employee_name: "lead_name",
    employee: "lead_name",

    // caller variations (Client Name)
    caller_id: "caller_id",
    caller: "caller_id",
    executive: "caller_id",
    agent: "caller_id",
    client_name: "caller_id",
    client: "caller_id",

    // phone variations
    contact_no: "contact_no",
    contact: "contact_no",
    mobile: "contact_no",
    phone: "contact_no",
    contactno: "contact_no",

    // case location variations
    case_location: "case_location",
    case_location_: "case_location",
    location: "case_location",
    city: "case_location",

    // case type variations
    case_type: "case_type",
    casetype: "case_type",
    service: "case_type",

    // duration variations
    duration: "duration",
    estimated_duration: "duration",
    estimate_duration: "duration",
    time_duration: "duration",
    days: "duration",

    // field work variations
    field_work: "field_work",
    fieldwork: "field_work",
    field: "field_work",
    field_visit: "field_work",
    fieldwork_required: "field_work",
    field_work_required: "field_work",

    // amounts
    total_amount: "total_amount",
    total: "total_amount",
    amount: "total_amount",

    received_amount: "received_amount",
    received: "received_amount",
    paid_amount: "received_amount",
    paid: "received_amount",

    pending_amount: "pending_amount",
    pending: "pending_amount",
    balance: "pending_amount",

    // status
    status: "status",
  };

  // 1) Copy allowed fields only + normalize values
  for (const nk of Object.keys(kv)) {
    const finalKey = alias[nk] || nk;
    if (!ALLOWED_FIELDS.includes(finalKey)) continue;

    let v = kv[nk];

    // trim strings
    if (typeof v === "string") v = v.trim();

    // normalize contact
    if (finalKey === "contact_no") v = normalizePhone(v);

    // normalize amounts
    if (
      finalKey === "total_amount" ||
      finalKey === "received_amount" ||
      finalKey === "pending_amount"
    ) {
      v = normalizeAmount(v);
    }

    // ✅ normalize date (read as India D/M/Y and store as YYYY-MM-DD)
    if (finalKey === "date") {
      const d = normalizeDate(v);
      v = toISODateOnly(d);
    }

    if (finalKey === "field_work") {
      v = normalizeYesNo(v);
    }

    out[finalKey] = v;
  }

  // 2) Defaults / computed fields
  // ✅ if date missing/null/invalid => fill current date
  if (!out.date) out.date = toISODateOnly(new Date());

  // ✅ status default
  if (!out.status) out.status = "Pending";

  if (!out.field_work) out.field_work = "No";

  // ✅ if pending_amount missing: compute from total - received (if possible)
  const total = out.total_amount != null ? Number(out.total_amount) : null;
  const received = out.received_amount != null ? Number(out.received_amount) : null;

  if ((out.pending_amount == null || out.pending_amount === "") && total != null) {
    out.pending_amount =
      received != null ? Math.max(0, total - received) : Math.max(0, total);
  }

  // 3) Minimal validation: reject totally empty rows
  if (!out.lead_name && !out.contact_no && !out.caller_id) return null;

  // ✅ reject invalid phone (so bulkCreate won't fail)
  if (!out.contact_no) return null;

  return out;
}

exports.importPaymentFile = async (req, res) => {
  try {
    const companyId = req.user?.company_id;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!req.file) return res.status(400).json({ message: "File missing" });

    const raw = await parseFile(req.file);

    const rejectedRows = [];
    const cleaned = [];

    raw.forEach((r, idx) => {
      const out = cleanRow(r);
      if (!out) rejectedRows.push({ rowIndex: idx + 1, row: r });
      else {
        out.contact_no = normalizePaymentContact(out.contact_no);
        cleaned.push({ ...out, company_id: companyId, _rowIndex: idx + 1 });
      }
    });

    if (!cleaned.length) {
      return res.status(400).json({
        success: false,
        message: "No valid rows found (all rows rejected due to invalid data)",
        rejected: rejectedRows.slice(0, 20),
      });
    }

    // ✅ bulk insert
    const seenContacts = new Set();
    const uniqueCleaned = [];

    for (const row of cleaned) {
      const contactKey = normalizePaymentContact(row.contact_no);
      if (seenContacts.has(contactKey)) {
        rejectedRows.push({
          rowIndex: row._rowIndex,
          row,
          reason: "Duplicate contact number in imported file",
        });
        continue;
      }

      seenContacts.add(contactKey);
      uniqueCleaned.push(row);
    }

    const lookupValues = [
      ...new Set(uniqueCleaned.flatMap((row) => getContactLookupValues(row.contact_no))),
    ];
    const existingPayments = lookupValues.length
      ? await Payment.findAll({
          where: {
            company_id: companyId,
            contact_no: { [Op.in]: lookupValues },
          },
          attributes: ["contact_no"],
        })
      : [];
    const existingContactKeys = new Set(
      existingPayments.map((payment) => normalizePaymentContact(payment.contact_no)),
    );
    const rowsToInsert = [];

    for (const row of uniqueCleaned) {
      const contactKey = normalizePaymentContact(row.contact_no);
      if (existingContactKeys.has(contactKey)) {
        rejectedRows.push({
          rowIndex: row._rowIndex,
          row,
          reason: "Payment entry with this contact number already exists",
        });
        continue;
      }

      const { _rowIndex, ...insertableRow } = row;
      rowsToInsert.push(insertableRow);
    }

    if (!rowsToInsert.length) {
      return res.status(400).json({
        success: false,
        message: "No rows inserted because all contact numbers already exist or are invalid",
        rejected: rejectedRows.slice(0, 20),
      });
    }

    const inserted = await Payment.bulkCreate(rowsToInsert, {
      validate: true,
    });

    return res.json({
      success: true,
      inserted: inserted.length,
      rejectedCount: rejectedRows.length,
      rejectedPreview: rejectedRows.slice(0, 20),
      preview: rowsToInsert.slice(0, 10),
      note:
        "Excel/India D/M/Y dates are parsed correctly. XLSX is read as formatted dd/mm/yyyy strings to avoid US locale flipping.",
    });
  } catch (err) {
    console.error(err);
    if (isUniqueConstraintError(err)) {
      return res.status(409).json({
        success: false,
        message: "Payment entry with this contact number already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: err.message || "Import failed",
    });
  }
};
