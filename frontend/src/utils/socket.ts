// src/utils/socket.ts
import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;
let connectionPromise: Promise<Socket> | null = null;

/**
 * ✅ Connect to the Socket.IO server (Singleton pattern)
 */
export const connectSocket = (token: string): Socket => {
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
  
  console.log("═══════════════════════════════════════════════════════");
  console.log("🔌 [Socket Utility] connectSocket called");
  console.log("   → Token present:", !!token);
  console.log("   → Socket exists:", !!socket);
  console.log("   → Socket connected:", socket?.connected);

  // If socket exists and is connected, return it immediately
  if (socket && socket.connected) {
    console.log("   → ✅ Reusing existing CONNECTED socket");
    console.log("   → Socket ID:", socket.id);
    console.log("═══════════════════════════════════════════════════════");
    return socket;
  }

  // If socket exists but disconnected, try to reconnect
  if (socket && !socket.connected) {
    console.log("   → 🔄 Socket exists but disconnected, reconnecting...");
    socket.connect();
    console.log("═══════════════════════════════════════════════════════");
    return socket;
  }

  // Create new socket connection
  console.log("   → 🆕 Creating NEW socket connection");
  console.log("   → API URL:", API_URL);

  socket = io(API_URL, {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 10,
    autoConnect: true,
  });

  console.log("   → Socket instance created");

  // System event listeners (only set once)
  socket.on("connect", () => {
    console.log("═══════════════════════════════════════════════════════");
    console.log("✅ [Socket Utility] Socket CONNECTED");
    console.log("   → Socket ID:", socket?.id);
    console.log("   → Transport:", socket?.io.engine.transport.name);
    console.log("═══════════════════════════════════════════════════════");
  });

  socket.on("disconnect", (reason) => {
    console.log("═══════════════════════════════════════════════════════");
    console.log("❌ [Socket Utility] Socket DISCONNECTED");
    console.log("   → Reason:", reason);
    
    // Don't clear socket instance - allow automatic reconnection
    if (reason === "io server disconnect") {
      console.log("   → Server disconnected, will reconnect automatically");
    }
    console.log("═══════════════════════════════════════════════════════");
  });

  socket.on("connect_error", (error) => {
    console.error("═══════════════════════════════════════════════════════");
    console.error("❌ [Socket Utility] Connection ERROR");
    console.error("   → Error:", error.message);
    console.error("═══════════════════════════════════════════════════════");
  });

  socket.on("reconnect", (attemptNumber) => {
    console.log("═══════════════════════════════════════════════════════");
    console.log("🔄 [Socket Utility] Socket RECONNECTED");
    console.log("   → Attempt number:", attemptNumber);
    console.log("═══════════════════════════════════════════════════════");
  });

  console.log("✅ [Socket Utility] Socket setup complete");
  console.log("═══════════════════════════════════════════════════════");

  return socket;
};

/**
 * 🔌 DON'T disconnect - keep alive
 */
export const disconnectSocket = (): void => {
  console.log("🔌 [Socket Utility] disconnectSocket called (keeping connection alive)");
  // Don't disconnect - socket should persist
};

/**
 * 💀 Force disconnect (only on logout)
 */
export const forceDisconnectSocket = (): void => {
  console.log("═══════════════════════════════════════════════════════");
  console.log("🔌 [Socket Utility] FORCE disconnect");
  
  if (socket) {
    console.log("   → Disconnecting socket:", socket.id);
    socket.disconnect();
    socket.removeAllListeners(); // Remove all listeners
    socket = null;
    console.log("✅ [Socket Utility] Socket completely destroyed");
  }
  console.log("═══════════════════════════════════════════════════════");
};

/**
 * 🧠 Get socket instance
 */
export const getSocket = (): Socket | null => {
  return socket;
};

/**
 * 🏗️ Join task chat
 */
export const joinTaskChat = (taskId: string): void => {
  if (!socket || !socket.connected) {
    console.error("❌ Cannot join task chat - socket not connected");
    return;
  }
  console.log(`🚪 Joining task chat: task_${taskId}`);
  socket.emit("joinTaskChat", taskId);
};

/**
 * 🚪 Leave task chat
 */
export const leaveTaskChat = (taskId: string): void => {
  if (!socket || !socket.connected) {
    console.error("❌ Cannot leave task chat - socket not connected");
    return;
  }
  console.log(`🚪 Leaving task chat: task_${taskId}`);
  socket.emit("leaveTaskChat", taskId);
};