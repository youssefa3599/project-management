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
    
    const socket = connectSocket(token);
    console.log("   → Socket instance obtained");

    // Test if socket is connected
    socket.on("connect", () => {
      console.log("✅ [Navbar Socket] Socket CONNECTED");
      console.log("   → Socket ID:", socket.id);
    });

    socket.on("disconnect", (reason) => {
      console.log("❌ [Navbar Socket] Socket DISCONNECTED");
      console.log("   → Reason:", reason);
    });

    socket.on("connect_error", (error) => {
      console.error("❌ [Navbar Socket] Connection ERROR");
      console.error("   → Error:", error.message);
    });

    // Listen for welcome message from server
    socket.on("welcome", (data) => {
      console.log("👋 [Navbar Socket] Welcome message received");
      console.log("   → Data:", data);
    });

    // Listen for new notifications (mentions)
    socket.on("newNotification", (notification: INotification) => {
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
    });

    socket.on("notificationCreated", (notification: INotification) => {
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
    });

    socket.on("notificationRead", () => {
      console.log("═══════════════════════════════════════════════════════");
      console.log("📖 [Navbar Socket] Received notificationRead event");
      setUnreadCount((prev) => {
        const newCount = Math.max(prev - 1, 0);
        console.log(`   ➖ Counter: ${prev} → ${newCount}`);
        return newCount;
      });
      console.log("═══════════════════════════════════════════════════════");
    });

    socket.on("notificationUpdated", (notification: INotification) => {
      console.log("═══════════════════════════════════════════════════════");
      console.log("🔄 [Navbar Socket] Received notificationUpdated event");
      console.log("   → Notification ID:", notification._id);
      console.log("   → Type:", notification.type);
      console.log("   → isRead:", notification.isRead);
      console.log("   → Status:", notification.status);
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
      console.log("═══════════════════════════════════════════════════════");
    });

    // Listen for bulk read event (when opening notifications page)
    socket.on("notificationsMarkedRead", (data: { count: number }) => {
      console.log("═══════════════════════════════════════════════════════");
      console.log("📚 [Navbar Socket] Received notificationsMarkedRead event");
      console.log(`   → Count to decrease: ${data.count}`);
      setUnreadCount((prev) => {
        const newCount = Math.max(prev - data.count, 0);
        console.log(`   ➖ Bulk decrease: ${prev} → ${newCount}`);
        return newCount;
      });
      console.log("═══════════════════════════════════════════════════════");
    });

    // Listen for any other events (debugging)
    socket.onAny((eventName, ...args) => {
      if (eventName !== 'connect' && eventName !== 'disconnect' && eventName !== 'welcome') {
        console.log("📡 [Navbar Socket] Received event:", eventName);
        console.log("   → Args:", args);
      }
    });

    console.log("✅ [Navbar Socket] All event listeners registered");
    console.log("═══════════════════════════════════════════════════════");

    return () => {
      console.log("═══════════════════════════════════════════════════════");
      console.log("🔌 [Navbar Socket] Cleaning up socket listeners");
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");
      socket.off("welcome");
      socket.off("newNotification");
      socket.off("notificationCreated");
      socket.off("notificationRead");
      socket.off("notificationUpdated");
      socket.off("notificationsMarkedRead");
      socket.offAny();
      // DON'T call forceDisconnectSocket() here! Keep socket alive
      console.log("✅ [Navbar Socket] Listeners removed (socket kept alive)");
      console.log("═══════════════════════════════════════════════════════");
    };
  }, [token, user]);

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
          onClick={() => {
            console.log("🔔 [Navbar] Notifications link clicked");
            console.log("   → Current unread count:", unreadCount);
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