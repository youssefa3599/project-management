import { Request, Response } from "express";
import { io } from "../server";
import TaskGoal from "../models/TaskGoal";
import mongoose from "mongoose";
import { DecodedToken } from "../middlewares/authMiddleware";
import { logActivity } from "../utils/activityLogger";

type RequestWithUser = Request & { user?: DecodedToken };

// =======================================================
// 🎯 TASK GOAL CONTROLLER — CLEANED (NO LINKS)
// =======================================================

// ✅ GET /api/chats/:chatId/task-goals
export const getTaskGoals = async (req: RequestWithUser, res: Response): Promise<void> => {
  console.log("===========================================");
  console.log("📥 [TaskGoals] GET request received");
  console.log("➡️ URL:", req.originalUrl);
  console.log("➡️ Params:", req.params);
  console.log("➡️ Auth User:", req.user);
  console.log("===========================================");

  try {
    const { chatId } = req.params;
    const goals = await TaskGoal.find({ chatId }).populate("createdBy", "name email");
    console.log(`✅ [TaskGoals] Found ${goals.length} goals for chatId ${chatId}`);
    res.json(goals);
  } catch (error: any) {
    console.error("🔥 [TaskGoals] Fetch error:", error.message);
    res.status(500).json({ message: "Failed to load goals" });
  }
};

// ✅ POST /api/chats/:chatId/task-goal
export const createTaskGoal = async (req: RequestWithUser, res: Response) => {
  console.log("🎯 [createTaskGoal] Request received", { params: req.params, body: req.body, user: req.user });

  try {
    const { chatId } = req.params;
    const { title } = req.body;
    const userId = req.user?.id;

    if (!title || title.trim() === "") {
      console.warn("⚠️ Missing required title:", { title });
      return res.status(400).json({ message: "Title is required" });
    }

    if (!userId) {
      console.warn("⚠️ Missing user ID from auth middleware");
      return res.status(401).json({ message: "Unauthorized" });
    }

    const goal = await TaskGoal.create({
      chatId: new mongoose.Types.ObjectId(chatId),
      createdBy: new mongoose.Types.ObjectId(userId),
      title: title.trim(),
      status: "pending",
    });

    await goal.populate("createdBy", "name email");

    console.log("✅ TaskGoal created successfully:", goal);
    io.to(chatId.toString()).emit("taskGoalCreated", goal);

    res.status(201).json(goal);
  } catch (error: any) {
    console.error("🔥 [createTaskGoal] Error:", error.message);
    res.status(500).json({ message: error.message || "Internal Server Error" });
  }
};

// ✅ PATCH /api/chats/:chatId/task-goal/:goalId/status
export const updateTaskGoalStatus = async (req: RequestWithUser, res: Response): Promise<void> => {
  console.log("🧩 [TaskGoals] updateTaskGoalStatus()", { params: req.params, body: req.body, user: req.user });

  try {
    const { goalId } = req.params;
    const { status } = req.body;
    const user = req.user;

    if (!user) {
      res.status(403).json({ message: "Unauthorized" });
      return;
    }

    const allowedStatuses = ["pending", "correct", "fulfilled", "succeeded"];
    if (!allowedStatuses.includes(status)) {
      res.status(400).json({ message: "Invalid status" });
      return;
    }

    const elevatedStatuses = ["correct", "fulfilled", "succeeded"];
    const isElevated = elevatedStatuses.includes(status);

    if (isElevated && user.role !== "admin" && user.role !== "editor") {
      res.status(403).json({ message: `Only admins or editors can set status '${status}'` });
      return;
    }

    const goal = await TaskGoal.findByIdAndUpdate(goalId, { status }, { new: true });
    if (!goal) {
      res.status(404).json({ message: "Goal not found" });
      return;
    }

    io.to(goal.chatId.toString()).emit("taskGoalUpdated", goal);
    res.json(goal);
  } catch (error: any) {
    console.error("🔥 [updateTaskGoalStatus] Error:", error.message);
    res.status(500).json({ message: error.message });
  }
};

// ✅ PATCH /api/chats/:chatId/task-goal/:goalId
export const updateTaskGoal = async (req: RequestWithUser, res: Response): Promise<void> => {
  console.log("🧠 [TaskGoals] updateTaskGoal()", { params: req.params, body: req.body, user: req.user });

  try {
    const { goalId } = req.params;
    const { title } = req.body;
    const user = req.user;

    if (!user) {
      res.status(403).json({ message: "Unauthorized" });
      return;
    }

    const goal = await TaskGoal.findById(goalId);
    if (!goal) {
      res.status(404).json({ message: "Goal not found" });
      return;
    }

    // Only admins, editors, or creator can edit
    if (user.role !== "admin" && user.role !== "editor" && user.id !== goal.createdBy.toString()) {
      res.status(403).json({ message: "Only admins, editors, or creator can edit" });
      return;
    }

    if (title) goal.title = title.trim();
    await goal.save();

    io.to(goal.chatId.toString()).emit("taskGoalUpdated", goal);
    res.json(goal);
  } catch (error: any) {
    console.error("🔥 [updateTaskGoal] Error:", error.message);
    res.status(500).json({ message: "Failed to edit goal" });
  }
};

// ✅ DELETE /api/chats/:chatId/task-goal/:goalId
export const deleteTaskGoal = async (req: RequestWithUser, res: Response): Promise<void> => {
  console.log("🧠 [TaskGoals] deleteTaskGoal()", { params: req.params, user: req.user });

  try {
    const { goalId } = req.params;
    const user = req.user;

    if (!user) {
      res.status(403).json({ message: "Unauthorized" });
      return;
    }

    const goal = await TaskGoal.findById(goalId);
    if (!goal) {
      res.status(404).json({ message: "Goal not found" });
      return;
    }

    if (user.role !== "admin" && user.role !== "editor" && user.id !== goal.createdBy.toString()) {
      res.status(403).json({ message: "Only admins, editors, or creator can delete" });
      return;
    }

    await goal.deleteOne();
    io.to(goal.chatId.toString()).emit("taskGoalDeleted", goalId);

    console.log("✅ Goal deleted:", goalId);
    res.json({ success: true, id: goalId });
  } catch (error: any) {
    console.error("🔥 [deleteTaskGoal] Error:", error.message);
    res.status(500).json({ message: "Failed to delete goal" });
  }
};
