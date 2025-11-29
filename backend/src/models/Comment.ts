import mongoose, { Schema, Document, Types } from "mongoose";

export interface IComment extends Document {
  _id: Types.ObjectId;              // Explicitly include _id
  text: string;
  task: Types.ObjectId;             // Reference to Task
  user: Types.ObjectId;             // Reference to User
  createdAt: Date;
  updatedAt: Date;                  // Include updatedAt for timestamps
}

const commentSchema = new Schema<IComment>(
  {
    text: { type: String, required: true },
    task: { type: Schema.Types.ObjectId, ref: "Task", required: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export default mongoose.model<IComment>("Comment", commentSchema);
