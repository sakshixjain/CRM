// config/emailConfig.js
// -----------------------------------------------------------------------------
// LOCALHOST DEV: SMTP is disabled. Emails/credentials are logged to the terminal console.
// WHEN DEPLOYING TO PRODUCTION:
// 1. Fill SMTP credentials in .env (SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_PORT, etc.)
// 2. Uncomment the nodemailer transport block below.
// -----------------------------------------------------------------------------

const nodemailer = require("nodemailer");

function formatEmailPreview(html, text) {
  if (text) return text;
  if (!html) return "(Empty body)";
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*[\/]?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+\n/g, "\n\n")
    .trim();
}

async function sendMail(mailOptions) {
  const to = mailOptions.to || mailOptions.email || "unknown@recipient.com";
  const subject = mailOptions.subject || "(No Subject)";
  const from = mailOptions.from || '"CRM System" <no-reply@crm.local>';

  /*
  // UNCOMMENT THIS BLOCK FOR PRODUCTION SMTP:
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587,
      secure: process.env.SMTP_SECURE === "true" || process.env.SMTP_PORT === "465",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    return await transporter.sendMail({ ...mailOptions, from });
  }
  */

  // Localhost console output:
  console.log("\n============================================================");
  console.log("📧 [EMAIL CONSOLE - LOCALHOST DEV MODE]");
  console.log("------------------------------------------------------------");
  console.log(`From:    ${from}`);
  console.log(`To:      ${to}`);
  console.log(`Subject: ${subject}`);
  console.log("----------------------- Message Content --------------------");
  console.log(formatEmailPreview(mailOptions.html, mailOptions.text));
  console.log("============================================================\n");

  return {
    success: true,
    messageId: `console-local-${Date.now()}`,
    mock: true,
  };
}

const transporterObject = {
  sendMail,
};

function createTransporter() {
  return transporterObject;
}

Object.assign(createTransporter, transporterObject);

module.exports = createTransporter;
