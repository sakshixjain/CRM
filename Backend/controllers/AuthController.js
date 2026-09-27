// controllers/authController.js
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const Admin = require("../models/Admin");
const Agent = require("../models/UserAgent");
const transporter = require("../config/emailConfig");
const { loginOtpTemplate, passwordResetTemplate , welcomeEmailTemplate} = require("../utils/emailTemplates");
const CompanyDetails = require("../models/CompanyDetails");
const { sequelize } = require("../models"); // adjust path


const signAccessToken = ({ id, type,company_id }) => {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET missing");
  return jwt.sign({ id, type ,company_id}, process.env.JWT_SECRET, {
    expiresIn: "12h",
  });
};

function generateRandomPassword(length = 8) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

const pickUserPayload = (user, type) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role_id: user.role_id,
  company_id:user.company_id,
  type,
  // verification_expire_at,
  // otp
});

const signup = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { name, email, contact_no, company_name } = req.body;

    if (!name || !email || !contact_no || !company_name) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    const cleanName = String(name).trim();
    const cleanEmail = String(email).trim().toLowerCase();
    const cleanPhone = String(contact_no).trim();
    const cleanCompanyName = String(company_name).trim();

    // Check existing admin email
    const exists = await Admin.findOne({
      where: { email: cleanEmail },
      transaction,
    });

    if (exists) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: "Email already in use",
      });
    }

    // Optional: also check Agent table
    const existingAgent = await Agent.findOne({
      where: { email: cleanEmail },
      transaction,
    });

    if (existingAgent) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: "Email already in use",
      });
    }
    const db_name =
  "db_" +
  cleanCompanyName  .toLowerCase() .replace(/[^a-z0-9]/g, "_");

    // Create company_details entry
    const company = await CompanyDetails.create(
      {
        name: cleanCompanyName,          // adjust if your column is different
        company_name: cleanCompanyName, // keep only if this column exists
        db_name:db_name,
        email: cleanEmail,               // adjust if your column is different
        contact_no: cleanPhone,               // adjust if your column is different
        is_active: true,
      },
      { transaction }
    );

    // Generate random password
    const plainPassword = generateRandomPassword(8);

    // Hash password
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    // Create admin
    const admin = await Admin.create(
      {
        company_id: company.id,
        name: cleanName,
        email: cleanEmail,
        contact_no: cleanPhone,
        password: hashedPassword,
        role_id: 1,
        is_verified: false,
        otp: null,
        verification_expire_at: null,
      },
      { transaction }
    );

    // Mirror entry in Agent table
    await Agent.create(
      {
        company_id: company.id,
        name: cleanName,
        email: cleanEmail,
        contact_no: cleanPhone,
        password: hashedPassword,
        role_id: 1,
      },
      { transaction }
    );

    const accessToken = signAccessToken({
      id: admin.id,
      type: "admin",
      company_id: company.id,
    });

    admin.token = accessToken;
    admin.last_login = new Date();
    await admin.save({ transaction });

    const loginUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/login`;

    // -------------------------------------------------------------------------
    // 📧 LOCAL DEV: Credentials console mein print ho rahe hain (SMTP commented)
    // -------------------------------------------------------------------------
    console.log("\n============================================================");
    console.log("🎉 NEW SIGNUP CREATED (LOCAL DEVELOPMENT)");
    console.log("------------------------------------------------------------");
    console.log(`Company:   ${cleanCompanyName}`);
    console.log(`Email:     ${cleanEmail}`);
    console.log(`Password:  ${plainPassword}`);
    console.log(`Login URL: ${loginUrl}`);
    console.log("============================================================\n");

    /* UNCOMMENT FOR PRODUCTION SMTP:
    await transporter.sendMail({
      from: `"CRM System" <${process.env.SMTP_USER}>`,
      to: cleanEmail,
      subject: "Your CRM Account Credentials",
      html: welcomeEmailTemplate({
        userName: cleanName,
        email: cleanEmail,
        password: plainPassword,
        role: "Admin",
        loginUrl,
        companyName: cleanCompanyName,
      }),
    });
    */

    await transaction.commit();

    return res.status(201).json({
      success: true,
      message: "Company, admin, and agent created successfully.",
      tempPassword: plainPassword,
      token: accessToken,
      company,
      user: pickUserPayload(admin, "admin"),
    });
  } catch (err) {
    await transaction.rollback();
    console.error("Signup error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error during signup",
      error: err.message,
    });
  }
};


// ✅ POST /login
// body: { email, password }
const login = async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const admin = await Admin.findOne({ where: { email } });
    if (!admin) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (admin.is_active === false) {
      return res.status(403).json({
        success: false,
        message: "Account is inactive. Please contact administrator.",
      });
    }

    const ok = await bcrypt.compare(password, admin.password);
    if (!ok) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const now = new Date();
    const token = signAccessToken({
      id: admin.id,
      type: "admin",
      company_id: admin.company_id,
    });

    admin.token = token;
    admin.last_login = now;
    await admin.save();

    return res.json({
      success: true,
      token,
      user: pickUserPayload(admin, "admin"),
    });
  } catch (err) {
    console.error("login error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error during login",
      error: err.message,
    });
  }
};

// ✅ GET ME
const getMe = async (req, res) => {
  try {
    const { id, type, company_id } = req.user || {};
    if (!id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (type === "agent") {
      const agent = await Agent.findOne({
        where: {
          id,
          company_id,
        },
      });

      if (!agent) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      return res.json({
        success: true,
        user: { ...pickUserPayload(agent, "agent"), is_active: agent.is_active },
      });
    }

    const admin = await Admin.findOne({
      where: {
        id,
        company_id,
      },
    });

    if (!admin) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.json({
      success: true,
      user: { ...pickUserPayload(admin, "admin"), is_active: admin.is_active },
    });
  } catch (err) {
    console.error("getMe error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ✅ LOGOUT
const logout = async (req, res) => {
  try {
    const { id, type, company_id } = req.user || {};
    if (!id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (type === "admin") {
      const admin = await Admin.findOne({
        where: {
          id,
          company_id,
        },
      });

      if (admin) {
        admin.token = null;
        await admin.save();
      }
    }

    if (type === "agent") {
      const agent = await Agent.findOne({
        where: {
          id,
          company_id,
        },
      });

      if (agent) {
        agent.token = null;
        await agent.save();
      }
    }

    return res.json({ success: true, message: "Logged out successfully" });
  } catch (err) {
    console.error("Logout error:", err);
    return res.status(500).json({ success: false, message: "Logout failed" });
  }
};

// ✅ CHANGE PASSWORD (ADMIN ONLY)
const changePassword = async (req, res) => {
  try {
    const { id, type, company_id } = req.user || {};
    const { newPassword, confirmPassword } = req.body;

    if (!id || type !== "admin") {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (!newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "New password and confirm password are required",
      });
    }

    if (newPassword !== confirmPassword) {
      return res
        .status(400)
        .json({ success: false, message: "Passwords do not match" });
    }

    const admin = await Admin.findOne({
      where: {
        id,
        company_id,
      },
    });

    if (!admin) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    admin.password = await bcrypt.hash(String(newPassword).trim(), 10);
    admin.token = null; // force logout
    await admin.save();

    return res.json({
      success: true,
      message: "Password updated successfully. Please login again.",
      forceLogout: true,
    });
  } catch (err) {
    console.error("changePassword error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ✅ FORGOT PASSWORD (sends reset link to email)
const forgotPassword = async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const admin = await Admin.findOne({ where: { email } });
    if (!admin) {
      return res.json({
        success: true,
        message: "If the email exists, a password reset link has been sent.",
      });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET missing");
    }

    const resetToken = jwt.sign(
      {
        id: admin.id,
        email: admin.email,
        company_id: admin.company_id,
        type: "password_reset",
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

    // -------------------------------------------------------------------------
    // 📧 LOCAL DEV: Reset Link console mein print ho raha hai (SMTP commented)
    // -------------------------------------------------------------------------
    console.log("\n============================================================");
    console.log("🔑 PASSWORD RESET LINK (LOCAL DEVELOPMENT)");
    console.log("------------------------------------------------------------");
    console.log(`Email:      ${email}`);
    console.log(`Reset Link: ${resetLink}`);
    console.log("============================================================\n");

    /* UNCOMMENT FOR PRODUCTION SMTP:
    const html = passwordResetTemplate(resetLink);
    const subject = "Password Reset Request - CRM System";

    await transporter.sendMail({
      from: `"CRM System" <${process.env.SMTP_USER}>`,
      to: email,
      subject,
      html,
    });
    */

    return res.json({
      success: true,
      message: "Password reset link generated (see console in local dev).",
      resetLink,
    });
  } catch (err) {
    console.error("forgotPassword error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to send password reset email",
    });
  }
};

// ✅ RESET PASSWORD (validates token and resets password)
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword, confirmPassword } = req.body;

    if (!token || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Token, new password, and confirm password are required",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET missing");
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token",
      });
    }

    if (decoded.type !== "password_reset") {
      return res.status(400).json({
        success: false,
        message: "Invalid token type",
      });
    }

    const admin = await Admin.findOne({
      where: {
        id: decoded.id,
        company_id: decoded.company_id,
      },
    });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (admin.email !== decoded.email) {
      return res.status(400).json({
        success: false,
        message: "Token email mismatch",
      });
    }

    const hashedPassword = await bcrypt.hash(String(newPassword).trim(), 10);
    admin.password = hashedPassword;
    admin.token = null; // Clear any existing session tokens
    await admin.save();

    return res.json({
      success: true,
      message: "Password has been reset successfully. Please login with your new password.",
    });
  } catch (err) {
    console.error("resetPassword error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error during password reset",
    });
  }
};

module.exports = {
  signup,
  login,
  changePassword,
  getMe,
  logout,
  forgotPassword,
  resetPassword,
};
