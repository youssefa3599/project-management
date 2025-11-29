import mongoose, { Document, Schema, Types } from "mongoose";

/**
 * =====================================
 * 🧩 Notification Model
 * -------------------------------------
 * Handles all types of notifications:
 * - Task Chat Invites
 * - Project Invites  
 * - Project Updates
 * - Chat Mentions ← KEY FOR YOUR FEATURE
 * =====================================
 */

export interface INotification extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId; // The recipient user
  message: string;

  // Optional references to other entities
  project?: Types.ObjectId;
  task?: Types.ObjectId;
  taskId?: Types.ObjectId; // ✅ Added for consistency

  // Notification behavior
  isRead: boolean;
  type: "taskChatInvite" | "projectInvite" | "projectUpdate" | "mention" | "general";
  status: "pending" | "accepted" | "declined";

  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    user: { 
      type: Schema.Types.ObjectId, 
      ref: "User", 
      required: true,
      index: true // Fast lookup by user
    },
    message: { 
      type: String, 
      required: true 
    },

    // Optional relationships
    project: { 
      type: Schema.Types.ObjectId, 
      ref: "Project" 
    },
    task: { 
      type: Schema.Types.ObjectId, 
      ref: "Task" 
    },
    taskId: { // ✅ Added for consistency with frontend
      type: Schema.Types.ObjectId, 
      ref: "Task" 
    },

    // Status & control flags
    isRead: { 
      type: Boolean, 
      default: false,
      index: true // Fast filtering of unread notifications
    },
    type: {
      type: String,
      enum: ["taskChatInvite", "projectInvite", "projectUpdate", "mention", "general"],
      default: "general",
      required: true,
      index: true // Fast filtering by notification type
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "declined"],
      default: "pending",
    },
  },
  { 
    timestamps: true // Automatically adds createdAt and updatedAt
  }
);

/**
 * =====================================
 * 🔍 Compound Indexes for Performance
 * =====================================
 * These speed up common queries:
 * - Get all notifications for a user (sorted by date)
 * - Get unread notifications for a user
 */
notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, isRead: 1 });
notificationSchema.index({ user: 1, type: 1 });

/**
 * =====================================
 * 🪵 Debug Middleware
 * -------------------------------------
 * Logs key lifecycle events for easier
 * backend tracing & debugging.
 * =====================================
 */

// Log when a notification is created
notificationSchema.post("save", function (doc) {
  if (this.isNew) {
    console.log("🔔 [NOTIFICATION CREATED]");
    console.log("   → ID:", doc._id.toString());
    console.log("   → Type:", doc.type);
    console.log("   → Status:", doc.status);
    console.log("   → Recipient:", doc.user.toString());
    console.log("   → Message:", doc.message.substring(0, 60) + (doc.message.length > 60 ? '...' : ''));
    if (doc.project) console.log("   → Project:", doc.project.toString());
    if (doc.task) console.log("   → Task:", doc.task.toString());
    if (doc.taskId) console.log("   → TaskId:", doc.taskId.toString());
    console.log("   → Read:", doc.isRead);
    console.log("════════════════════════════════════════");
  }
});

// Log when a notification is updated
notificationSchema.post("findOneAndUpdate", function (doc) {
  if (doc) {
    console.log("✏️ [NOTIFICATION UPDATED]:", doc._id.toString());
    console.log("   → New status:", doc.status);
    console.log("   → Read:", doc.isRead);
  }
});

// Log when a notification is deleted
notificationSchema.post("findOneAndDelete", function (doc) {
  if (doc) {
    console.log("🗑️ [NOTIFICATION DELETED]:", doc._id.toString());
  }
});

/**
 * =====================================
 * 📊 Virtual Fields (Optional)
 * =====================================
 * Add computed fields that don't exist in DB
 */

// Example: Get time elapsed since creation
notificationSchema.virtual("timeAgo").get(function () {
  const now = new Date();
  const created = this.createdAt;
  const diffMs = now.getTime() - created.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
});

// Ensure virtuals are included when converting to JSON
notificationSchema.set("toJSON", { virtuals: true });
notificationSchema.set("toObject", { virtuals: true });

/**
 * =====================================
 * 🔧 Static Methods (Optional)
 * =====================================
 * Add helper methods to the model
 */

// Find unread notifications for a user
notificationSchema.statics.findUnreadByUser = function (userId: string) {
  return this.find({ 
    user: userId, 
    isRead: false 
  }).sort({ createdAt: -1 });
};

// Find mention notifications for a user
notificationSchema.statics.findMentionsByUser = function (userId: string) {
  return this.find({ 
    user: userId, 
    type: "mention" 
  }).sort({ createdAt: -1 });
};

// Mark all notifications as read for a user
notificationSchema.statics.markAllAsRead = function (userId: string) {
  return this.updateMany(
    { user: userId, isRead: false },
    { isRead: true }
  );
};

/**
 * =====================================
 * 📤 Export Model
 * =====================================
 */
export default mongoose.model<INotification>("Notification", notificationSchema);