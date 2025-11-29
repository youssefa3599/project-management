import { Request, Response, NextFunction } from "express";
import jwt, { JsonWebTokenError, TokenExpiredError } from "jsonwebtoken";
import User from "../models/User";

export interface DecodedToken {
  userId: string;
  email: string;
  role?: "admin" | "editor" | "viewer";
}

// Extend Express Request to include both id and userId for compatibility
declare module "express-serve-static-core" {
  interface Request {
    user?: {
      id: string;        // Added for compatibility
      userId: string;
      email: string;
      role?: "admin" | "editor" | "viewer";
      name?: string;     // Added for comment controller
    };
  }
}

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.log("═══════════════════════════════════════════════════════");
  console.log("🛡️ [AUTH MIDDLEWARE] Verifying token...");

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.warn("❌ No Authorization header found");
      console.log("═══════════════════════════════════════════════════════");
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    console.log("🪪 Incoming JWT (truncated):", token.slice(0, 15) + "...");

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error("❌ JWT_SECRET is missing in .env file!");
      console.log("═══════════════════════════════════════════════════════");
      return res.status(500).json({ message: "Server misconfiguration" });
    }

    const decoded = jwt.verify(token, secret) as DecodedToken;
    console.log("✅ Token successfully verified!");
    console.log("   → User ID:", decoded.userId);
    console.log("   → Email:", decoded.email);
    console.log("   → Role:", decoded.role);

    // Validate user existence in DB
    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      console.warn("⚠️ No user found in DB for ID:", decoded.userId);
      console.log("═══════════════════════════════════════════════════════");
      return res.status(401).json({ message: "User not found or deleted" });
    }

    // Check if user's email is verified
    if (!user.isVerified) {
      console.warn("⚠️ User email not verified:", user.email);
      console.log("═══════════════════════════════════════════════════════");
      return res.status(403).json({ 
        message: "Please verify your email before accessing this resource",
        needsVerification: true 
      });
    }

    // Attach verified user info to request with both id and userId for compatibility
    req.user = {
      id: user._id.toString(),          // Added: used by comment controller
      userId: user._id.toString(),       // Kept: used elsewhere
      email: user.email,
      role: user.role,
      name: user.name,                   // Added: useful for comments
    };

    console.log("✅ Authenticated user loaded from DB:");
    console.log("   → user.id:", req.user.id);
    console.log("   → user.userId:", req.user.userId);
    console.log("   → user.email:", req.user.email);
    console.log("   → user.name:", req.user.name);
    console.log("   → user.role:", req.user.role);
    console.log("   → user.isVerified:", true);
    console.log("═══════════════════════════════════════════════════════");

    next();
  } catch (err: unknown) {
    const error = err as Error;
    console.error("❌ [AUTH ERROR] Type:", (err as any)?.constructor?.name);
    console.error("❌ [AUTH ERROR] Message:", error.message);
    console.log("═══════════════════════════════════════════════════════");

    if (err instanceof TokenExpiredError) {
      return res.status(401).json({ message: "Token expired" });
    } else if (err instanceof JsonWebTokenError) {
      return res.status(401).json({ message: "Invalid token" });
    }

    return res.status(401).json({ message: "Invalid or expired token" });
  }
};