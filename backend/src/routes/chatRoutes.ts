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
   🌍 ROUTER-LEVEL DEBUG ENTRY - ENHANCED
   ======================================================= */
router.use((req: Request, _res: Response, next: NextFunction) => {
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("🌍 [CHAT ROUTER ENTERED]");
  console.log("═══════════════════════════════════════════════════════");
  console.log("➡️ METHOD:", req.method);
  console.log("➡️ URL:", req.originalUrl);
  console.log("➡️ PATH:", req.path);
  console.log("➡️ BASE URL:", req.baseUrl);
  console.log("➡️ PARAMS:", JSON.stringify(req.params, null, 2));
  console.log("➡️ QUERY:", JSON.stringify(req.query, null, 2));
  console.log("➡️ BODY:", JSON.stringify(req.body, null, 2));
  console.log("➡️ HEADERS (Auth):", req.headers.authorization ? "✅ Token present" : "❌ No token");
  console.log("➡️ IP:", req.ip);
  console.log("➡️ TIMESTAMP:", new Date().toISOString());
  console.log("═══════════════════════════════════════════════════════");
  next();
});

/* =======================================================
   🛡 AUTH MIDDLEWARE CHECKPOINT - ENHANCED
   ======================================================= */
router.use(authMiddleware, (req: any, _res: Response, next: NextFunction) => {
  console.log("───────────────────────────────────────────────────────");
  console.log("🔐 [AUTH MIDDLEWARE] Authentication passed");
  console.log("───────────────────────────────────────────────────────");
  console.log("👤 Auth User Details:");
  console.log("   → User ID:", req.user?.id);
  console.log("   → User Name:", req.user?.name);
  console.log("   → User Email:", req.user?.email);
  console.log("   → User Role:", req.user?.role);
  console.log("   → Full user object:", JSON.stringify(req.user, null, 2));
  console.log("───────────────────────────────────────────────────────");
  next();
});

/* =======================================================
   💬 CHAT MESSAGE ROUTES (Real-time)
   ======================================================= */

// GET messages for a task chat
router.get("/tasks/:id/chat", (req, res, next) => {
  console.log("───────────────────────────────────────────────────────");
  console.log("📥 [ROUTE] GET /tasks/:id/chat");
  console.log("   → Task ID:", req.params.id);
  console.log("   → Cache-Control: private, max-age=10");
  console.log("───────────────────────────────────────────────────────");
  res.set("Cache-Control", "private, max-age=10");
  next();
}, getTaskMessages);

// POST a new message (emit via Socket.IO)
router.post("/tasks/:id/chat", (req, _res, next) => {
  console.log("───────────────────────────────────────────────────────");
  console.log("💬 [ROUTE] POST /tasks/:id/chat - NEW MESSAGE");
  console.log("───────────────────────────────────────────────────────");
  console.log("📝 Message Details:");
  console.log("   → Task ID:", req.params.id);
  console.log("   → Message Content:", req.body.content);
  console.log("   → Message Length:", req.body.content?.length || 0);
  console.log("   → Contains '@':", req.body.content?.includes('@') ? '✅ YES' : '❌ NO');
  
  // Check for mentions in the content
  if (req.body.content) {
    const mentions = req.body.content.match(/@(\w+)/g);
    if (mentions) {
      console.log("   → 📢 MENTIONS DETECTED:", mentions);
      console.log("   → Number of mentions:", mentions.length);
    } else {
      console.log("   → ℹ️ No mentions in message");
    }
  }
  
  console.log("   → Request from user:", (req as any).user?.name);
  console.log("   → Timestamp:", new Date().toISOString());
  console.log("───────────────────────────────────────────────────────");
  console.log("🎯 Forwarding to addTaskMessage controller...");
  console.log("───────────────────────────────────────────────────────");
  next();
}, addTaskMessage);

// List all task chats for the user (semi-static)
router.get("/task-chats", (req, res, next) => {
  console.log("───────────────────────────────────────────────────────");
  console.log("📋 [ROUTE] GET /task-chats");
  console.log("   → User:", (req as any).user?.name);
  console.log("   → Cache-Control: private, max-age=15");
  console.log("───────────────────────────────────────────────────────");
  res.set("Cache-Control", "private, max-age=15");
  next();
}, getUserTaskChats);

// Get specific task chat (semi-static)
router.get("/task-chats/:chatId", (req, res, next) => {
  console.log("───────────────────────────────────────────────────────");
  console.log("📄 [ROUTE] GET /task-chats/:chatId");
  console.log("   → Chat ID:", req.params.chatId);
  console.log("   → User:", (req as any).user?.name);
  console.log("   → Cache-Control: private, max-age=15");
  console.log("───────────────────────────────────────────────────────");
  res.set("Cache-Control", "private, max-age=15");
  next();
}, getTaskChatById);

// Invite / accept / leave task chat (real-time, no cache)
router.post("/task-chats/:chatId/invite", (req, _res, next) => {
  console.log("───────────────────────────────────────────────────────");
  console.log("📨 [ROUTE] POST /task-chats/:chatId/invite");
  console.log("   → Chat ID:", req.params.chatId);
  console.log("   → Inviting user ID:", req.body.userId);
  console.log("   → Inviter:", (req as any).user?.name);
  console.log("───────────────────────────────────────────────────────");
  next();
}, inviteMemberToTaskChat);

