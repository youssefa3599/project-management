// MUST BE FIRST - Load environment variables
import dotenv from "dotenv";

dotenv.config();

// Debug: Check if env variables loaded
console.log("\n🔍 Environment Variables Check:");
console.log("SMTP_HOST:", process.env.SMTP_HOST || "NOT SET");
console.log("SMTP_USER:", process.env.SMTP_USER || "NOT SET");
console.log("SMTP_PASS:", process.env.SMTP_PASS ? "***SET***" : "NOT SET");
console.log("EMAIL_FROM:", process.env.EMAIL_FROM || "NOT SET");
console.log("\n");

import mongoose from "mongoose";
import app from "./app";
import http from "http";
import { Server } from "socket.io";
import { initSocket } from "./socket";
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';

const server = http.createServer(app);

console.log("═══════════════════════════════════════════════════════");
console.log("🔌 [SOCKET.IO] Initializing Socket.IO server...");
console.log("═══════════════════════════════════════════════════════");

// Initialize Socket.IO immediately with the server
export const io = new Server(server, { 
  cors: { 
    origin: process.env.FRONTEND_URL || "http://localhost:5173", 
    credentials: true 
  } 
});

console.log("✅ [SOCKET.IO] Socket.IO instance created");

// Initialize socket handlers
initSocket(io);
console.log("✅ [SOCKET.IO] Socket handlers initialized");

// 🚨 CRITICAL FIX: Attach io to Express app
console.log("📌 [SOCKET.IO] Attaching to Express app...");
app.set("io", io);
console.log("✅ [SOCKET.IO] Attached to app successfully");

// 🧪 Test that it works
const testIo = app.get("io");
if (testIo) {
  console.log("🧪 [SOCKET.IO] Test retrieval: ✅ SUCCESS");
  console.log("   → Controllers can now access io via: req.app.get('io')");
} else {
  console.error("🧪 [SOCKET.IO] Test retrieval: ❌ FAILED");
  console.error("   → This will cause notification issues!");
}

console.log("═══════════════════════════════════════════════════════");

// ═══════════════════════════════════════════════════════════════
// 📚 Swagger API Documentation Setup
// ═══════════════════════════════════════════════════════════════
console.log("📚 [SWAGGER] Setting up API documentation...");
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: "Project Management API Docs",
  customfavIcon: "/favicon.ico",
  swaggerOptions: {
    persistAuthorization: true, // Keeps your JWT token even after page refresh
  }
}));
console.log("✅ [SWAGGER] API documentation configured");
console.log("═══════════════════════════════════════════════════════");

const MONGO_URI = process.env.MONGO_URI!;

mongoose.set("debug", true); // optional query debug

console.log("⏳ [MONGODB] Connecting to MongoDB...");
mongoose.connect(MONGO_URI)
  .then(() => {
    console.log("═══════════════════════════════════════════════════════");
    console.log("✅ [MONGODB] MongoDB connected successfully");
    console.log("═══════════════════════════════════════════════════════");

    // Start the server only after MongoDB connects
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log("═══════════════════════════════════════════════════════");
      console.log("🚀 [SERVER] Server running successfully!");
      console.log(`   → Port: ${PORT}`);
      console.log(`   → API: http://localhost:${PORT}`);
      console.log(`   → Socket.IO: ✅ Ready for connections`);
      console.log(`   → Health Check: http://localhost:${PORT}/api/health`);
      console.log(`   → 📚 API Documentation: http://localhost:${PORT}/api-docs`);
      console.log("═══════════════════════════════════════════════════════");
      console.log("💡 TIP: Visit /api-docs to test your API endpoints!");
      console.log("═══════════════════════════════════════════════════════");
    });
  })
  .catch((err) => {
    console.error("═══════════════════════════════════════════════════════");
    console.error("❌ [MONGODB] MongoDB connection failed!");
    console.error("   → Error:", err.message);
    console.error("═══════════════════════════════════════════════════════");
    process.exit(1);
  });