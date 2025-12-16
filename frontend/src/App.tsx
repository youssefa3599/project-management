import React, { useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import Login from "./pages/Login";
import Register from "./pages/Register";
import DashboardPage from "./pages/DashboardPage";
import ProjectsPage from "./pages/ProjectsPage";
import ProjectDetailsPage from "./pages/ProjectDetailsPage";
import EditProjectPage from "./pages/EditProjectPage";
import ChatPage from "./pages/ChatPage";

import NotificationsPage from "./pages/NotificationPage";

import AppNavbar from "./components/AppNavbar";
import { AuthProvider, useAuth } from "./context/AuthContext";

// ✅ Create QueryClient instance (outside component)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

/** -------------------------------------
 * Scrolls to top on route change
 * ------------------------------------- */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  return null;
}

/** -------------------------------------
 * Protected route wrapper
 * ------------------------------------- */
function ProtectedRoute({ children }: { children: React.JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? children : <Navigate to="/login" replace />;
}

/** -------------------------------------
 * Layout with navbar
 * ------------------------------------- */
function AppLayout({ children }: { children: React.JSX.Element }) {
  return (
    <>
      <AppNavbar />
      <main style={{ padding: "20px" }}>{children}</main>
    </>
  );
}

/** -------------------------------------
 * Main route config
 * ------------------------------------- */
function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return null;

  return (
    <Routes>
      {/* Public routes */}
      <Route
        path="/login"
        element={!user ? <Login /> : <Navigate to="/dashboard" replace />}
      />
      <Route
        path="/register"
        element={!user ? <Register /> : <Navigate to="/dashboard" replace />}
      />

      {/* Protected routes with layout */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <AppLayout>
              <DashboardPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/projects"
        element={
          <ProtectedRoute>
            <AppLayout>
              <ProjectsPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/projects/:id"
        element={
          <ProtectedRoute>
            <AppLayout>
              <ProjectDetailsPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/projects/edit/:id"
        element={
          <ProtectedRoute>
            <AppLayout>
              <EditProjectPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      {/* Notifications */}
      <Route
        path="/notifications"
        element={
          <ProtectedRoute>
            <AppLayout>
              <NotificationsPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      {/* Chat + Invite */}
      <Route
        path="/chats/:taskId"
        element={
          <ProtectedRoute>
            <AppLayout>
              <ChatPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

     

      {/* Redirects */}
      <Route
        path="/"
        element={<Navigate to={user ? "/dashboard" : "/login"} replace />}
      />
      <Route
        path="*"
        element={<Navigate to={user ? "/dashboard" : "/login"} replace />}
      />
    </Routes>
  );
}

/** -------------------------------------
 * Root App Component
 * ------------------------------------- */
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <ScrollToTop />
          <AppRoutes />
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}