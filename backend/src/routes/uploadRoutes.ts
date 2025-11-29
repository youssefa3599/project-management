import express from "express";
import { uploadFile } from "../controllers/uploadController";
import { upload } from "../middlewares/upload";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = express.Router();

router.post("/", authMiddleware, upload.single("file"), uploadFile);

export default router;
