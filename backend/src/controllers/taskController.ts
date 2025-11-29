import { Request, Response } from "express";
import Task from "../models/Task";
import Project from "../models/Project";
import User from "../models/User";
import { DecodedToken } from "../middlewares/authMiddleware";
import { getMemberRole } from "../utils/projectHelpers";
import { io } from "../server";
import { getCache, setCache, clearCache } from "../utils/cache";
import { sendEmail } from "../utils/mailer";
import { paginateQuery } from "../utils/paginate";
import { logActivity } from "../utils/activityLogger"; // ✅ FIXED: Import from activityLogger
import TaskGoal from "../models/TaskGoal";
import mongoose from "mongoose";

type RequestWithUser = Request & { user?: DecodedToken };

// =====================
// Create Task
// =====================
export const createTask = async (req: RequestWithUser, res: Response) => {
  try {
    const { projectId, title, description, assignedTo } = req.body;

    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    if (!projectId) return res.status(400).json({ message: "projectId is required" });
    if (!title) return res.status(400).json({ message: "title is required" });

    const project = await Project.findById(projectId).populate("members.user");
    if (!project) return res.status(404).json({ message: "Project not found" });

    const role = getMemberRole(project, req.user.id);
    if (!role || !["admin", "editor"].includes(role))
      return res.status(403).json({ message: "Forbidden: insufficient permissions" });

    // ✅ FIX: Initialize task.members with creator + assignedTo
    const initialMembers = [new mongoose.Types.ObjectId(req.user.id)];
    if (assignedTo && assignedTo !== req.user.id) {
      initialMembers.push(new mongoose.Types.ObjectId(assignedTo));
    }

    const task = await Task.create({
      title,
      description,
      project: projectId,
      assignedTo,
      createdBy: req.user.id,
      members: initialMembers, // ✅ Only creator and assignedTo have access
    });

    console.log("✅ Task created with members:", task.members.map(m => m.toString()));

    io.to(projectId).emit("taskCreated", task);
    await clearCache(`tasks:project:${projectId}`);
    await clearCache(`task:${task._id}`);

    // ✅ Send email notification
    if (assignedTo) {
      const assignedUser = await User.findById(assignedTo);
      if (assignedUser) {
        await sendEmail({
          to: assignedUser.email,
          subject: `📝 New Task Assigned: "${title}"`,
          html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.5;">
              <h2>New Task Assigned</h2>
              <p>Hello <b>${assignedUser.name}</b>,</p>
              <p>You've been assigned a new task in project <b>${project.name}</b>.</p>
              <p><b>Task:</b> ${title}</p>
              <p><b>Description:</b> ${description || "No description provided"}</p>
              <a href="https://yourfrontend.com/projects/${projectId}" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">View Task</a>
              <p style="margin-top:20px;color:#666;">Assigned by: ${req.user?.name || "A teammate"}</p>
            </div>
          `,
        });
        console.log(`📩 Task assignment email sent to ${assignedUser.email}`);
      }
    }

    // ✅ FIXED: Enhanced activity logging for task creation
    await logActivity({
      userId: req.user.id,
      action: "created",
      entityType: "task",
      entityId: task._id.toString(),
      description: `Created task "${title}"`,
      details: `Task "${title}" created in project "${project.name}"${assignedTo ? ` and assigned to user` : ''}`,
      metadata: {
        taskId: task._id.toString(),
        taskTitle: title,
        projectId: project._id.toString(),
        projectName: project.name,
        assignedTo: assignedTo || null,
      },
    });

    // ✅ NEW: Log activity for assigned user (if different from creator)
    if (assignedTo && assignedTo !== req.user.id) {
      await logActivity({
        userId: assignedTo,
        action: "assigned",
        entityType: "task",
        entityId: task._id.toString(),
        description: `You were assigned to task "${title}"`,
        details: `${req.user.name} assigned you to task "${title}" in project "${project.name}"`,
        metadata: {
          taskId: task._id.toString(),
          taskTitle: title,
          projectId: project._id.toString(),
          projectName: project.name,
          assignedBy: req.user.id,
        },
      });
    }

    res.status(201).json({ message: "Task created successfully", task });
  } catch (error) {
    console.error("Error creating task:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =====================
// Update Task
// =====================
export const updateTask = async (req: RequestWithUser, res: Response) => {
  try {
    const { taskId } = req.params;
    const { projectId, title, description, status, assignedTo } = req.body;
    
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    if (!projectId) return res.status(400).json({ message: "projectId is required" });

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });

    const role = getMemberRole(project, req.user.id);
    if (!role || !["admin", "editor"].includes(role))
      return res.status(403).json({ message: "Forbidden: insufficient permissions" });

    // Get old task data for comparison
    const oldTask = await Task.findById(taskId);
    if (!oldTask) return res.status(404).json({ message: "Task not found" });

    const oldTitle = oldTask.title;
    const oldStatus = oldTask.status;
    const oldAssignedTo = oldTask.assignedTo?.toString();

    const task = await Task.findOneAndUpdate(
      { _id: taskId, project: projectId },
      { title, description, status, assignedTo },
      { new: true }
    )
      .populate("assignedTo", "name email")
      .populate("createdBy", "name email");

    if (!task) return res.status(404).json({ message: "Task not found" });

    // ✅ FIX: If assignedTo changed, update task.members
    if (assignedTo) {
      const assignedToId = new mongoose.Types.ObjectId(assignedTo);
      const isAlreadyMember = task.members.some(m => m.toString() === assignedTo.toString());
      
      if (!isAlreadyMember) {
        task.members.push(assignedToId);
        await task.save();
        console.log("✅ Added new assignedTo user to task.members:", assignedTo);
      }
    }

    io.to(projectId).emit("taskUpdated", task);
    await clearCache(`task:${taskId}`);
    await clearCache(`tasks:project:${projectId}`);

    // ✅ Send email notification
    if (assignedTo && task.assignedTo) {
      await sendEmail({
        to: (task.assignedTo as any).email,
        subject: `🔄 Task Updated: "${task.title}"`,
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.5;">
            <h2>Task Updated</h2>
            <p>Hello <b>${(task.assignedTo as any).name}</b>,</p>
            <p>The task <b>${task.title}</b> has been updated in project <b>${project.name}</b>.</p>
            <p><b>Status:</b> ${status}</p>
            <a href="https://yourfrontend.com/projects/${projectId}" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">View Task</a>
            <p style="margin-top:20px;color:#666;">Updated by: ${req.user?.name || "A teammate"}</p>
          </div>
        `,
      });
      console.log(`📩 Task update email sent to ${(task.assignedTo as any).email}`);
    }

    // ✅ FIXED: Enhanced activity logging for task update with change tracking
    const changes: string[] = [];
    if (title && title !== oldTitle) changes.push(`title changed from "${oldTitle}" to "${title}"`);
    if (status && status !== oldStatus) changes.push(`status changed from "${oldStatus}" to "${status}"`);
    if (assignedTo && assignedTo !== oldAssignedTo) changes.push('assignee changed');

    await logActivity({
      userId: req.user.id,
      action: "updated",
      entityType: "task",
      entityId: task._id.toString(),
      description: `Updated task "${task.title}"`,
      details: changes.length > 0 ? `Modified: ${changes.join(', ')}` : `Task "${task.title}" updated`,
      metadata: {
        taskId: task._id.toString(),
        taskTitle: task.title,
        projectId: project._id.toString(),
        projectName: project.name,
        changes: req.body,
        oldTitle,
        oldStatus,
        oldAssignedTo,
      },
    });

    // ✅ NEW: If assignee changed, log for the new assignee
    if (assignedTo && assignedTo !== oldAssignedTo && assignedTo !== req.user.id) {
      await logActivity({
        userId: assignedTo,
        action: "assigned",
        entityType: "task",
        entityId: task._id.toString(),
        description: `You were assigned to task "${task.title}"`,
        details: `${req.user.name} assigned you to task "${task.title}"`,
        metadata: {
          taskId: task._id.toString(),
          taskTitle: task.title,
          projectId: project._id.toString(),
          projectName: project.name,
          assignedBy: req.user.id,
        },
      });
    }

    res.json({ message: "Task updated successfully", task });
  } catch (error) {
    console.error("Error updating task:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =====================
// Delete Task
// =====================
export const deleteTask = async (req: RequestWithUser, res: Response) => {
  try {
    const { taskId } = req.params;
    const projectId = req.body.projectId || req.query.projectId;
    
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    if (!projectId) return res.status(400).json({ message: "projectId is required" });

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });

    const role = getMemberRole(project, req.user.id);
    if (!role || role !== "admin")
      return res.status(403).json({ message: "Forbidden: only admin can delete tasks" });

    const task = await Task.findOneAndDelete({ _id: taskId, project: projectId });
    if (!task) return res.status(404).json({ message: "Task not found" });

    const taskTitle = task.title; // Store before deletion

    io.to(projectId.toString()).emit("taskDeleted", taskId);
    await clearCache(`task:${taskId}`);
    await clearCache(`tasks:project:${projectId}`);

    // ✅ FIXED: Enhanced activity logging for task deletion
    await logActivity({
      userId: req.user.id,
      action: "deleted",
      entityType: "task",
      entityId: task._id.toString(),
      description: `Deleted task "${taskTitle}"`,
      details: `Task "${taskTitle}" was permanently deleted from project "${project.name}"`,
      metadata: {
        taskId: task._id.toString(),
        taskTitle,
        projectId: project._id.toString(),
        projectName: project.name,
        deletedAt: new Date().toISOString(),
      },
    });

    res.json({ message: "Task deleted successfully" });
  } catch (error) {
    console.error("Error deleting task:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =====================
// Get Tasks by Project
// =====================
export const getTasksByProject = async (req: RequestWithUser, res: Response) => {
  try {
    const { projectId } = req.query;

    if (!req.user)
      return res.status(401).json({ message: "Unauthorized" });

    if (!projectId)
      return res.status(400).json({ message: "projectId is required in query params" });

    const project = await Project.findById(projectId as string);
    if (!project)
      return res.status(404).json({ message: "Project not found" });

    // ✅ Check if user is project member OR has task-level access
    const isProjectMember = project.members.some(
      (m: any) => m.user.toString() === req.user!.id
    );

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // ✅ FIX: Filter tasks by membership
    let taskQuery;
    if (isProjectMember) {
      // Project members see all tasks
      taskQuery = { project: projectId as string };
    } else {
      // Non-project members only see tasks they're members of
      taskQuery = { 
        project: projectId as string,
        members: req.user!.id  // ✅ Only tasks where user is in members array
      };
    }

    const tasks = await Task.find(taskQuery)
      .populate("assignedTo", "name email")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Task.countDocuments(taskQuery);

    console.log(`✅ User ${req.user.id} retrieved ${tasks.length} tasks (isProjectMember: ${isProjectMember})`);

    res.json({
      tasks,
      page,
      totalPages: Math.ceil(total / limit),
      total,
    });
  } catch (error) {
    console.error("Error fetching tasks:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ===========================================
// TASK GOAL CONTROLLERS
// ===========================================
export const getTaskGoals = async (req: RequestWithUser, res: Response) => {
  console.log("\n\n✅ [TaskGoals] Fetching task goals");
  console.log("➡ Chat ID:", req.params.chatId);

  try {
    const { chatId } = req.params;
    const goals = await TaskGoal.find({ chatId }).populate("createdBy", "name email");

    if (goals.length === 0) {
      console.log("⚠ No goals found for chat", chatId);
      return res.status(200).json([]);
    }

    console.log("✅ Found", goals.length, "goal(s)");
    res.json(goals);
  } catch (error) {
    console.error("🔥 ERROR FETCHING TASK GOALS:", error);
    res.status(500).json({ message: "Failed to load goals", error });
  }
};

export const createTaskGoal = async (req: RequestWithUser, res: Response) => {
  console.log("\n\n✅ [TaskGoals] Creating new goal");
  console.log("➡ Chat ID:", req.params.chatId);
  console.log("➡ Body:", req.body);

  try {
    const { chatId } = req.params;
    const { title, link } = req.body;

    if (!title || !link) {
      console.log("❌ Missing required fields");
      return res.status(400).json({ message: "title and link are required" });
    }

    const existing = await TaskGoal.findOne({ chatId });
    if (existing) {
      console.log("⚠ Goal already exists for chat", chatId);
      return res.status(400).json({ message: "Goal already exists for this chat" });
    }

    const goal = await TaskGoal.create({
      chatId,
      title,
      link,
      createdBy: req.user?.id,
    });

    console.log("✅ Goal created:", goal._id);
    io.to(chatId).emit("taskGoalCreated", goal);

    res.status(201).json(goal);
  } catch (error) {
    console.error("🔥 ERROR CREATING TASK GOAL:", error);
    res.status(500).json({ message: "Failed to create goal", error });
  }
};

export const updateTaskGoalStatus = async (req: RequestWithUser, res: Response) => {
  console.log("\n\n✅ [TaskGoals] Updating goal status");
  console.log("➡ Goal ID:", req.params.id);
  console.log("➡ New status:", req.body.status);

  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowed = ["pending", "correct", "fulfilled", "succeeded"];
    if (!allowed.includes(status)) {
      console.log("❌ Invalid status:", status);
      return res.status(400).json({ message: "Invalid status" });
    }

    const goal = await TaskGoal.findByIdAndUpdate(id, { status }, { new: true });
    if (!goal) {
      console.log("❌ Goal not found");
      return res.status(404).json({ message: "Goal not found" });
    }

    console.log("✅ Goal updated:", goal._id, "→", status);
    io.to(goal.chatId.toString()).emit("taskGoalUpdated", goal);

    res.json(goal);
  } catch (error) {
    console.error("🔥 ERROR UPDATING TASK GOAL:", error);
    res.status(500).json({ message: "Failed to update goal", error });
  }
};

// =====================
// Get Single Task by ID (with populated members)
// =====================
export const getTaskById = async (req: RequestWithUser, res: Response) => {
  try {
    const { taskId } = req.params;

    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    console.log("🔍 [GET TASK BY ID] Fetching task:", taskId);

    const task = await Task.findById(taskId)
      .populate("members", "name email role") // ✅ Populate members
      .populate("assignedTo", "name email")
      .populate("createdBy", "name email")
      .populate("project", "name");

    if (!task) {
      console.log("❌ Task not found");
      return res.status(404).json({ message: "Task not found" });
    }

    console.log("✅ Task found:", task._id);
    console.log("👥 Task members (raw):", task.members);
    console.log("👥 Task members (count):", task.members.length);

    // Check if user has access
    const isMember = task.members.some((m: any) => {
      const memberId = m._id ? m._id.toString() : m.toString();
      return memberId === req.user!.id;
    });
    const isCreator = task.createdBy.toString() === req.user!.id;

    if (!isMember && !isCreator) {
      console.log("❌ Access denied - user not a member or creator");
      return res.status(403).json({ message: "Access denied" });
    }

    console.log("✅ Returning task with", task.members.length, "populated members");
    res.json({ task });
  } catch (error) {
    console.error("Error fetching task:", error);
    res.status(500).json({ message: "Server error" });
  }
};