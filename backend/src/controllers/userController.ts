import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User";
import { logActivity } from "../utils/logActivity";
import Redis from "ioredis";
import { sendVerificationEmail } from "../utils/mailer";

// -------------------- REDIS INIT --------------------
const redis = new Redis(6379);
redis.on("connect", () => console.log("✅ Redis connected"));
redis.on("error", (err) => console.error("❌ Redis error:", err));

// Helper to generate 6-digit code
const generateVerificationCode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// ====================================================
// STEP 1: REQUEST VERIFICATION CODE (account NOT created yet)
// ====================================================
export const requestVerificationCode = async (req: Request, res: Response) => {
  console.log("📩 Incoming /request-verification request:", req.body);

  try {
    const { name, email, password, role } = req.body;

    // Validate input
    if (!name?.trim() || !email?.trim() || !password?.trim()) {
      console.warn("⚠️ Missing required fields");
      return res.status(400).json({ message: "All fields are required" });
    }

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      console.warn("⚠️ User already exists:", email);
      return res.status(400).json({ message: "Email already registered" });
    }

    // Generate 6-digit code
    const code = generateVerificationCode();

    // Hash password now (to store in Redis temporarily)
    const hashedPassword = await bcrypt.hash(password, 10);

    // Store pending registration in Redis (expires in 15 minutes)
    const pendingData = JSON.stringify({
      name,
      email,
      password: hashedPassword,
      role: role || "viewer",
      code,
      timestamp: Date.now(),
    });

    await redis.setex(`pending:${email}`, 900, pendingData); // 15 min expiry

    // Send verification email
    await sendVerificationEmail(email, code);

    console.log(`✅ Verification code sent to: ${email}`);

    return res.status(200).json({
      message: "Verification code sent to your email",
      email,
    });
  } catch (error: any) {
    console.error("❌ Request verification failed:", error);
    return res.status(500).json({
      message: "Failed to send verification code",
      error: error.message || error,
    });
  }
};

// ====================================================
// STEP 2: VERIFY CODE & CREATE ACCOUNT
// ====================================================
export const verifyAndRegister = async (req: Request, res: Response) => {
  console.log("📩 Incoming /verify-and-register request:", req.body);

  try {
    const { email, code } = req.body;

    if (!email?.trim() || !code?.trim()) {
      return res.status(400).json({ message: "Email and code are required" });
    }

    // Retrieve pending registration from Redis
    const pendingDataStr = await redis.get(`pending:${email}`);
    if (!pendingDataStr) {
      return res.status(400).json({ 
        message: "Verification code expired or invalid. Please request a new code." 
      });
    }

    const pendingData = JSON.parse(pendingDataStr);

    // Verify code
    if (pendingData.code !== code) {
      console.warn("⚠️ Invalid verification code for:", email);
      return res.status(400).json({ message: "Invalid verification code" });
    }

    // Check if user was created in the meantime
    const userExists = await User.findOne({ email });
    if (userExists) {
      await redis.del(`pending:${email}`);
      return res.status(400).json({ message: "Email already registered" });
    }

    // ✅ FIXED: Create the user with isVerified: true
    const user = await User.create({
      name: pendingData.name,
      email: pendingData.email,
      password: pendingData.password, // Already hashed
      role: pendingData.role,
      isVerified: true, // ✅ Email is already verified!
    });

    // Delete pending registration
    await redis.del(`pending:${email}`);

    console.log("✅ User created after verification:", { id: user._id, email, isVerified: user.isVerified });

    // Log activity
    try {
      await redis.set(`user:${user._id}:registered`, new Date().toISOString());
      await logActivity({
        userId: user._id.toString(),
        action: "User registered",
        entityType: "User",
        entityId: user._id.toString(),
        details: `User ${user.name} registered with role ${user.role}. Email verified and account created`,
      });
    } catch (err) {
      console.error("❌ Redis/logging failed:", err);
    }

    // ✅ FIXED: Generate JWT token with "userId" instead of "id"
    const token = jwt.sign(
      { 
        userId: user._id.toString(),  // ✅ Changed from "id" to "userId"
        email: user.email, 
        role: user.role 
      },
      process.env.JWT_SECRET || "supersecret",
      { expiresIn: "1d" }
    );

    console.log("🔑 Generated token with userId:", user._id.toString());

    return res.status(201).json({
      message: "Account created successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
      },
      token,
    });
  } catch (error: any) {
    console.error("❌ Verify and register failed:", error);
    return res.status(500).json({
      message: "Registration failed",
      error: error.message || error,
    });
  }
};

