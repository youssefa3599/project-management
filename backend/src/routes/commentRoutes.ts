import express from "express";
import { createComment, getCommentsByTask } from "../controllers/commentController";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = express.Router();

// POST /api/comments → create a new comment
router.post("/", authMiddleware, createComment);

// GET /api/comments/:taskId → get all comments for a task
router.get("/:taskId", authMiddleware, getCommentsByTask);

export default router;
