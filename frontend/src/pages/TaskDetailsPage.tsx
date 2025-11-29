import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import useAddComment, { Comment, Task } from "../hooks/useAddComment";
import "./TaskDetailsPage.css";

export default function TaskDetailsPage() {
  const { id } = useParams<{ id: string }>();
  if (!id) throw new Error("Task id missing from params");
  const taskId = id;

  const [newComment, setNewComment] = useState("");

  // Fetch task
  const { data: task, isLoading, error } = useQuery<Task, Error>({
    queryKey: ["task", taskId],
    queryFn: async () => {
      const res = await axios.get(`/api/tasks/${taskId}`);
      return res.data.task as Task;
    },
  });

  // Use AddComment hook
  const addCommentMutation = useAddComment(taskId);

const handleAddComment = () => {
  if (!newComment.trim()) return;
  addCommentMutation.mutate({ content: newComment.trim() });
  setNewComment("");
};

const isAddingComment = addCommentMutation.status === "pending"; // ✅ fixed
 // ✅ TS-safe

  if (isLoading) return <p>Loading task...</p>;
  if (error || !task) return <p>Failed to load task.</p>;

  return (
    <div className="task-details-container">
      <h2>{task.title}</h2>
      <p>{task.description}</p>
      <p>Status: {task.status}</p>

      <hr />

      <h3>Comments</h3>
      <ul className="comments-list">
        {task.comments.map((c) => (
          <li key={c._id}>
            <strong>{c.author.name}:</strong> {c.content}{" "}
            <span className="comment-date">
              ({new Date(c.createdAt).toLocaleString()})
            </span>
          </li>
        ))}
      </ul>

      <div className="add-comment">
        <input
          type="text"
          placeholder="Write a comment..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
        />
        <button onClick={handleAddComment} disabled={isAddingComment}>
          {isAddingComment ? "Adding..." : "Add Comment"}
        </button>
      </div>
    </div>
  );
}
