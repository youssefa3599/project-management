import mongoose, { Schema, Document } from "mongoose";

export interface ITaskGoal extends Document {
  chatId: mongoose.Types.ObjectId; // link to Chat
  title: string;
  link: string;
  status: "pending" | "correct" | "fulfilled" | "succeeded";
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TaskGoalSchema = new Schema<ITaskGoal>(
  {
    // 🔧 Removed "unique: true" so multiple goals can exist per chat
    chatId: { 
  type: Schema.Types.ObjectId, 
  ref: "Chat", 
  required: true,
  index: true // ✅ adds a normal (non-unique) index for faster queries
},


    title: { type: String, required: true },
    //link: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "correct", "fulfilled", "succeeded"],
      default: "pending",
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

// ⚙️ Index optimizations (non-unique)
TaskGoalSchema.index({ chatId: 1 });
TaskGoalSchema.index({ chatId: 1, createdAt: -1 });

export default mongoose.model<ITaskGoal>("TaskGoal", TaskGoalSchema);
