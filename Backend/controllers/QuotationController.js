const { Op } = require("sequelize");
const Quotation = require("../models/Quotation");
const QuotationService = require("../models/QuotationService");

function toNullableDecimal(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toNullableInteger(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function toNullableDate(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function deriveQuotationStatus(firstPaymentDate, secondPaymentDate) {
  if (secondPaymentDate) return "converted";
  if (firstPaymentDate) return "partial";
  return "pending";
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function buildQuotationPayload(body = {}, options = {}) {
  const { requireCoreFields = true } = options;
  const clientName = String(body.client_name || "").trim();
  const clientMobile = String(body.client_mobile || "").trim();
  const serviceType = toNullableInteger(body.service_type);
  const firstPaymentDate = toNullableDate(body.first_payment_date);
  const secondPaymentDate = toNullableDate(body.second_payment_date);

  if (requireCoreFields && !clientName) {
    return { error: "Client name is required" };
  }
  if (requireCoreFields && !clientMobile) {
    return { error: "Client mobile is required" };
  }
  if (requireCoreFields && !serviceType) {
    return { error: "Service is required" };
  }

  return {
    client_name: clientName,
    client_mobile: clientMobile,
    service_type: serviceType,
    base_amount: toNullableDecimal(body.base_amount),
    amount: toNullableDecimal(body.amount ?? body.base_amount),
    gst_rate: toNullableInteger(body.gst_rate),
    gst_amount: toNullableDecimal(body.gst_amount),
    total_amount: toNullableDecimal(body.total_amount),
    advance_amount: toNullableDecimal(body.advance_amount),
    remaining_amount: toNullableDecimal(body.remaining_amount),
    duration: String(body.duration || "").trim() || null,
    service_desc: String(body.service_desc || "").trim() || null,
    status: deriveQuotationStatus(firstPaymentDate, secondPaymentDate),
    first_payment_date: firstPaymentDate,
    second_payment_date: secondPaymentDate,
  };
}

exports.createQuotation = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const payload = buildQuotationPayload(req.body);
    if (payload.error) {
      return res.status(400).json({ success: false, message: payload.error });
    }

    const serviceRow = await QuotationService.findOne({
      where: {
        id: payload.service_type,
        company_id: companyId,
      },
    });
    if (!serviceRow) {
      return res.status(400).json({ success: false, message: "Invalid quotation service" });
    }

    const row = await Quotation.create({
      ...payload,
      company_id: companyId,
    });
    const fullRow = await Quotation.findOne({
      where: {
        id: row.id,
        company_id: companyId,
      },
      include: [
        {
          model: QuotationService,
          as: "service",
          attributes: ["id", "name"],
          required: false,
        },
      ],
    });

    return res.status(201).json({
      success: true,
      message: "Quotation created successfully",
      data: fullRow,
    });
  } catch (err) {
    console.error("createQuotation error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Server error",
    });
  }
};

exports.getAllQuotations = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const q = String(req.query.q || req.query.search || "").trim();
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || "10", 10)));
    const offset = (page - 1) * limit;
    const status = String(req.query.status || "").trim();
    const serviceType = String(req.query.service_type || "").trim();
    const startDate = String(req.query.start_date || "").trim();
    const endDate = String(req.query.end_date || "").trim();

    const where = {
      company_id: companyId,
    };

    if (q) {
      where[Op.or] = [
        { client_name: { [Op.like]: `%${q}%` } },
        { client_mobile: { [Op.like]: `%${q}%` } },
        { id: Number.isNaN(Number(q)) ? 0 : Number(q) },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (serviceType) {
      where.service_type = serviceType;
    }

    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) {
        where.created_at[Op.gte] = new Date(`${startDate}T00:00:00`);
      }
      if (endDate) {
        where.created_at[Op.lte] = new Date(`${endDate}T23:59:59`);
      }
    }

    const { rows, count } = await Quotation.findAndCountAll({
      where,
      include: [
        {
          model: QuotationService,
          as: "service",
          attributes: ["id", "name"],
          required: false,
        },
      ],
      order: [["created_at", "DESC"]],
      limit,
      offset,
    });

    return res.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page,
        limit,
        pages: Math.ceil(count / limit),
      },
    });
  } catch (err) {
    console.error("getAllQuotations error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Server error",
    });
  }
};

