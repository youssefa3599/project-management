import React, { useEffect, useState } from "react";
import axios from "axios";
import { connectSocket } from "../utils/socket";
import { useAuth } from "../context/AuthContext";
import "./ActivityLog.css";

interface IActivity {
  _id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
  description: string;
  metadata?: Record<string, any>;
  createdAt: string;
  isRead?: boolean;
}

interface ActivityLogProps {
  apiUrl: string;
  token: string;
}

const ActivityLog: React.FC<ActivityLogProps> = ({ apiUrl, token }) => {
  const { user } = useAuth();
  const [activities, setActivities] = useState<IActivity[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  /** ---------------------------------------
   * Fetch unread activity count
   * --------------------------------------- */
  useEffect(() => {
    if (!token) return;

    const fetchUnreadCount = async () => {
      try {
        console.log("═══════════════════════════════════════════════════════");
        console.log("🔄 [ActivityLog] Fetching unread count...");
        console.log("   → API URL:", `${apiUrl}/api/activities/unread-count`);
        console.log("   → Token present:", !!token);
        
        const res = await axios.get(`${apiUrl}/api/activities/unread-count`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const count = res.data?.count || 0;
        console.log("   → Response status:", res.status);
        console.log("   → Unread count from API:", count);
        console.log("   → Previous count state:", unreadCount);
        
        setUnreadCount(count);
        console.log(`📊 [ActivityLog] Unread count updated: ${unreadCount} → ${count}`);
        console.log("═══════════════════════════════════════════════════════");
      } catch (err: any) {
        console.error("═══════════════════════════════════════════════════════");
        console.error("❌ [ActivityLog] Failed to fetch unread count");
        console.error("   → Error:", err.message);
        console.error("   → Response:", err.response?.data);
        console.error("═══════════════════════════════════════════════════════");
      }
    };

    fetchUnreadCount();
  }, [token, apiUrl]);

  /** ---------------------------------------
   * Socket setup for real-time updates
   * --------------------------------------- */
  useEffect(() => {
    if (!token || !user) return;

    console.log("🔌 [ActivityLog] Setting up socket for real-time updates");
    const socket = connectSocket(token);

    // Listen for new activity events
    socket.on("newActivity", (activity: IActivity) => {
      console.log("📩 [ActivityLog] Received newActivity:", activity);
      if (!activity.isRead) {
        setUnreadCount((prev) => {
          const newCount = prev + 1;
          console.log(`➕ [ActivityLog] Count increased: ${prev} → ${newCount}`);
          return newCount;
        });
      }
    });

    socket.on("activityCreated", (activity: IActivity) => {
      console.log("📩 [ActivityLog] Received activityCreated:", activity);
      if (!activity.isRead) {
        setUnreadCount((prev) => {
          const newCount = prev + 1;
          console.log(`➕ [ActivityLog] Count increased: ${prev} → ${newCount}`);
          return newCount;
        });
      }
    });

    socket.on("activityRead", () => {
      console.log("📖 [ActivityLog] Received activityRead");
      setUnreadCount((prev) => {
        const newCount = Math.max(prev - 1, 0);
        console.log(`➖ [ActivityLog] Count decreased: ${prev} → ${newCount}`);
        return newCount;
      });
    });

    socket.on("activityUpdated", (activity: IActivity) => {
      console.log("🔄 [ActivityLog] Received activityUpdated:", activity);
      if (activity.isRead) {
        setUnreadCount((prev) => {
          const newCount = Math.max(prev - 1, 0);
          console.log(`➖ [ActivityLog] Count decreased: ${prev} → ${newCount}`);
          return newCount;
        });
      }
    });

    // Listen for bulk read event
    socket.on("activitiesMarkedRead", (data: { count: number }) => {
      console.log(`📚 [ActivityLog] Bulk read event received: ${data.count} activities`);
      setUnreadCount((prev) => {
        const newCount = Math.max(prev - data.count, 0);
        console.log(`➖ [ActivityLog] Bulk decrease: ${prev} → ${newCount}`);
        return newCount;
      });
    });

    return () => {
      console.log("🔌 [ActivityLog] Cleaning up socket listeners");
      socket.off("newActivity");
      socket.off("activityCreated");
      socket.off("activityRead");
      socket.off("activityUpdated");
      socket.off("activitiesMarkedRead");
    };
  }, [token, user]);

  /** ---------------------------------------
   * Fetch activities when dropdown opens
   * --------------------------------------- */
  useEffect(() => {
    if (!isOpen || !token) {
      console.log("⚠️ [ActivityLog] Skipping activity fetch");
      console.log("   → isOpen:", isOpen);
      console.log("   → token:", !!token);
      return;
    }

    const fetchActivities = async () => {
      setLoading(true);
      try {
        console.log("═══════════════════════════════════════════════════════");
        console.log("📡 [ActivityLog] Fetching activities...");
        console.log("   → API URL:", `${apiUrl}/api/activities`);
        
        const res = await axios.get(`${apiUrl}/api/activities`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const activitiesArray = res.data?.data || [];
        console.log(`✅ [ActivityLog] Fetched ${activitiesArray.length} activities`);
        
        // Log unread activities
        const unreadActivities = activitiesArray.filter((a: IActivity) => !a.isRead);
        console.log(`   → Unread activities: ${unreadActivities.length}`);
        unreadActivities.forEach((a: IActivity, idx: number) => {
          console.log(`      ${idx + 1}. ID: ${a._id.substring(0, 8)}..., Action: ${a.action}, isRead: ${a.isRead}`);
        });
        
        setActivities(activitiesArray);
        console.log("   → Activities state updated");
        console.log("   → Now marking all as read...");

        // Mark all as read when opening
        await markAllAsRead(activitiesArray);
        console.log("═══════════════════════════════════════════════════════");
      } catch (err) {
        console.error("═══════════════════════════════════════════════════════");
        console.error("❌ [ActivityLog] Failed to fetch activities:", err);
        console.error("═══════════════════════════════════════════════════════");
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();
  }, [isOpen, token, apiUrl]);

  /** ---------------------------------------
   * Mark all activities as read
   * --------------------------------------- */
  const markAllAsRead = async (activitiesToMark: IActivity[]) => {
    const unreadIds = activitiesToMark.filter(a => !a.isRead).map(a => a._id);
    
    console.log("═══════════════════════════════════════════════════════");
    console.log("📖 [ActivityLog] markAllAsRead called");
    console.log("   → Total activities:", activitiesToMark.length);
    console.log("   → Unread IDs to mark:", unreadIds.length);
    
    if (unreadIds.length === 0) {
      console.log("✅ [ActivityLog] No unread activities to mark");
      console.log("   → Counter should already be 0");
      console.log("   → Current counter value:", unreadCount);
      console.log("═══════════════════════════════════════════════════════");
      return;
    }

    try {
      console.log(`📖 [ActivityLog] Marking ${unreadIds.length} activities as read...`);
      console.log("   → IDs:", unreadIds.map(id => id.substring(0, 8) + "...").join(", "));

      let successCount = 0;
      let failCount = 0;

      for (const id of unreadIds) {
        try {
          console.log(`   → Marking activity ${id.substring(0, 8)}... as read`);
          
          await axios.patch(
            `${apiUrl}/api/activities/${id}/read`,
            {},
            { headers: { Authorization: `Bearer ${token}` } }
          );

          console.log(`   ✅ Marked ${id.substring(0, 8)}... as read`);
          successCount++;

          // Update local state immediately
          setActivities(prev =>
            prev.map(a => (a._id === id ? { ...a, isRead: true } : a))
          );

          await new Promise(resolve => setTimeout(resolve, 50));
        } catch (err: any) {
          console.error(`   ❌ Failed to mark ${id.substring(0, 8)}... as read:`, err.response?.data || err.message);
          failCount++;
        }
      }

      console.log(`📊 [ActivityLog] Mark as read results:`);
      console.log(`   → Success: ${successCount}`);
      console.log(`   → Failed: ${failCount}`);
      console.log(`   → Previous counter value: ${unreadCount}`);
      console.log("   → Setting counter to 0...");
      
      // Reset counter to zero after marking all as read
      setUnreadCount(0);
      
      console.log("✅ [ActivityLog] All activities marked as read, counter reset to 0");
      console.log("═══════════════════════════════════════════════════════");
    } catch (err) {
      console.error("═══════════════════════════════════════════════════════");
      console.error("❌ [ActivityLog] Failed to mark all as read:", err);
      console.error("═══════════════════════════════════════════════════════");
    }
  };

  /** ---------------------------------------
   * Toggle dropdown
   * --------------------------------------- */
  const toggleDropdown = () => {
    console.log("═══════════════════════════════════════════════════════");
    console.log("🔔 [ActivityLog] Bell icon clicked");
    console.log("   → Current state (isOpen):", isOpen);
    console.log("   → Current unread count:", unreadCount);
    console.log("   → Will open:", !isOpen);
    
    if (!isOpen) {
      console.log("   → Opening dropdown - will fetch activities and mark as read");
      console.log("   → Setting counter to 0 immediately");
      setUnreadCount(0); // Reset counter immediately when opening
    } else {
      console.log("   → Closing dropdown");
    }
    
    setIsOpen(!isOpen);
    console.log("═══════════════════════════════════════════════════════");
  };

  /** ---------------------------------------
   * Format time ago
   * --------------------------------------- */
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  /** ---------------------------------------
   * Get activity icon
   * --------------------------------------- */
  const getActivityIcon = (action: string) => {
    switch (action) {
      case "created":
      case "project_created":
      case "task_created":
        return "➕";
      case "updated":
      case "project_updated":
      case "task_updated":
        return "✏️";
      case "deleted":
      case "project_deleted":
      case "task_deleted":
        return "🗑️";
      case "mentioned":
        return "📢";
      case "sent_message":
        return "💬";
      case "invited":
        return "📨";
      case "joined":
        return "👋";
      default:
        return "📌";
    }
  };

  return (
    <div className="activity-log-container">
      <button
        className="activity-log-button navbar-link"
        onClick={toggleDropdown}
        aria-label="Activity Log"
      >
        Activity Log
        {unreadCount > 0 && (
          <span className="activity-badge">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="activity-overlay" onClick={() => setIsOpen(false)} />
          <div className="activity-dropdown">
            <div className="activity-header">
              <h3>Activity Log</h3>
              <button
                className="activity-close"
                onClick={() => setIsOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="activity-list">
              {loading ? (
                <div className="activity-loading">Loading activities...</div>
              ) : activities.length === 0 ? (
                <div className="activity-empty">No activities yet</div>
              ) : (
                activities.map((activity) => (
                  <div
                    key={activity._id}
                    className={`activity-item ${activity.isRead ? "read" : "unread"}`}
                  >
                    <div className="activity-icon">
                      {getActivityIcon(activity.action)}
                    </div>
                    <div className="activity-content">
                      <p className="activity-description">
                        {activity.description}
                      </p>
                      {activity.details && (
                        <p className="activity-details">{activity.details}</p>
                      )}
                      <span className="activity-time">
                        {formatTimeAgo(activity.createdAt)}
                      </span>
                    </div>
                    {!activity.isRead && <div className="activity-unread-dot" />}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ActivityLog;