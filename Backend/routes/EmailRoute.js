const express = require("express");
const router = express.Router();
const emailController = require("../controllers/EmailController");
const { protect } = require("../middleware/authMiddleware");

// Template routes
router.get("/templates", protect, emailController.getAllTemplates);
router.post("/templates", protect, emailController.createTemplate);
router.put("/templates/:id", protect, emailController.updateTemplate);
router.delete("/templates/:id", protect, emailController.deleteTemplate);

// SMTP configuration routes
router.get("/smtp", protect, emailController.getSmtpSettings);
router.post("/smtp", protect, emailController.saveSmtpSettings);
router.post("/test-smtp", protect, emailController.testSmtpConnection);

// Bulk broadcast routes
router.post("/bulk-status", protect, emailController.sendBulkStatusEmail);
router.post("/bulk-selected", protect, emailController.sendBulkSelectedEmail);

module.exports = router;