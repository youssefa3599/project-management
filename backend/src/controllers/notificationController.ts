import { Request, Response } from "express";
import mongoose, { Types } from "mongoose";
import Notification from "../models/Notification";
import Task, { ITask } from "../models/Task";
import Project, { IProject } from "../models/Project";
import Chat, { IChat } from "../models/Chat";
import { DecodedToken } from "../middlewares/authMiddleware";
import { logActivity } from "../utils/activityLogger";

type RequestWithUser = Request & { user?: DecodedToken };

/* =========================
   🎯 Create Notification
   ========================= */
export const createNotification = async (req: RequestWithUser, res: Response) => {
  console.log("═══════════════════════════════════════════════════════");
  console.log("🔔 [CREATE NOTIFICATION] Starting process...");
  console.log("═══════════════════════════════════════════════════════");

  try {
    const userId = req.body.userId || req.body.user;
    const { type, message, task, project, taskId } = req.body;

    if (!userId || !type || !message) {
      console.error("❌ [VALIDATION] Missing required fields!");
      return res.status(400).json({
        message: "Missing required fields: userId (or user), type, message",
        received: { userId, type, message, task, project },
      });
    }

    const notification = new Notification({
      user: userId,
      type,
      message,
      task: task || undefined,
      taskId: taskId || task || undefined,
      project: project || undefined,
      status: "pending",
      isRead: false, // ✅ CRITICAL: Explicitly set to false
    });

    await notification.save();
    console.log("✅ [STEP 3] Notification saved to database →", notification._id);
    console.log("   → isRead:", notification.isRead);
    console.log("   → status:", notification.status);

    // ✅ Get Socket.IO instance safely
    const io = (req as any).app?.get?.("io");
    
    console.log("📡 [SOCKET EMISSION] Attempting to emit to user:", userId);
    
    if (!io) {
      console.error("❌ [SOCKET ERROR] io instance is undefined!");
      return res.status(201).json({
        message: "Notification created but socket emission failed - io undefined",
        notification,
      });
    }

    const userIdString = userId.toString();
    
    // ✅ Emit to the specific user's room
    try {
      console.log(`📤 [SOCKET] Emitting to room: "${userIdString}"`);
      
      // Emit the notification with all necessary fields
      const notificationPayload = {
        _id: notification._id,
        user: notification.user,
        type: notification.type,
        message: notification.message,
        task: notification.task,
        taskId: notification.taskId || notification.task,
        project: notification.project,
        status: notification.status,
        isRead: notification.isRead,
        createdAt: notification.createdAt,
      };
      
      io.to(userIdString).emit("newNotification", notificationPayload);
      console.log("✅ [SOCKET EMIT] newNotification emitted successfully!");
      console.log("   → Payload:", JSON.stringify(notificationPayload, null, 2));
      
      // Also verify the room exists
      const socketsInRoom = await io.in(userIdString).fetchSockets();
      console.log(`   → Sockets in room "${userIdString}": ${socketsInRoom.length}`);
      
    } catch (emitError) {
      console.error("❌ [SOCKET ERROR] Failed to emit notification:", emitError);
    }

    res.status(201).json({
      message: "Notification created successfully",
      notification,
    });
  } catch (error: any) {
    console.error("❌ [ERROR] createNotification:", error);
    res.status(500).json({
      message: "Failed to create notification",
      error: error.message,
    });
  }
};

/* =========================
   📋 Get User Notifications
   ========================= */
export const getUserNotifications = async (req: RequestWithUser, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized: Missing user ID" });

    const notifications = await Notification.find({ user: userId }).sort({ createdAt: -1 });

    console.log(`📊 [GET NOTIFICATIONS] Found ${notifications.length} notifications for user ${userId}`);
    const unreadCount = notifications.filter(n => !n.isRead).length;
    console.log(`   → Unread: ${unreadCount}`);

    res.status(200).json({ data: notifications });
  } catch (error: any) {
    console.error("❌ [ERROR] Fetching notifications:", error);
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
};

/* =========================
   ✅ Mark Notification as Read
   ========================= */
export const markNotificationAsRead = async (req: RequestWithUser, res: Response) => {
  try {
    const { id } = req.params;
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    console.log(`📖 [MARK AS READ] Notification: ${id}, User: ${req.user.id}`);

    const notification = await Notification.findById(new mongoose.Types.ObjectId(id));
    if (!notification) return res.status(404).json({ message: "Notification not found" });

    if (notification.user.toString() !== req.user.id)
      return res.status(403).json({ message: "Forbidden: You can only mark your own notifications as read" });

    // Only update if not already read
    if (!notification.isRead) {
      notification.isRead = true;
      await notification.save();
      console.log(`✅ [MARK AS READ] Notification ${id} marked as read`);

      // ✅ Get Socket.IO instance safely
      const io = (req as any).app?.get?.("io");
      if (io) {
        const notificationPayload = {
          _id: notification._id,
          user: notification.user,
          type: notification.type,
          message: notification.message,
          task: notification.task,
          taskId: notification.taskId,
          project: notification.project,
          status: notification.status,
          isRead: notification.isRead,
          createdAt: notification.createdAt,
        };
        
        console.log(`📤 [SOCKET] Emitting notificationUpdated to user ${req.user.id}`);
        io.to(req.user.id).emit("notificationUpdated", notificationPayload);
      }
    } else {
      console.log(`ℹ️ [MARK AS READ] Notification ${id} already read`);
    }

    res.status(200).json({ message: "Notification marked as read", notification });
  } catch (error: any) {
    console.error("❌ Error marking notification as read:", error);
    res.status(500).json({ message: "Failed to mark notification as read", error: error.message });
  }
};

