const UserRole = require("../models/UserRole");

const ALLOWED_ROLES = ["admin", "agent"];

exports.createRole = async (req, res) => {
  try {
    const { role } = req.body;

    // role is optional because defaultValue exists
    if (role && !ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role. Allowed: ${ALLOWED_ROLES.join(", ")}`,
      });
    }

    // Prevent duplicate role rows if you want only one per role
    // (optional but recommended)
    if (role) {
      const exists = await UserRole.findOne({ where: { role } });
      if (exists) {
        return res.status(409).json({
          success: false,
          message: "Role already exists",
        });
      }
    }

    const created = await UserRole.create({
      role: role || "agent",
    });

    return res.status(201).json({
      success: true,
      message: "Role created",
      data: created,
    });
  } catch (err) {
    console.error("createRole error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getAllRoles = async (req, res) => {
  try {
    const roles = await UserRole.findAll({
      order: [["id", "DESC"]],
    });

    return res.status(200).json({ success: true, data: roles });
  } catch (err) {
    console.error("getAllRoles error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getRoleById = async (req, res) => {
  try {
    const { id } = req.params;

    const role = await UserRole.findByPk(id);
    if (!role) {
      return res.status(404).json({ success: false, message: "Role not found" });
    }

    return res.status(200).json({ success: true, data: role });
  } catch (err) {
    console.error("getRoleById error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!role) {
      return res.status(400).json({
        success: false,
        message: "role is required",
      });
    }

    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role. Allowed: ${ALLOWED_ROLES.join(", ")}`,
      });
    }

    const row = await UserRole.findByPk(id);
    if (!row) {
      return res.status(404).json({ success: false, message: "Role not found" });
    }

    // prevent duplicates
    const exists = await UserRole.findOne({ where: { role } });
    if (exists && String(exists.id) !== String(id)) {
      return res.status(409).json({
        success: false,
        message: "Role already exists",
      });
    }

    await row.update({ role });

    return res.status(200).json({
      success: true,
      message: "Role updated",
      data: row,
    });
  } catch (err) {
    console.error("updateRole error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.deleteRole = async (req, res) => {
  try {
    const { id } = req.params;

    const row = await UserRole.findByPk(id);
    if (!row) {
      return res.status(404).json({ success: false, message: "Role not found" });
    }

    await row.destroy();

    return res.status(200).json({
      success: true,
      message: "Role deleted",
    });
  } catch (err) {
    console.error("deleteRole error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
