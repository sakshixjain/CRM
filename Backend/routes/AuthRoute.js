const express = require("express");
const AuthController = require("../controllers/AuthController.js");
const { protect } = require("../middleware/authMiddleware.js");
const router = express.Router();
// Auth routes
router.post("/signup", AuthController.signup);
router.post("/login", AuthController.login);
// router.post("/verify-otp",AuthController.verifyOtp);
// router.post("/sent-otp",AuthController.sendOtp);


router.post("/forgot-password", AuthController.forgotPassword);
router.post("/reset-password", AuthController.resetPassword);

// ✅ PROTECT this (req.user is needed)
router.patch("/change-password", protect, AuthController.changePassword);

router.get("/me", protect, AuthController.getMe);

module.exports = router;
