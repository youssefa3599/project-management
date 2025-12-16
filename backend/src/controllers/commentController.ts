import { Request, Response } from "express";
import Comment from "../models/Comment";
import Task from "../models/Task";
import User, { IUser } from "../models/User";
import Notification from "../models/Notification";
import { getCache, clearCache } from "../utils/cache";
import { sendEmail } from "../utils/mailer";
import { paginateQuery } from "../utils/paginate";
import { logActivity } from "../utils/logActivity";

/* =========================
   💬 Create Comment (WITH NOTIFICATION CREATION)
   ========================= */
export const createComment = async (req: Request, res: Response) => {
  console.log("\n\n💬 [CREATE COMMENT] Starting process...");
  console.log("═══════════════════════════════════════════════════════");
  
  try {
    const { text, taskId } = req.body;
    const userId = req.user?.id;
    const userName = req.user?.name || "Someone";

    console.log("📝 [COMMENT] Data received:");
    console.log("   → User ID:", userId);
    console.log("   → User Name:", userName);
    console.log("   → Task ID:", taskId);
    console.log("   → Comment Text:", text);

    if (!userId) {
      console.error("❌ [COMMENT] Unauthorized - no user ID");
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    if (!text || !taskId) {
      console.error("❌ [COMMENT] Missing required fields");
      return res.status(400).json({ message: "Text and taskId are required" });
    }

    // Validate task exists
    const task = await Task.findById(taskId).populate("project");
    if (!task) {
      console.error("❌ [COMMENT] Task not found:", taskId);
      return res.status(404).json({ message: "Task not found" });
    }

    console.log("✅ [COMMENT] Task found:", task.title);

    // Create comment
    const comment = await Comment.create({ text, task: taskId, user: userId });
    console.log("✅ [COMMENT] Comment created:", comment._id);

    // Clear cache
    await clearCache(`comments:task:${taskId}`);

    // ═══════════════════════════════════════════════════════
    // 🎯 CRITICAL FIX: Handle mentions + CREATE NOTIFICATIONS
    // ═══════════════════════════════════════════════════════
    const mentionMatches = text.match(/@(\w+)/g) || [];
    
    console.log("📢 [MENTION DETECTION] Checking for mentions...");
    console.log("   → Found mentions:", mentionMatches);

    if (mentionMatches.length > 0) {
      // Get Socket.IO instance safely
      const io = (req as any).app?.get?.("io");
      
      if (!io) {
        console.error("❌ [MENTION] Socket.IO instance not found!");
        console.error("   → Cannot emit real-time notifications");
        console.error("   → Notifications will still be created in database");
      }

      for (const match of mentionMatches) {
        const username = match.replace("@", "");
        console.log(`🔍 [MENTION] Processing: ${match} (username: ${username})`);
        
        const mentionedUser = (await User.findOne({ name: username })) as IUser | null;

        if (!mentionedUser) {
          console.warn(`⚠️ [MENTION] User not found: ${username}`);
          continue;
        }

        if (mentionedUser._id.toString() === userId) {
          console.log(`ℹ️ [MENTION] Skipping self-mention: ${username}`);
          continue;
        }

        console.log(`✅ [MENTION] Found user: ${mentionedUser.name} (${mentionedUser._id})`);

        // ═══════════════════════════════════════════════════════
        // 🔥 CRITICAL FIX: CREATE NOTIFICATION WITH taskId
        // ═══════════════════════════════════════════════════════
        try {
          const notification = await Notification.create({
            user: mentionedUser._id,
            type: "mention",
            message: `${userName} mentioned you in a comment: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`,
            task: taskId,
            taskId: taskId,  // ← CRITICAL: Frontend needs this field
            status: "pending",
            isRead: false
          });

          console.log("📝 [MENTION] ✅ Notification created in database:");
          console.log("   → Notification ID:", notification._id);
          console.log("   → Type:", notification.type);
          console.log("   → Recipient:", mentionedUser._id);
          console.log("   → task field:", notification.task);
          console.log("   → taskId field:", taskId);
          console.log("   → 🎯 BOTH task AND taskId included!");

          // ═══════════════════════════════════════════════════════
          // 📡 CRITICAL FIX: Emit Socket.IO with taskId
          // ═══════════════════════════════════════════════════════
          if (io) {
            const mentionedUserId = mentionedUser._id.toString();
            
            console.log("📡 [SOCKET EMIT] Preparing notification payload...");
            
            const socketPayload = {
              _id: notification._id.toString(),
              type: notification.type,
              message: notification.message,
              task: notification.task,
              taskId: taskId,  // ← CRITICAL: Frontend needs this
              status: notification.status,
              isRead: notification.isRead,
              createdAt: notification.createdAt,
              user: notification.user
            };

            console.log("📦 [SOCKET PAYLOAD]:", JSON.stringify(socketPayload, null, 2));
            
            // Emit to user's personal room
            io.to(mentionedUserId).emit("newNotification", socketPayload);

            console.log("✅ [SOCKET EMIT] Notification emitted to user:", mentionedUserId);
            console.log("   → Room: ", mentionedUserId);
            console.log("   → Event: newNotification");
            console.log("   → Payload includes taskId: ✅");
          }

          // ═══════════════════════════════════════════════════════
          // 📧 Send email notification (optional)
          // ═══════════════════════════════════════════════════════
          if (mentionedUser.email) {
            try {
              await sendEmail({
                to: mentionedUser.email,
                subject: `💬 ${userName} mentioned you in a comment`,
                html: `
                  <div style="font-family: Arial, sans-serif; line-height: 1.5;">
                    <p><b>${userName}</b> mentioned you in a comment:</p>
                    <blockquote style="border-left: 3px solid #ccc; padding-left: 10px; color: #555;">
                      ${text}
                    </blockquote>
                    <p><a href="https://yourfrontend.com/tasks/${taskId}" style="color: #2563eb;">View Task</a></p>
                  </div>
                `,
              });
              console.log("📧 [EMAIL] Mention notification email sent to:", mentionedUser.email);
            } catch (emailError) {
              console.error("❌ [EMAIL] Failed to send email:", emailError);
              // Continue even if email fails
            }
          }

        } catch (notifError) {
          console.error("❌ [MENTION] Failed to create notification:", notifError);
          console.error("   Error details:", notifError);
          // Continue processing other mentions
        }
      }

      console.log("✅ [MENTION DETECTION] All mentions processed");
    } else {
      console.log("ℹ️ [MENTION DETECTION] No mentions found in comment");
    }

    // ═══════════════════════════════════════════════════════
    // 📡 Emit comment to project room (for real-time updates)
    // ═══════════════════════════════════════════════════════
    const io = (req as any).app?.get?.("io");
    if (io && task.project) {
      io.to(task.project.toString()).emit("commentCreated", comment);
      console.log("📡 [SOCKET] Comment emitted to project room:", task.project.toString());
    }

    // ═══════════════════════════════════════════════════════
    // 📋 Log activity
    // ═══════════════════════════════════════════════════════
    await logActivity({
      userId,
      action: "create_comment",
      entityType: "comment",
      entityId: comment._id.toString(),
      details: `Added a comment on task ${taskId}: "${text}"`,
    });

    console.log("═══════════════════════════════════════════════════════");
    console.log("✅ [CREATE COMMENT] Process completed successfully");
    console.log("═══════════════════════════════════════════════════════\n\n");

    res.status(201).json({ 
      message: "Comment added successfully", 
      comment,
      mentionsProcessed: mentionMatches.length
    });

  } catch (error: any) {
    console.error("═══════════════════════════════════════════════════════");
    console.error("❌ [CREATE COMMENT ERROR]:", error);
    console.error("═══════════════════════════════════════════════════════");
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

/* =========================
   📄 Get Comments for a Task (WITH PAGINATION)
   ========================= */
export const getCommentsByTask = async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    if (!taskId) return res.status(400).json({ message: "Task ID is required" });

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const { skip, limit: safeLimit, page: safePage } = paginateQuery(page, limit);

    const [comments, total] = await Promise.all([
      Comment.find({ task: taskId })
        .populate("user", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .lean(),
      Comment.countDocuments({ task: taskId }),
    ]);

    // 🔹 Log activity
    if (req.user?.id) {
      await logActivity({
        userId: req.user.id,
        action: "fetch_comments",
        entityType: "comment",
        details: `Fetched comments for task ${taskId}, page ${safePage}, limit ${safeLimit}`,
        entityId: taskId,
      });
    }

    res.json({
      data: comments,
      pagination: {
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit),
      },
    });
  } catch (error: any) {
    console.error("Error fetching comments:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};