import express from "express";
import {
  requestVerificationCode,  // NEW - Step 1: Send code
  verifyAndRegister,        // NEW - Step 2: Verify & create account
  resendVerificationCode,   // NEW - Resend code if expired
  loginUser,                // EXISTING - Login
  getCurrentUser,           // NEW - Get authenticated user
  getAllUsers,              // EXISTING - Get all users
} from "../controllers/userController";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = express.Router();

// NEW: Two-step registration with email verification
router.post("/request-verification", requestVerificationCode);
router.post("/verify-and-register", verifyAndRegister);
router.post("/resend-verification", resendVerificationCode);

// Login
router.post("/login", loginUser);

// Protected routes
router.get("/me", authMiddleware, getCurrentUser);
router.get("/users", authMiddleware, getAllUsers);

export default router;