import mongoose, { Schema, Document, Types } from "mongoose";

export interface IComment extends Document {
  _id: Types.ObjectId;
  text: string;
  task: Types.ObjectId;
  user: Types.ObjectId;
  parentComment?: Types.ObjectId;  // 🆕 NEW: Enables nesting!
  createdAt: Date;
  updatedAt: Date;
}

const commentSchema = new Schema<IComment>(
  {
    text: { type: String, required: true },
    task: { type: Schema.Types.ObjectId, ref: "Task", required: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    parentComment: {                    // 🆕 NEW FIELD
      type: Schema.Types.ObjectId,
      ref: "Comment",
      default: null                      // null = top-level comment
    },
  },
  { timestamps: true }
);

// 🆕 Index for faster nested queries
commentSchema.index({ task: 1, parentComment: 1 });

export default mongoose.model<IComment>("Comment", commentSchema);