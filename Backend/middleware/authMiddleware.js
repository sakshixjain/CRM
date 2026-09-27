// middleware/authMiddleware.js
const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");
const Agent = require("../models/UserAgent");

const protect = async (req, res, next) => {
  let token;

  // ✅ Read Bearer token
  if (req.headers.authorization?.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: "Not authorized - no token" });
  }

  try {
    if (!process.env.JWT_SECRET) {
      return res
        .status(500)
        .json({ success: false, message: "JWT_SECRET missing on server" });
    }

    // ✅ Verify JWT (signature + expiry)
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { id, type, company_id } = decoded || {};

    if (!id) {
      return res
        .status(401)
        .json({ success: false, message: "Not authorized - invalid token" });
    }

    // ✅ Find correct user by type (token stored in DB)
    let user = null;

    if (type === "agent") {
      user = await Agent.findByPk(id);

      if (!user || user.token !== token) {
        return res
          .status(401)
          .json({ success: false, message: "Token invalid or revoked" });
      }

      // ✅ attach full shape for multi-tenant controllers
      req.user = {
        id: user.id,
        type: "agent",
        company_id: user.company_id ?? company_id ?? null,
        email: user.email,
        role_id: user.role_id,
      };

      return next();
    }

    // default: admin
    user = await Admin.findByPk(id);

    if (!user || user.token !== token) {
      return res
        .status(401)
        .json({ success: false, message: "Token invalid or revoked" });
    }

    req.user = {
      id: user.id,
      type: "admin",
      company_id: user.company_id ?? company_id ?? null,
      email: user.email,
      role_id: user.role_id,
    };

    return next();
  } catch (err) {
    return res
      .status(401)
      .json({ success: false, message: "Not authorized - invalid/expired token" });
  }
};

module.exports = { protect };