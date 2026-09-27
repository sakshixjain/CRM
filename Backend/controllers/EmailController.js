const nodemailer = require("nodemailer");
const { Op } = require("sequelize");
const EmailTemplate = require("../models/EmailTemplate");
const SmtpSetting = require("../models/SmtpSetting");
const Lead = require("../models/Leads");
const Company = require("../models/CompanyDetails");

// Create dynamic nodemailer transporter
async function getTransporterForCompany(companyId) {
  try {
    const smtp = await SmtpSetting.findOne({
      where: { company_id: companyId, is_active: true },
    });

    if (smtp && smtp.host && smtp.username && smtp.password) {
      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: Number(smtp.port) || 587,
        secure: smtp.secure === true || Number(smtp.port) === 465,
        auth: {
          user: smtp.username,
          pass: smtp.password,
        },
      });

      return {
        transporter,
        from: `"${smtp.from_name || 'CRM Team'}" <${smtp.from_email || smtp.username}>`,
        isMock: false,
      };
    }
  } catch (err) {
    console.error("Error reading company SMTP settings:", err.message);
  }

  // Fallback to process.env if available
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "true" || process.env.SMTP_PORT === "465",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    return {
      transporter,
      from: `"${process.env.FROM_NAME || 'CRM Platform'}" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
      isMock: false,
    };
  }

  // Dev Console Mock Transporter
  return {
    transporter: {
      sendMail: async (opts) => {
        console.log("\n============================================================");
        console.log("📧 [EMAIL BROADCAST - LOCALHOST DEV/MOCK MODE]");
        console.log("------------------------------------------------------------");
        console.log(`To:      ${opts.to}`);
        console.log(`Subject: ${opts.subject}`);
        console.log(`From:    ${opts.from}`);
        console.log("----------------------- Body Preview -----------------------");
        console.log(String(opts.html || opts.text || "").replace(/<[^>]+>/g, " ").trim().slice(0, 300));
        console.log("============================================================\n");
        return { messageId: `mock-${Date.now()}` };
      },
    },
    from: '"CRM System" <no-reply@crm.local>',
    isMock: true,
  };
}

// Replace template placeholders with lead data
function renderTemplate(content = "", lead = {}) {
  if (!content) return "";
  return content
    .replace(/\{\{\s*name\s*\}\}/gi, lead.name || "Customer")
    .replace(/\{\{\s*email\s*\}\}/gi, lead.email || "")
    .replace(/\{\{\s*phone\s*\}\}/gi, lead.contact_no || "")
    .replace(/\{\{\s*city\s*\}\}/gi, lead.city || "your city")
    .replace(/\{\{\s*state\s*\}\}/gi, lead.state || "")
    .replace(/\{\{\s*address\s*\}\}/gi, lead.address || "")
    .replace(/\{\{\s*case_type\s*\}\}/gi, lead.case_type || "inquiry")
    .replace(/\{\{\s*service\s*\}\}/gi, lead.case_type || "inquiry");
}

/* ==========================================================================
   EMAIL TEMPLATES CRUD
   ========================================================================== */

exports.getAllTemplates = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const templates = await EmailTemplate.findAll({
      where: { company_id: companyId },
      order: [["created_at", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      data: templates,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || "Error fetching templates" });
  }
};

exports.createTemplate = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    const { name, subject, body_html, category } = req.body;

    if (!companyId) return res.status(401).json({ success: false, message: "Unauthorized" });
    if (!name || !subject || !body_html) {
      return res.status(400).json({ success: false, message: "name, subject, and body_html are required" });
    }

    const template = await EmailTemplate.create({
      company_id: companyId,
      name: String(name).trim(),
      subject: String(subject).trim(),
      body_html: String(body_html).trim(),
      category: category || "general",
      is_active: true,
    });

    return res.status(201).json({
      success: true,
      data: template,
      message: "Template created successfully",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || "Error creating template" });
  }
};

exports.updateTemplate = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    const { id } = req.params;
    const { name, subject, body_html, category, is_active } = req.body;

    if (!companyId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const template = await EmailTemplate.findOne({
      where: { id, company_id: companyId },
    });

    if (!template) {
      return res.status(404).json({ success: false, message: "Template not found" });
    }

    await template.update({
      name: name !== undefined ? String(name).trim() : template.name,
      subject: subject !== undefined ? String(subject).trim() : template.subject,
      body_html: body_html !== undefined ? String(body_html).trim() : template.body_html,
      category: category !== undefined ? category : template.category,
      is_active: is_active !== undefined ? is_active : template.is_active,
    });

    return res.status(200).json({
      success: true,
      data: template,
      message: "Template updated successfully",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || "Error updating template" });
  }
};

exports.deleteTemplate = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    const { id } = req.params;

    if (!companyId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const deleted = await EmailTemplate.destroy({
      where: { id, company_id: companyId },
    });

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Template not found" });
    }

    return res.status(200).json({ success: true, message: "Template deleted successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || "Error deleting template" });
  }
};

/* ==========================================================================
   SMTP SETTINGS CRUD & CONNECTION TEST
   ========================================================================== */

exports.getSmtpSettings = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const smtp = await SmtpSetting.findOne({
      where: { company_id: companyId },
    });

    if (!smtp) {
      return res.status(200).json({
        success: true,
        data: null,
        message: "No custom SMTP configured. Using default system mailer.",
      });
    }

    const safeData = smtp.toJSON();
    safeData.password = "••••••••"; // Mask password

    return res.status(200).json({
      success: true,
      data: safeData,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || "Error fetching SMTP settings" });
  }
};

exports.saveSmtpSettings = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    const { host, port, secure, username, password, from_email, from_name, is_active } = req.body;

    if (!companyId) return res.status(401).json({ success: false, message: "Unauthorized" });
    if (!host || !username || !from_email) {
      return res.status(400).json({ success: false, message: "host, username, and from_email are required" });
    }

    let smtp = await SmtpSetting.findOne({ where: { company_id: companyId } });

    if (smtp) {
      const updatePayload = {
        host: String(host).trim(),
        port: Number(port) || 587,
        secure: Boolean(secure),
        username: String(username).trim(),
        from_email: String(from_email).trim(),
        from_name: from_name ? String(from_name).trim() : "CRM Platform",
        is_active: is_active !== undefined ? Boolean(is_active) : true,
      };

      if (password && password !== "••••••••") {
        updatePayload.password = String(password).trim();
      }

      await smtp.update(updatePayload);
    } else {
      if (!password) {
        return res.status(400).json({ success: false, message: "Password is required for new SMTP configuration" });
      }

      smtp = await SmtpSetting.create({
        company_id: companyId,
        host: String(host).trim(),
        port: Number(port) || 587,
        secure: Boolean(secure),
        username: String(username).trim(),
        password: String(password).trim(),
        from_email: String(from_email).trim(),
        from_name: from_name ? String(from_name).trim() : "CRM Platform",
        is_active: is_active !== undefined ? Boolean(is_active) : true,
      });
    }

    return res.status(200).json({
      success: true,
      message: "SMTP configuration saved successfully",
      data: {
        id: smtp.id,
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        username: smtp.username,
        from_email: smtp.from_email,
        from_name: smtp.from_name,
        is_active: smtp.is_active,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || "Error saving SMTP settings" });
  }
};

exports.testSmtpConnection = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    const { test_email } = req.body;

    if (!companyId) return res.status(401).json({ success: false, message: "Unauthorized" });
    if (!test_email) return res.status(400).json({ success: false, message: "test_email is required" });

    const { transporter, from, isMock } = await getTransporterForCompany(companyId);

    const info = await transporter.sendMail({
      from,
      to: test_email,
      subject: "Test Email from CRM Platform",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 24px; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #4f46e5; margin-top: 0;">SMTP Connection Verified!</h2>
          <p>Congratulations! Your SMTP email server connection has been successfully established and tested.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
          <p style="font-size: 13px; color: #64748b;">Mode: ${isMock ? "Localhost Console Mock" : "Production SMTP Live"}</p>
          <p style="font-size: 12px; color: #94a3b8;">Sent from your CRM platform at ${new Date().toLocaleString()}</p>
        </div>
      `,
    });

    return res.status(200).json({
      success: true,
      message: `Test email dispatched to ${test_email} successfully!`,
      info,
      isMock,
    });
  } catch (error) {
    console.error("SMTP Test Error:", error);
    return res.status(500).json({
      success: false,
      message: `SMTP Connection test failed: ${error.message}`,
    });
  }
};

