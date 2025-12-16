import express from "express";
import {
  createNotification,
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead, // ✅ ADD THIS IMPORT
  deleteNotification,
  respondToNotification,
} from "../controllers/notificationController";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = express.Router();

router.post("/", authMiddleware, createNotification);
router.get("/", authMiddleware, getUserNotifications);

// ✅ ADD THIS LINE - Mark all notifications as read (MUST come before /:id routes!)
router.patch("/read-all", authMiddleware, markAllNotificationsAsRead);

router.patch("/:id/read", authMiddleware, markNotificationAsRead);
router.post("/:id/respond", authMiddleware, respondToNotification);
router.delete("/:id", authMiddleware, deleteNotification);

export default router;