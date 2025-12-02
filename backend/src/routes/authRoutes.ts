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

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User authentication and registration endpoints
 */

/**
 * @swagger
 * /api/auth/request-verification:
 *   post:
 *     summary: Request email verification code (Step 1 of registration)
 *     description: Send a verification code to the user's email address to begin the registration process
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - name
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "john@example.com"
 *               name:
 *                 type: string
 *                 example: "John Doe"
 *     responses:
 *       200:
 *         description: Verification code sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Verification code sent to your email"
 *       400:
 *         description: Invalid input or email already registered
 *       500:
 *         description: Server error
 */
// NEW: Two-step registration with email verification
router.post("/request-verification", requestVerificationCode);

/**
 * @swagger
 * /api/auth/verify-and-register:
 *   post:
 *     summary: Verify code and complete registration (Step 2 of registration)
 *     description: Verify the email code and create a new user account
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - code
 *               - password
 *               - name
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "john@example.com"
 *               code:
 *                 type: string
 *                 example: "123456"
 *               password:
 *                 type: string
 *                 format: password
 *                 example: "SecurePassword123!"
 *               name:
 *                 type: string
 *                 example: "John Doe"
 *               role:
 *                 type: string
 *                 enum: [admin, editor, viewer]
 *                 default: viewer
 *                 example: "viewer"
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Registration successful"
 *                 token:
 *                   type: string
 *                   description: JWT authentication token
 *                 user:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     email:
 *                       type: string
 *                     role:
 *                       type: string
 *       400:
 *         description: Invalid code or input
 *       500:
 *         description: Server error
 */
router.post("/verify-and-register", verifyAndRegister);

/**
 * @swagger
 * /api/auth/resend-verification:
 *   post:
 *     summary: Resend verification code
 *     description: Request a new verification code if the previous one expired
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "john@example.com"
 *     responses:
 *       200:
 *         description: New verification code sent
 *       400:
 *         description: Invalid email
 *       500:
 *         description: Server error
 */
router.post("/resend-verification", resendVerificationCode);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login to get JWT token
 *     description: Authenticate user with email and password to receive JWT token for API access
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "john@example.com"
 *               password:
 *                 type: string
 *                 format: password
 *                 example: "SecurePassword123!"
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Login successful"
 *                 token:
 *                   type: string
 *                   description: JWT token - Copy this to use in "Authorize" button above
 *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                 user:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     email:
 *                       type: string
 *                     role:
 *                       type: string
 *       400:
 *         description: Invalid credentials
 *       500:
 *         description: Server error
 */
// Login
router.post("/login", loginUser);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current authenticated user
 *     description: Returns the profile information of the currently authenticated user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 email:
 *                   type: string
 *                 role:
 *                   type: string
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 */
// Protected routes
router.get("/me", authMiddleware, getCurrentUser);

/**
 * @swagger
 * /api/auth/users:
 *   get:
 *     summary: Get all users
 *     description: Returns a list of all registered users (requires authentication)
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   email:
 *                     type: string
 *                   role:
 *                     type: string
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 */
router.get("/users", authMiddleware, getAllUsers);

export default router;
