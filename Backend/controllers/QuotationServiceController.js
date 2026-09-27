const { Op } = require("sequelize");
const QuotationService = require("../models/QuotationService");

function normalizeDescription(value) {
  if (value === undefined || value === null) {
    return JSON.stringify([]);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return JSON.stringify([]);

    try {
      JSON.parse(trimmed);
      return trimmed;
    } catch (error) {
      return JSON.stringify([{ description: trimmed }]);
    }
  }

  try {
    return JSON.stringify(value);
  } catch (error) {
    return JSON.stringify([]);
  }
}

exports.createQuotationService = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { name, description } = req.body;

    const normalizedName = String(name || "").trim();
    if (!normalizedName) {
      return res.status(400).json({ success: false, message: "name is required" });
    }

    const exists = await QuotationService.findOne({
      where: {
        name: normalizedName,
        company_id: companyId,
      },
    });

    if (exists) {
      return res.status(409).json({
        success: false,
        message: "Quotation service already exists",
      });
    }

    const row = await QuotationService.create({
      company_id: companyId,
      name: normalizedName,
      description: normalizeDescription(description),
    });

    return res.status(201).json({
      success: true,
      message: "Created",
      data: row,
    });
  } catch (err) {
    console.error("createQuotationService error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Server error",
    });
  }
};

exports.getAllQuotationServices = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const q = String(req.query.q || "").trim();
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || "10", 10)));
    const offset = (page - 1) * limit;

    const where = q
      ? {
          company_id: companyId,
          [Op.or]: [
            { name: { [Op.like]: `%${q}%` } },
            { description: { [Op.like]: `%${q}%` } },
          ],
        }
      : { company_id: companyId };

    const { rows, count } = await QuotationService.findAndCountAll({
      where,
      limit,
      offset,
      order: [["id", "DESC"]],
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
    console.error("getAllQuotationServices error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Server error",
    });
  }
};

exports.getQuotationServiceById = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { id } = req.params;

    const row = await QuotationService.findOne({
      where: {
        id,
        company_id: companyId,
      },
    });
    if (!row) {
      return res.status(404).json({
        success: false,
        message: "Quotation service not found",
      });
    }

    return res.json({ success: true, data: row });
  } catch (err) {
    console.error("getQuotationServiceById error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Server error",
    });
  }
};

exports.updateQuotationService = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { id } = req.params;
    const { name, description } = req.body;

    const row = await QuotationService.findOne({
      where: {
        id,
        company_id: companyId,
      },
    });
    if (!row) {
      return res.status(404).json({
        success: false,
        message: "Quotation service not found",
      });
    }

    if (name !== undefined) {
      const normalizedName = String(name || "").trim();
      if (!normalizedName) {
        return res.status(400).json({ success: false, message: "name is required" });
      }

      const exists = await QuotationService.findOne({
        where: {
          name: normalizedName,
          company_id: companyId,
          id: { [Op.ne]: id },
        },
      });

      if (exists) {
        return res.status(409).json({
          success: false,
          message: "Quotation service name already exists",
        });
      }

      row.name = normalizedName;
    }

    if (description !== undefined) {
      row.description = normalizeDescription(description);
    }

    await row.save();

    return res.json({
      success: true,
      message: "Updated",
      data: row,
    });
  } catch (err) {
    console.error("updateQuotationService error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Server error",
    });
  }
};

exports.deleteQuotationService = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { id } = req.params;

    const row = await QuotationService.findOne({
      where: {
        id,
        company_id: companyId,
      },
    });
    if (!row) {
      return res.status(404).json({
        success: false,
        message: "Quotation service not found",
      });
    }

    await row.destroy();

    return res.json({
      success: true,
      message: "Deleted",
    });
  } catch (err) {
    console.error("deleteQuotationService error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Server error",
    });
  }
};