/* ==========================================================================
   STATUS-BASED BULK EMAIL BROADCAST
   ========================================================================== */

exports.sendBulkStatusEmail = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    const { status_id, template_id, subject, body_html } = req.body;

    if (!companyId) return res.status(401).json({ success: false, message: "Unauthorized" });

    if (!status_id) {
      return res.status(400).json({ success: false, message: "status_id is required to select leads" });
    }

    let finalSubject = subject;
    let finalHtml = body_html;

    if (template_id) {
      const tmpl = await EmailTemplate.findOne({
        where: { id: template_id, company_id: companyId },
      });
      if (tmpl) {
        finalSubject = finalSubject || tmpl.subject;
        finalHtml = finalHtml || tmpl.body_html;
      }
    }

    if (!finalSubject || !finalHtml) {
      return res.status(400).json({
        success: false,
        message: "Email subject and body_html (or a valid template_id) are required",
      });
    }

    // Fetch all leads in this company with this status having an email
    const leads = await Lead.findAll({
      where: {
        company_id: companyId,
        status_id: Number(status_id),
        email: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: "" }] },
      },
    });

    if (leads.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No leads with valid email addresses found for the selected status",
      });
    }

    const { transporter, from, isMock } = await getTransporterForCompany(companyId);

    // Send emails in batches / parallel
    let sentCount = 0;
    let failedCount = 0;
    const results = [];

    await Promise.all(
      leads.map(async (lead) => {
        try {
          const personalizedSubject = renderTemplate(finalSubject, lead);
          const personalizedHtml = renderTemplate(finalHtml, lead);

          await transporter.sendMail({
            from,
            to: lead.email,
            subject: personalizedSubject,
            html: personalizedHtml,
          });

          sentCount++;
          results.push({ leadId: lead.id, email: lead.email, status: "sent" });
        } catch (mailErr) {
          failedCount++;
          results.push({
            leadId: lead.id,
            email: lead.email,
            status: "failed",
            error: mailErr.message,
          });
        }
      })
    );

    return res.status(200).json({
      success: true,
      message: `Bulk email complete: ${sentCount} sent, ${failedCount} failed`,
      totalLeads: leads.length,
      sentCount,
      failedCount,
      isMock,
      results,
    });
  } catch (error) {
    console.error("sendBulkStatusEmail error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error broadcasting bulk email",
    });
  }
};

