import React, { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getSocket } from "../utils/socket";
import axios from "axios";
import { Link } from "react-router-dom";

interface Notification {
  _id: string;
  message: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

const NotificationBell: React.FC = () => {
  const { token, user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  // Fetch unread notifications
  const fetchNotifications = async () => {
    try {
      const res = await axios.get("/api/notifications", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(res.data);
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    }
  };

  // Handle real-time incoming notifications
  useEffect(() => {
    if (!user) return;
    const socket = getSocket();
    fetchNotifications();

    socket.on("newNotification", (notif: Notification) => {
      setNotifications((prev) => [notif, ...prev]);
    });

    return () => {
      socket.off("newNotification");
    };
  }, [user]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="relative p-2 rounded-full hover:bg-gray-100"
      >
        <Bell size={22} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 rounded-lg bg-white shadow-lg border p-2 z-50">
          {notifications.length === 0 ? (
            <p className="text-sm text-gray-500 text-center">No notifications</p>
          ) : (
            <ul className="max-h-64 overflow-y-auto">
              {notifications.slice(0, 5).map((n: Notification) => (
                <li
                  key={n._id}
                  className={`p-2 text-sm rounded-md ${
                    n.read ? "text-gray-500" : "bg-gray-100 font-semibold"
                  }`}
                >
                  {n.link ? (
                    <Link to={n.link} className="hover:underline">
                      {n.message}
                    </Link>
                  ) : (
                    n.message
                  )}
                  <small className="block text-xs text-gray-400">
                    {new Date(n.createdAt).toLocaleString()}
                  </small>
                </li>
              ))}
            </ul>
          )}
          <Link
            to="/notifications"
            className="block text-center text-blue-500 text-sm mt-2 hover:underline"
          >
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