exports.getQuotationById = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const row = await Quotation.findOne({
      where: {
        id: req.params.id,
        company_id: companyId,
      },
      include: [
        {
          model: QuotationService,
          as: "service",
          attributes: ["id", "name"],
          required: false,
        },
      ],
    });

    if (!row) {
      return res.status(404).json({
        success: false,
        message: "Quotation not found",
      });
    }

    return res.json({
      success: true,
      data: row,
    });
  } catch (err) {
    console.error("getQuotationById error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Server error",
    });
  }
};

exports.updateQuotation = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const row = await Quotation.findOne({
      where: {
        id: req.params.id,
        company_id: companyId,
      },
    });

    if (!row) {
      return res.status(404).json({
        success: false,
        message: "Quotation not found",
      });
    }

    const current = row.get({ plain: true });
    const payload = {};

    if (hasOwn(req.body, "client_name")) {
      const clientName = String(req.body.client_name || "").trim();
      if (!clientName) {
        return res.status(400).json({ success: false, message: "Client name is required" });
      }
      payload.client_name = clientName;
    }

    if (hasOwn(req.body, "client_mobile")) {
      const clientMobile = String(req.body.client_mobile || "").trim();
      if (!clientMobile) {
        return res.status(400).json({ success: false, message: "Client mobile is required" });
      }
      payload.client_mobile = clientMobile;
    }

    if (hasOwn(req.body, "service_type")) {
      const serviceType = toNullableInteger(req.body.service_type);
      if (!serviceType) {
        return res.status(400).json({ success: false, message: "Service is required" });
      }

      const serviceRow = await QuotationService.findOne({
        where: {
          id: serviceType,
          company_id: companyId,
        },
      });
      if (!serviceRow) {
        return res.status(400).json({ success: false, message: "Invalid quotation service" });
      }

      payload.service_type = serviceType;
    }

    if (hasOwn(req.body, "base_amount")) payload.base_amount = toNullableDecimal(req.body.base_amount);
    if (hasOwn(req.body, "amount")) payload.amount = toNullableDecimal(req.body.amount);
    if (hasOwn(req.body, "gst_rate")) payload.gst_rate = toNullableInteger(req.body.gst_rate);
    if (hasOwn(req.body, "gst_amount")) payload.gst_amount = toNullableDecimal(req.body.gst_amount);
    if (hasOwn(req.body, "total_amount")) payload.total_amount = toNullableDecimal(req.body.total_amount);
    if (hasOwn(req.body, "advance_amount")) payload.advance_amount = toNullableDecimal(req.body.advance_amount);
    if (hasOwn(req.body, "remaining_amount")) payload.remaining_amount = toNullableDecimal(req.body.remaining_amount);
    if (hasOwn(req.body, "duration")) payload.duration = String(req.body.duration || "").trim() || null;
    if (hasOwn(req.body, "service_desc")) payload.service_desc = String(req.body.service_desc || "").trim() || null;
    if (hasOwn(req.body, "first_payment_date")) payload.first_payment_date = toNullableDate(req.body.first_payment_date);
    if (hasOwn(req.body, "second_payment_date")) payload.second_payment_date = toNullableDate(req.body.second_payment_date);

    const nextFirstPaymentDate = hasOwn(payload, "first_payment_date")
      ? payload.first_payment_date
      : current.first_payment_date;
    const nextSecondPaymentDate = hasOwn(payload, "second_payment_date")
      ? payload.second_payment_date
      : current.second_payment_date;

    payload.status = deriveQuotationStatus(nextFirstPaymentDate, nextSecondPaymentDate);

    await row.update(payload, { fields: Object.keys(payload) });

    const fullRow = await Quotation.findOne({
      where: {
        id: row.id,
        company_id: companyId,
      },
      include: [
        {
          model: QuotationService,
          as: "service",
          attributes: ["id", "name"],
          required: false,
        },
      ],
    });

    return res.json({
      success: true,
      message: "Quotation updated successfully",
      data: fullRow,
    });
  } catch (err) {
    console.error("updateQuotation error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Server error",
    });
  }
};
