import React, { useEffect, useState, MutableRefObject } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

export interface IUser {
  id?: string;
  _id?: string;
  name: string;
  role?: "admin" | "editor" | "viewer";
}

export interface ITaskGoal {
  _id: string;
  title: string;
  status: "pending" | "succeeded";
  createdBy: IUser;
}

interface Props {
  taskId: string;
  externalGoals?: ITaskGoal[];
  setExternalGoals?: React.Dispatch<React.SetStateAction<ITaskGoal[]>>;
  socketRef?: MutableRefObject<any | null>;
}

const TaskChatGoals: React.FC<Props> = ({
  taskId,
  externalGoals,
  setExternalGoals,
  socketRef,
}) => {
  const { user, token } = useAuth();
  const API_URL = import.meta.env.VITE_API_URL;
  const [goals, setGoals] = useState<ITaskGoal[]>(externalGoals ?? []);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [togglingGoalId, setTogglingGoalId] = useState<string | null>(null);

  // 🐛 DEBUG: Watch externalGoals
  useEffect(() => {
    console.log("🐛 [DEBUG] externalGoals updated:", externalGoals?.length, externalGoals);
  }, [externalGoals]);

  // 🐛 DEBUG: Watch internal goals
  useEffect(() => {
    console.log("🐛 [DEBUG] goals state changed:", goals.length, goals);
  }, [goals]);

  // Helper: deduplicate by _id
  const dedupeGoals = (arr: ITaskGoal[]): ITaskGoal[] => {
    const unique = arr.filter(
      (g, i, self) => i === self.findIndex((x) => x._id === g._id)
    );
    if (unique.length !== arr.length) {
      console.warn("⚠️ [DEBUG] Duplicate goals detected!", {
        total: arr.length,
        unique: unique.length,
        duplicates: arr.length - unique.length,
      });
    }
    return unique;
  };

  // Sync externalGoals -> local state when parent updates
  useEffect(() => {
    if (externalGoals) {
      console.log("🐛 [DEBUG] Syncing externalGoals → local goals", externalGoals.length);
      const unique = dedupeGoals(externalGoals);
      setGoals(unique);
    }
  }, [externalGoals]);

  // Helper: update both internal and external (if provided)
  const setBoth = (updater: (prev: ITaskGoal[]) => ITaskGoal[]) => {
    setGoals((prev) => {
      const next = updater(prev);
      const unique = dedupeGoals(next);
      console.log("🐛 [DEBUG] setBoth() updating local + external, new length:", unique.length);
      setExternalGoals?.(unique);
      return unique;
    });
  };

  // --------------------------
  // Create goal (optimistic)
  // --------------------------
  const createGoal = async () => {
    if (!title.trim() || !taskId || !token) {
      return alert("Enter a goal title");
    }

    const tempId = `tmp-${Date.now()}`;
    const tempGoal: ITaskGoal = {
      _id: tempId,
      title: title.trim(),
      status: "pending",
      createdBy: user as IUser,
    };

    console.log("🐛 [DEBUG] createGoal() adding temp goal:", tempGoal);

    // optimistic add
    setBoth((prev) => [...prev, tempGoal]);
    setTitle("");

    try {
      const res = await axios.post(
        `${API_URL}/api/chats/${taskId}/task-goal`,
        { title: tempGoal.title },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const saved: ITaskGoal = res.data;

      console.log("🐛 [DEBUG] createGoal() server returned:", saved);

      // replace temp with real
      setBoth((prev) =>
        prev.map((g) => (g._id === tempId ? saved : g))
      );

      // emit via socket so other clients pick it up immediately
      if (socketRef?.current?.connected) {
        console.log("🐛 [DEBUG] Emitting socket event: taskGoalCreated", { taskId, goal: saved });
        socketRef.current.emit("taskGoalCreated", { taskId, goal: saved });
      }
    } catch (err) {
      console.error("createGoal failed:", err);
      // rollback
      setBoth((prev) => prev.filter((g) => g._id !== tempId));
      alert("Failed to create goal");
    }
  };

  // --------------------------
  // Toggle status (optimistic)
  // --------------------------
  const toggleGoalStatus = async (goalId: string, current: "pending" | "succeeded") => {
    if (!taskId || !token) return;
    if (togglingGoalId === goalId) {
      console.warn("Duplicate toggle prevented for", goalId);
      return;
    }

    const newStatus: "pending" | "succeeded" =
      current === "succeeded" ? "pending" : "succeeded";
    setTogglingGoalId(goalId);

    console.log("🐛 [DEBUG] toggleGoalStatus() ->", goalId, "new status:", newStatus);

    // optimistic update
    setBoth((prev) =>
      prev.map((g) => (g._id === goalId ? { ...g, status: newStatus } : g))
    );

    try {
      await axios.patch(
        `${API_URL}/api/chats/${taskId}/task-goal/${goalId}/status`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (socketRef?.current?.connected) {
        socketRef.current.emit("taskGoalUpdated", {
          taskId,
          goalId,
          status: newStatus,
        });
      }
    } catch (err) {
      console.error("toggleGoalStatus failed:", err);
      // rollback
      setBoth((prev) =>
        prev.map((g) => (g._id === goalId ? { ...g, status: current } : g))
      );
      alert("Failed to update goal status");
    } finally {
      setTogglingGoalId(null);
    }
  };

  // --------------------------
  // Edit title (optimistic)
  // --------------------------
  const editGoal = async (goalId: string, currentTitle: string) => {
    const newTitle = prompt("Enter new title:", currentTitle);
    if (!newTitle || newTitle.trim() === currentTitle) return;

    const cleanTitle = newTitle.trim();

    console.log("🐛 [DEBUG] editGoal() ->", goalId, cleanTitle);

    // optimistic update
    setBoth((prev) =>
      prev.map((g) => (g._id === goalId ? { ...g, title: cleanTitle } : g))
    );

    try {
      const res = await axios.patch(
        `${API_URL}/api/chats/${taskId}/task-goal/${goalId}`,
        { title: cleanTitle },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const updated: ITaskGoal = res.data;

      setBoth((prev) =>
        prev.map((g) => (g._id === goalId ? updated : g))
      );

      if (socketRef?.current?.connected) {
        socketRef.current.emit("taskGoalUpdated", { taskId, goal: updated });
      }
    } catch (err) {
      console.error("editGoal failed:", err);
      // rollback
      setBoth((prev) =>
        prev.map((g) => (g._id === goalId ? { ...g, title: currentTitle } : g))
      );
      alert("Failed to update goal");
    }
  };

  // --------------------------
  // Delete goal (optimistic)
  // --------------------------
  const deleteGoal = async (goalId: string) => {
    if (!window.confirm("Are you sure you want to delete this goal?")) return;
    if (!taskId || !token) return;

    console.log("🐛 [DEBUG] deleteGoal() called for:", goalId);

    const backup = goals.find((g) => g._id === goalId);
    setBoth((prev) => prev.filter((g) => g._id !== goalId));

    try {
      await axios.delete(`${API_URL}/api/chats/${taskId}/task-goal/${goalId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (socketRef?.current?.connected) {
        socketRef.current.emit("taskGoalDeleted", { taskId, goalId });
      }

      console.log("✅ [DEBUG] Goal deleted successfully:", goalId);
    } catch (err) {
      console.error("deleteGoal failed:", err);
      if (backup) setBoth((prev) => [...prev, backup]);
      alert("Failed to delete goal");
    }
  };

  const isEditor = user?.role === "editor" || user?.role === "admin";

  return (
    <div
      className="task-goals-box"
      style={{
        background: "#f8f9fa",
        border: "1px solid #ddd",
        borderRadius: "10px",
        padding: "1rem",
        marginBottom: "1rem",
      }}
    >
      <h3 style={{ marginBottom: "1rem" }}>🎯 Task Goals</h3>

      {loading ? (
        <p>Loading goals...</p>
      ) : (
        <div
          className="goals-list"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.8rem",
            marginBottom: "1rem",
          }}
        >
          {goals.length > 0 ? (
            goals.map((goal) => {
              const isToggling = togglingGoalId === goal._id;
              return (
                <div
                  key={goal._id}
                  className={`goal-item ${goal.status}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "#fff",
                    padding: "0.6rem 0.8rem",
                    borderRadius: "8px",
                    border: "1px solid #ddd",
                    opacity: isToggling ? 0.6 : 1,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.6rem",
                      flex: 1,
                    }}
                  >
                    {isEditor && (
                      <input
                        type="checkbox"
                        checked={goal.status === "succeeded"}
                        disabled={isToggling}
                        onChange={() => toggleGoalStatus(goal._id, goal.status)}
                        style={{
                          transform: "scale(1.3)",
                          cursor: isToggling ? "not-allowed" : "pointer",
                          accentColor: "#28a745",
                        }}
                      />
                    )}
                    <div>
                      <div
                        style={{
                          fontWeight: "600",
                          textDecoration:
                            goal.status === "succeeded" ? "line-through" : "none",
                        }}
                      >
                        {goal.title}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "#555", marginTop: "2px" }}>
                        Created by: <em>{goal.createdBy?.name}</em>
                      </div>
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: "0.8rem",
                      color: goal.status === "succeeded" ? "#28a745" : "#888",
                      marginRight: "1rem",
                    }}
                  >
                    {isToggling
                      ? "🔄 Updating..."
                      : goal.status === "succeeded"
                      ? "✅ Done"
                      : "⏳ Pending"}
                  </span>

                  {isEditor && (
                    <div style={{ display: "flex", gap: "0.4rem" }}>
                      <button
                        style={{
                          background: "#ffc107",
                          color: "#000",
                          border: "none",
                          padding: "0.3rem 0.6rem",
                          borderRadius: "5px",
                          cursor: "pointer",
                          fontSize: "0.8rem",
                        }}
                        onClick={() => editGoal(goal._id, goal.title)}
                      >
                        ✏️ Edit
                      </button>

                      <button
                        style={{
                          background: "#dc3545",
                          color: "#fff",
                          border: "none",
                          padding: "0.3rem 0.6rem",
                          borderRadius: "5px",
                          cursor: "pointer",
                          fontSize: "0.8rem",
                        }}
                        onClick={() => deleteGoal(goal._id)}
                      >
                        🗑 Delete
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <p style={{ color: "#666" }}>No goals yet</p>
          )}
        </div>
      )}

      {isEditor && (
        <div className="goal-create" style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <input
            type="text"
            placeholder="Goal title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{
              flex: 1,
              padding: "0.4rem",
              border: "1px solid #ccc",
              borderRadius: "5px",
            }}
          />
          <button
            onClick={createGoal}
            style={{
              background: "#111",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              padding: "0.5rem 1rem",
              cursor: "pointer",
            }}
          >
            ➕ Add Goal
          </button>
        </div>
      )}
    </div>
  );
};

export default TaskChatGoals;
