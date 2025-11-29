// src/middlewares/upload.ts
import multer from "multer";

const storage = multer.memoryStorage(); // store file buffer in memory
export const upload = multer({ storage });
