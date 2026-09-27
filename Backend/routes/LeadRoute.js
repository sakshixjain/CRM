const express = require("express");
const router = express.Router();
const leadController = require("../controllers/LeadController");
const leadSource = require("../controllers/LeadSourceController");
const leadStatus = require("../controllers/LeadStatusController");
const agent = require("../controllers/UserAgentController");
const paymentController = require("../controllers/PaymentController");
const userRole = require("../controllers/UserRoleController");
const quotationService = require("../controllers/QuotationServiceController");
const quotation = require("../controllers/QuotationController");
const Import = require("../controllers/ImportController");
const followup = require("../controllers/FollowupController");
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });
const  globalSearch = require("../controllers/GlobalSearch");
const { protect } = require('../middleware/authMiddleware.js');
const  companyDetails  = require("../controllers/CompanyDetailsController");
const Activity = require("../controllers/ActivityController");
const webhook = require("../controllers/WebhookController");
const webhookLead = require("../controllers/WebhookLeadController");

const FieldWork= require("../controllers/FieldWorkController.js"); 


router.get("/search", protect, globalSearch.globalSearch);

router.get("/webhook/health", webhook.health);
router.post("/webhook/:token", webhookLead.createLeadFromWebhook);
router.post("/webhooks", webhook.createWebhook);
router.get("/webhooks", webhook.getAllWebhooks);
router.patch("/webhooks/:id/regenerate-token", webhook.regenerateWebhookToken);


router.post("/leads", protect,leadController.createLead);
router.get("/leads",protect, leadController.getAllLeads);
router.get("/leads/stats", protect, leadController.getLeadStats);
router.post("/leads/bulk-assign", protect, leadController.bulkAssignLeads);
router.get("/leads/changed-by", protect, leadController.getChangedByOptions);

// Get single lead by ID
router.get("/leads/:id",protect, leadController.getLeadById);

// Update lead
router.put("/leads/:id",protect, leadController.updateLead);

// Delete lead (hard delete)
router.delete("/leads/:id",protect, leadController.deleteLead);


// routes/leadRoutes.js
// routes/leadRoutes.js
router.post("/leads/followup/:id",protect, followup.followup);
router.get("/leads/followup/:id", protect, followup.getFollowupsByLead);
router.get( "/lead/followup", protect, followup.getAllFollowups);
router.get("/lead/reminder-alerts", protect, followup.getActiveReminderAlerts);
router.put("/lead/followup/:id", protect, followup.updateFollowup);
router.delete("/lead/followup/:id", protect, followup.deleteFollowup);


// CRUD
router.post("/lead-source", protect,leadSource.createLeadSource);
router.get("/lead-source",protect, leadSource.getAllLeadSources); // ?q=&page=1&limit=10
router.get("/lead-source/:id", protect,leadSource.getLeadSourceById);
router.put("/lead-source/:id",protect, leadSource.updateLeadSource);
router.delete("/lead-source/:id",protect, leadSource.deleteLeadSource);
// Optional: soft delete


router.post("/payment",protect, paymentController.createPayment);
router.get("/payment",protect, paymentController.getAllPayments);
router.get("/payment/duration-reminders", protect, paymentController.getDurationReminderAlerts);
router.get("/payment/:id",protect, paymentController.getPaymentById);
router.put("/payment/:id",protect, paymentController.updatePayment);
router.delete("/payment/:id",protect, paymentController.deletePayment);
router.get("/payments/dummy-sheet",protect, paymentController.downloadPaymentDummySheet);
router.post("/payment/import", upload.single("file"),protect, paymentController.importPaymentFile);


// CRUD
router.post("/lead-status",protect, leadStatus.createLeadStatus);
router.get("/lead-status",protect, leadStatus.getAllLeadStatuses); // ?q=&page=1&limit=10
router.get("/lead-status/:id",protect, leadStatus.getLeadStatusById);
router.put("/lead-status/:id",protect, leadStatus.updateLeadStatus);
router.delete("/lead-status/:id",protect, leadStatus.deleteLeadStatus);
// Optional: soft delete
router.patch("/lead-status/:id/disable",protect, leadStatus.disableLeadStatus);

// CRUD
router.post("/user-agent",protect, agent.createAgent);
router.get("/user-agent",protect, agent.getAllAgents);
router.get("/user-agent/:id",protect, agent.getAgentById);
router.put("/user-agent/:id",protect, agent.updateAgent);
router.delete("/user-agent/:id",protect, agent.deleteAgent);

// CRUD
router.post("/user-role", userRole.createRole);
router.get("/user-role", userRole.getAllRoles);
router.get("/user-role/:id", userRole.getRoleById);
router.put("/user-role/:id", userRole.updateRole);
router.delete("/user-role/:id", userRole.deleteRole);

router.post("/quotation-services", protect, quotationService.createQuotationService);
router.get("/quotation-services", protect, quotationService.getAllQuotationServices);
router.get("/quotation-services/:id", protect, quotationService.getQuotationServiceById);
router.put("/quotation-services/:id", protect, quotationService.updateQuotationService);
router.delete("/quotation-services/:id", protect, quotationService.deleteQuotationService);
router.post("/quotations", protect, quotation.createQuotation);
router.get("/quotations", protect, quotation.getAllQuotations);
router.get("/quotations/:id", protect, quotation.getQuotationById);
router.put("/quotations/:id", protect, quotation.updateQuotation);



router.get("/field-works", FieldWork.getAllFieldWorks);
router.get("/field-works/:id", FieldWork.getFieldWorkById);
router.post("/field-works", FieldWork.createFieldWork);
router.put("/field-works/:id", FieldWork.updateFieldWork);
router.delete("/field-works/:id", FieldWork.deleteFieldWork);

router.post("/company-details",protect, companyDetails.createCompany);
router.get("/company-details",protect, companyDetails.getAllCompanies);
router.get("/company-details/:id",protect, companyDetails.getCompanyById);
router.put("/company-details/:id",protect, companyDetails.updateCompany);
router.delete("/company-details/:id",protect, companyDetails.deleteCompany);


// import
router.post("/import", upload.single("file"), Import.importLeadsFile);
// download dummy files
router.get("/import/dummy-sheet", Import.downloadLeadDummySheet);


router.post("/activity/session/start", Activity.startSession);
router.post("/activity/heartbeat", Activity.receiveHeartbeat);
router.post("/activity/session/end", Activity.endSession);

router.get("/activity/live", Activity.getLiveUsers);
router.get("/activity/user/:userId/sessions", Activity.getUserSessions);
router.get("/activity/session/:sessionId", Activity.getSessionDetails);

router.post("/activity/mark-stale-closed", Activity.closeStaleSessions);


module.exports = router;
