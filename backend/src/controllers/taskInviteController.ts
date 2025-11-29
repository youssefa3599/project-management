import { Request, Response } from "express";
import User from "../models/User";
import Task from "../models/Task";
import Project from "../models/Project";
import Notification from "../models/Notification";
import { io } from "../server";
import { logActivity } from "../utils/logActivity";

type RequestWithUser = Request & {
  user?: {
    id: string;
    name?: string;
    email: string;
    role?: "admin" | "editor" | "viewer";
  };
};

export const inviteUserToTaskChat = async (req: RequestWithUser, res: Response) => {
  console.log("====================================");
  console.log("📨 [DEBUG] inviteUserToTaskChat triggered");
  console.log("➡️ Request Body:", req.body);
  console.log("➡️ Request Params:", req.params);
  console.log("➡️ Authenticated User:", req.user);
  console.log("====================================");

  try {
    const { userId } = req.body;
    const { taskId } = req.params;
    const inviter = req.user;
    if (!inviter) return res.status(401).json({ message: "Not authenticated" });

    const invitedUser = await User.findById(userId);
    if (!invitedUser) return res.status(404).json({ message: "User not found" });

    const task = await Task.findById(taskId).populate("project");
    if (!task) return res.status(404).json({ message: "Task not found" });

    const project = task.project as any;
    if (!project) return res.status(404).json({ message: "Parent project not found" });

    console.log("🧭 [DEBUG] Project found:", project._id, project.name);

    const alreadyMember = project.members.some(
      (m: any) => m.user.toString() === invitedUser._id.toString()
    );

    if (!alreadyMember) {
      project.members.push({ user: invitedUser._id, role: "viewer" });
      await project.save();
      console.log(`👥 [DEBUG] Added ${invitedUser.name} as viewer to project`);
    }

    // 🔔 Create notification for invited user
    const notification = await Notification.create({
      user: invitedUser._id,
      message: `${inviter.name || "Someone"} invited you to a task chat`,
      taskId,
      projectId: project._id,
      type: "taskChatInvite",
      status: "pending",
      isRead: false,
    });

    // 📡 Emit Socket.IO events
    io.to(invitedUser._id.toString()).emit("projectAdded", {
      projectId: project._id,
      projectName: project.name,
      role: "viewer",
    });

    io.to(invitedUser._id.toString()).emit("taskUnlocked", {
      taskId,
      projectId: project._id,
      message: "You’ve been added to a task chat",
    });

    console.log("📡 [DEBUG] Emitted projectAdded + taskUnlocked to invited user");

    await logActivity({
      userId: inviter.id,
      action: "invite_user_task_chat",
      entityType: "Task",
      entityId: taskId,
      details: `Invited ${invitedUser.name} to task chat in project "${project.name}"`,
    });

    res.status(200).json({
      message: "Invitation sent successfully",
      invitedUser: { id: invitedUser._id, name: invitedUser.name },
      project: { id: project._id, name: project.name },
      taskId,
      notification,
    });
  } catch (error: any) {
    console.error("❌ [DEBUG] inviteUserToTaskChat error:", error);
    res.status(500).json({ message: "Failed to send invitation", error: error.message });
  }
};
