import React, { useEffect, useState } from "react";
import { NavLink, Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import axios from "axios";
import { connectSocket, forceDisconnectSocket } from "../utils/socket";
import ActivityLog from "../pages/ActivityLog";
import "./AppNavbar.css";

interface INotification {
  _id: string;
  isRead: boolean;
  status?: string;
  type?: string;
  message?: string;
}

const AppNavbar: React.FC = () => {
  const { user, logout, token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);

  const API_URL = import.meta.env.VITE_API_URL;

  if (!user) return null;

  const handleLogout = () => {
    forceDisconnectSocket(); // Force disconnect on logout
    logout();
    navigate("/login", { replace: true });
  };

  /** ---------------------------------------
   * Fetch unread notifications count
   * Refetches when location changes (navigation)
   * --------------------------------------- */
  useEffect(() => {
    if (!token) return;

    const fetchUnread = async () => {
      try {
        console.log("═══════════════════════════════════════════════════════");
        console.log("🔄 [Navbar] Fetching unread count...");
        console.log("   → API URL:", `${API_URL}/api/notifications`);
        console.log("   → Token present:", !!token);
        
        const res = await axios.get(`${API_URL}/api/notifications`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        console.log("   → Response status:", res.status);
        console.log("   → Total notifications:", res.data.data?.length || 0);

        const notifications: INotification[] = res.data.data || [];
        
        // Log all notifications
        console.log("   → All notifications:");
        notifications.forEach((n, idx) => {
          console.log(`      ${idx + 1}. ID: ${n._id}, isRead: ${n.isRead}, status: ${n.status}, type: ${n.type}`);
        });
        
        const unread = notifications.filter(
          (n) => !n.isRead && (n.status === "pending" || !n.status)
        ).length;
        
        console.log(`   → Unread count calculated: ${unread}`);
        console.log(`   → Filter criteria: isRead=false AND (status=pending OR status=undefined)`);
        setUnreadCount(unread);
        console.log(`📊 [Navbar] Unread count set to: ${unread}`);
        console.log("═══════════════════════════════════════════════════════");
      } catch (err: any) {
        console.error("═══════════════════════════════════════════════════════");
        console.error("❌ [Navbar] Failed to fetch notifications");
        console.error("   → Error:", err.message);
        console.error("   → Response:", err.response?.data);
        console.error("═══════════════════════════════════════════════════════");
      }
    };

    fetchUnread();
  }, [token, API_URL, location.pathname]); // Refetch when route changes

  /** ---------------------------------------
   * Socket setup for live updates
   * ✅ CRITICAL FIX: Only cleanup on token change (login/logout)
   * NOT on route navigation!
   * --------------------------------------- */
  useEffect(() => {
    if (!token || !user) {
      console.log("⚠️ [Navbar Socket] Skipping - no token or user");
      return;
    }

    console.log("═══════════════════════════════════════════════════════");
    console.log("🔌 [Navbar Socket] Setting up socket connection");
    console.log("   → User ID:", user.id);
    console.log("   → User Name:", user.name);
    console.log("   → User Email:", user.email);
    console.log("   → Current Route:", location.pathname);
    
    const socket = connectSocket(token);
    console.log("   → Socket instance obtained");

    // Test if socket is connected
    const handleConnect = () => {
      console.log("✅ [Navbar Socket] Socket CONNECTED");
      console.log("   → Socket ID:", socket.id);
    };

    const handleDisconnect = (reason: string) => {
      console.log("❌ [Navbar Socket] Socket DISCONNECTED");
      console.log("   → Reason:", reason);
    };

    const handleConnectError = (error: Error) => {
      console.error("❌ [Navbar Socket] Connection ERROR");
      console.error("   → Error:", error.message);
    };

    const handleWelcome = (data: any) => {
      console.log("👋 [Navbar Socket] Welcome message received");
      console.log("   → Data:", data);
    };

    // Listen for new notifications (mentions)
    const handleNewNotification = (notification: INotification) => {
      console.log("═══════════════════════════════════════════════════════");
      console.log("📩 [Navbar Socket] Received newNotification event");
      console.log("   → Notification ID:", notification._id);
      console.log("   → Type:", notification.type);
      console.log("   → Message:", notification.message);
      console.log("   → isRead:", notification.isRead);
      console.log("   → Status:", notification.status);
      console.log("   → Full payload:", JSON.stringify(notification, null, 2));
      
      if (!notification.isRead) {
        console.log("   → This notification is UNREAD - incrementing counter");
        setUnreadCount((prev) => {
          const newCount = prev + 1;
          console.log(`   ➕ Counter: ${prev} → ${newCount}`);
          return newCount;
        });
      } else {
        console.log("   → This notification is already READ - not incrementing");
      }
      console.log("═══════════════════════════════════════════════════════");
    };

    const handleNotificationCreated = (notification: INotification) => {
      console.log("═══════════════════════════════════════════════════════");
      console.log("📩 [Navbar Socket] Received notificationCreated event");
      console.log("   → Notification ID:", notification._id);
      console.log("   → Type:", notification.type);
      console.log("   → Message:", notification.message);
      console.log("   → isRead:", notification.isRead);
      console.log("   → Status:", notification.status);
      console.log("   → Full payload:", JSON.stringify(notification, null, 2));
      
      if (!notification.isRead) {
        console.log("   → This notification is UNREAD - incrementing counter");
        setUnreadCount((prev) => {
          const newCount = prev + 1;
          console.log(`   ➕ Counter: ${prev} → ${newCount}`);
          return newCount;
        });
      } else {
        console.log("   → This notification is already READ - not incrementing");
      }
      console.log("═══════════════════════════════════════════════════════");
    };

    const handleNotificationRead = () => {
      console.log("═══════════════════════════════════════════════════════");
      console.log("📖 [Navbar Socket] Received notificationRead event");
      setUnreadCount((prev) => {
        const newCount = Math.max(prev - 1, 0);
        console.log(`   ➖ Counter: ${prev} → ${newCount}`);
        return newCount;
      });
      console.log("═══════════════════════════════════════════════════════");
    };

    const handleNotificationUpdated = (notification: INotification) => {
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("🔔 [Navbar Socket] NOTIFICATION UPDATED RECEIVED! 🎉");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("   → Notification ID:", notification._id);
      console.log("   → Type:", notification.type);
      console.log("   → isRead:", notification.isRead);
      console.log("   → Status:", notification.status);
      console.log("   → Current Route:", location.pathname);
      console.log("   → Full payload:", JSON.stringify(notification, null, 2));
      
      // If notification was marked as read, decrease count
      if (notification.isRead) {
        console.log("   → Notification marked as READ - decrementing counter");
        setUnreadCount((prev) => {
          const newCount = Math.max(prev - 1, 0);
          console.log(`   ➖ Counter: ${prev} → ${newCount}`);
          return newCount;
        });
      } else {
        console.log("   → Notification is UNREAD - no change to counter");
      }
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    };

    const handleNotificationsMarkedRead = (data: { count: number }) => {
      console.log("═══════════════════════════════════════════════════════");
      console.log("📚 [Navbar Socket] Received notificationsMarkedRead event");
      console.log(`   → Count to decrease: ${data.count}`);
      setUnreadCount((prev) => {
        const newCount = Math.max(prev - data.count, 0);
        console.log(`   ➖ Bulk decrease: ${prev} → ${newCount}`);
        return newCount;
      });
      console.log("═══════════════════════════════════════════════════════");
    };

    const handleAnyEvent = (eventName: string, ...args: any[]) => {
      if (eventName !== 'connect' && eventName !== 'disconnect' && eventName !== 'welcome') {
        console.log("📡 [Navbar Socket] Received event:", eventName);
        console.log("   → Args:", args);
      }
    };

    // ✅ Register ALL event listeners
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on("welcome", handleWelcome);
    socket.on("newNotification", handleNewNotification);
    socket.on("notificationCreated", handleNotificationCreated);
    socket.on("notificationRead", handleNotificationRead);
    socket.on("notificationUpdated", handleNotificationUpdated);
    socket.on("notificationsMarkedRead", handleNotificationsMarkedRead);
    socket.onAny(handleAnyEvent);

    console.log("✅ [Navbar Socket] All event listeners registered");
    console.log("═══════════════════════════════════════════════════════");

    // ✅✅ CRITICAL FIX: Only cleanup when token changes (logout), NOT on route change!
    return () => {
      console.log("═══════════════════════════════════════════════════════");
      console.log("🔌 [Navbar Socket] Cleaning up socket listeners");
      console.log("   → Reason: Token changed or component unmounting");
      console.log("   → Current Route:", location.pathname);
      
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.off("welcome", handleWelcome);
      socket.off("newNotification", handleNewNotification);
      socket.off("notificationCreated", handleNotificationCreated);
      socket.off("notificationRead", handleNotificationRead);
      socket.off("notificationUpdated", handleNotificationUpdated);
      socket.off("notificationsMarkedRead", handleNotificationsMarkedRead);
      socket.offAny(handleAnyEvent);
      
      // DON'T call forceDisconnectSocket() here! Keep socket alive
      console.log("✅ [Navbar Socket] Listeners removed (socket kept alive)");
      console.log("═══════════════════════════════════════════════════════");
    };
  }, [token]); // ✅ ONLY depend on token, NOT user or location.pathname!

  return (
    <nav className="app-navbar">
      <h2 className="navbar-title">
        <Link to="/dashboard">
          {user.role === "admin" ? "AdminPanel" : "ProjectManager"}
        </Link>
      </h2>

      <div className="app-navbar-links">
        {/* Projects */}
        <NavLink
          to="/projects"
          className={({ isActive }) =>
            `navbar-link ${isActive ? "active-link" : ""}`
          }
        >
          Projects
        </NavLink>

        {/* Activity Log */}
        <ActivityLog 
          apiUrl={API_URL}
          token={token || ''}
        />

        {/* Notifications */}
        <NavLink
          to="/notifications"
          className={({ isActive }) =>
            `navbar-link ${isActive ? "active-link" : ""}`
          }
          onClick={async (e) => {
            console.log("═══════════════════════════════════════════════════════");
            console.log("🔔 [Navbar] Notifications link clicked");
            console.log("   → Current unread count:", unreadCount);
            console.log("   → Token present:", !!token);
            console.log("   → API_URL:", API_URL);
            
            // If there are unread notifications, mark all as read
            if (unreadCount > 0 && token) {
              try {
                console.log("📚 [Navbar] Marking all notifications as read...");
                const url = `${API_URL}/api/notifications/read-all`;
                
                console.log("   → Request URL:", url);
                console.log("   → Request method: PATCH");
                console.log("   → Token (first 20 chars):", token.substring(0, 20) + "...");
                
                const response = await axios.patch(
                  url,
                  {},
                  { 
                    headers: { 
                      Authorization: `Bearer ${token}`,
                      'Content-Type': 'application/json'
                    } 
                  }
                );
                
                console.log("✅ [Navbar] Mark all as read SUCCESS!");
                console.log("   → Response status:", response.status);
                console.log("   → Response data:", JSON.stringify(response.data, null, 2));
                console.log("   → Marked count:", response.data.count);
                
                // The socket listener will handle updating the counter
                console.log("   → Socket will handle counter update via 'notificationsMarkedRead' event");
                console.log("   → Waiting for socket event...");
              } catch (error: any) {
                console.error("❌ [Navbar] Failed to mark all as read!");
                console.error("   → Error message:", error.message);
                console.error("   → Error response status:", error.response?.status);
                console.error("   → Error response data:", JSON.stringify(error.response?.data, null, 2));
                console.error("   → Full error:", error);
              }
            } else {
              if (unreadCount === 0) {
                console.log("ℹ️ [Navbar] No unread notifications to mark");
              }
              if (!token) {
                console.error("❌ [Navbar] No token available!");
              }
            }
            console.log("═══════════════════════════════════════════════════════");
          }}
        >
          Notifications
          {unreadCount > 0 && (
            <span className="notification-badge">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </NavLink>
      </div>

      <div className="app-navbar-actions">
        <span className="user-name">{user.name}</span>
        <button onClick={handleLogout} className="logout-btn">
          Logout
        </button>
      </div>
    </nav>
  );
};

export default AppNavbar;