// ====================================================
// RESEND VERIFICATION CODE
// ====================================================
export const resendVerificationCode = async (req: Request, res: Response) => {
  console.log("📩 Incoming /resend-verification request:", req.body);

  try {
    const { email } = req.body;

    if (!email?.trim()) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Check if there's a pending registration
    const pendingDataStr = await redis.get(`pending:${email}`);
    if (!pendingDataStr) {
      return res.status(400).json({ 
        message: "No pending registration found. Please start registration again." 
      });
    }

    const pendingData = JSON.parse(pendingDataStr);

    // Generate new code
    const newCode = generateVerificationCode();
    pendingData.code = newCode;
    pendingData.timestamp = Date.now();

    // Update Redis with new code
    await redis.setex(`pending:${email}`, 900, JSON.stringify(pendingData));

    // Send new verification email
    await sendVerificationEmail(email, newCode);

    console.log(`✅ Verification code resent to: ${email}`);

    return res.status(200).json({
      message: "New verification code sent",
    });
  } catch (error: any) {
    console.error("❌ Resend verification failed:", error);
    return res.status(500).json({
      message: "Failed to resend code",
      error: error.message || error,
    });
  }
};

// ====================================================
// LOGIN USER
// ====================================================
export const loginUser = async (req: Request, res: Response) => {
  console.log("📩 Incoming /login request:", req.body);

  try {
    const { email, password } = req.body;

    if (!email?.trim() || !password?.trim()) {
      console.warn("⚠️ Missing email or password");
      return res.status(400).json({ message: "Email and password are required" });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      console.warn("⚠️ User not found:", email);
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.warn("⚠️ Incorrect password for:", email);
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // ✅ FIXED: Generate JWT with "userId" instead of "id"
    const token = jwt.sign(
      { 
        userId: user._id.toString(),  // ✅ Changed from "id" to "userId"
        email: user.email, 
        role: user.role 
      },
      process.env.JWT_SECRET || "supersecret",
      { expiresIn: "1d" }
    );

    console.log("🔑 Generated token with userId:", user._id.toString());

    // Log activity
    try {
      await redis.set(`user:${user._id}:lastLogin`, new Date().toISOString());
      await logActivity({
        userId: user._id.toString(),
        action: "User logged in",
        entityType: "User",
        entityId: user._id.toString(),
        details: `User ${user.email} logged in successfully`,
      });
    } catch (err) {
      console.error("❌ Redis/logging failed:", err);
    }

    return res.status(200).json({
      message: "Login successful",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
      },
      token,
    });
  } catch (error: any) {
    console.error("❌ Login route failed:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message || error,
    });
  }
};

// ====================================================
// GET CURRENT USER (protected route)
// ====================================================
export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    // req.user is set by authMiddleware
    if (!req.user?.id) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await User.findById(req.user.id).select("-password");
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      }
    });
  } catch (error: any) {
    console.error("❌ Get current user failed:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message || error,
    });
  }
};

// ====================================================
// GET ALL USERS (for inviting)
// ====================================================
export const getAllUsers = async (req: Request, res: Response) => {
  try {
    console.log("📡 Fetching all users...");

    const users = await User.find({}, "_id name email role isVerified");

    console.log(`✅ Found ${users.length} users`);
    return res.status(200).json(users);
  } catch (error: any) {
    console.error("❌ Failed to fetch users:", error);
    return res.status(500).json({
      message: "Failed to fetch users",
      error: error.message || error,
    });
  }
};