/* =========================
   ✅ Mark ALL Notifications as Read (Bulk)
   ========================= */
export const markAllNotificationsAsRead = async (req: RequestWithUser, res: Response) => {
  console.log("═══════════════════════════════════════════════════════");
  console.log("📚 [MARK ALL AS READ] Starting process...");
  console.log("═══════════════════════════════════════════════════════");

  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    const userId = req.user.id;

    // Find all unread notifications
    const unreadNotifications = await Notification.find({
      user: userId,
      isRead: false,
    });

    const unreadCount = unreadNotifications.length;
    console.log(`📊 [MARK ALL] Found ${unreadCount} unread notifications for user ${userId}`);

    if (unreadCount === 0) {
      console.log("ℹ️ [MARK ALL] No unread notifications to mark");
      return res.status(200).json({
        message: "No unread notifications",
        count: 0,
      });
    }

    // Bulk update all to isRead: true
    const result = await Notification.updateMany(
      { user: userId, isRead: false },
      { $set: { isRead: true } }
    );

    console.log(`✅ [MARK ALL] Marked ${result.modifiedCount} notifications as read`);

    // ✅ Get Socket.IO instance safely
    const io = (req as any).app?.get?.("io");
    if (io) {
      // Emit event to user that all notifications are read
      io.to(userId).emit("notificationsMarkedRead", {
        count: unreadCount,
      });
      console.log("📡 [SOCKET] Emitted notificationsMarkedRead event");
    }

    res.status(200).json({
      message: "All notifications marked as read",
      count: result.modifiedCount,
    });
  } catch (error: any) {
    console.error("❌ [ERROR] markAllNotificationsAsRead:", error);
    res.status(500).json({
      message: "Failed to mark all notifications as read",
      error: error.message,
    });
  }
};

/* =========================
   🗑️ Delete Notification
   ========================= */
export const deleteNotification = async (req: RequestWithUser, res: Response) => {
  try {
    const { id } = req.params;
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    const notification = await Notification.findById(new mongoose.Types.ObjectId(id));
    if (!notification) return res.status(404).json({ message: "Notification not found" });

    if (notification.user.toString() !== req.user.id)
      return res.status(403).json({ message: "Forbidden: You can only delete your own notifications" });

    await Notification.findByIdAndDelete(notification._id);

    // ✅ Get Socket.IO instance safely
    const io = (req as any).app?.get?.("io");
    if (io) {
      io.to(req.user.id).emit("notificationDeleted", { notificationId: id });
    }

    res.status(200).json({ message: "Notification deleted successfully" });
  } catch (error: any) {
    console.error("❌ Error deleting notification:", error);
    res.status(500).json({ message: "Failed to delete notification", error: error.message });
  }
};

/* =========================
   🎯 Respond to Notification (Accept/Decline)
   ✅ FIXED: Only adds to TASK.MEMBERS, NOT project.members
   ========================= */
