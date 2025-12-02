import express from "express";
import { 
  createComment, 
  getCommentsByTask,
 
} from "../controllers/commentController";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = express.Router();

/**
 * @swagger
 * /api/comments:
 *   post:
 *     summary: Create a comment or reply
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - text
 *               - taskId
 *             properties:
 *               text:
 *                 type: string
 *                 description: Comment text
 *                 example: "Great work on this task!"
 *               taskId:
 *                 type: string
 *                 description: Task ID
 *                 example: "507f1f77bcf86cd799439011"
 *               parentCommentId:
 *                 type: string
 *                 description: Parent comment ID (for nested replies)
 *                 example: "507f1f77bcf86cd799439012"
 *     responses:
 *       201:
 *         description: Comment created successfully
 *       400:
 *         description: Missing required fields
 *       404:
 *         description: Task or parent comment not found
 */
router.post("/", authMiddleware, createComment);

/**
 * @swagger
 * /api/comments/nested/{taskId}:
 *   get:
 *     summary: Get nested comments tree structure
 *     description: Returns comments with replies nested inside parent comments
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *         description: Task ID
 *         example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: Nested comments tree
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       text:
 *                         type: string
 *                       user:
 *                         type: object
 *                       replies:
 *                         type: array
 *                         description: Nested replies
 *                 total:
 *                   type: number
 *                 topLevel:
 *                   type: number
 *                 replies:
 *                   type: number
 */
  // ⬆️ MUST BE FIRST!

/**
 * @swagger
 * /api/comments/{taskId}:
 *   get:
 *     summary: Get flat list of comments (paginated)
 *     description: Returns all comments for a task in flat list with pagination
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: string
 *         description: Task ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Paginated list of comments
 */
router.get("/:taskId", authMiddleware, getCommentsByTask);  // ⬇️ Generic route LAST!

export default router;