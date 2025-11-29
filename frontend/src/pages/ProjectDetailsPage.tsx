import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import "./ProjectDetailsPage.css";

interface IUser {
  _id: string;
  name: string;
  email: string;
  role: "admin" | "editor" | "viewer";
}

interface ITask {
  _id: string;
  title: string;
  status: "todo" | "in-progress" | "done";
  description?: string;
}

interface IProject {
  _id: string;
  name: string;
  description?: string;
  members: IUser[];
}

export default function ProjectDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [project, setProject] = useState<IProject | null>(null);
  const [tasks, setTasks] = useState<ITask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const API_URL = import.meta.env.VITE_API_URL;
  const token = localStorage.getItem("token");

  useEffect(() => {
    const fetchProjectAndTasks = async () => {
      setLoading(true);
      try {
        const projectRes = await axios.get(`${API_URL}/api/projects/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setProject(projectRes.data.project || projectRes.data);

        const tasksRes = await axios.get(`${API_URL}/api/tasks?projectId=${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setTasks(tasksRes.data.tasks || []);
      } catch (err) {
        console.error("❌ Failed loading project or tasks:", err);
        setError("Failed to load project or tasks");
      } finally {
        setLoading(false);
      }
    };

    fetchProjectAndTasks();
  }, [id]);

  const handleCreateTask = async () => {
    try {
      const res = await axios.post(
        `${API_URL}/api/tasks`,
        { title: newTitle, description: newDesc, projectId: id },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setTasks((prev) => [res.data.task, ...prev]);
      setShowModal(false);
      setNewTitle("");
      setNewDesc("");
    } catch (err) {
      console.error("❌ Failed to create task:", err);
      alert("Failed to create task");
    }
  };

const handleTaskClick = (task: ITask) => {
  navigate(`/chats/${task._id}`); // ✅ Correct path matches App.tsx route
};



  if (loading) return <p className="loading">Loading project...</p>;
  if (!project) return <p>{error || "Project not found"}</p>;

  return (
    <div className="project-container">
      <header className="project-header">
        <h2 className="project-title">{project.name}</h2>
        {project.description && <p className="project-desc">{project.description}</p>}
      </header>

      <section className="members-section">
        <h3 className="section-title">Members</h3>
        <ul className="members-list">
          {project.members.map((m) => (
            <li key={m._id} className="member-item">
              {m.name} <span className="member-role">({m.role})</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <div className="tasks-header">
          <h3 className="section-title">Tasks</h3>
          <button onClick={() => setShowModal(true)} className="add-task-btn">
            + Add Task
          </button>
        </div>

        <div className="tasks-grid">
          {tasks.length > 0 ? (
            tasks.map((task) => (
              <div
                key={task._id}
                className="task-card"
                onClick={() => handleTaskClick(task)}
                style={{ cursor: "pointer" }}
              >
                <h4 className="task-title">{task.title}</h4>
                {task.description && (
                  <p className="task-desc">{task.description.slice(0, 80)}...</p>
                )}
                <p className="task-status">Status: {task.status}</p>
              </div>
            ))
          ) : (
            <p>No tasks yet.</p>
          )}
        </div>
      </section>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 className="modal-title">Create Task</h3>

            <input
              className="input-field"
              placeholder="Task title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />

            <textarea
              className="textarea-field"
              placeholder="Description"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
            />

            <div className="modal-actions">
              <button onClick={() => setShowModal(false)} className="btn-cancel">
                Cancel
              </button>
              <button onClick={handleCreateTask} className="btn-create">
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
