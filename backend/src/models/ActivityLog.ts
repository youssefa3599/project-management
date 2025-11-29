// backend/src/models/ActivityLog.ts
import mongoose, { Document, Schema, Types } from "mongoose";

export interface IActivityLog extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  action: string;
  entityType: string;
  entityId?: Types.ObjectId | string;
  details?: string;
  description: string; // Human-readable description
  metadata?: Record<string, any>;
  isRead?: boolean; // NEW FIELD - Mark if activity has been viewed
  createdAt: Date;
  updatedAt: Date;
}

const activityLogSchema = new Schema<IActivityLog>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    entityType: {
      type: String,
      required: true,
      enum: [
        "project",
        "task",
        "message",
        "mention",
        "user",
        "notification",
        "chat",
        "comment",
        "file",
      ],
    },
    entityId: {
      type: Schema.Types.Mixed,
    },
    details: {
      type: String,
    },
    description: {
      type: String,
      required: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
activityLogSchema.index({ userId: 1, createdAt: -1 });
activityLogSchema.index({ userId: 1, isRead: 1 });
activityLogSchema.index({ userId: 1, action: 1 });

// Log when activity is created
activityLogSchema.post("save", function (doc) {
  if (this.isNew) {
    console.log("📝 [ACTIVITY LOG CREATED]");
    console.log("   → ID:", doc._id.toString());
    console.log("   → User:", doc.userId.toString());
    console.log("   → Action:", doc.action);
    console.log("   → Description:", doc.description.substring(0, 60) + (doc.description.length > 60 ? '...' : ''));
    console.log("   → isRead:", doc.isRead);
  }
});

export default mongoose.model<IActivityLog>("ActivityLog", activityLogSchema);