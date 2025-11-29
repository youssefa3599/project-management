import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;

interface Project {
  _id: string;
  name: string;
  description: string;
}

const EditProjectPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProject = async () => {
      console.log("🟡 [DEBUG] useParams id:", id);
      console.log("🟡 [DEBUG] Fetching project from:", `${API_URL}/api/projects/${id}`);

      try {
        const token = localStorage.getItem("token");
        const res = await axios.get(`${API_URL}/api/projects/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        console.log("🟢 [DEBUG] Response from backend:", res.data);
        setProject(res.data.project || res.data);
      } catch (err: any) {
        console.error("🔴 [DEBUG] Fetch project error:", err.response?.data || err.message);
        alert("Failed to load project details");
      } finally {
        setLoading(false);
      }
    };
    fetchProject();
  }, [id]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;

    console.log("🟡 [DEBUG] Updating project:", project);
    console.log("🟡 [DEBUG] Sending PUT to:", `${API_URL}/api/projects/${project._id}`);

    try {
      const token = localStorage.getItem("token");
      const res = await axios.put(
        `${API_URL}/api/projects/${project._id}`,
        { name: project.name, description: project.description },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      console.log("🟢 [DEBUG] Update success response:", res.data);
      alert("✅ Project updated successfully!");

      // ✅ Pass updated project to ProjectsPage for instant UI update
      console.log("🟣 [DEBUG] Navigating back to /projects with updatedProject in state");
      navigate("/projects", { state: { updatedProject: res.data.project } });
    } catch (err: any) {
      console.error("🔴 [DEBUG] Update failed:", err.response?.data || err.message);
      alert(err.response?.data?.message || "Update failed");
    }
  };

  if (loading) return <p>Loading project...</p>;
  if (!project) return <p>Project not found</p>;

  return (
    <div className="projects-container">
      <h1>Edit Project</h1>

      <form onSubmit={handleUpdate} className="create-project-form">
        <input
          type="text"
          value={project.name}
          onChange={(e) => setProject({ ...project, name: e.target.value })}
          placeholder="Project name"
          required
        />
        <textarea
          value={project.description}
          onChange={(e) => setProject({ ...project, description: e.target.value })}
          placeholder="Project description"
          required
        />
        <button type="submit" className="btn-create">Save Changes</button>
        <button
          type="button"
          onClick={() => {
            console.log("🟠 [DEBUG] Cancel clicked — navigating back");
            navigate("/projects");
          }}
          style={{ marginLeft: "10px" }}
        >
          Cancel
        </button>
      </form>
    </div>
  );
};

export default EditProjectPage;
