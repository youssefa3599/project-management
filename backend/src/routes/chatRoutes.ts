import express, { Request, Response, NextFunction } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import {
  getTaskMessages,
  addTaskMessage,
  getUserTaskChats,
  getTaskChatById,
  inviteMemberToTaskChat,
  acceptTaskChatInvite,
  leaveTaskChat,
} from "../controllers/TaskChatController";

import {
  getTaskGoals,
  createTaskGoal,
  updateTaskGoalStatus,
  updateTaskGoal,
  deleteTaskGoal,
} from "../controllers/TaskGoalController";

const router = express.Router();

/* =======================================================
   🌍 ROUTER-LEVEL DEBUG ENTRY
   ======================================================= */
router.use((req: Request, _res: Response, next: NextFunction) => {
  console.log("\n🌍 [CHAT ROUTER ENTERED]");
  console.log("➡️ METHOD:", req.method);
  console.log("➡️ URL:", req.originalUrl);
  console.log("➡️ PATH:", req.path);
  console.log("➡️ BODY:", req.body);
  console.log("➡️ PARAMS:", req.params);
  console.log(
    "➡️ HEADERS:",
    req.headers.authorization ? "✅ Token present" : "❌ No token"
  );
  next();
});

/* =======================================================
   🛡 AUTH MIDDLEWARE CHECKPOINT
   ======================================================= */
router.use(authMiddleware, (req: any, _res: Response, next: NextFunction) => {
  console.log("🔐 [AUTH PASSED]");
  console.log("👤 Auth User:", req.user);
  next();
});

/* =======================================================
   💬 CHAT MESSAGE ROUTES (Real-time)
   ======================================================= */
// GET messages for a task chat
router.get("/tasks/:id/chat", (req, res, next) => {
  // Short-term cache: 5–10s (optional, mostly real-time)
  res.set("Cache-Control", "private, max-age=10");
  next();
}, getTaskMessages);

// POST a new message (emit via Socket.IO)
router.post("/tasks/:id/chat", (req, _res, next) => {
  console.log("💬 [ROUTE HIT] POST /tasks/:id/chat", { params: req.params, body: req.body });
  next();
}, addTaskMessage);

// List all task chats for the user (semi-static)
router.get("/task-chats", (req, res, next) => {
  res.set("Cache-Control", "private, max-age=15"); // short TTL cache
  next();
}, getUserTaskChats);

// Get specific task chat (semi-static)
router.get("/task-chats/:chatId", (req, res, next) => {
  res.set("Cache-Control", "private, max-age=15"); // short TTL cache
  next();
}, getTaskChatById);

// Invite / accept / leave task chat (real-time, no cache)
router.post("/task-chats/:chatId/invite", inviteMemberToTaskChat);
router.post("/task-chats/:chatId/accept", acceptTaskChatInvite);
router.post("/task-chats/:chatId/leave", leaveTaskChat);

/* =======================================================
   🎯 TASK GOAL ROUTES
   ======================================================= */
// GET all goals for a task chat (semi-static)
router.get("/chats/:chatId/task-goals", (req, res, next) => {
  console.log("🎯 [ROUTE HIT] GET /chats/:chatId/task-goals", req.params);
  res.set("Cache-Control", "private, max-age=15"); // short TTL cache
  next();
}, getTaskGoals);

// POST a new goal (real-time)
router.post("/chats/:chatId/task-goal", (req, _res, next) => {
  console.log("🎯 [ROUTE HIT] POST /chats/:chatId/task-goal", req.params, req.body);
  next();
}, createTaskGoal);

// PATCH goal status (real-time)
router.patch("/chats/:chatId/task-goal/:goalId/status", (req, _res, next) => {
  console.log("🛠 [ROUTE HIT] PATCH /chats/:chatId/task-goal/:goalId/status", req.params, req.body);
  next();
}, updateTaskGoalStatus);

// PATCH full goal update (real-time)
router.patch("/chats/:chatId/task-goal/:goalId", (req, _res, next) => {
  console.log("🛠 [ROUTE HIT] PATCH /chats/:chatId/task-goal/:goalId", { params: req.params, body: req.body });
  next();
}, updateTaskGoal);

// DELETE a goal (real-time)
router.delete("/chats/:chatId/task-goal/:goalId", (req, _res, next) => {
  console.log("🗑 [ROUTE HIT] DELETE /chats/:chatId/task-goal/:goalId", { params: req.params });
  next();
}, deleteTaskGoal);

/* =======================================================
   ❌ 404 FALLBACK
   ======================================================= */
router.use((req: Request, res: Response) => {
  console.error("🚨 [CHAT ROUTER 404] No route matched:", req.originalUrl);
  res.status(404).json({ error: "No matching chat route", path: req.originalUrl });
});

export default router;