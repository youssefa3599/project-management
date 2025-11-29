import express, { Request, Response, NextFunction } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import { authorizeProjectRole } from "../middlewares/authorization";
import {
  createTask,
  updateTask,
  deleteTask,
  getTasksByProject,
  getTaskById, // ✅ Add this import
} from "../controllers/taskController";

const router = express.Router();

// ==========================
// 🔍 Global Debug Middleware
// ==========================
router.use(authMiddleware, (req: Request, res: Response, next: NextFunction) => {
  console.log("====================================");
  console.log("📍 [TASK ROUTE HIT]");
  console.log("➡️ Method:", req.method);
  console.log("➡️ URL:", req.originalUrl);
  console.log("➡️ Headers:", req.headers);
  console.log("➡️ Params:", req.params);
  console.log("➡️ Query:", req.query);
  console.log("➡️ Body:", req.body);
  console.log("➡️ Authenticated User:", req.user);
  console.log("====================================");
  next();
});

// ==========================
// 🧱 Task CRUD Routes
// ==========================

// ✅ Get single task by ID (MUST BE FIRST)
router.get("/:taskId", getTaskById);

// Get all tasks for a project
router.get("/", getTasksByProject);

// Create new task (admin/editor only)
router.post("/", authorizeProjectRole(["admin", "editor"]), createTask);

// Update a task (admin/editor only)
router.put("/:taskId", authorizeProjectRole(["admin", "editor"]), updateTask);

// Delete a task (admin only)
router.delete("/:taskId", authorizeProjectRole(["admin"]), deleteTask);

export default router;