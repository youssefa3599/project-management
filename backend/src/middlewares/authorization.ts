import { Request, Response, NextFunction } from "express";
import Project from "../models/Project";
import Task from "../models/Task";

/**
 * ✅ Role-based authorization (used for admin/editor-level operations)
 */
export const authorize =
  (...allowedRoles: string[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    console.log("🔒 [authorize] roles allowed:", allowedRoles);

    if (!req.user) {
      console.warn("❌ [authorize] → no user on request");
      return res.status(401).json({ message: "Not authenticated" });
    }

    const userRole = req.user.role;
    console.log("👤 [authorize] user role:", userRole);

    if (!userRole || !allowedRoles.includes(userRole)) {
      console.warn("🚫 [authorize] forbidden (allowed:", allowedRoles, ")");
      return res.status(403).json({ message: "Forbidden: insufficient role" });
    }

    console.log("✅ [authorize] access granted");
    next();
  };

/**
 * ✅ FIXED: Project membership-based authorization
 * NOW ALSO checks if user is a member of any task in the project
 */
export const authorizeProjectRole =
  (allowedRoles: string[]) =>
  async (req: Request, res: Response, next: NextFunction) => {
    console.log("\n🔍 [authorizeProjectRole] BEGIN");
    try {
      if (!req.user) {
        console.warn("❌ [authorizeProjectRole] → no user on request");
        return res.status(401).json({ message: "Not authenticated" });
      }

      const projectId =
        req.params.id ||
        req.params.projectId ||
        req.body.projectId ||
        req.query.projectId;

      const userId = req.user.id;
      console.log("📁 [authorizeProjectRole] projectId:", projectId);
      console.log("👤 [authorizeProjectRole] userId:", userId);

      if (!projectId) {
        console.warn("⚠️ [authorizeProjectRole] missing projectId");
        return res.status(400).json({ message: "Project ID is required" });
      }

      const project = await Project.findById(projectId).populate(
        "members.user",
        "name email role"
      );

      if (!project) {
        console.warn("❌ [authorizeProjectRole] project not found:", projectId);
        return res.status(404).json({ message: "Project not found" });
      }

      const isOwner = project.createdBy.toString() === userId;
      const member = project.members.find(
        (m) => m.user && m.user._id.toString() === userId
      );
      const memberRole = member?.role;

      console.log("🔎 [authorizeProjectRole] project member check:", {
        isOwner,
        memberRole,
        allowedRoles,
      });

      // ✅ Check if user is owner or has allowed project role
      if (isOwner || (memberRole && allowedRoles.includes(memberRole))) {
        console.log("✅ [authorizeProjectRole] access granted (project member)");
        return next();
      }

      // ✅ NEW: Check if user is a member of any task in this project
      const hasTaskMembership = await Task.exists({
        project: projectId,
        members: userId,
      });

      if (hasTaskMembership) {
        console.log("✅ [authorizeProjectRole] access granted (task member)");
        return next();
      }

      // ❌ User has no access
      console.warn(
        "🚫 [authorizeProjectRole] forbidden → no project or task membership"
      );
      return res
        .status(403)
        .json({ message: "Forbidden: insufficient permissions" });
    } catch (error: any) {
      console.error("💥 [authorizeProjectRole] server error:", error);
      res.status(500).json({
        message: "Server error during authorization",
        error: error.message,
      });
    }
  };