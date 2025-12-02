import express, { Request, Response } from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';

// ✅ Route Imports
import authRoutes from "./routes/authRoutes";
import activityRoutes from './routes/activityRoutes';
import commentRoutes from "./routes/commentRoutes";
import notificationRoutes from "./routes/notificationRoutes";
import projectRoutes from "./routes/projectRoutes";
import taskRoutes from "./routes/taskRoutes";
import chatRoutes from "./routes/chatRoutes";

dotenv.config();

const app = express();

// ✅ Environment setup
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const NODE_ENV = process.env.NODE_ENV || "development";

// ✅ Middlewares
app.use(
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    credentials: true,
  })
);

app.use(express.json());
app.use(morgan("dev"));

// ✅ Startup debug info
console.log("🚀 Starting Express server...");
console.log(`🌍 FRONTEND_URL: ${FRONTEND_URL}`);
console.log(`🧱 NODE_ENV: ${NODE_ENV}`);

// ✅ Swagger Documentation - ADD THIS BEFORE YOUR ROUTES
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ✅ Routes
app.use("/api/auth", authRoutes);
app.use('/api/activities', activityRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api", chatRoutes);

// ✅ Health check route
app.get("/api/health", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    environment: NODE_ENV,
    frontend: FRONTEND_URL,
    timestamp: new Date().toISOString(),
  });
});

// ✅ 404 fallback for debugging missing routes
app.use((req: Request, res: Response) => {
  console.warn(`❌ [404] Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    error: "Route not found",
    path: req.originalUrl,
  });
});

// ✅ Global error handler
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error("🔥 [SERVER ERROR]", err);
  res.status(500).json({
    error: "Internal Server Error",
    details: NODE_ENV === "development" ? err.message : undefined,
  });
});

export default app;