import mongoose, { Schema, Document } from "mongoose";

// 🆕 UPDATED - Added _id and parentMessage
export interface IMessage {
  _id: mongoose.Types.ObjectId;
  sender: mongoose.Types.ObjectId;
  content: string;
  createdAt: Date;
  parentMessage?: mongoose.Types.ObjectId | IMessage; // Can be ID or populated object
}

export interface IChat extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  projectId?: mongoose.Types.ObjectId;
  taskId?: mongoose.Types.ObjectId;
  members: mongoose.Types.ObjectId[];
  messages: IMessage[];
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// 🆕 UPDATED - Added parentMessage field
const MessageSchema = new Schema<IMessage>({
  sender: { type: Schema.Types.ObjectId, ref: "User", required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  parentMessage: { type: Schema.Types.ObjectId }, // ✅ NO ref - it's a self-reference
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
  console.log("═══════════════════════════════════════════════════════");
  console.log("💾 [MONGOOSE POST-SAVE] Chat document saved");
  console.log(`   → Chat ID: ${doc._id}`);
  console.log(`   → Task ID: ${doc.taskId}`);
  console.log(`   → Members: [${doc.members.map(m => m.toString()).join(", ")}]`);
  console.log(`   → Total messages: ${doc.messages.length}`);
  if (doc.messages.length > 0) {
    const lastMsg = doc.messages[doc.messages.length - 1];
    console.log(`   → Last message ID: ${lastMsg._id}`);
    console.log(`   → Last message sender: ${lastMsg.sender}`);
    console.log(`   → Last message has reply: ${!!lastMsg.parentMessage}`);
  }
  console.log("═══════════════════════════════════════════════════════");
});

export default mongoose.model<IChat>("Chat", ChatSchema);