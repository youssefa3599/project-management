import { Schema, model, Document, Types } from "mongoose";

export interface ITask extends Document {
  _id: Types.ObjectId;
  title: string;
  description?: string;
  status: "todo" | "in-progress" | "done";
  project: Types.ObjectId;
  assignedTo?: Types.ObjectId;
  createdBy: Types.ObjectId;
  // ✅ NEW: Task-level members for isolated chat access
  members: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const taskSchema = new Schema<ITask>(
  {
    title: { type: String, required: true },
    description: { type: String },
    status: {
      type: String,
      enum: ["todo", "in-progress", "done"],
      default: "todo",
    },
    project: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    // ✅ NEW: Array of users who have access to this specific task's chat
    members: [{ type: Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

taskSchema.post("save", function (doc) {
  console.log("💾 [MONGOOSE] Task saved:", doc._id, "→ members:", doc.members?.map(m => m.toString()));
});

export default model<ITask>("Task", taskSchema);