import express from "express";
import ActivityLog from "../models/ActivityLog";

const router = express.Router();

// Middleware to authenticate (reuse from authRoutes)
const authenticateToken = async (req: any, res: any, next: any) => {
  try {
    console.log("═══════════════════════════════════════════════════════");
    console.log("🔐 [Activity Auth] Authenticating request");
    
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      console.error("❌ [Activity Auth] No token provided");
      return res.status(401).json({ message: 'No token provided' });
    }

    const jwt = require('jsonwebtoken');
    const User = require('../models/User').default;

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    console.log("   → Token decoded, userId:", decoded.userId);
    
    const user = await User.findById(decoded.userId);

    if (!user) {
      console.error("❌ [Activity Auth] User not found:", decoded.userId);
      return res.status(401).json({ message: 'User not found' });
    }

    req.user = {
      id: user._id.toString(),
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
    };

    console.log("✅ [Activity Auth] User authenticated");
    console.log("   → User ID:", req.user.id);
    console.log("   → User Name:", req.user.name);
    console.log("═══════════════════════════════════════════════════════");

    next();
  } catch (error: any) {
    console.error("═══════════════════════════════════════════════════════");
    console.error("❌ [Activity Auth] Authentication failed");
    console.error("   → Error:", error.message);
    console.error("═══════════════════════════════════════════════════════");
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
};

