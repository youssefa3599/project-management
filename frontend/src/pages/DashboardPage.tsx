import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import axios from "axios";
import { connectSocket, disconnectSocket } from "../utils/socket";
import "./DashboardPage.css";

interface INotification {
  _id: string;
  isRead: boolean;
  type?: string;
  data?: { projectId?: string; projectName?: string };
  project?: string;
}

const DashboardPage = () => {
  const { user, token } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [projectUnreadCount, setProjectUnreadCount] = useState(0);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteData, setInviteData] = useState<{
    projectId?: string;
    projectName?: string;
  } | null>(null);

  const API_URL = import.meta.env.VITE_API_URL;
  const navigate = useNavigate();

  /** -----------------------------
   * Fetch unread notifications
   * ----------------------------- */
  useEffect(() => {
    if (!token) return;
    const fetchUnread = async () => {
      try {
        console.log("📡 [Dashboard] Fetching unread notifications...");
        const res = await axios.get(`${API_URL}/api/notifications`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const notifications: INotification[] = res.data.data || [];
        const unread = notifications.filter((n) => !n.isRead).length;
        const projectUnread = notifications.filter((n) => !n.isRead && n.project).length;
        console.log("✅ [Dashboard] Unread counts:", { unread, projectUnread });
        setUnreadCount(unread);
        setProjectUnreadCount(projectUnread);
      } catch (err) {
        console.error("❌ [Dashboard] Failed to fetch notifications:", err);
      }
    };
    fetchUnread();
  }, [token, API_URL]);

  /** -----------------------------
   * Real-time updates via Socket.IO
   * ----------------------------- */
  useEffect(() => {
    if (!token || !user) return;
    console.log("🔌 [Dashboard] Connecting to socket...");
    const socket = connectSocket(token);

    socket.on("notificationCreated", (n: INotification) => {
      console.log("📨 [Dashboard] New notification received:", n);
      setUnreadCount((prev) => prev + 1);
      if (n.project) setProjectUnreadCount((prev) => prev + 1);

      if (n.type === "project_invite") {
        setInviteData({
          projectId: n.data?.projectId,
          projectName: n.data?.projectName,
        });
        setShowInviteModal(true);
      } else {
        navigate("/notifications");
      }
    });

    return () => {
      console.log("🔌 [Dashboard] Disconnecting socket...");
      socket.off("notificationCreated");
      disconnectSocket();
    };
  }, [token, user, navigate]);

  /** -----------------------------
   * Handle ?invite=projectId param
   * ----------------------------- */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inviteId = params.get("invite");
    if (inviteId) {
      setInviteData({ projectId: inviteId, projectName: "Project Invitation" });
      setShowInviteModal(true);
    }
  }, []);

  if (!user) return null;

  /** -----------------------------
   * Badge Component
   * ----------------------------- */
  const Badge = ({ count }: { count: number }) =>
    count > 0 ? (
      <span
        style={{
          position: "absolute",
          top: "-5px",
          right: "-10px",
          backgroundColor: "red",
          color: "white",
          borderRadius: "50%",
          padding: "2px 6px",
          fontSize: "12px",
        }}
      >
        {count}
      </span>
    ) : null;

  /** -----------------------------
   * Accept Invite
   * ----------------------------- */
  const handleAcceptInvite = async () => {
    try {
      console.log("✅ [Dashboard] Accepting invite:", inviteData);
      await axios.post(
        `${API_URL}/api/projects/${inviteData?.projectId}/accept-invite`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      alert(`✅ You've joined ${inviteData?.projectName || "the project"}!`);
      setShowInviteModal(false);
      setInviteData(null);

      // ✅ Tell ProjectsPage to refresh
      navigate("/projects", { state: { refreshProjects: true } });
    } catch (err) {
      console.error("❌ [Dashboard] Failed to accept invite:", err);
      alert("Failed to join project.");
    }
  };

  /** -----------------------------
   * Decline Invite
   * ----------------------------- */
  const handleDeclineInvite = () => {
    console.log("❎ [Dashboard] Declined project invite");
    setShowInviteModal(false);
    setInviteData(null);
  };

  /** -----------------------------
   * Render (NO AppNavbar - it's in AppLayout)
   * ----------------------------- */
  return (
    <div className="page-root dashboard-page-root">
      {/* ❌ REMOVED: <AppNavbar /> - it's already in AppLayout */}

      <div className="dashboard-container">
        <h1>Welcome to your dashboard!</h1>
        <p>Here are your main sections:</p>

        <div className="dashboard-buttons">
          <Link to="/projects" className="btn btn-projects" style={{ position: "relative" }}>
            View Projects
            <Badge count={projectUnreadCount} />
          </Link>

          <Link
            to="/notifications"
            className="btn btn-tasks"
            style={{ position: "relative" }}
            onClick={() => setUnreadCount(0)}
          >
            Notifications
            <Badge count={unreadCount} />
          </Link>
        </div>
      </div>

      {showInviteModal && inviteData && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Project Invitation</h3>
            <p>
              You've been invited to join{" "}
              <strong>{inviteData.projectName || "this project"}</strong>.
            </p>

            <div className="modal-actions">
              <button onClick={handleAcceptInvite} className="btn-accept">
                Accept
              </button>
              <button onClick={handleDeclineInvite} className="btn-decline">
                Decline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;