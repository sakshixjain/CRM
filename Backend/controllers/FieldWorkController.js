const { Op } = require("sequelize");

const FieldWork = require("../models/FieldWork");
const Lead = require("../models/Leads");

const normalizeYesNo = (value) => {
  if (
    value === true ||
    value === "true" ||
    value === "on" ||
    value === "1" ||
    value === 1 ||
    value === "yes"
  ) {
    return "yes";
  }

  return "no";
};

const leadInclude = {
  model: Lead,
  as: "lead",
  attributes: ["id", "name", "contact_no"],
  required: false,
};

const getAllFieldWorks = async (req, res) => {
  try {
    const {
      search = "",
      case_type = "",
      report_submit = "",
      recheck = "",
      proof = "",
    } = req.query;

    const where = {};

    if (case_type) {
      where.case_type = { [Op.like]: `%${case_type}%` };
    }

    if (report_submit) {
      where.report_submit = report_submit;
    }

    if (recheck) {
      where.recheck = recheck;
    }

    if (proof) {
      where.proof = proof;
    }

    if (search) {
      where[Op.or] = [
        { number: { [Op.like]: `%${search}%` } },
        { remarks: { [Op.like]: `%${search}%` } },
        { case_type: { [Op.like]: `%${search}%` } },
        { "$lead.name$": { [Op.like]: `%${search}%` } },
      ];
    }

    const fieldWorks = await FieldWork.findAll({
      where,
      include: [leadInclude],
      order: [["id", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      message: "Field works fetched successfully",
      data: fieldWorks,
    });
  } catch (error) {
    console.error("getAllFieldWorks error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch field works",
      error: error.message,
    });
  }
};

const getFieldWorkById = async (req, res) => {
  try {
    const fieldWork = await FieldWork.findByPk(req.params.id, {
      include: [leadInclude],
    });

    if (!fieldWork) {
      return res.status(404).json({
        success: false,
        message: "Field work not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Field work fetched successfully",
      data: fieldWork,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch field work",
      error: error.message,
    });
  }
};

const createFieldWork = async (req, res) => {
  try {
    const fieldWork = await FieldWork.create({
      lead_id: req.body.lead_id || null,
      days: req.body.days || null,
      number: req.body.number || null,
      remarks: req.body.remarks || null,
      report_submit: normalizeYesNo(req.body.report_submit),
      recheck: normalizeYesNo(req.body.recheck),
      proof: normalizeYesNo(req.body.proof),
      case_type: req.body.case_type || null,
      amount: req.body.amount || 0,
    });

    const createdFieldWork = await FieldWork.findByPk(fieldWork.id, {
      include: [leadInclude],
    });

    return res.status(201).json({
      success: true,
      message: "Field work created successfully",
      data: createdFieldWork,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create field work",
      error: error.message,
    });
  }
};

const updateFieldWork = async (req, res) => {
  try {
    const fieldWork = await FieldWork.findByPk(req.params.id);

    if (!fieldWork) {
      return res.status(404).json({
        success: false,
        message: "Field work not found",
      });
    }

    await fieldWork.update({
      lead_id: req.body.lead_id !== undefined ? req.body.lead_id || null : fieldWork.lead_id,
      days: req.body.days !== undefined ? req.body.days : fieldWork.days,
      number: req.body.number !== undefined ? req.body.number : fieldWork.number,
      remarks: req.body.remarks !== undefined ? req.body.remarks : fieldWork.remarks,
      report_submit:
        req.body.report_submit !== undefined
          ? normalizeYesNo(req.body.report_submit)
          : fieldWork.report_submit,
      recheck:
        req.body.recheck !== undefined
          ? normalizeYesNo(req.body.recheck)
          : fieldWork.recheck,
      proof:
        req.body.proof !== undefined
          ? normalizeYesNo(req.body.proof)
          : fieldWork.proof,
      case_type: req.body.case_type !== undefined ? req.body.case_type : fieldWork.case_type,
      amount: req.body.amount !== undefined ? req.body.amount || 0 : fieldWork.amount,
    });

    const updatedFieldWork = await FieldWork.findByPk(fieldWork.id, {
      include: [leadInclude],
    });

    return res.status(200).json({
      success: true,
      message: "Field work updated successfully",
      data: updatedFieldWork,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update field work",
      error: error.message,
    });
  }
};

const deleteFieldWork = async (req, res) => {
  try {
    const fieldWork = await FieldWork.findByPk(req.params.id);

    if (!fieldWork) {
      return res.status(404).json({
        success: false,
        message: "Field work not found",
      });
    }

    await fieldWork.destroy();

    return res.status(200).json({
      success: true,
      message: "Field work deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete field work",
      error: error.message,
    });
  }
};

module.exports = {
  getAllFieldWorks,
  getFieldWorkById,
  createFieldWork,
  updateFieldWork,
  deleteFieldWork,
};