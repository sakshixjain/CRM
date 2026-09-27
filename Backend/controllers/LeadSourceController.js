const { Op } = require("sequelize");
const LeadSource = require("../models/LeadSource");

// ✅ CREATE
exports.createLeadSource = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
  
    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { name, description, is_active } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: "name is required" });
    }

    // unique check inside same company
    const exists = await LeadSource.findOne({
      where: {
        name: String(name).trim(),
        company_id: companyId,
      },
    });

    if (exists) {
      return res
        .status(409)
        .json({ success: false, message: "Lead source already exists" });
    }

    const row = await LeadSource.create({
      company_id: companyId,
      name: String(name).trim(),
      description: description ?? null,
      is_active: typeof is_active === "boolean" ? is_active : true,
    });

    return res.status(201).json({ success: true, message: "Created", data: row });
  } catch (err) {
    console.error("createLeadSource error:", err);
    return res.status(500).json({ success: false, message: err.message || "Server error" });
  }
};

// ✅ READ ALL (search + pagination)
exports.getAllLeadSources = async (req, res) => {
  try {
    const companyId = req.user?.company_id;

    console.log("source ka data", companyId);
    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
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

    const { rows, count } = await LeadSource.findAndCountAll({
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
    console.error("getAllLeadSources error:", err);
    return res.status(500).json({ success: false, message: err.message || "Server error" });
  }
};

// ✅ READ ONE
exports.getLeadSourceById = async (req, res) => {
  try {
    const companyId = req.user?.company_id;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { id } = req.params;

    const row = await LeadSource.findOne({
      where: {
        id,
        company_id: companyId,
      },
    });

    if (!row) return res.status(404).json({ success: false, message: "Lead source not found" });

    return res.json({ success: true, data: row });
  } catch (err) {
    console.error("getLeadSourceById error:", err);
    return res.status(500).json({ success: false, message: err.message || "Server error" });
  }
};

// ✅ UPDATE
exports.updateLeadSource = async (req, res) => {
  try {
    const companyId = req.user?.company_id;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { id } = req.params;
    const { name, description, is_active } = req.body;

    const row = await LeadSource.findOne({
      where: {
        id,
        company_id: companyId,
      },
    });

    if (!row) return res.status(404).json({ success: false, message: "Lead source not found" });

    // name duplicate check if changing
    if (name !== undefined) {
      const newName = String(name || "").trim();
      if (!newName) {
        return res.status(400).json({ success: false, message: "name is required" });
      }

      const exists = await LeadSource.findOne({
        where: {
          name: newName,
          company_id: companyId,
          id: { [Op.ne]: id },
        },
      });

      if (exists) {
        return res.status(409).json({ success: false, message: "Lead source name already exists" });
      }

      row.name = newName;
    }

    if (description !== undefined) row.description = description ?? null;
    if (typeof is_active === "boolean") row.is_active = is_active;

    await row.save();

    return res.json({ success: true, message: "Updated", data: row });
  } catch (err) {
    console.error("updateLeadSource error:", err);
    return res.status(500).json({ success: false, message: err.message || "Server error" });
  }
};

// ✅ DELETE (hard delete)
exports.deleteLeadSource = async (req, res) => {
  try {
    const companyId = req.user?.company_id;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { id } = req.params;

    const row = await LeadSource.findOne({
      where: {
        id,
        company_id: companyId,
      },
    });

    if (!row) return res.status(404).json({ success: false, message: "Lead source not found" });

    await row.destroy();

    return res.json({ success: true, message: "Deleted" });
  } catch (err) {
    console.error("deleteLeadSource error:", err);
    return res.status(500).json({ success: false, message: err.message || "Server error" });
  }
};

// ✅ OPTIONAL: SOFT DELETE (disable instead of delete)
exports.disableLeadSource = async (req, res) => {
  try {
    const companyId = req.user?.company_id;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const { id } = req.params;

    const row = await LeadSource.findOne({
      where: {
        id,
        company_id: companyId,
      },
    });

    if (!row) return res.status(404).json({ success: false, message: "Lead source not found" });

    row.is_active = false;
    await row.save();

    return res.json({ success: true, message: "Disabled", data: row });
  } catch (err) {
    console.error("disableLeadSource error:", err);
    return res.status(500).json({ success: false, message: err.message || "Server error" });
  }
};