import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
} from "../controllers/projectController";
import { authorize, authorizeProjectRole } from "../middlewares/authorization";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Projects
 *   description: Project management endpoints
 */

// 🔐 All routes require authentication
router.use(authMiddleware);

/**
 * @swagger
 * /api/projects:
 *   get:
 *     summary: Get all projects for authenticated user
 *     description: Returns a paginated list of projects where the user is creator, member, or has task-level access
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: Successfully retrieved projects
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
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 *                       createdBy:
 *                         type: object
 *                       members:
 *                         type: array
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *             example:
 *               data:
 *                 - _id: "507f1f77bcf86cd799439011"
 *                   name: "Website Redesign"
 *                   description: "Redesigning company website"
 *                   createdBy:
 *                     _id: "507f191e810c19729de860ea"
 *                     name: "John Doe"
 *                     email: "john@example.com"
 *                   members: []
 *               pagination:
 *                 total: 5
 *                 page: 1
 *                 limit: 10
 *                 totalPages: 1
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 */
// 📌 Get all projects user can see (admin sees all, members see their projects)
router.get("/", getProjects);

/**
 * @swagger
 * /api/projects/{id}:
 *   get:
 *     summary: Get a single project by ID
 *     description: Returns project details with all tasks the user has access to
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *         example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: Project details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 project:
 *                   type: object
 *                 tasks:
 *                   type: array
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden - not authorized to view this project
 *       404:
 *         description: Project not found
 *       500:
 *         description: Server error
 */
// 📌 Get single project
router.get("/:id", authorizeProjectRole(["admin", "editor", "viewer"]), getProjectById);

/**
 * @swagger
 * /api/projects:
 *   post:
 *     summary: Create a new project (Admin only)
 *     description: Creates a new project with the authenticated user as the creator. Only users with admin role can create projects.
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 description: Project name
 *                 example: "New Marketing Campaign"
 *               description:
 *                 type: string
 *                 description: Project description
 *                 example: "Q4 2024 marketing initiatives"
 *               members:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of user IDs to add as members
 *                 example: ["507f191e810c19729de860ea"]
 *     responses:
 *       201:
 *         description: Project created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Project created successfully"
 *                 project:
 *                   type: object
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden - only admins can create projects
 *       500:
 *         description: Server error
 */
// 📌 Create new project (admins only)
router.post("/", authorize("admin"), createProject);

/**
 * @swagger
 * /api/projects/{id}:
 *   put:
 *     summary: Update a project (Admin only)
 *     description: Update project details. Only users with admin role can update projects.
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *         example: "507f1f77bcf86cd799439011"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Updated Project Name"
 *               description:
 *                 type: string
 *                 example: "Updated description"
 *     responses:
 *       200:
 *         description: Project updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 project:
 *                   type: object
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden - only admins can update projects
 *       404:
 *         description: Project not found
 *       500:
 *         description: Server error
 */
// 📌 Update project (admins only)
router.put("/:id", authorize("admin"), updateProject);

/**
 * @swagger
 * /api/projects/{id}:
 *   delete:
 *     summary: Delete a project (Admin only)
 *     description: Permanently delete a project. Only users with admin role can delete projects.
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *         example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: Project deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Project deleted"
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden - only admins can delete projects
 *       404:
 *         description: Project not found
 *       500:
 *         description: Server error
 */
// 📌 Delete project (admins only)
router.delete("/:id", authorize("admin"), deleteProject);

export default router;