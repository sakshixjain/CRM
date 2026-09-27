const crypto = require("crypto");
const Webhook = require("../models/Webhook");

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

function buildWebhookUrl(req, token) {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const protocol = Array.isArray(forwardedProto)
    ? forwardedProto[0]
    : forwardedProto || req.protocol;

  return `${protocol}://${req.get("host")}/api/webhook/${token}`;
}

function firstValue(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return "";
}

exports.health = async (_req, res) => {
  return res.status(200).json({
    success: true,
    message: "Webhook is ready",
  });
};

exports.createWebhook = async (req, res) => {
  try {
    const companyId = Number(
      firstValue(req.body?.company_id, req.body?.companyId, req.query.company_id),
    );
    const name = String(req.body?.name || "").trim() || null;
    const platform = String(req.body?.platform || "").trim() || null;

    if (!Number.isInteger(companyId) || companyId <= 0) {
      return res.status(400).json({
        success: false,
        message: "company_id is required",
      });
    }

    const token = generateToken();
    const webhookUrl = buildWebhookUrl(req, token);

    const webhook = await Webhook.create({
      company_id: companyId,
      name,
      platform,
      webhook_url: webhookUrl,
      token,
      is_active: true,
    });

    return res.status(201).json({
      success: true,
      message: "Webhook created",
      data: webhook,
    });
  } catch (error) {
    console.error("createWebhook error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error creating webhook",
    });
  }
};

exports.getAllWebhooks = async (req, res) => {
  try {
    const companyId = Number(
      firstValue(req.body?.company_id, req.body?.companyId, req.query.company_id),
    );

    if (!Number.isInteger(companyId) || companyId <= 0) {
      return res.status(400).json({
        success: false,
        message: "company_id is required",
      });
    }

    const rows = await Webhook.findAll({
      where: { company_id: companyId },
      order: [["id", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error("getAllWebhooks error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error fetching webhooks",
    });
  }
};

exports.regenerateWebhookToken = async (req, res) => {
  try {
    const companyId = Number(
      firstValue(req.body?.company_id, req.body?.companyId, req.query.company_id),
    );

    if (!Number.isInteger(companyId) || companyId <= 0) {
      return res.status(400).json({
        success: false,
        message: "company_id is required",
      });
    }

    const webhook = await Webhook.findOne({
      where: {
        id: req.params.id,
        company_id: companyId,
      },
    });

    if (!webhook) {
      return res.status(404).json({
        success: false,
        message: "Webhook not found",
      });
    }

    const token = generateToken();
    await webhook.update({
      token,
      webhook_url: buildWebhookUrl(req, token),
    });

    return res.status(200).json({
      success: true,
      message: "Webhook token regenerated",
      data: webhook,
    });
  } catch (error) {
    console.error("regenerateWebhookToken error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error regenerating webhook token",
    });
  }
};
