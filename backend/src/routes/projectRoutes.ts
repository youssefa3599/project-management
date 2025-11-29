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

// 🔐 All routes require authentication
router.use(authMiddleware);

// 📌 Get all projects user can see (admin sees all, members see their projects)
router.get("/", getProjects);

// 📌 Get single project
router.get("/:id", authorizeProjectRole(["admin", "editor", "viewer"]), getProjectById);

// 📌 Create new project (admins only)
router.post("/", authorize("admin"), createProject);

// 📌 Update project (admins only)
router.put("/:id", authorize("admin"), updateProject);

// 📌 Delete project (admins only)
router.delete("/:id", authorize("admin"), deleteProject);

export default router;
