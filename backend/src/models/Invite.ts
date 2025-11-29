import mongoose, { Schema, Document } from "mongoose";

export interface IInvite extends Document {
  project: mongoose.Schema.Types.ObjectId;
  email: string;
  inviter: mongoose.Schema.Types.ObjectId;
  status: "pending" | "accepted" | "declined";
  token: string;
  createdAt: Date;
}

const inviteSchema = new Schema<IInvite>({
  project: { type: Schema.Types.ObjectId, ref: "Project", required: true },
  email: { type: String, required: true },
  inviter: { type: Schema.Types.ObjectId, ref: "User", required: true },
  status: { type: String, enum: ["pending", "accepted", "declined"], default: "pending" },
  token: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model<IInvite>("Invite", inviteSchema);
