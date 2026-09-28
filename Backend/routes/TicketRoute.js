const express = require("express");
const router = express.Router();
const ticketController = require("../controllers/TicketController");
const { protect } = require("../middleware/authMiddleware");

router.get("/stats", protect, ticketController.getTicketStats);
router.get("/", protect, ticketController.getAllTickets);
router.get("/:id", protect, ticketController.getTicketById);
router.post("/", protect, ticketController.createTicket);
router.put("/:id", protect, ticketController.updateTicket);
router.delete("/:id", protect, ticketController.deleteTicket);

module.exports = router;
