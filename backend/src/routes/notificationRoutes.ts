import express from "express";
import {
  createNotification,
  getUserNotifications,
  markNotificationAsRead,
  deleteNotification,
  respondToNotification, // ✅ add this
} from "../controllers/notificationController";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = express.Router();

router.post("/", authMiddleware, createNotification);
router.get("/", authMiddleware, getUserNotifications);
router.patch("/:id/read", authMiddleware, markNotificationAsRead);
router.post("/:id/respond", authMiddleware, respondToNotification); // ✅ new route
router.delete("/:id", authMiddleware, deleteNotification);

export default router;
