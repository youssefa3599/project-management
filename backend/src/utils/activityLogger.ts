// backend/src/utils/activityLogger.ts
import mongoose from "mongoose";
import ActivityLog from "../models/ActivityLog";

interface LogActivityParams {
  userId: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: string;
  description: string; // Human-readable description
  metadata?: Record<string, any>;
}

export const logActivity = async (params: LogActivityParams): Promise<void> => {
  console.log("═══════════════════════════════════════════════════════");
  console.log("📝 [ACTIVITY LOGGER] Creating new activity log");
  console.log("   → User ID:", params.userId);
  console.log("   → Action:", params.action);
  console.log("   → Entity Type:", params.entityType);
  console.log("   → Entity ID:", params.entityId);
  console.log("   → Description:", params.description.substring(0, 60) + (params.description.length > 60 ? '...' : ''));
  console.log("   → Details:", params.details?.substring(0, 60) + (params.details && params.details.length > 60 ? '...' : ''));
  console.log("   → Metadata:", JSON.stringify(params.metadata || {}));
  
  try {
    const activityLog = new ActivityLog({
      userId: new mongoose.Types.ObjectId(params.userId),
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ? new mongoose.Types.ObjectId(params.entityId) : undefined,
      details: params.details,
      description: params.description,
      metadata: params.metadata,
      isRead: false, // IMPORTANT: Always create as unread
    });

    console.log("   → Activity object created");
    console.log("   → isRead field:", activityLog.isRead);

    await activityLog.save();
    
    console.log("✅ [ACTIVITY LOGGER] Activity saved to database");
    console.log("   → Activity ID:", activityLog._id.toString());
    console.log("   → isRead status:", activityLog.isRead);
    console.log("═══════════════════════════════════════════════════════");
    
    // Get Socket.IO instance to emit real-time event
    const io = (global as any).io;
    if (io) {
      console.log("📡 [ACTIVITY LOGGER] Emitting newActivity socket event");
      console.log("   → Target user room:", params.userId);
      
      const socketPayload = {
        _id: activityLog._id,
        userId: activityLog.userId,
        action: activityLog.action,
        entityType: activityLog.entityType,
        description: activityLog.description,
        details: activityLog.details,
        isRead: activityLog.isRead,
        createdAt: activityLog.createdAt,
      };
      
      io.to(params.userId.toString()).emit("newActivity", socketPayload);
      console.log("✅ [ACTIVITY LOGGER] Socket event emitted successfully");
    } else {
      console.warn("⚠️ [ACTIVITY LOGGER] Socket.IO instance not available");
    }
  } catch (error: any) {
    console.error("═══════════════════════════════════════════════════════");
    console.error("❌ [ACTIVITY LOGGER] Error logging activity");
    console.error("   → Error message:", error.message);
    console.error("   → Error stack:", error.stack);
    console.error("═══════════════════════════════════════════════════════");
    // Don't throw - logging failures shouldn't break main flow
  }
};