// Get user's activities
router.get("/", authenticateToken, async (req: any, res) => {
  console.log("═══════════════════════════════════════════════════════");
  console.log("📋 [GET ACTIVITIES] Request received");
  
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    console.log("   → User ID:", req.user.userId);
    console.log("   → Page:", page);
    console.log("   → Limit:", limit);
    console.log("   → Skip:", skip);

    const activities = await ActivityLog.find({ userId: req.user.userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await ActivityLog.countDocuments({ userId: req.user.userId });

    console.log(`📊 [GET ACTIVITIES] Found ${activities.length} activities`);
    console.log(`   → Total activities: ${total}`);
    console.log(`   → Current page: ${page}/${Math.ceil(total / limit)}`);
    
    // Log unread count
    const unreadCount = activities.filter((a: any) => !a.isRead).length;
    console.log(`   → Unread in this page: ${unreadCount}`);
    
    // Log sample activities
    console.log("   → Sample activities:");
    activities.slice(0, 3).forEach((a: any, idx: number) => {
      console.log(`      ${idx + 1}. Action: ${a.action}, isRead: ${a.isRead}, Created: ${new Date(a.createdAt).toLocaleString()}`);
    });

    console.log("✅ [GET ACTIVITIES] Sending response");
    console.log("═══════════════════════════════════════════════════════");

    res.json({
      data: activities, // Changed from 'activities' to 'data' to match frontend
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error("═══════════════════════════════════════════════════════");
    console.error("❌ [GET ACTIVITIES] Error");
    console.error("   → Error:", error.message);
    console.error("   → Stack:", error.stack);
    console.error("═══════════════════════════════════════════════════════");
    res.status(500).json({ message: "Failed to fetch activities" });
  }
});

// Get unread count (activities from last 24 hours)
router.get("/unread-count", authenticateToken, async (req: any, res) => {
  console.log("═══════════════════════════════════════════════════════");
  console.log("📊 [GET UNREAD COUNT] Request received");
  
  try {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    console.log("   → User ID:", req.user.userId);
    console.log("   → Counting activities since:", yesterday.toISOString());
    console.log("   → Filter: isRead != true");

    // Count unread activities from last 24 hours
    const count = await ActivityLog.countDocuments({
      userId: req.user.userId,
      createdAt: { $gte: yesterday },
      isRead: { $ne: true }, // Only count unread activities
    });

    console.log(`📊 [UNREAD COUNT] Result: ${count} unread activities`);
    
    // Debug: Get sample unread activities
    const sampleUnread = await ActivityLog.find({
      userId: req.user.userId,
      createdAt: { $gte: yesterday },
      isRead: { $ne: true },
    }).limit(5).lean();
    
    console.log("   → Sample unread activities:");
    sampleUnread.forEach((a: any, idx: number) => {
      console.log(`      ${idx + 1}. ID: ${a._id.toString().substring(0, 8)}..., Action: ${a.action}, isRead: ${a.isRead}, Created: ${new Date(a.createdAt).toLocaleString()}`);
    });
    
    console.log("✅ [GET UNREAD COUNT] Sending response");
    console.log("═══════════════════════════════════════════════════════");

    res.json({ count });
  } catch (error: any) {
    console.error("═══════════════════════════════════════════════════════");
    console.error("❌ [GET UNREAD COUNT] Error");
    console.error("   → Error:", error.message);
    console.error("   → Stack:", error.stack);
    console.error("═══════════════════════════════════════════════════════");
    res.status(500).json({ message: "Failed to fetch unread count" });
  }
});

// Mark activity as read
router.patch("/:id/read", authenticateToken, async (req: any, res) => {
  console.log("═══════════════════════════════════════════════════════");
  console.log("📖 [MARK AS READ] Request received");
  
  try {
    const { id } = req.params;
    
    console.log("   → Activity ID:", id);
    console.log("   → User ID:", req.user.userId);

    const activity = await ActivityLog.findById(id);
    
    if (!activity) {
      console.error("❌ [MARK AS READ] Activity not found");
      return res.status(404).json({ message: "Activity not found" });
    }

    console.log("✅ [MARK AS READ] Activity found");
    console.log(`   → Owner: ${activity.userId.toString()}`);
    console.log(`   → Current isRead: ${activity.isRead}`);
    console.log(`   → Action: ${activity.action}`);

    // Verify ownership
    if (activity.userId.toString() !== req.user.userId) {
      console.error("❌ [MARK AS READ] User mismatch");
      console.error(`   → Activity owner: ${activity.userId.toString()}`);
      console.error(`   → Requesting user: ${req.user.userId}`);
      return res.status(403).json({ message: "Forbidden: You can only mark your own activities as read" });
    }

    // Update activity
    const wasAlreadyRead = activity.isRead;
    activity.isRead = true;
    await activity.save();

    console.log("✅ [MARK AS READ] Activity updated in database");
    console.log(`   → Was already read: ${wasAlreadyRead}`);
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

      const userIdString = req.user.userId.toString();
      console.log(`📡 [SOCKET] Emitting "activityUpdated" to room: "${userIdString}"`);
      console.log(`   → Payload:`, JSON.stringify(socketPayload, null, 2));
      
      io.to(userIdString).emit("activityUpdated", socketPayload);
      console.log("✅ [SOCKET] Event emitted successfully!");
      
      // Verify room occupancy
      try {
        const socketsInRoom = await io.in(userIdString).fetchSockets();
        console.log(`📊 [SOCKET] Sockets in room "${userIdString}": ${socketsInRoom.length}`);
        
        if (socketsInRoom.length === 0) {
          console.warn("⚠️ [SOCKET] No sockets in user room - user might not be connected");
        } else {
          socketsInRoom.forEach((socket: any, idx: number) => {
            console.log(`   ${idx + 1}. Socket ID: ${socket.id}`);
          });
        }
      } catch (socketError) {
        console.error("❌ [SOCKET] Error checking room:", socketError);
      }
    } else {
      console.warn("⚠️ [SOCKET] io instance not available");
    }

    console.log("✅ [MARK AS READ] Process completed successfully");
    console.log("═══════════════════════════════════════════════════════");
    
    res.status(200).json({ 
      message: "Activity marked as read", 
      activity: {
        _id: activity._id,
        isRead: activity.isRead,
        action: activity.action,
        description: activity.description,
      }
    });
  } catch (error: any) {
    console.error("═══════════════════════════════════════════════════════");
    console.error("❌ [MARK AS READ] Error");
    console.error("   → Error:", error.message);
    console.error("   → Stack:", error.stack);
    console.error("═══════════════════════════════════════════════════════");
    res.status(500).json({ 
      message: "Failed to mark activity as read", 
      error: error.message 
    });
  }
});

export default router;