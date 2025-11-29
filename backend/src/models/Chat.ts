import mongoose, { Schema, Document } from "mongoose";

export interface IMessage {
  sender: mongoose.Types.ObjectId;
  content: string;
  createdAt: Date;
}

export interface IChat extends Document {
  _id: mongoose.Types.ObjectId; // ✅ Add this line
  name: string;
  projectId?: mongoose.Types.ObjectId;
  taskId?: mongoose.Types.ObjectId;
  members: mongoose.Types.ObjectId[];
  messages: IMessage[];
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>({
  sender: { type: Schema.Types.ObjectId, ref: "User", required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const ChatSchema = new Schema<IChat>(
  {
    name: { type: String, required: true, trim: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project" },
    taskId: { type: Schema.Types.ObjectId, ref: "Task" },
    members: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],
    messages: [MessageSchema],
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

ChatSchema.index({ members: 1 });
ChatSchema.index({ projectId: 1 });
ChatSchema.index({ taskId: 1 });
ChatSchema.index({ createdAt: -1 });

ChatSchema.post("save", function (doc) {
  console.log("💾 [MONGOOSE] Chat saved:", doc._id, "→ members:", doc.members.map(m => m.toString()));
});

export default mongoose.model<IChat>("Chat", ChatSchema);