/* ==========================================================================
   SELECTED LEADS BULK EMAIL
   ========================================================================== */

exports.sendBulkSelectedEmail = async (req, res) => {
  try {
    const companyId = req.user?.company_id;
    const { lead_ids, template_id, subject, body_html } = req.body;

    if (!companyId) return res.status(401).json({ success: false, message: "Unauthorized" });

    if (!Array.isArray(lead_ids) || lead_ids.length === 0) {
      return res.status(400).json({ success: false, message: "lead_ids array is required" });
    }

    let finalSubject = subject;
    let finalHtml = body_html;

    if (template_id) {
      const tmpl = await EmailTemplate.findOne({
        where: { id: template_id, company_id: companyId },
      });
      if (tmpl) {
        finalSubject = finalSubject || tmpl.subject;
        finalHtml = finalHtml || tmpl.body_html;
      }
    }

    if (!finalSubject || !finalHtml) {
      return res.status(400).json({
        success: false,
        message: "Email subject and body_html (or a valid template_id) are required",
      });
    }

    const leads = await Lead.findAll({
      where: {
        company_id: companyId,
        id: { [Op.in]: lead_ids },
        email: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: "" }] },
      },
    });

    if (leads.length === 0) {
      return res.status(404).json({
        success: false,
        message: "None of the selected leads have a valid email address",
      });
    }

    const { transporter, from, isMock } = await getTransporterForCompany(companyId);

    let sentCount = 0;
    let failedCount = 0;

    await Promise.all(
      leads.map(async (lead) => {
        try {
          const personalizedSubject = renderTemplate(finalSubject, lead);
          const personalizedHtml = renderTemplate(finalHtml, lead);

          await transporter.sendMail({
            from,
            to: lead.email,
            subject: personalizedSubject,
            html: personalizedHtml,
          });

          sentCount++;
        } catch (mailErr) {
          failedCount++;
        }
      })
    );

    return res.status(200).json({
      success: true,
      message: `Bulk email complete: ${sentCount} sent, ${failedCount} failed`,
      totalLeads: leads.length,
      sentCount,
      failedCount,
      isMock,
    });
  } catch (error) {
    console.error("sendBulkSelectedEmail error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error broadcasting bulk email",
    });
  }
};