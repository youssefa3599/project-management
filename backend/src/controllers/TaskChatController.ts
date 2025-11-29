import { Request, Response } from "express";
import mongoose from "mongoose";
import Chat from "../models/Chat";
import Task, { ITask } from "../models/Task";
import Notification from "../models/Notification";
import User from "../models/User";
import { DecodedToken } from "../middlewares/authMiddleware";
import { io } from "../server";
import TaskGoal from "../models/TaskGoal";
import Project from "../models/Project";
import { logActivity } from "../utils/activityLogger";

type RequestWithUser = Request & { user?: DecodedToken };

// =====================
// Get user task chats
// =====================
export const getUserTaskChats = async (
  req: RequestWithUser,
  res: Response
): Promise<Response | void> => {
  console.log("\n\n✅ GET USER TASK CHATS");
  console.log("➡ User:", req.user?.id);

  try {
    const chats = await Chat.find({
      members: req.user!.id,
      taskId: { $exists: true },
    })
      .populate("members", "name email")
      .populate("createdBy", "name email")
      .sort({ updatedAt: -1 });

    console.log("✅ Returning", chats.length, "chats");
    return res.json({ chats });
  } catch (error) {
    console.error("🔥 ERROR GETTING USER TASK CHATS:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// =====================
// Get single chat
// =====================
export const getTaskChatById = async (
  req: RequestWithUser,
  res: Response
): Promise<Response | void> => {
  console.log("\n\n✅ GET TASK CHAT BY ID");
  console.log("➡ Chat ID:", req.params.chatId);

  try {
    const { chatId } = req.params;

    const chat = await Chat.findById(chatId)
      .populate("members", "name email")
      .populate("messages.sender", "name email")
      .populate("createdBy", "name email");

    if (!chat) {
      console.log("❌ Chat NOT FOUND");
      return res.status(404).json({ message: "Chat not found" });
    }

    console.log("✅ Found chat:", chat._id.toString());
    return res.json({ chat });
  } catch (error) {
    console.error("🔥 ERROR GETTING CHAT BY ID:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// =====================
// Invite member
// =====================
export const inviteMemberToTaskChat = async (req: RequestWithUser, res: Response) => {
  console.log("\n\n🎯 [DEBUG] INVITE MEMBER TO TASK CHAT");
  console.log("➡ Chat ID:", req.params.chatId);
  console.log("➡ Inviting user ID:", req.body.userId);

  try {
    const { chatId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      console.log("❌ [DEBUG] Missing userId in request body");
      return res.status(400).json({ message: "userId required" });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      console.log("❌ [DEBUG] Chat not found");
      return res.status(404).json({ message: "Chat not found" });
    }

    // Get invited user details
    const invitedUser = await User.findById(userId);
    if (!invitedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const notification = await Notification.create({
      user: userId,
      type: "taskChatInvite",
      message: `You've been invited to join the chat "${chat.name}"`,
      task: chat.taskId,
      status: "pending",
    });

    console.log("✅ [DEBUG] Notification created:", notification._id);

    // ✅ LOG ACTIVITY - Inviter's perspective
    await logActivity({
      userId: req.user!.id,
      action: "invited_to_chat",
      entityType: "chat",
      entityId: chat._id.toString(),
      description: `Invited ${invitedUser.name} to chat`,
      details: `Invited ${invitedUser.name} to join "${chat.name}"`,
      metadata: {
        chatName: chat.name,
        invitedUserId: userId,
        invitedUserName: invitedUser.name,
      },
    });

    // ✅ LOG ACTIVITY - Invitee's perspective
    await logActivity({
      userId: userId,
      action: "chat_invite_received",
      entityType: "chat",
      entityId: chat._id.toString(),
      description: `Received chat invite from ${req.user!.name}`,
      details: `You were invited to join "${chat.name}"`,
      metadata: {
        chatName: chat.name,
        invitedBy: req.user!.name,
        invitedById: req.user!.id,
      },
    });

    const targetRoom = userId.toString();
    io.to(targetRoom).emit("newNotification", notification);

    return res.status(201).json({
      message: "Invite sent successfully",
      notification,
    });
  } catch (error) {
    console.error("🔥 [DEBUG] ERROR in inviteMemberToTaskChat:", error);
    return res.status(500).json({ message: "Server error", error });
  }
};

// =====================
// Accept invite - FIXED (No project access + Emit member joined)
// =====================
export const acceptTaskChatInvite = async (req: RequestWithUser, res: Response) => {
  console.log("\n\n═══════════════════════════════════════════════════════");
  console.log("✅ [ACCEPT TASK CHAT INVITE]");
  console.log("➡ Chat ID:", req.params.chatId);
  console.log("➡ User ID:", req.user?.id);

  try {
    const { chatId } = req.params;
    const userId = req.user!.id.toString();

    const chat = await Chat.findById(chatId);
    if (!chat) {
      console.log("❌ Chat NOT FOUND in DB");
      return res.status(404).json({ message: "Chat not found" });
    }

    // ✅ 1. Add user to chat
    const isMember = chat.members?.some(m => m.toString() === userId);
    if (!isMember) {
      chat.members.push(new mongoose.Types.ObjectId(userId));
      await chat.save();
      console.log("✅ Added user to chat members:", userId);

      // ✅ LOG ACTIVITY - User joined chat
      await logActivity({
        userId: userId,
        action: "joined_chat",
        entityType: "chat",
        entityId: chat._id.toString(),
        description: `Joined chat "${chat.name}"`,
        details: `Accepted invite and joined the chat`,
        metadata: {
          chatName: chat.name,
        },
      });
    } else {
      console.log("ℹ️ User already in chat members");
    }

    // ✅ 2. Add user to TASK.MEMBERS (NOT project)
    const taskId = chat.taskId ? chat.taskId.toString() : undefined;
    if (!taskId) {
      console.log("⚠️ Chat has no linked taskId");
    } else {
      const task = await Task.findById(taskId);
      
      if (task) {
        console.log("🧾 Task before:", task.members.map((m: mongoose.Types.ObjectId) => m.toString()));

        const isTaskMember = task.members.some((m: mongoose.Types.ObjectId) => m.toString() === userId);
        
        if (!isTaskMember) {
          task.members.push(new mongoose.Types.ObjectId(userId));
          await task.save();
          console.log("✅ Added user to task.members (isolated access)");
        } else {
          console.log("ℹ️ User already in task.members");
        }

        const taskAfter = await Task.findById(taskId);
        console.log("🧾 Task after:", taskAfter?.members.map((m: mongoose.Types.ObjectId) => m.toString()));
      }
    }

    // ✅ 3. Emit events
    try {
      // Emit to the user who accepted
      io.to(userId).emit("taskInviteAccepted", { chatId, userId, taskId });
      console.log("✅ [SOCKET] taskInviteAccepted emitted to user");
      
      // ✅ Emit to task room so everyone sees new member
      if (taskId) {
        const taskRoom = `task_${taskId}`;
        io.to(taskRoom).emit("memberJoinedTaskChat", { userId, taskId });
        console.log(`✅ [SOCKET] memberJoinedTaskChat emitted to room: ${taskRoom}`);
      }
    } catch (e) {
      console.warn("❗ Socket emit failed:", e);
    }

    return res.json({ message: "✅ Joined task chat with isolated access" });
  } catch (error) {
    console.error("🔥 ERROR ACCEPTING TASK CHAT INVITE:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// =====================
// Leave chat
// =====================
export const leaveTaskChat = async (
  req: RequestWithUser,
  res: Response
): Promise<Response | void> => {
  console.log("\n\n✅ LEAVE TASK CHAT");
  console.log("➡ Chat:", req.params.chatId);

  try {
    const { chatId } = req.params;

    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    chat.members = chat.members.filter((m) => m.toString() !== req.user!.id);
    await chat.save();

    // ✅ LOG ACTIVITY - User left chat
    await logActivity({
      userId: req.user.id,
      action: "left_chat",
      entityType: "chat",
      entityId: chat._id.toString(),
      description: `Left chat "${chat.name}"`,
      details: `You left the chat`,
      metadata: {
        chatName: chat.name,
      },
    });

    chat.members.forEach((m) => {
      try {
        io.to(m.toString()).emit("memberLeftTaskChat", {
          chatId: chat._id,
          userId: req.user!.id,
        });
      } catch (socketErr) {
        console.warn("❗ Socket emit failed:", socketErr);
      }
    });

    return res.json({ message: "Left task chat successfully" });
  } catch (error) {
    console.error("🔥 ERROR LEAVING CHAT:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// ===========================================
// TASK GOAL CONTROLLERS
// ===========================================
export const getTaskGoals = async (
  req: RequestWithUser,
  res: Response
): Promise<Response | void> => {
  try {
    const { chatId } = req.params;
    console.log(`✅ [TaskGoals] Fetching goals for chatId: ${chatId}`);
    const goals = await TaskGoal.find({ chatId }).populate("createdBy", "name email");
    console.log(`✅ [TaskGoals] Found ${goals.length} goals for chatId ${chatId}`);
    return res.json(goals || []);
  } catch (error) {
    console.error("🔥 ERROR FETCHING TASK GOALS:", error);
    return res.status(500).json({ message: "Failed to load goals", error });
  }
};

export const createTaskGoal = async (
  req: RequestWithUser,
  res: Response
): Promise<Response | void> => {
  try {
    const { chatId } = req.params;
    const { title, link } = req.body;

    if (!title || !link) {
      return res.status(400).json({ message: "title and link are required" });
    }

    const existing = await TaskGoal.findOne({ chatId });
    if (existing) {
      return res.status(400).json({ message: "Goal already exists for this chat" });
    }

    const goal = await TaskGoal.create({
      chatId,
      title,
      link,
      createdBy: req.user?.id,
    });

    // ✅ LOG ACTIVITY - Goal created
    await logActivity({
      userId: req.user!.id,
      action: "created_goal",
      entityType: "goal",
      entityId: (goal._id as mongoose.Types.ObjectId).toString(),
      description: `Created goal "${title}"`,
      details: `Created a new goal with link: ${link}`,
      metadata: {
        goalTitle: title,
        goalLink: link,
        chatId: chatId,
      },
    });

    try {
      io.to(chatId).emit("taskGoalCreated", goal);
    } catch (socketErr) {
      console.warn("❗ Socket emit failed:", socketErr);
    }

    return res.status(201).json(goal);
  } catch (error) {
    console.error("🔥 ERROR CREATING TASK GOAL:", error);
    return res.status(500).json({ message: "Failed to create goal", error });
  }
};

export const updateTaskGoalStatus = async (
  req: RequestWithUser,
  res: Response
): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowed = ["pending", "correct", "fulfilled", "succeeded"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const goal = await TaskGoal.findByIdAndUpdate(id, { status }, { new: true });
    if (!goal) {
      return res.status(404).json({ message: "Goal not found" });
    }

    // ✅ LOG ACTIVITY - Goal status updated
    await logActivity({
      userId: req.user!.id,
      action: "updated_goal_status",
      entityType: "goal",
      entityId: (goal._id as mongoose.Types.ObjectId).toString(),
      description: `Updated goal status to "${status}"`,
      details: `Changed goal "${goal.title}" status to ${status}`,
      metadata: {
        goalTitle: goal.title,
        oldStatus: goal.status,
        newStatus: status,
      },
    });

    try {
      io.to(goal.chatId.toString()).emit("taskGoalUpdated", goal);
    } catch (socketErr) {
      console.warn("❗ Socket emit failed:", socketErr);
    }

    return res.json(goal);
  } catch (error) {
    console.error("🔥 ERROR UPDATING TASK GOAL:", error);
    return res.status(500).json({ message: "Failed to update goal", error });
  }
};

// =============================
// GET TASK MESSAGES
// =============================
export const getTaskMessages = async (
  req: RequestWithUser,
  res: Response
): Promise<Response | void> => {
  console.log("\n\n✅ [GET TASK MESSAGES]");
  console.log("➡ Task ID:", req.params.id);

  try {
    const { id: taskId } = req.params;

    let chat = await Chat.findOne({ taskId }).populate("messages.sender", "name email");

    if (!chat) {
      console.log("⚠ No chat found → creating");
      const task = await Task.findById(taskId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      chat = await Chat.create({
        taskId,
        name: `${task.title} Chat`,
        members: [task.createdBy, ...(task.assignedTo ? [task.assignedTo] : [])],
        createdBy: req.user?.id || task.createdBy,
        messages: [],
      });
    }

    console.log(`✅ Returning ${chat.messages?.length || 0} messages`);
    return res.status(200).json(chat.messages || []);
  } catch (error) {
    console.error("🔥 ERROR GETTING TASK MESSAGES:", error);
    return res.status(500).json({ message: "Failed", error });
  }
};

// =============================
// ADD TASK MESSAGE (WITH ACTIVITY LOGGING & MENTIONS)
// =============================
export const addTaskMessage = async (
  req: RequestWithUser,
  res: Response
): Promise<Response | void> => {
  console.log("\n\n💬 [ADD TASK MESSAGE]");
  console.log("➡ Task ID:", req.params.id);
  console.log("➡ User ID:", req.user?.id);
  console.log("➡ User Name:", req.user?.name);
  console.log("➡ Content:", req.body.content);

  try {
    const { id: taskId } = req.params;
    const { content } = req.body;

    if (!content) {
      console.log("❌ No content provided");
      return res.status(400).json({ message: "Message content is required" });
    }

    let chat = await Chat.findOne({ taskId });

    if (!chat) {
      console.log("⚠️ Chat not found → creating new chat");
      const task = await Task.findById(taskId);
      if (!task) {
        console.log("❌ Task not found");
        return res.status(404).json({ message: "Task not found" });
      }

      chat = await Chat.create({
        taskId,
        name: `${task.title} Chat`,
        members: [task.createdBy, ...(task.assignedTo ? [task.assignedTo] : [])],
        createdBy: req.user?.id || task.createdBy,
        messages: [],
      });
      console.log("✅ Chat created:", chat._id);
    }

    const message = {
      sender: new mongoose.Types.ObjectId(req.user!.id),
      content,
      createdAt: new Date(),
    };

    chat.messages.push(message as any);
    await chat.save();
    console.log("💾 Message saved to database");

    const task = await Task.findById(taskId);
    const taskTitle = task ? task.title : "Unknown Task";

    // ======================
    // LOG ACTIVITY
    // ======================
    await logActivity({
      userId: req.user!.id,
      action: "sent_message",
      entityType: "message",
      entityId: chat._id.toString(),
      description: `Sent message in "${taskTitle}"`,
      details: content.length > 100 ? content.substring(0, 100) + "..." : content,
      metadata: {
        taskId: taskId,
        taskTitle: taskTitle,
        chatId: chat._id.toString(),
        messageLength: content.length,
      },
    });

    // ========================================================
    // 🔍 SUPER DEBUG VERSION — MENTION DETECTION & NOTIFICATIONS
    // ========================================================
   // In TaskChatController.ts - addTaskMessage function
// Replace the mention detection section with this:

// ✅ DETECT @MENTIONS AND CREATE NOTIFICATIONS + ACTIVITY LOGS
console.log("🔍 [MENTION CHECK] Checking for mentions in message...");

// 🔥 FIX: Support names with spaces
// Old regex: /@(\w+)/g  ← Only matches single words
// New regex: Matches @name or @"full name with spaces"
const mentionMatches = content.match(/@"([^"]+)"|@(\S+)/g) || [];

console.log("🔍 Raw content:", content);
console.log("🔍 Regex raw matches:", mentionMatches);

if (mentionMatches.length > 0) {
  console.log("📢 [MENTIONS] Found mentions:", mentionMatches);
  
  for (const match of mentionMatches) {
    // Extract username - handle both @name and @"name with spaces"
    let username: string;
    
    if (match.startsWith('@"')) {
      // @"full name" format
      username = match.slice(2, -1); // Remove @" and trailing "
    } else {
      // @name format
      username = match.slice(1); // Remove @
    }
    
    console.log("─────────────────────────────────────────────────────");
    console.log(`🔍 [MENTION] Processing token: ${match}`);
    console.log(`➡ Extracted username: "${username}"`);
    console.log(`🔎 Looking for user "${username}" in DB...`);
    
    // Find the mentioned user by name (exact match, case-insensitive)
    const mentionedUser = await User.findOne({ 
      name: { $regex: new RegExp(`^${username}$`, 'i') } 
    });
    
    if (!mentionedUser) {
      console.warn(`❌ User "${username}" NOT FOUND.`);
      continue;
    }
    
    console.log(`✅ User "${username}" FOUND!`);
    console.log(`   → User ID: ${mentionedUser._id}`);
    console.log(`   → User email: ${mentionedUser.email}`);
    
    // Don't notify if user mentions themselves
    if (mentionedUser._id.toString() === req.user!.id) {
      console.log(`ℹ️ [MENTION] Skipping self-mention`);
      continue;
    }
    
    console.log(`✅ [MENTION] Found user: ${mentionedUser.name} (${mentionedUser._id})`);
    
    // Create notification in database
    try {
      const notification = await Notification.create({
        user: mentionedUser._id,
        type: "mention",
        message: `${req.user!.name} mentioned you in chat: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`,
        task: taskId,
        status: "pending",
        isRead: false
      });
      
      console.log("📝 [NOTIFICATION] Created notification:", notification._id);
      console.log("   → Recipient:", mentionedUser._id.toString());
      console.log("   → Type:", notification.type);
      console.log("   → Message:", notification.message);

      // ✅ LOG ACTIVITY - Mentioned user's perspective
      await logActivity({
        userId: mentionedUser._id.toString(),
        action: "mentioned",
        entityType: "mention",
        entityId: chat._id.toString(),
        description: `${req.user!.name} mentioned you`,
        details: `You were mentioned in "${taskTitle}": ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`,
        metadata: {
          mentionedBy: req.user!.name,
          mentionedById: req.user!.id,
          taskId: taskId,
          taskTitle: taskTitle,
          messageContent: content,
        },
      });

      // ✅ LOG ACTIVITY - Mentioner's perspective
      await logActivity({
        userId: req.user!.id,
        action: "mentioned_user",
        entityType: "mention",
        entityId: chat._id.toString(),
        description: `Mentioned @${mentionedUser.name}`,
        details: `You mentioned ${mentionedUser.name} in "${taskTitle}"`,
        metadata: {
          mentionedUser: mentionedUser.name,
          mentionedUserId: mentionedUser._id.toString(),
          taskId: taskId,
          taskTitle: taskTitle,
        },
      });
      
      // Emit notification via Socket.IO
      if (io) {
        const notificationPayload = {
          _id: notification._id,
          type: notification.type,
          message: notification.message,
          task: notification.task,
          status: notification.status,
          isRead: notification.isRead,
          createdAt: notification.createdAt,
          user: notification.user
        };
        
        const recipientUserId = mentionedUser._id.toString();
        console.log("📡 [SOCKET] Emitting to room:", recipientUserId);
        
        io.to(recipientUserId).emit("newNotification", notificationPayload);
        console.log("✅ [SOCKET] Notification emitted to user:", recipientUserId);
        
        // Also emit a mention-specific event
        io.to(recipientUserId).emit("mentionNotification", {
          senderName: req.user!.name,
          taskId,
          message: content
        });
        console.log("✅ [SOCKET] Mention notification emitted");
      } else {
        console.error("❌ [SOCKET] io instance not available!");
      }
    } catch (notifError) {
      console.error("❌ [NOTIFICATION] Failed to create notification:", notifError);
    }
  }
  
  console.log("✅ [MENTION CHECK] All mentions processed");
} else {
  console.log("ℹ️ [MENTION CHECK] No mentions found in message");
}
    // ======================
    // BROADCAST MESSAGE TO TASK ROOM
    // ======================
    const taskRoom = `task_${taskId}`;
    const emittedMessage = {
      _id: message.sender.toString(),
      sender: {
        _id: req.user!.id,
        id: req.user!.id,
        name: req.user!.name || "Unknown",
        email: req.user!.email,
      },
      content,
      createdAt: message.createdAt,
    };

    try {
      io.to(taskRoom).emit("newTaskMessage", emittedMessage);
      console.log("📡 Message emitted to room:", taskRoom);
    } catch (socketErr) {
      console.error("❌ SOCKET EMIT ERROR:", socketErr);
    }

    return res.status(201).json(emittedMessage);

  } catch (error) {
    console.error("🔥 ERROR ADDING MESSAGE:", error);
    return res.status(500).json({ message: "Failed to add message", error });
  }
};
