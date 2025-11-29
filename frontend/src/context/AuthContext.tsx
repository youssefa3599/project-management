import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import axios from "axios";
import { connectSocket, disconnectSocket } from "../utils/socket";
import { toast } from "react-hot-toast";

axios.defaults.baseURL = import.meta.env.VITE_API_URL || "http://localhost:5000";
axios.defaults.withCredentials = true;

export type Role = "admin" | "editor" | "viewer";

export interface IUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

interface Notification {
  _id?: string;
  message: string;
  link?: string;
  read?: boolean;
  createdAt?: string;
}

interface IAuthContext {
  user: IUser | null;
  token: string | null;
  loading: boolean;
  notifications: Notification[];
  unreadCount: number;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  requestVerificationCode: (name: string, email: string, password: string, role: Role) => Promise<void>;
  verifyAndRegister: (email: string, code: string) => Promise<void>;
  resendVerificationCode: (email: string) => Promise<void>;
  setUserFromToken: (token: string) => Promise<void>;
}

const AuthContext = createContext<IAuthContext | undefined>(undefined);

const TOKEN_KEY = "token";
const USER_KEY = "user";

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<IUser | null>(() => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  });

  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState<boolean>(!!token);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // 🔒 Sync axios headers when token changes
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      delete axios.defaults.headers.common["Authorization"];
      localStorage.removeItem(TOKEN_KEY);
    }
  }, [token]);

  // 💾 Persist user info
  useEffect(() => {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      localStorage.setItem("role", user.role);
      localStorage.setItem("userId", user.id);
      console.log("🪪 DEBUG: Saved user to localStorage", user);
    } else {
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem("role");
      localStorage.removeItem("userId");
      console.log("🪪 DEBUG: Cleared user from localStorage");
    }
  }, [user]);

  // 🔍 Verify token on first load
  useEffect(() => {
    let mounted = true;

    const verifyUser = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      console.log("🪪 Verifying token:", token.slice(0, 25) + "...");

      try {
        setLoading(true);
        const res = await axios.get("/api/auth/me");
        if (!mounted) return;
        setUser(res.data.user);
        console.log("✅ Verified user:", res.data.user);
      } catch (err: any) {
        console.error("❌ Token verification failed:", err.response?.data || err.message);
        setToken(null);
        setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    verifyUser();
    return () => {
      mounted = false;
    };
  }, []);

  // ⚡ Handle socket connection for real-time notifications
  useEffect(() => {
    if (!token || !user) {
      disconnectSocket();
      return;
    }

    const socket = connectSocket(token);
    socket.emit("joinUser", user.id);

    socket.on("newNotification", (notif: Notification) => {
      setNotifications(prev => [notif, ...prev]);
      setUnreadCount(prev => prev + 1);
      toast.success(notif.message);
    });

    socket.on("mentionNotification", (notif: Notification) => {
      setNotifications(prev => [notif, ...prev]);
      setUnreadCount(prev => prev + 1);
      toast(`💬 ${notif.message}`);
    });

    socket.on("disconnect", () => console.warn("🔴 Socket disconnected"));

    return () => {
      socket.off("newNotification");
      socket.off("mentionNotification");
      disconnectSocket();
    };
  }, [token, user]);

  // 🧩 STEP 1: Request verification code (no account created yet)
  const requestVerificationCode = async (name: string, email: string, password: string, role: Role) => {
    setLoading(true);
    try {
      const res = await axios.post("/api/auth/request-verification", { 
        name, 
        email, 
        password, 
        role 
      });
      
      console.log("✅ Verification code sent:", res.data.message);
      toast.success("📧 Verification code sent! Check your email.");
    } catch (err: any) {
      console.error("❌ Request verification error:", err.response?.data || err.message);
      const errorMsg = err.response?.data?.message || "Failed to send verification code";
      toast.error(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // ✉️ STEP 2: Verify code and create account
  const verifyAndRegister = async (email: string, code: string) => {
    setLoading(true);
    try {
      const res = await axios.post("/api/auth/verify-and-register", { email, code });
      const { token: newToken, user: userData } = res.data;

      console.log("✅ Account created successfully:", userData);
      
      setToken(newToken);
      setUser(userData);
      
      toast.success("✅ Account created! Welcome!");
    } catch (err: any) {
      console.error("❌ Verification error:", err.response?.data || err.message);
      const errorMsg = err.response?.data?.message || "Verification failed";
      toast.error(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // 📧 Resend Verification Code
  const resendVerificationCode = async (email: string) => {
    setLoading(true);
    try {
      await axios.post("/api/auth/resend-verification", { email });
      console.log("📧 Verification code resent to:", email);
      toast.success("📧 Verification code resent! Check your email.");
    } catch (err: any) {
      console.error("❌ Resend error:", err.response?.data || err.message);
      const errorMsg = err.response?.data?.message || "Failed to resend code";
      toast.error(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // 🔑 Login
  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const res = await axios.post("/api/auth/login", { email, password });
      const { token: newToken, user: userData } = res.data;

      if (!newToken) throw new Error("No token returned from login");

      console.log("✅ Login successful:", userData);
      setToken(newToken);
      setUser(userData);
      
      toast.success(`Welcome back, ${userData.name}!`);
    } catch (err: any) {
      console.error("❌ Login error:", err.response?.data || err.message);
      const errorMsg = err.response?.data?.message || "Login failed";
      toast.error(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // 🚪 Logout
  const logout = () => {
    setToken(null);
    setUser(null);
    setNotifications([]);
    setUnreadCount(0);
    disconnectSocket();
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem("role");
    localStorage.removeItem("userId");
    console.log("👋 DEBUG: Logged out, cleared all user data");
    toast.success("Logged out successfully");
  };

  // 🎫 Load user from existing token
  const setUserFromToken = async (newToken: string) => {
    setToken(newToken);
    try {
      const res = await axios.get("/api/auth/me");
      setUser(res.data.user);
    } catch {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        notifications,
        unreadCount,
        login,
        logout,
        requestVerificationCode,
        verifyAndRegister,
        resendVerificationCode,
        setUserFromToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): IAuthContext => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside an AuthProvider");
  return ctx;
};