// backend/src/controllers/activityController.ts
import { Request, Response } from "express";
import ActivityLog from "../models/ActivityLog";
import { DecodedToken } from "../middlewares/authMiddleware";

type RequestWithUser = Request & { user?: DecodedToken };

/* =========================
   📋 Get User Activities
   ========================= */
export const getUserActivities = async (req: RequestWithUser, res: Response) => {
  console.log("═══════════════════════════════════════════════════════");
  console.log("📋 [GET ACTIVITIES] Request received");
  
  try {
    const userId = req.user?.id;
    if (!userId) {
      console.error("❌ Unauthorized: Missing user ID");
      return res.status(401).json({ message: "Unauthorized: Missing user ID" });
    }

    console.log("   → User ID:", userId);

    const activities = await ActivityLog.find({ userId })
      .sort({ createdAt: -1 })
      .limit(50);

    console.log(`📊 [GET ACTIVITIES] Found ${activities.length} activities for user ${userId}`);
    
    const unreadCount = activities.filter(a => !a.isRead).length;
    console.log(`   → Unread activities: ${unreadCount}`);
    
    console.log("✅ [GET ACTIVITIES] Sending response");
    console.log("═══════════════════════════════════════════════════════");
    
    res.status(200).json({ data: activities });
  } catch (error: any) {
    console.error("═══════════════════════════════════════════════════════");
    console.error("❌ [ERROR] Fetching activities");
    console.error("   → Error:", error.message);
    console.error("═══════════════════════════════════════════════════════");
    res.status(500).json({ message: "Failed to fetch activities" });
  }
};

/* =========================
   🔢 Get Unread Activity Count
   ========================= */
export const getUnreadCount = async (req: RequestWithUser, res: Response) => {
  console.log("═══════════════════════════════════════════════════════");
  console.log("📊 [GET UNREAD COUNT] Request received");
  
  try {
    const userId = req.user?.id;
    if (!userId) {
      console.error("❌ Unauthorized: Missing user ID");
      return res.status(401).json({ message: "Unauthorized: Missing user ID" });
    }

    console.log("   → User ID:", userId);

    // Count activities from last 24 hours that are unread
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    console.log("   → Counting activities since:", oneDayAgo.toISOString());
    console.log("   → Filter: isRead != true");
    
    const count = await ActivityLog.countDocuments({
      userId,
      createdAt: { $gte: oneDayAgo },
      isRead: { $ne: true }
    });

    console.log(`📊 [UNREAD COUNT] Result: ${count} unread activities`);
    
    // Debug: Also get the actual unread activities
    const unreadActivities = await ActivityLog.find({
      userId,
      createdAt: { $gte: oneDayAgo },
      isRead: { $ne: true }
    }).limit(10);
    
    console.log("   → Sample unread activities:");
    unreadActivities.forEach((a, idx) => {
      console.log(`      ${idx + 1}. ID: ${a._id.toString().substring(0, 8)}..., Action: ${a.action}, isRead: ${a.isRead}, Created: ${a.createdAt}`);
    });
    
    console.log("✅ [GET UNREAD COUNT] Sending response");
    console.log("═══════════════════════════════════════════════════════");
    
    res.status(200).json({ count });
  } catch (error: any) {
    console.error("═══════════════════════════════════════════════════════");
    console.error("❌ [ERROR] Fetching unread count");
    console.error("   → Error:", error.message);
    console.error("═══════════════════════════════════════════════════════");
    res.status(500).json({ message: "Failed to fetch unread count" });
  }
};

/* =========================
   ✅ Mark Activity as Read
   ========================= */
export const markActivityAsRead = async (req: RequestWithUser, res: Response) => {
  console.log("═══════════════════════════════════════════════════════");
  console.log("📖 [MARK ACTIVITY AS READ] Starting process...");
  
  try {
    const { id } = req.params;
    if (!req.user) {
      console.error("❌ Unauthorized - no user");
      return res.status(401).json({ message: "Unauthorized" });
    }

    console.log(`   → Activity ID: ${id}`);
    console.log(`   → User ID: ${req.user.id}`);

    const activity = await ActivityLog.findById(id);
    
    if (!activity) {
      console.error("❌ Activity not found");
      return res.status(404).json({ message: "Activity not found" });
    }

    console.log("✅ Activity found");
    console.log(`   → Owner: ${activity.userId.toString()}`);
    console.log(`   → Current isRead: ${activity.isRead}`);

    if (activity.userId.toString() !== req.user.id) {
      console.error("❌ Forbidden - user mismatch");
      return res.status(403).json({ message: "Forbidden: You can only mark your own activities as read" });
    }

    // Update activity
    activity.isRead = true;
    await activity.save();

    console.log("✅ Activity updated in database");
    console.log(`   → Now isRead: ${activity.isRead}`);

    // Get Socket.IO instance
    const io = (req as any).app?.get?.("io");
    
    if (io) {
      const socketPayload = {
        _id: activity._id,
        userId: activity.userId,
        isRead: activity.isRead,
        action: activity.action,
        description: activity.description,
        details: activity.details,
        createdAt: activity.createdAt,
      };

      console.log(`📡 [SOCKET] Emitting "activityUpdated" to room: "${req.user.id}"`);
      io.to(req.user.id.toString()).emit("activityUpdated", socketPayload);
      console.log("✅ [SOCKET] Event emitted successfully!");
      
      // Verify the room exists and has sockets
      const socketsInRoom = await io.in(req.user.id.toString()).fetchSockets();
      console.log(`📊 [SOCKET] Sockets in room "${req.user.id}": ${socketsInRoom.length}`);
      
      if (socketsInRoom.length === 0) {
        console.warn("⚠️ [SOCKET] No sockets found in user room - user might not be connected");
      }
    } else {
      console.warn("⚠️ [SOCKET] io instance not available");
    }

    console.log("═══════════════════════════════════════════════════════");
    
    res.status(200).json({ 
      message: "Activity marked as read", 
      activity 
    });
  } catch (error: any) {
    console.error("═══════════════════════════════════════════════════════");
    console.error("❌ [ERROR] markActivityAsRead");
    console.error("   → Error:", error.message);
    console.error("═══════════════════════════════════════════════════════");
    res.status(500).json({ 
      message: "Failed to mark activity as read", 
      error: error.message 
    });
  }
};