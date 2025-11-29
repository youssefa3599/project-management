// src/pages/InvitePage.tsx
import { useEffect, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";

interface ProjectInfo {
  name: string;
  description: string;
}

export default function InvitePage() {
  const { projectId } = useParams();
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email");
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // ✅ Fetch project info when the page loads
  useEffect(() => {
    async function fetchProject() {
      try {
        const res = await axios.get(`/api/projects/${projectId}`);
        setProject(res.data);
      } catch {
        setError("Invalid or expired invitation.");
      } finally {
        setLoading(false);
      }
    }
    fetchProject();
  }, [projectId]);

  // ✅ Handle accept invitation
  const handleAccept = async () => {
    try {
      const token = localStorage.getItem("token");

      // If user is not logged in, redirect to login with redirect URL
      if (!token) {
        navigate(`/login?redirect=/invite/${projectId}?email=${email}`);
        return;
      }

      // Send accept request to backend
      await axios.post(
        "/api/invites/accept",
        { projectId, email },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setMessage("✅ You’ve successfully joined the project!");
      setError("");
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to join project.");
    }
  };

  // ✅ Conditional UI states
  if (loading) return <p>Loading invite...</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;

  // ✅ Main render
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="bg-white shadow-lg rounded-2xl p-8 max-w-md text-center">
        <h1 className="text-2xl font-bold mb-3">You're invited!</h1>

        <p>
          {email} was invited to join <b>{project?.name}</b>
        </p>
        <p className="text-gray-500 text-sm mt-1">{project?.description}</p>

        <button
          onClick={handleAccept}
          className="mt-6 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-all"
        >
          Accept Invitation
        </button>

        {message && <p className="mt-4 text-green-600">{message}</p>}
      </div>
    </div>
  );
}