export const respondToNotification = async (req: RequestWithUser, res: Response) => {
  console.log("====================================");
  console.log("📩 [DEBUG] Respond to Notification triggered");
  console.log("➡️ Params:", req.params);
  console.log("➡️ Body:", req.body);
  console.log("➡️ Authenticated User:", req.user);
  console.log("====================================");

  try {
    const { id } = req.params;
    const { response } = req.body;

    if (!req.user) {
      console.log("❌ [DEBUG] Unauthorized request (no user)");
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!["accept", "decline"].includes(response)) {
      console.log("⚠️ [DEBUG] Invalid response value:", response);
      return res.status(400).json({ message: "Invalid response. Must be 'accept' or 'decline'." });
    }

    const notification = await Notification.findById(id)
      .populate("task")
      .populate("project");

    if (!notification) {
      console.log("❌ [DEBUG] Notification not found:", id);
      return res.status(404).json({ message: "Notification not found" });
    }

    if (notification.user.toString() !== req.user.id) {
      console.log(`❌ [DEBUG] User ${req.user.id} is not authorized to respond to notification ${id}`);
      return res.status(403).json({ message: "Forbidden: Not your notification." });
    }

    notification.status = response === "accept" ? "accepted" : "declined";
    notification.isRead = true; // ✅ Mark as read when responding

    /* ------------------------------------------------
     * ✅ ACCEPT: taskChatInvite → add to TASK.MEMBERS + CHAT only
     * ❌ REMOVED: No longer adds to project.members
     * ------------------------------------------------ */
    let fullTask: any = null;
    let fullProject: any = null;

    if (response === "accept" && notification.type === "taskChatInvite") {
      const taskId =
        typeof notification.task === "object" && notification.task && "_id" in notification.task
          ? (notification.task as any)._id
          : notification.task;

      const task = taskId ? await Task.findById(taskId).populate("project") : null;

      if (!task) {
        console.log("❌ [DEBUG] Task not found for notification");
      } else {
        console.log("📋 [DEBUG] Found Task:", task._id);

        const userObjectId = new mongoose.Types.ObjectId(req.user.id);

        // ✅ 1. Add user to TASK.MEMBERS (isolated task access)
        const isTaskMember = task.members.some(
          (m: mongoose.Types.ObjectId) => m.toString() === req.user!.id
        );

        if (!isTaskMember) {
          task.members.push(userObjectId);
          await task.save();
          console.log("✅ [DEBUG] User added to task.members (isolated access)");
        } else {
          console.log("ℹ️ [DEBUG] User already a task member");
        }

        // ❌ REMOVED: NO LONGER ADDING TO PROJECT.MEMBERS
        // User will only see this project because they're a task member
        console.log("⚠️ [DEBUG] NOT adding user to project.members (task-only access)");

        // ✅ 2. Add user to chat
        let chat = await Chat.findOne({ taskId: task._id });
        if (chat) {
          const isChatMember = chat.members.some(
            (m: any) => m.toString() === req.user!.id.toString()
          );

          if (!isChatMember) {
            chat.members.push(userObjectId);
            await chat.save();
            console.log("✅ [DEBUG] User added to chat");

            // ✅ Get Socket.IO instance safely
            const io = (req as any).app?.get?.("io");
            if (io) {
              io.to((chat._id as mongoose.Types.ObjectId).toString()).emit("memberJoinedTaskChat", {
                chatId: (chat._id as mongoose.Types.ObjectId).toString(),
                userId: req.user.id,
              });
            }
          } else {
            console.log("ℹ️ [DEBUG] User already in chat");
          }
        } else {
          console.log("⚠️ [DEBUG] No chat found for this task — creating new one...");
          chat = await Chat.create({
            taskId: task._id,
            name: `${task.title} Chat`,
            members: [userObjectId],
            createdBy: userObjectId,
          });
          console.log("✅ [DEBUG] New chat created:", chat._id);
        }

        // ✅ Fetch project info (for display purposes, NOT membership)
        const projectId =
          typeof task.project === "object" && task.project && "_id" in task.project
            ? (task.project as any)._id
            : task.project;

        fullProject = await Project.findById(projectId)
          .populate("createdBy", "name email")
          .populate("members.user", "name email");

        fullTask = await Task.findById(taskId)
          .populate("project")
          .populate("createdBy", "name email")
          .populate("assignedTo", "name email");
      }
    }

    await notification.save();
    console.log("💾 [DEBUG] Notification saved:", notification._id);

    // ✅ Get Socket.IO instance safely and emit complete data
    const io = (req as any).app?.get?.("io");
    
    if (io) {
      const socketPayload = {
        _id: notification._id,
        status: notification.status,
        type: notification.type,
        message: notification.message,
        taskId: fullTask?._id || notification.task,
        projectId: fullProject?._id || notification.project,
        project: fullProject || notification.project,
        task: fullTask || notification.task,
        user: notification.user,
        createdAt: notification.createdAt,
        isRead: notification.isRead
      };

      console.log("📡 [SOCKET] Emitting notificationUpdated with full data");
      io.to(notification.user.toString()).emit("notificationUpdated", socketPayload);
    }

    await logActivity({
      userId: req.user.id,
      action: 'notification_response',
      entityType: 'notification',
      entityId: notification._id.toString(),
      description: `User responded to notification`,
      details: `User responded '${response}' to notification (task-only access).`,
    });

    const responsePayload: any = {
      success: true,
      message: `Notification ${response === "accept" ? "accepted" : "declined"}`,
      notification: {
        _id: notification._id,
        status: notification.status,
        type: notification.type,
        projectId: fullProject?._id || notification.project,
        taskId: fullTask?._id || notification.task
      },
      project: fullProject,
      task: fullTask
    };

    console.log("✅ [RESPONSE] Sending response with project and task data");
    res.status(200).json(responsePayload);
  } catch (error: any) {
    console.error("❌ [DEBUG] Error responding to notification:", error);
    res.status(500).json({
      message: "Failed to respond to notification",
      error: error.message,
    });
  }
};