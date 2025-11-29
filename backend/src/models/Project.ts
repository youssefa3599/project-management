import mongoose, { Schema, Document, Types } from "mongoose";

export interface IProject extends Document {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  createdBy: Types.ObjectId;
  members: { user: Types.ObjectId; role: "admin" | "editor" | "viewer" }[];
  status: "active" | "completed" | "archived";
  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new Schema<IProject>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    members: [
      {
        user: { type: Schema.Types.ObjectId, ref: "User", required: true },
        role: { type: String, enum: ["admin", "editor", "viewer"], default: "viewer" },
      },
    ],
    status: { type: String, enum: ["active", "completed", "archived"], default: "active" },
  },
  { timestamps: true }
);

projectSchema.post("save", function (doc) {
  console.log("💾 [MONGOOSE] Project saved:", doc._id, "→ members:", doc.members.map(m => m.user.toString()));
});

export default mongoose.model<IProject>("Project", projectSchema);
