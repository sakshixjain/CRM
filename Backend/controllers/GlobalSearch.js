const { Op } = require("sequelize");

const Admin = require("../models/Admin");
const Agent = require("../models/UserAgent");
const Lead = require("../models/Leads");
const Payment = require("../models/Payment");
const LeadSource = require("../models/LeadSource");
const LeadStatus = require("../models/LeadStatus");

exports.globalSearch = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    const q = String(req.query.q || "").trim();

    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!q || q.length < 2) {
      return res.json({
        success: true,
        query: q,
        results: {},
      });
    }

    const like = `%${q}%`;

    const [admins, agents, leads, payments, sources, statuses] =
      await Promise.all([
        Admin.findAll({
          where: {
            company_id: companyId,
            [Op.or]: [
              { name: { [Op.like]: like } },
              { email: { [Op.like]: like } },
              { contact_no: { [Op.like]: like } },
            ],
          },
          attributes: ["id", "name", "email", "contact_no", "role_id"],
          limit: 5,
        }),

        Agent.findAll({
          where: {
            company_id: companyId,
            [Op.or]: [
              { name: { [Op.like]: like } },
              { email: { [Op.like]: like } },
              { contact_no: { [Op.like]: like } },
            ],
          },
          attributes: ["id", "name", "email", "contact_no", "role_id"],
          limit: 5,
        }),

        Lead.findAll({
          where: {
            company_id: companyId,
            [Op.or]: [
              { name: { [Op.like]: like } },
              { email: { [Op.like]: like } },
              { contact_no: { [Op.like]: like } },
              { contact_no1: { [Op.like]: like } },
              { call_status: { [Op.like]: like } },
              { whatsapp_chat: { [Op.like]: like } },
              { case_type: { [Op.like]: like } },
              { address: { [Op.like]: like } },
              { city: { [Op.like]: like } },
              { state: { [Op.like]: like } },
              { country: { [Op.like]: like } },
              { pincode: { [Op.like]: like } },
              { description: { [Op.like]: like } },
            ],
          },
          attributes: [
            "id",
            "name",
            "email",
            "contact_no",
            "contact_no1",
            "case_type",
            "city",
            "state",
            "country",
            "is_active",
          ],
          limit: 8,
        }),

        Payment.findAll({
          where: {
            company_id: companyId,
            [Op.or]: [
              { lead_name: { [Op.like]: like } },
              { contact_no: { [Op.like]: like } },
              { case_type: { [Op.like]: like } },
              { case_location: { [Op.like]: like } },
            ],
          },
          attributes: [
            "id",
            "lead_name",
            "contact_no",
            "case_type",
            "case_location",
            "total_amount",
            "status",
          ],
          limit: 5,
        }),

        LeadSource.findAll({
          where: {
            company_id: companyId,
            name: { [Op.like]: like },
          },
          attributes: ["id", "name"],
          limit: 5,
        }),

        LeadStatus.findAll({
          where: {
            company_id: companyId,
            name: { [Op.like]: like },
          },
          attributes: ["id", "name"],
          limit: 5,
        }),
      ]);

    const withPath = {
      admins: admins.map((a) => ({
        ...a.toJSON(),
        path: "/agent",
      })),

      agents: agents.map((a) => ({
        ...a.toJSON(),
        path: "/agent",
      })),

      leads: leads.map((l) => ({
        ...l.toJSON(),
        path: `/leads?highlightLeadId=${l.id}&search=${encodeURIComponent(q)}`,
      })),

      payments: payments.map((p) => ({
        ...p.toJSON(),
        path: `/payments?highlightPaymentId=${p.id}`,
      })),

      sources: sources.map((s) => ({
        ...s.toJSON(),
        path: "/source",
      })),

      statuses: statuses.map((s) => ({
        ...s.toJSON(),
        path: "/status",
      })),
    };

    return res.json({
      success: true,
      query: q,
      results: withPath,
    });
  } catch (error) {
    console.error("Global search error:", error);
    return res.status(500).json({
      success: false,
      message: error?.message || "Global search failed",
    });
  }
};
