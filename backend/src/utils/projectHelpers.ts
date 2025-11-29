// src/utils/projectHelpers.ts
import { IProject } from "../models/Project";

export const getMemberRole = (project: IProject, userId: string): "admin" | "editor" | "viewer" | null => {
  // 1️⃣ Check if the user is the project creator
  if (project.createdBy.toString() === userId) return "admin";

  // 2️⃣ Find the user in the project's members array
  const member = project.members.find((m: any) => m.user.toString() === userId);

  // 3️⃣ Return the role, or null if the user is not a member
  return member?.role || null;
};
