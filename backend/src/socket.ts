import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";

export const initSocket = (io: Server) => {
  console.log("═══════════════════════════════════════════════════════");
  console.log("🔌 [SOCKET.IO] Initializing Socket.IO server...");
  console.log("═══════════════════════════════════════════════════════");

  // ═══════════════════════════════════════════════════════
  // 🔐 Authentication Middleware
  // ═══════════════════════════════════════════════════════
  io.use((socket: Socket, next) => {
    console.log("───────────────────────────────────────────────────────");
    console.log("🔐 [AUTH] New socket connection attempt");
    console.log(`   → Socket ID: ${socket.id}`);
    console.log(`   → IP: ${socket.handshake.address}`);
    
    const token = socket.handshake.auth.token;
    console.log(`   → Token present: ${!!token}`);
    
    if (!token) {
      console.error("❌ [AUTH] No token provided - rejecting connection");
      return next(new Error("Authentication error: No token"));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      
      // ✅ FIXED: Support both "userId" and "id" for backwards compatibility
      const userId = decoded.userId || decoded.id;
      socket.data.userId = userId;
      
      console.log("✅ [AUTH] Token verified successfully");
      console.log(`   → User ID: ${userId}`);
      console.log(`   → User ID type: ${typeof userId}`);
      console.log(`   → Email: ${decoded.email || 'N/A'}`);
      console.log(`   → Token uses: ${decoded.userId ? 'userId' : 'id'} field`);
      
      next();
    } catch (err: any) {
      console.error("❌ [AUTH] Token verification failed");
      console.error(`   → Error: ${err.message}`);
      next(new Error("Authentication error: Invalid token"));
    }
  });

  // ═══════════════════════════════════════════════════════
  // 🔗 Connection Handler
  // ═══════════════════════════════════════════════════════
  io.on("connection", (socket: Socket) => {
    const userId = socket.data.userId;
    
    console.log("═══════════════════════════════════════════════════════");
    console.log("🔌 [CONNECTION] User connected");
    console.log(`   → User ID: ${userId}`);
    console.log(`   → User ID type: ${typeof userId}`);
    console.log(`   → Socket ID: ${socket.id}`);
    console.log(`   → Time: ${new Date().toISOString()}`);
    console.log("═══════════════════════════════════════════════════════");

    // ✅ CRITICAL: Join user to their personal room
    console.log("📦 [JOIN ROOM] Adding user to personal room...");
    socket.join(userId);
    console.log(`   → Joined room: "${userId}"`);
    console.log(`   → All socket rooms: [${Array.from(socket.rooms).join(", ")}]`);

    // Verify the join was successful
    const isInRoom = socket.rooms.has(userId);
    if (isInRoom) {
      console.log("✅ [JOIN ROOM] Successfully joined personal room");
    } else {
      console.error("❌ [JOIN ROOM] FAILED to join personal room!");
      console.error(`   → Expected room: ${userId}`);
      console.error(`   → Actual rooms: [${Array.from(socket.rooms).join(", ")}]`);
    }

    // Log total connections
    io.fetchSockets().then(sockets => {
      console.log(`📊 [STATS] Total connected sockets: ${sockets.length}`);
      console.log("   → Connected users:");
      sockets.forEach((s, index) => {
        console.log(`      ${index + 1}. User ID: ${s.data.userId}, Socket ID: ${s.id}`);
      });
    });

    // ═══════════════════════════════════════════════════════
    // 📨 Event Listeners
    // ═══════════════════════════════════════════════════════

    // ✅ Join task chat room
    socket.on("joinTaskChat", (taskId: string) => {
      console.log("───────────────────────────────────────────────────────");
      console.log("📥 [JOIN TASK CHAT] Event received");
      console.log(`   → User: ${userId}`);
      console.log(`   → Task ID: ${taskId}`);
      console.log(`   → Task ID type: ${typeof taskId}`);
      
      // ✅ Check if taskId is valid
      if (!taskId || typeof taskId !== 'string') {
        console.error("❌ [JOIN TASK CHAT] Invalid taskId!");
        console.error(`   → Received: ${taskId}`);
        console.error(`   → Type: ${typeof taskId}`);
        return;
      }
      
      const roomName = `task_${taskId}`;
      socket.join(roomName);
      
      console.log(`   → Joined room: "${roomName}"`);
      console.log(`   → All rooms: [${Array.from(socket.rooms).join(", ")}]`);
      
      // ✅ Verify join and log room occupancy
      io.in(roomName).fetchSockets().then(sockets => {
        console.log(`   → Total sockets in "${roomName}": ${sockets.length}`);
        sockets.forEach((s, idx) => {
          console.log(`      ${idx + 1}. Socket: ${s.id}, User: ${s.data.userId}`);
        });
      });
      
      // ✅ Send confirmation to client
      socket.emit("joinedTaskChat", { 
        taskId, 
        roomName, 
        success: true,
        message: `Successfully joined ${roomName}`
      });
      
      console.log("✅ [JOIN TASK CHAT] Confirmation sent to client");
      console.log("───────────────────────────────────────────────────────");
    });

    // ✅ Leave task chat room
    socket.on("leaveTaskChat", (taskId: string) => {
      console.log("───────────────────────────────────────────────────────");
      console.log("📤 [LEAVE TASK CHAT] Event received");
      console.log(`   → User: ${userId}`);
      console.log(`   → Task ID: ${taskId}`);
      console.log(`   → Task ID type: ${typeof taskId}`);
      
      if (!taskId || typeof taskId !== 'string') {
        console.error("❌ [LEAVE TASK CHAT] Invalid taskId!");
        return;
      }
      
      const roomName = `task_${taskId}`;
      socket.leave(roomName);
      
      console.log(`   → Left room: "${roomName}"`);
      console.log(`   → Remaining rooms: [${Array.from(socket.rooms).join(", ")}]`);
      
      // ✅ Log remaining room occupancy
      io.in(roomName).fetchSockets().then(sockets => {
        console.log(`   → Remaining sockets in "${roomName}": ${sockets.length}`);
      });
      
      console.log("───────────────────────────────────────────────────────");
    });

    // ✅ Get current rooms (for debugging)
    socket.on("getRooms", () => {
      console.log("───────────────────────────────────────────────────────");
      console.log("🔍 [GET ROOMS] Request received");
      const rooms = Array.from(socket.rooms);
      console.log(`   → User: ${userId}`);
      console.log(`   → Rooms: [${rooms.join(", ")}]`);
      
      socket.emit("currentRooms", { rooms });
      console.log("───────────────────────────────────────────────────────");
    });

    // ✅ Test event to verify socket communication
    socket.on("ping", (data) => {
      console.log("───────────────────────────────────────────────────────");
      console.log("🏓 [PING] Received from client");
      console.log(`   → User: ${userId}`);
      console.log(`   → Data:`, data);
      socket.emit("pong", { 
        message: "pong", 
        receivedAt: new Date().toISOString(),
        yourData: data 
      });
      console.log("   → Sent pong response");
      console.log("───────────────────────────────────────────────────────");
    });

    // ═══════════════════════════════════════════════════════
    // 🔌 Disconnection Handler
    // ═══════════════════════════════════════════════════════
    socket.on("disconnect", (reason) => {
      console.log("═══════════════════════════════════════════════════════");
      console.log("🔌 [DISCONNECT] User disconnected");
      console.log(`   → User ID: ${userId}`);
      console.log(`   → Socket ID: ${socket.id}`);
      console.log(`   → Reason: ${reason}`);
      console.log(`   → Time: ${new Date().toISOString()}`);
      
      // Log remaining connections
      io.fetchSockets().then(sockets => {
        console.log(`   → Remaining connected sockets: ${sockets.length}`);
      });
      
      console.log("═══════════════════════════════════════════════════════");
    });

    // ═══════════════════════════════════════════════════════
    // ⚠️ Error Handler
    // ═══════════════════════════════════════════════════════
    socket.on("error", (error) => {
      console.error("═══════════════════════════════════════════════════════");
      console.error("❌ [SOCKET ERROR]");
      console.error(`   → User ID: ${userId}`);
      console.error(`   → Socket ID: ${socket.id}`);
      console.error(`   → Error:`, error);
      console.error("═══════════════════════════════════════════════════════");
    });

    // Send welcome message to confirm connection
    socket.emit("welcome", {
      message: "Connected to server",
      userId: userId,
      socketId: socket.id,
      timestamp: new Date().toISOString()
    });
    console.log("📨 [WELCOME] Sent welcome message to client");
  });

  console.log("✅ [SOCKET.IO] Initialization complete");
};