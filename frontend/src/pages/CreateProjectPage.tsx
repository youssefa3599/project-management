// src/pages/CreateProjectPage.tsx
import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "../styles/CreateProjectPage.css";

const CreateProjectPage: React.FC = () => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    try {
      const token = localStorage.getItem("token");

      const response = await axios.post(
        "http://localhost:5000/api/projects",
        { name, description },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setMessage("✅ Project created successfully!");
      setName("");
      setDescription("");

      // Redirect to project list after short delay
      setTimeout(() => navigate("/projects"), 1000);
    } catch (err: any) {
      setMessage(err.response?.data?.message || "❌ Failed to create project");
    }
  };

  return (
    <div className="create-project-container">
      <h1 className="create-project-title">Create a New Project</h1>

      {message && <p className="create-project-message">{message}</p>}

      <form className="create-project-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="name">Project Name</label>
          <input
            type="text"
            id="name"
            placeholder="Enter project name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="description">Project Description</label>
          <textarea
            id="description"
            placeholder="Enter a short description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            required
          />
        </div>

        <button type="submit" className="create-btn">
          Create Project
        </button>
      </form>
    </div>
  );
};

export default CreateProjectPage;