router.post("/task-chats/:chatId/accept", (req, _res, next) => {
  console.log("───────────────────────────────────────────────────────");
  console.log("✅ [ROUTE] POST /task-chats/:chatId/accept");
  console.log("   → Chat ID:", req.params.chatId);
  console.log("   → User accepting:", (req as any).user?.name);
  console.log("───────────────────────────────────────────────────────");
  next();
}, acceptTaskChatInvite);

router.post("/task-chats/:chatId/leave", (req, _res, next) => {
  console.log("───────────────────────────────────────────────────────");
  console.log("👋 [ROUTE] POST /task-chats/:chatId/leave");
  console.log("   → Chat ID:", req.params.chatId);
  console.log("   → User leaving:", (req as any).user?.name);
  console.log("───────────────────────────────────────────────────────");
  next();
}, leaveTaskChat);

/* =======================================================
   🎯 TASK GOAL ROUTES
   ======================================================= */

// GET all goals for a task chat (semi-static)
router.get("/chats/:chatId/task-goals", (req, res, next) => {
  console.log("───────────────────────────────────────────────────────");
  console.log("🎯 [ROUTE] GET /chats/:chatId/task-goals");
  console.log("   → Chat ID:", req.params.chatId);
  console.log("   → User:", (req as any).user?.name);
  console.log("   → Cache-Control: private, max-age=15");
  console.log("───────────────────────────────────────────────────────");
  res.set("Cache-Control", "private, max-age=15");
  next();
}, getTaskGoals);

// POST a new goal (real-time)
router.post("/chats/:chatId/task-goal", (req, _res, next) => {
  console.log("───────────────────────────────────────────────────────");
  console.log("🎯 [ROUTE] POST /chats/:chatId/task-goal");
  console.log("   → Chat ID:", req.params.chatId);
  console.log("   → Goal Title:", req.body.title);
  console.log("   → Goal Link:", req.body.link);
  console.log("   → Created by:", (req as any).user?.name);
  console.log("───────────────────────────────────────────────────────");
  next();
}, createTaskGoal);

// PATCH goal status (real-time)
router.patch("/chats/:chatId/task-goal/:goalId/status", (req, _res, next) => {
  console.log("───────────────────────────────────────────────────────");
  console.log("🛠 [ROUTE] PATCH /chats/:chatId/task-goal/:goalId/status");
  console.log("   → Chat ID:", req.params.chatId);
  console.log("   → Goal ID:", req.params.goalId);
  console.log("   → New Status:", req.body.status);
  console.log("   → Updated by:", (req as any).user?.name);
  console.log("───────────────────────────────────────────────────────");
  next();
}, updateTaskGoalStatus);

// PATCH full goal update (real-time)
router.patch("/chats/:chatId/task-goal/:goalId", (req, _res, next) => {
  console.log("───────────────────────────────────────────────────────");
  console.log("🛠 [ROUTE] PATCH /chats/:chatId/task-goal/:goalId");
  console.log("   → Chat ID:", req.params.chatId);
  console.log("   → Goal ID:", req.params.goalId);
  console.log("   → Update data:", JSON.stringify(req.body, null, 2));
  console.log("   → Updated by:", (req as any).user?.name);
  console.log("───────────────────────────────────────────────────────");
  next();
}, updateTaskGoal);

// DELETE a goal (real-time)
router.delete("/chats/:chatId/task-goal/:goalId", (req, _res, next) => {
  console.log("───────────────────────────────────────────────────────");
  console.log("🗑 [ROUTE] DELETE /chats/:chatId/task-goal/:goalId");
  console.log("   → Chat ID:", req.params.chatId);
  console.log("   → Goal ID:", req.params.goalId);
  console.log("   → Deleted by:", (req as any).user?.name);
  console.log("───────────────────────────────────────────────────────");
  next();
}, deleteTaskGoal);

/* =======================================================
   ❌ 404 FALLBACK - ENHANCED
   ======================================================= */
router.use((req: Request, res: Response) => {
  console.error("═══════════════════════════════════════════════════════");
  console.error("🚨 [CHAT ROUTER 404] No route matched!");
  console.error("═══════════════════════════════════════════════════════");
  console.error("❌ Request Details:");
  console.error("   → Method:", req.method);
  console.error("   → URL:", req.originalUrl);
  console.error("   → Path:", req.path);
  console.error("   → Base URL:", req.baseUrl);
  console.error("   → Available routes:");
  console.error("      • GET /tasks/:id/chat");
  console.error("      • POST /tasks/:id/chat");
  console.error("      • GET /task-chats");
  console.error("      • GET /task-chats/:chatId");
  console.error("      • POST /task-chats/:chatId/invite");
  console.error("      • POST /task-chats/:chatId/accept");
  console.error("      • POST /task-chats/:chatId/leave");
  console.error("      • GET /chats/:chatId/task-goals");
  console.error("      • POST /chats/:chatId/task-goal");
  console.error("      • PATCH /chats/:chatId/task-goal/:goalId/status");
  console.error("      • PATCH /chats/:chatId/task-goal/:goalId");
  console.error("      • DELETE /chats/:chatId/task-goal/:goalId");
  console.error("═══════════════════════════════════════════════════════");
  res.status(404).json({ 
    error: "No matching chat route", 
    path: req.originalUrl,
    method: req.method,
    availableRoutes: [
      "GET /tasks/:id/chat",
      "POST /tasks/:id/chat",
      "GET /task-chats",
      "GET /task-chats/:chatId",
      "POST /task-chats/:chatId/invite",
      "POST /task-chats/:chatId/accept",
      "POST /task-chats/:chatId/leave"
    ]
  });
});

export default router;