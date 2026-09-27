const { Op } = require("sequelize");
const LeadStatus = require("../models/LeadStatus");

// ✅ CREATE
exports.createLeadStatus = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
      console.log("status ka data", companyId);
    if (!companyId) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized" });
    }

    const { name, color, is_active } = req.body;

    if (!name || !String(name).trim()) {
      return res
        .status(400)
        .json({ success: false, message: "name is required" });
    }

    // unique check
    const exists = await LeadStatus.findOne({
      where: {
        name: String(name).trim(),
        company_id: companyId,
      },
    });

    console.log("akfnjak",exists)

    if (exists) {
      return res
        .status(409)
        .json({ success: false, message: "Lead status already exists" });
    }

    const row = await LeadStatus.create({
      company_id: companyId,
      name: String(name).trim(),
      color: color ?? null,
      is_active: typeof is_active === "boolean" ? is_active : true, // default false (as your model)
    });

    return res
      .status(201)
      .json({ success: true, message: "Created", data: row });
  } catch (err) {
    console.error("createLeadStatus error:", err);
    return res
      .status(500)
      .json({ success: false, message: err.message || "Server error" });
  }
};

// ✅ READ ALL (search + pagination)
exports.getAllLeadStatuses = async (req, res) => {
  try {
    const companyId = req.user?.company_id;

    if (!companyId) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized" });
    }

    const q = String(req.query.q || "").trim();
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit || "10", 10)),
    );
    const offset = (page - 1) * limit;

    const where = q
      ? {
          company_id: companyId,
          [Op.or]: [
            { name: { [Op.like]: `%${q}%` } },
            { color: { [Op.like]: `%${q}%` } },
          ],
        }
      : { company_id: companyId };

    const { rows, count } = await LeadStatus.findAndCountAll({
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
    console.error("getAllLeadStatuses error:", err);
    return res
      .status(500)
      .json({ success: false, message: err.message || "Server error" });
  }
};

// ✅ READ ONE
exports.getLeadStatusById = async (req, res) => {
  try {
    const companyId = req.user?.company_id;

    if (!companyId) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized" });
    }

    const { id } = req.params;

    const row = await LeadStatus.findOne({
      where: {
        id,
        company_id: companyId,
      },
    });

    if (!row)
      return res
        .status(404)
        .json({ success: false, message: "Lead status not found" });

    return res.json({ success: true, data: row });
  } catch (err) {
    console.error("getLeadStatusById error:", err);
    return res
      .status(500)
      .json({ success: false, message: err.message || "Server error" });
  }
};

// ✅ UPDATE
exports.updateLeadStatus = async (req, res) => {
  try {
    const companyId = req.user?.company_id;

    if (!companyId) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized" });
    }

    const { id } = req.params;
    const { name, color, is_active } = req.body;

    const row = await LeadStatus.findOne({
      where: {
        id,
        company_id: companyId,
      },
    });

    if (!row)
      return res
        .status(404)
        .json({ success: false, message: "Lead status not found" });

    // if name changing -> duplicate check
    if (name !== undefined) {
      const newName = String(name || "").trim();
      if (!newName) {
        return res
          .status(400)
          .json({ success: false, message: "name is required" });
      }

      const exists = await LeadStatus.findOne({
        where: {
          name: newName,
          company_id: companyId,
          id: { [Op.ne]: id },
        },
      });

      if (exists) {
        return res
          .status(409)
          .json({ success: false, message: "Lead status name already exists" });
      }

      row.name = newName;
    }

    if (color !== undefined) row.color = color ?? null;
    if (typeof is_active === "boolean") row.is_active = is_active;

    await row.save();

    return res.json({ success: true, message: "Updated", data: row });
  } catch (err) {
    console.error("updateLeadStatus error:", err);
    return res
      .status(500)
      .json({ success: false, message: err.message || "Server error" });
  }
};

// ✅ DELETE (hard delete)
exports.deleteLeadStatus = async (req, res) => {
  try {
    const companyId = req.user?.company_id;

    if (!companyId) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized" });
    }

    const { id } = req.params;

    const row = await LeadStatus.findOne({
      where: {
        id,
        company_id: companyId,
      },
    });

    if (!row)
      return res
        .status(404)
        .json({ success: false, message: "Lead status not found" });

    await row.destroy();

    return res.json({ success: true, message: "Deleted" });
  } catch (err) {
    console.error("deleteLeadStatus error:", err);
    return res
      .status(500)
      .json({ success: false, message: err.message || "Server error" });
  }
};

// ✅ OPTIONAL: SOFT DELETE (disable instead of delete)
exports.disableLeadStatus = async (req, res) => {
  try {
    const companyId = req.user?.company_id;

    if (!companyId) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized" });
    }

    const { id } = req.params;

    const row = await LeadStatus.findOne({
      where: {
        id,
        company_id: companyId,
      },
    });

    if (!row)
      return res
        .status(404)
        .json({ success: false, message: "Lead status not found" });

    row.is_active = false;
    await row.save();

    return res.json({ success: true, message: "Disabled", data: row });
  } catch (err) {
    console.error("disableLeadStatus error:", err);
    return res
      .status(500)
      .json({ success: false, message: err.message || "Server error" });
  }
};