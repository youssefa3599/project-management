// src/pages/NotificationPage.tsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { connectSocket } from "../utils/socket";
import "./NotificationPage.css";

interface INotification {
  _id: string;
  message: string;
  taskId?: string;
  task?: string | { _id: string };
  type?: "taskChatInvite" | "projectInvite" | "projectUpdate" | "mention" | "general";
  status?: "pending" | "accepted" | "declined";
  createdAt: string;
  isRead?: boolean;
}

export default function NotificationPage() {
  const { token, user } = useAuth();
  const [notifications, setNotifications] = useState<INotification[]>([]);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const API_URL = import.meta.env.VITE_API_URL;

  // Fetch notifications from API
  useEffect(() => {
    const fetchNotifications = async () => {
      if (!token) {
        console.warn("⚠️ No auth token, skipping notifications fetch.");
        return;
      }

      console.log("📡 Fetching notifications from:", `${API_URL}/api/notifications`);
      setLoading(true);
      try {
        const res = await axios.get(`${API_URL}/api/notifications`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const notificationsArray: INotification[] = res.data?.data || [];
        console.log("✅ [FETCH SUCCESS] Notifications received:", notificationsArray.length);
        
        const unreadCount = notificationsArray.filter(n => !n.isRead).length;
        console.log(`📊 Unread notifications: ${unreadCount}/${notificationsArray.length}`);

        setNotifications(notificationsArray);
      } catch (err) {
        console.error("❌ [FETCH ERROR] Failed to fetch notifications:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, [token, API_URL]);

  // 🔥 NEW: Listen for live socket notifications
  useEffect(() => {
    if (!token || !user) return;

    console.log("🔌 [NotificationPage] Setting up socket listener for live updates");
    const socket = connectSocket(token);

    // Listen for new notifications
    const handleNewNotification = (notif: INotification) => {
      console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("🔔 [NotificationPage] NEW NOTIFICATION RECEIVED VIA SOCKET");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("   Type:", notif.type);
      console.log("   Message:", notif.message);
      console.log("   taskId:", notif.taskId);
      console.log("   task:", notif.task);
      console.log("   Has taskId?:", !!notif.taskId);
      console.log("   Has task?:", !!notif.task);
      console.log("   Full payload:", JSON.stringify(notif, null, 2));
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

      // Add to notifications list at the top
      setNotifications(prev => [notif, ...prev]);
      console.log("✅ [NotificationPage] Notification added to local state");
    };

    socket.on("newNotification", handleNewNotification);
    

    console.log("✅ [NotificationPage] Socket listeners registered");

    return () => {
      socket.off("newNotification", handleNewNotification);
      socket.off("mentionNotification", handleNewNotification);
      console.log("🔌 [NotificationPage] Socket listeners cleaned up");
    };
  }, [token, user]);

  const handleRespondToInvite = async (
    notificationId: string,
    response: "accept" | "decline",
    taskId?: string
  ) => {
    try {
      setRespondingTo(notificationId);
      console.log(`🪪 Responding to invite: ${notificationId} with "${response}"`);

      await axios.post(
        `${API_URL}/api/notifications/${notificationId}/respond`,
        { response },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const newStatus: "accepted" | "declined" =
        response === "accept" ? "accepted" : "declined";

      setNotifications((prev: INotification[]) =>
        prev.map((n: INotification) =>
          n._id === notificationId ? { ...n, status: newStatus, isRead: true } : n
        )
      );

      console.log(`✅ Notification ${notificationId} marked as ${newStatus}`);

      if (response === "accept" && taskId) {
        console.log(`➡️ Navigating to chat for task ${taskId}`);
        navigate(`/chats/${taskId}`);
      }
    } catch (err) {
      console.error("❌ [RESPOND ERROR] Failed to respond to invite:", err);
      alert("Error responding to invite");
    } finally {
      setRespondingTo(null);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      console.log(`📖 Marking notification ${notificationId} as read...`);
      
      await axios.patch(
        `${API_URL}/api/notifications/${notificationId}/read`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setNotifications((prev) =>
        prev.map((n) => (n._id === notificationId ? { ...n, isRead: true } : n))
      );
      
      console.log(`✅ Notification marked as read`);
    } catch (err: any) {
      console.error("❌ Failed to mark as read:", err.response?.data || err.message);
    }
  };

  const handleNotificationClick = async (notification: INotification) => {
    console.log("\n🖱️ [CLICK] Notification clicked:", notification.type);

    // Mark as read if not already
    if (!notification.isRead) {
      await handleMarkAsRead(notification._id);
    }

    // Navigate based on type
    if (notification.type === "mention" || notification.type === "general") {
      if (notification.taskId || notification.task) {
        const taskId = typeof notification.task === "string" 
          ? notification.task 
          : notification.task?._id || notification.taskId;
        if (taskId) {
          console.log("➡️ Navigating to:", `/chats/${taskId}`);
          navigate(`/chats/${taskId}`);
        }
      }
    }
  };

  const handleViewChat = (taskId?: string | { _id: string }) => {
    console.log("🔘 [VIEW CHAT CLICKED] taskId:", taskId);
    if (!taskId) {
      console.error("❌ No taskId provided!");
      return;
    }
    const id = typeof taskId === "string" ? taskId : taskId._id;
    console.log("➡️ Navigating to:", `/chats/${id}`);
    navigate(`/chats/${id}`);
  };

  const getNotificationIcon = (type?: string) => {
    switch (type) {
      case "taskChatInvite":
        return "💬";
      case "mention":
        return "📢";
      case "projectInvite":
        return "📁";
      case "projectUpdate":
        return "📋";
      default:
        return "🔔";
    }
  };

  const getNotificationTitle = (type?: string) => {
    switch (type) {
      case "taskChatInvite":
        return "Task Chat Invitation";
      case "mention":
        return "You were mentioned";
      case "projectInvite":
        return "Project Invitation";
      case "projectUpdate":
        return "Project Update";
      default:
        return "Notification";
    }
  };

  return (
    <div className="notification-page">
      <h2>Notifications</h2>

      {loading ? (
        <div className="loading">Loading...</div>
      ) : notifications.length === 0 ? (
        <div className="empty-state">No notifications yet</div>
      ) : (
        <div className="notification-cards">
          {notifications.map((n: INotification) => (
            <div
              key={n._id}
              className={`notification-card ${n.status || ""} ${n.isRead ? "read" : "unread"}`}
              onClick={() => handleNotificationClick(n)}
              style={{ cursor: 'pointer' }}
            >
              <div className="card-header">
                <h4>
                  <span className="notification-icon">{getNotificationIcon(n.type)}</span>
                  {getNotificationTitle(n.type)}
                </h4>
                <span className="card-time">
                  {new Date(n.createdAt).toLocaleString()}
                </span>
              </div>

              <div className="card-body">
                <p>{n.message}</p>
              </div>

              <div className="card-footer">
                {/* Task Chat Invite - Accept/Decline */}
                {n.type === "taskChatInvite" && n.status === "pending" && (
                  <div className="invite-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="btn-accept"
                      onClick={() =>
                        handleRespondToInvite(n._id, "accept", n.taskId)
                      }
                      disabled={respondingTo === n._id}
                    >
                      {respondingTo === n._id ? "..." : "Accept"}
                    </button>
                    <button
                      className="btn-decline"
                      onClick={() =>
                        handleRespondToInvite(n._id, "decline", n.taskId)
                      }
                      disabled={respondingTo === n._id}
                    >
                      {respondingTo === n._id ? "..." : "Decline"}
                    </button>
                  </div>
                )}

                {/* Mention - View Chat */}
                {(n.type === "mention" || n.type === "general") && (n.taskId || n.task) && (
                  <div className="mention-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="btn-view-chat"
                      onClick={() => handleViewChat(n.taskId || n.task)}
                    >
                      View Chat
                    </button>
                  </div>
                )}

                {/* Status Badges */}
                {n.status === "accepted" && (
                  <span className="status-badge accepted">Accepted</span>
                )}
                {n.status === "declined" && (
                  <span className="status-badge declined">Declined</span>
                )}
                {!n.isRead && <div className="unread-dot"></div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}