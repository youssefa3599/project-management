import { Request, Response } from "express";
import mongoose from "mongoose";
import Project, { IProject } from "../models/Project";
import User, { IUser } from "../models/User";
import Task from "../models/Task";
import { getCache, setCache, clearCache, clearCacheByPattern } from "../utils/cache";
import { sendEmail } from "../utils/mailer";
import { paginateQuery } from "../utils/paginate";
import { logActivity } from "../utils/activityLogger"; // ✅ FIXED: Import from activityLogger

// ========================================
// ➕ Create Project
// ========================================
export const createProject = async (req: Request, res: Response) => {
  console.log("🧩 [DEBUG] ➕ createProject called");
  try {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });

    const { name, description, members } = req.body;
    const project = await Project.create({
      name,
      description,
      createdBy: req.user.id,
      members: members || [],
    });

    console.log("✅ [DEBUG] Project created:", project._id);
    await clearCacheByPattern(`projects:${req.user.id}:*`);

    // ✅ FIXED: Add description field and proper parameters
    await logActivity({
      userId: req.user.id,
      action: "created",
      entityType: "project",
      entityId: project._id.toString(),
      description: `Created project "${name}"`, // ✅ Added description
      details: `Project "${name}" created with ${members?.length || 0} members`,
      metadata: {
        projectId: project._id.toString(),
        projectName: name,
        memberCount: members?.length || 0,
      },
    });

    res.status(201).json({ message: "Project created successfully", project });
  } catch (error) {
    console.error("❌ [DEBUG] createProject error:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

// ========================================
// 📂 Get Projects (FIXED - includes task-based access)
// ========================================
export const getProjects = async (req: Request, res: Response) => {
  console.log("🧩 [DEBUG] getProjects called by user:", req.user?.id);
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Not authenticated" });

    const { skip, limit, page } = paginateQuery(
      parseInt(req.query.page as string) || 1,
      parseInt(req.query.limit as string) || 10
    );

    const cacheKey = `projects:${userId}:page:${page}:limit:${limit}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      console.log("⚡ [DEBUG] Returning cached project list");
      return res.status(200).json(cached);
    }

    const userTaskProjectIds = await Task.find({ members: userId }).distinct('project');
    console.log("🔍 [DEBUG] User is member of tasks in projects:", userTaskProjectIds.map(id => id.toString()));

    const [projects, total] = await Promise.all([
      Project.find({
        $or: [
          { createdBy: userId },
          { "members.user": userId },
          { _id: { $in: userTaskProjectIds } }
        ]
      })
        .populate("createdBy", "name email")
        .populate("members.user", "name email")
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Project.countDocuments({
        $or: [
          { createdBy: userId },
          { "members.user": userId },
          { _id: { $in: userTaskProjectIds } }
        ]
      }),
    ]);

    console.log(`✅ [DEBUG] Found ${projects.length} projects for user ${userId}`);

    const response = {
      data: projects,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };

    await setCache(cacheKey, response, 120);
    res.status(200).json(response);
  } catch (error) {
    console.error("❌ [DEBUG] getProjects error:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

// ========================================
// 📄 Get Single Project (FIXED - filters tasks by membership)
// ========================================
export const getProjectById = async (req: Request, res: Response) => {
  console.log("======================================");
  console.log("📄 [DEBUG] getProjectById triggered");
  console.log("======================================");

  try {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    const { id: userId, role } = req.user;
    const projectId = req.params.id;

    const cacheKey = `project:${projectId}:user:${userId}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      console.log("⚡ [DEBUG] Returning cached project data");
      return res.status(200).json(cached);
    }

    const project = await Project.findById(projectId)
      .populate("createdBy", "name email")
      .populate("members.user", "name email");
    if (!project) return res.status(404).json({ message: "Project not found" });

    const isCreator = project.createdBy.toString() === userId;
    const isProjectMember = project.members.some(
      (m: any) => m.user && m.user.toString() === userId
    );

    let taskQuery: any = { project: projectId };

    if (!isCreator && !isProjectMember) {
      taskQuery.members = userId;
      console.log("🔒 [DEBUG] User is task-only member → filtering by task.members");
    } else if (role === "viewer") {
      taskQuery.$or = [
        { assignedTo: userId },
        { createdBy: userId },
        { members: userId }
      ];
      console.log("👁️ [DEBUG] User is viewer → showing assigned/created/member tasks");
    } else {
      console.log("👑 [DEBUG] User is admin/editor → showing all tasks");
    }

    const tasks = await Task.find(taskQuery)
      .populate("assignedTo", "name email")
      .populate("createdBy", "name email")
      .sort({ updatedAt: -1 })
      .lean();

    console.log(`✅ [DEBUG] Found ${tasks.length} visible tasks for user ${userId}`);

    const response = { project, tasks };
    await setCache(cacheKey, response, 120);

    res.status(200).json(response);
  } catch (error) {
    console.error("❌ [DEBUG] getProjectById error:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

// ========================================
// 🗑️ Delete Project
// ========================================
export const deleteProject = async (req: Request, res: Response) => {
  console.log("🧩 [DEBUG] deleteProject called");
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    if (req.user?.role !== "admin" && project.createdBy.toString() !== req.user?.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const projectName = project.name;

    await project.deleteOne();
    await clearCacheByPattern(`projects:${req.user?.id}:*`);
    await clearCache(`project:${req.params.id}`);

    // ✅ FIXED: Add activity logging for delete
    await logActivity({
      userId: req.user!.id,
      action: "deleted",
      entityType: "project",
      entityId: req.params.id,
      description: `Deleted project "${projectName}"`,
      details: `Project "${projectName}" was permanently deleted`,
      metadata: {
        projectName,
        deletedAt: new Date().toISOString(),
      },
    });

    console.log("✅ [DEBUG] Project deleted:", projectName);
    res.status(200).json({ message: "Project deleted" });
  } catch (error) {
    console.error("❌ [DEBUG] deleteProject error:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

// ========================================
// 📧 Invite User to Project
// ========================================


// ========================================
// ✏️ Update Project
// ========================================
// ========================================
// ✏️ Update Project
// ========================================
export const updateProject = async (req: Request, res: Response) => {
  console.log("🧩 [DEBUG] updateProject called");
  try {
    const projectId = req.params.id;
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });

    if (req.user.role !== "admin" && project.createdBy.toString() !== req.user.id) {
      console.warn("⚠️ [DEBUG] Unauthorized update attempt by:", req.user.id);
      return res.status(403).json({ message: "Forbidden" });
    }

    const oldName = project.name; // Store old name for comparison
    const updated = await Project.findByIdAndUpdate(projectId, req.body, { new: true })
      .populate("createdBy", "name email")
      .populate("members.user", "name email");

    console.log("✅ [DEBUG] Project updated:", updated?._id);
    await clearCache(`project:${projectId}`);
    await clearCacheByPattern(`projects:${req.user.id}:*`);

    // ✅ FIXED: Enhanced activity logging for update with detailed changes
    const updatedFields = Object.keys(req.body);
    const changesDescription = updatedFields.map(field => {
      if (field === 'name' && oldName !== req.body.name) {
        return `name changed from "${oldName}" to "${req.body.name}"`;
      }
      return field;
    }).join(', ');

    await logActivity({
      userId: req.user.id,
      action: "updated",
      entityType: "project",
      entityId: projectId,
      description: `Updated project "${updated?.name}"`,
      details: `Modified: ${changesDescription}`,
      metadata: {
        projectId,
        projectName: updated?.name,
        oldName,
        updatedFields,
        changes: req.body,
      },
    });

    res.status(200).json({ message: "Project updated successfully", project: updated });
  } catch (error) {
    console.error("❌ [DEBUG] updateProject error:", error);
    res.status(500).json({ message: "Server error", error });
  }
};