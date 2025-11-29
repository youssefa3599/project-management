import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";
import { connectSocket, disconnectSocket } from "../utils/socket";
import "./ProjectsPage.css";

interface Member {
  _id: string;
  name: string;
  email: string;
  role: "admin" | "editor" | "viewer";
}

interface Project {
  _id: string;
  name: string;
  description: string;
  createdBy: { _id: string; name: string; email: string };
  members: Member[];
  status: "active" | "completed" | "archived";
}

const API_URL = import.meta.env.VITE_API_URL;

const ProjectsPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");

  const navigate = useNavigate();
  const location = useLocation();
  const userRole = localStorage.getItem("role");

  console.log("=" .repeat(60));
  console.log("🟡 [RENDER] ProjectsPage component rendered");
  console.log("📍 Location state:", location.state);
  console.log("👤 User role:", userRole);
  console.log("🌐 API_URL:", API_URL);
  console.log("=" .repeat(60));

  /** ------------------------------------
   * Fetch Projects
   * ------------------------------------ */
  const fetchProjects = async (reason = "manual") => {
    console.log("\n" + "=".repeat(60));
    console.log(`🔄 [FETCH] Starting fetchProjects()`);
    console.log(`📌 Reason: ${reason}`);
    console.log("=".repeat(60));
    
    setLoading(true);

    try {
      const token = localStorage.getItem("token");
      console.log("🔑 Token exists:", !!token);
      console.log("🔑 Token preview:", token ? token.substring(0, 20) + "..." : "null");
      
      const url = `${API_URL}/api/projects?_=${Date.now()}`;
      console.log("🌐 Request URL:", url);
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      console.log("\n📦 [RESPONSE] Full response object:");
      console.log(JSON.stringify(response.data, null, 2));
      
      console.log("\n🔍 [PARSING] Checking response structure:");
      console.log("  - response.data.projects:", response.data.projects);
      console.log("  - response.data.data:", response.data.data);
      console.log("  - response.data:", response.data);
      
      const data = response.data.projects || response.data.data || [];
      
      console.log("\n✅ [RESULT] Final parsed data:");
      console.log("  - Type:", Array.isArray(data) ? "Array" : typeof data);
      console.log("  - Length:", Array.isArray(data) ? data.length : "N/A");
      console.log("  - Projects:", JSON.stringify(data, null, 2));
      
      setProjects(data);
      setMessage("");
      
      console.log("✅ [SUCCESS] Projects state updated");
      console.log("=".repeat(60) + "\n");
    } catch (err: any) {
      console.log("\n❌ [ERROR] fetchProjects failed:");
      console.error("  - Status:", err.response?.status);
      console.error("  - Status Text:", err.response?.statusText);
      console.error("  - Error Data:", err.response?.data);
      console.error("  - Error Message:", err.message);
      console.error("  - Full Error:", err);
      console.log("=".repeat(60) + "\n");
      
      setMessage(err.response?.data?.message || "Failed to load projects");
    } finally {
      setLoading(false);
      console.log("🏁 [COMPLETE] fetchProjects finished\n");
    }
  };

  /** ------------------------------------
   * Initial load
   * ------------------------------------ */
  useEffect(() => {
    console.log("🎬 [EFFECT] Initial load effect triggered");
    fetchProjects("initial load");
  }, []);

  /** ------------------------------------
   * Refresh if invited project was accepted
   * ------------------------------------ */
  useEffect(() => {
    console.log("🔔 [EFFECT] Navigation state effect triggered");
    console.log("   State:", location.state);
    
    if (location.state?.refreshProjects) {
      console.log("🔁 [REFRESH] Refresh triggered by navigation state");
      fetchProjects("invitation accepted");
      navigate("/projects", { replace: true, state: {} });
    }
  }, [location.state]);

  /** ------------------------------------
   * Real-time socket updates
   * ------------------------------------ */
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      console.log("⚠️ [SOCKET] No token, skipping socket connection");
      return;
    }

    console.log("🔌 [SOCKET] Connecting socket...");
    const socket = connectSocket(token);

    socket.on("notificationUpdated", (notification) => {
      console.log("📡 [SOCKET] notificationUpdated event:", notification);
      if (notification.status === "accepted" && notification.project) {
        console.log("🔄 [SOCKET] Triggering project refresh");
        fetchProjects("socket notification update");
      }
    });

    return () => {
      console.log("🔌 [SOCKET] Disconnecting socket");
      socket.off("notificationUpdated");
      disconnectSocket();
    };
  }, []);

  /** ------------------------------------
   * Monitor projects state changes
   * ------------------------------------ */
  useEffect(() => {
    console.log("📊 [STATE] Projects state changed:");
    console.log("   Count:", projects.length);
    console.log("   Projects:", projects.map(p => ({ id: p._id, name: p.name })));
  }, [projects]);

  /** ------------------------------------
   * Create Project
   * ------------------------------------ */
  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      alert("Enter project name");
      return;
    }

    console.log("\n" + "=".repeat(60));
    console.log("➕ [CREATE] Creating new project");
    console.log("   Name:", newProjectName);
    console.log("   Description:", newProjectDescription);
    console.log("=".repeat(60));

    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(
        `${API_URL}/api/projects`,
        { name: newProjectName, description: newProjectDescription },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      console.log("✅ [CREATE] Project created successfully:");
      console.log("   Response:", res.data);
      console.log("   New project:", res.data.project);
      
      setProjects((prev) => {
        const updated = [res.data.project, ...prev];
        console.log("📊 [STATE] Updated projects array:", updated.length, "items");
        return updated;
      });
      
      setNewProjectName("");
      setNewProjectDescription("");
      setShowCreateForm(false);
      alert("✅ Project created successfully!");
      console.log("=".repeat(60) + "\n");
    } catch (err: any) {
      console.error("❌ [CREATE] Failed to create project:");
      console.error("   Error:", err.response?.data || err.message);
      console.log("=".repeat(60) + "\n");
      alert(err.response?.data?.message || "Failed to create project");
    }
  };

  const editProject = (id: string) => {
    console.log("✏️ [ACTION] Edit clicked for project:", id);
    navigate(`/projects/edit/${id}`);
  };

  const viewProject = (id: string) => {
    console.log("👁️ [ACTION] View clicked for project:", id);
    navigate(`/projects/${id}`);
  };

  const handleDeleteProject = async (projectId: string) => {
    const confirmDelete = window.confirm("Are you sure you want to delete this project?");
    if (!confirmDelete) {
      console.log("❌ [DELETE] User cancelled deletion");
      return;
    }

    console.log("\n" + "=".repeat(60));
    console.log("🗑️ [DELETE] Deleting project:", projectId);
    console.log("=".repeat(60));

    try {
      const token = localStorage.getItem("token");
      const res = await axios.delete(`${API_URL}/api/projects/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      console.log("✅ [DELETE] Project deleted:", res.data.message);
      
      setProjects((prev) => {
        const updated = prev.filter((p) => p._id !== projectId);
        console.log("📊 [STATE] Updated projects array:", updated.length, "items");
        return updated;
      });
      
      alert("✅ Project deleted successfully!");
      console.log("=".repeat(60) + "\n");
    } catch (err: any) {
      console.error("❌ [DELETE] Failed to delete project:");
      console.error("   Error:", err.response?.data || err.message);
      console.log("=".repeat(60) + "\n");
      alert(err.response?.data?.message || "Failed to delete project");
    }
  };

  /** ------------------------------------
   * Render
   * ------------------------------------ */
  console.log("🎨 [RENDER] Rendering UI with:", {
    loading,
    projectsCount: projects.length,
    showCreateForm,
    message
  });

  return (
    <div className="projects-container">
      <div className="projects-header">
        <h1 className="projects-title">My Projects</h1>

        <div className="debug-info" style={{ 
          background: "#f0f0f0", 
          padding: "10px", 
          margin: "10px 0",
          borderRadius: "5px",
          fontFamily: "monospace",
          fontSize: "12px"
        }}>
          <p><strong>🔍 DEBUG INFO:</strong></p>
          <p>Role: {userRole || "none"}</p>
          <p>Projects Count: {projects.length}</p>
          <p>Loading: {loading ? "Yes" : "No"}</p>
          <p>API_URL: {API_URL || "NOT SET"}</p>
          <p>Has Token: {!!localStorage.getItem("token") ? "Yes" : "No"}</p>
        </div>

        {userRole === "admin" && (
          <button className="btn-create" onClick={() => setShowCreateForm(!showCreateForm)}>
            {showCreateForm ? "Hide Create Form" : "+ Create New Project"}
          </button>
        )}
      </div>

      {showCreateForm && (
        <div className="create-project-form">
          <input
            type="text"
            placeholder="Project Name"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
          />
          <textarea
            placeholder="Description"
            value={newProjectDescription}
            onChange={(e) => setNewProjectDescription(e.target.value)}
          />
          <button onClick={handleCreateProject}>Create</button>
        </div>
      )}

      {message && <p className="message">{message}</p>}
      {loading && <p>Loading projects...</p>}
      {!loading && projects.length === 0 && <p>No projects found.</p>}

      <div className="projects-grid">
        {projects.map((project) => (
          <div key={project._id} className="project-card">
            <h2>{project.name}</h2>
            <p>{project.description}</p>

            <div className="project-actions">
              <button onClick={() => viewProject(project._id)} className="btn btn-view">
                View
              </button>
              <button
                onClick={() => navigate(`/projects/${project._id}/members`)}
                className="btn btn-members"
              >
                Members
              </button>
              <button onClick={() => editProject(project._id)} className="btn btn-edit">
                Edit
              </button>
              {userRole === "admin" && (
                <button onClick={() => handleDeleteProject(project._id)} className="btn btn-delete">
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProjectsPage;