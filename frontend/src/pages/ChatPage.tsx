import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { connectSocket, disconnectSocket } from "../utils/socket";
import TaskChatGoals, { ITaskGoal } from "../components/TaskChatGoals";
import "./ChatPage.css";

interface IUser {
  id?: string;
  _id?: string;
  name: string;
  email?: string;
  role?: "admin" | "editor" | "viewer";
}

interface IMessage {
  _id: string;
  sender: IUser;
  content: string;
  createdAt: string;
}

const getUserId = (u?: IUser | null) => u?._id || u?.id || "";

export default function ChatPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const { user, token } = useAuth();
  const API_URL = import.meta.env.VITE_API_URL;

  const [messages, setMessages] = useState<IMessage[]>([]);
  const [goals, setGoals] = useState<ITaskGoal[]>([]);
  const [chatMembers, setChatMembers] = useState<IUser[]>([]);
  const [showMembersDropdown, setShowMembersDropdown] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [allUsers, setAllUsers] = useState<IUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);

  // ✅ Mention autocomplete state
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [mentionCursorPosition, setMentionCursorPosition] = useState(0);
  const [filteredMentions, setFilteredMentions] = useState<IUser[]>([]);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);

  const socketRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // -----------------------------
  // Fetch chat messages
  // -----------------------------
  useEffect(() => {
    const fetchMessages = async () => {
      if (!taskId || !token) return;
      try {
        const res = await axios.get(`${API_URL}/api/tasks/${taskId}/chat`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        const fetchedMessages: IMessage[] = res.data?.messages ?? res.data ?? [];
        console.log(`📥 Fetched ${fetchedMessages.length} messages from server`);
        setMessages(fetchedMessages);
      } catch (err) {
        console.error("❌ Failed to fetch messages:", err);
      }
    };
    fetchMessages();
  }, [taskId, token, API_URL]);

  // -----------------------------
  // Fetch task members
  // -----------------------------
  useEffect(() => {
    const fetchTaskMembers = async () => {
      if (!taskId || !token) return;
      try {
        const res = await axios.get(`${API_URL}/api/tasks/${taskId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        const task = res.data?.task || res.data;
        if (task?.members && Array.isArray(task.members)) {
          console.log(`👥 Found ${task.members.length} task members`);
          setChatMembers(task.members);
        }
      } catch (err) {
        console.error("❌ Failed to fetch task members:", err);
      }
    };
    
    fetchTaskMembers();
  }, [taskId, token, API_URL]);

  // -----------------------------
  // Fetch goals
  // -----------------------------
  useEffect(() => {
    const fetchGoals = async () => {
      if (!taskId || !token) return;
      try {
        const res = await axios.get(`${API_URL}/api/chats/${taskId}/task-goals`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setGoals(res.data ?? []);
      } catch (err) {
        console.error("❌ Failed to fetch goals:", err);
      }
    };
    fetchGoals();
  }, [taskId, token, API_URL]);

  // -----------------------------
  // Socket setup - ZERO FILTERING
  // -----------------------------
  useEffect(() => {
    if (!token || !taskId) return;

    const socket = connectSocket(token);
    socketRef.current = socket;

    const onConnect = () => {
      console.log("✅ Socket connected");
      setSocketConnected(true);
      socket.emit("joinTaskChat", taskId);
      console.log(`📡 Joined room: task_${taskId}`);
    };

    const onNewTaskMessage = (msg: any) => {
      console.log("📨 [Socket] Received newTaskMessage:", msg._id);
      
      // ✅ JUST ADD IT - NO CHECKS AT ALL
      const formattedMessage: IMessage = {
        _id: msg._id || `msg-${Date.now()}`,
        sender: typeof msg.sender === 'string' 
          ? { _id: msg.sender, name: 'Loading...' } as IUser
          : {
              _id: msg.sender._id || msg.sender.id,
              id: msg.sender.id || msg.sender._id,
              name: msg.sender.name || 'Unknown User',
              email: msg.sender.email,
            } as IUser,
        content: msg.content,
        createdAt: msg.createdAt || new Date().toISOString(),
      };
      
      // Just add to state array, that's it
      setMessages(prev => [...prev, formattedMessage]);
    };

    const onDisconnect = (reason: string) => {
      console.log("❌ Socket disconnected:", reason);
      setSocketConnected(false);
    };

    // ✅ Listen for mention notifications
    const onMentionNotification = (data: any) => {
      console.log("📢 Mention notification:", data);
      const shouldNavigate = window.confirm(
        `${data.senderName} mentioned you in a message! Go to notifications?`
      );
      if (shouldNavigate) {
        window.location.href = '/notifications';
      }
    };

    const onMemberJoined = async () => {
      console.log("👥 Member joined, refetching members...");
      try {
        const res = await axios.get(`${API_URL}/api/tasks/${taskId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        const task = res.data?.task || res.data;
        if (task?.members) {
          setChatMembers(task.members);
          console.log(`✅ Updated members list: ${task.members.length} members`);
        }
      } catch (err) {
        console.error("❌ Failed to refetch members:", err);
      }
    };

    socket.on("connect", onConnect);
    socket.on("newTaskMessage", onNewTaskMessage);
    socket.on("disconnect", onDisconnect);
    socket.on("mentionNotification", onMentionNotification);
    socket.on("memberJoinedTaskChat", onMemberJoined);

    if (socket.connected) {
      onConnect();
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("newTaskMessage", onNewTaskMessage);
      socket.off("disconnect", onDisconnect);
      socket.off("mentionNotification", onMentionNotification);
      socket.off("memberJoinedTaskChat", onMemberJoined);
      
      if (taskId) {
        socket.emit("leaveTaskChat", taskId);
      }
      
      disconnectSocket();
      socketRef.current = null;
      setSocketConnected(false);
    };
  }, [token, taskId, API_URL]);

  // -----------------------------
  // ✅ Handle mention autocomplete
  // -----------------------------
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    
    setNewMessage(value);
    
    const textBeforeCursor = value.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
      
      if (!textAfterAt.includes(' ')) {
        setMentionSearch(textAfterAt.toLowerCase());
        setMentionCursorPosition(lastAtIndex);
        
        const filtered = chatMembers.filter(member =>
          member.name.toLowerCase().includes(textAfterAt.toLowerCase())
        );
        
        setFilteredMentions(filtered);
        setShowMentionDropdown(filtered.length > 0);
        setSelectedMentionIndex(0);
      } else {
        setShowMentionDropdown(false);
      }
    } else {
      setShowMentionDropdown(false);
    }
  };

  // -----------------------------
  // ✅ Handle mention selection
  // -----------------------------
  const insertMention = (member: IUser) => {
  const beforeMention = newMessage.slice(0, mentionCursorPosition);
  const afterMention = newMessage.slice(mentionCursorPosition + mentionSearch.length + 1);
  
  // 🔥 FIX: Wrap names with spaces in quotes
  const mentionText = member.name.includes(' ') 
    ? `@"${member.name}"` 
    : `@${member.name}`;
  
  const newText = `${beforeMention}${mentionText} ${afterMention}`;
  setNewMessage(newText);
  setShowMentionDropdown(false);
  
  setTimeout(() => {
    inputRef.current?.focus();
    const newCursorPos = beforeMention.length + mentionText.length + 1;
    inputRef.current?.setSelectionRange(newCursorPos, newCursorPos);
  }, 0);
};

  // -----------------------------
  // ✅ Handle keyboard navigation for mentions
  // -----------------------------
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showMentionDropdown) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMentionIndex(prev => 
          prev < filteredMentions.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMentionIndex(prev => prev > 0 ? prev - 1 : prev);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredMentions[selectedMentionIndex]) {
          insertMention(filteredMentions[selectedMentionIndex]);
        }
      } else if (e.key === 'Escape') {
        setShowMentionDropdown(false);
      }
    }
  };

  // -----------------------------
  // ✅ Render message with highlighted mentions
  // -----------------------------
  const renderMessageContent = (content: string) => {
    const mentionRegex = /@(\w+)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = mentionRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push(
          <span key={`text-${lastIndex}`}>
            {content.slice(lastIndex, match.index)}
          </span>
        );
      }

      const mentionedName = match[1];
      const isMentioningMe = mentionedName.toLowerCase() === user?.name?.toLowerCase();
      
      parts.push(
        <span
          key={`mention-${match.index}`}
          style={{
            backgroundColor: isMentioningMe ? '#fef3c7' : '#dbeafe',
            color: isMentioningMe ? '#92400e' : '#1e40af',
            padding: '2px 6px',
            borderRadius: '4px',
            fontWeight: '600',
          }}
        >
          @{mentionedName}
        </span>
      );

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) {
      parts.push(
        <span key={`text-${lastIndex}`}>
          {content.slice(lastIndex)}
        </span>
      );
    }

    return parts.length > 0 ? parts : content;
  };

  // -----------------------------
  // Send message - NO TEMP MESSAGE LOGIC
  // -----------------------------
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !taskId || !token) return;

    const payload = { content: newMessage.trim() };
    setNewMessage("");

    try {
      await axios.post(
        `${API_URL}/api/tasks/${taskId}/chat`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // That's it. Socket will handle adding the message to UI
      console.log("✅ Message sent");
      
    } catch (err) {
      console.error("❌ Failed to send:", err);
      alert("Failed to send message");
    }
  };

  // -----------------------------
  // Auto-scroll
  // -----------------------------
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // -----------------------------
  // Invite modal handlers
  // -----------------------------
  const handleOpenInvite = async () => {
    if (!token) return;
    setShowInviteModal(true);
    setLoadingUsers(true);
    try {
      const res = await axios.get(`${API_URL}/api/auth/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAllUsers(res.data ?? []);
    } catch (err) {
      console.error("Failed to fetch users:", err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleCloseInvite = () => {
    setShowInviteModal(false);
  };

  const handleInviteUser = async (invitedUser: IUser) => {
    if (!token || !taskId) return;
    
    const invitedUserId = invitedUser._id || invitedUser.id;
    if (!invitedUserId) return;

    setInvitingUserId(invitedUserId);

    const payload = {
      userId: invitedUserId,
      type: "taskChatInvite",
      message: `${user?.name} invited you to join a task chat`,
      task: taskId,
    };

    try {
      await axios.post(
        `${API_URL}/api/notifications`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      alert(`✅ Invitation sent to ${invitedUser.name}!`);
      handleCloseInvite();
    } catch (err: any) {
      console.error("❌ Failed to invite:", err);
      alert(`❌ ${err.response?.data?.message || "Failed to send invitation"}`);
    } finally {
      setInvitingUserId(null);
    }
  };

  // -----------------------------
  // Render
  // -----------------------------
  return (
    <div className="chat-page">
      <div className="chat-header">
        <div className="chat-header-left">
          <h2>Task Chat</h2>
          <p>
            {socketConnected ? "🟢 Connected" : "🔴 Disconnected"}
            {chatMembers.length > 0 && ` • ${chatMembers.length} member${chatMembers.length > 1 ? 's' : ''}`}
          </p>
        </div>
        
        <div className="chat-header-right">
          <div className="members-container">
            <button 
              className="members-btn"
              onClick={() => setShowMembersDropdown(!showMembersDropdown)}
            >
              👥 Members ({chatMembers.length})
            </button>
            
            {showMembersDropdown && (
              <div className="members-dropdown">
                <h4>Task Members</h4>
                {chatMembers.length === 0 ? (
                  <p className="no-members">No members yet</p>
                ) : (
                  <ul>
                    {chatMembers.map((member) => {
                      const memberId = member._id || member.id;
                      const isCurrentUser = memberId === getUserId(user);
                      
                      return (
                        <li key={memberId}>
                          <div className="member-info">
                            <span className="member-name">
                              {member.name}
                              {isCurrentUser && (
                                <span className="current-user-badge">(You)</span>
                              )}
                            </span>
                            {member.email && (
                              <span className="member-email">{member.email}</span>
                            )}
                          </div>
                          {member.role && (
                            <span className={`member-role role-${member.role}`}>
                              {member.role}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>

          <button className="invite-btn" onClick={handleOpenInvite}>
            + Invite User
          </button>
        </div>
      </div>

      <TaskChatGoals
        taskId={taskId!}
        externalGoals={goals}
        setExternalGoals={setGoals}
        socketRef={socketRef}
      />

      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="no-messages">
            No messages yet. Type @ to mention someone!
          </div>
        ) : (
          messages.map((msg) => {
            const senderUserId = getUserId(msg.sender);
            const currentUserId = getUserId(user);
            const isOwn = senderUserId === currentUserId;
            
            return (
              <div key={msg._id} className={`message ${isOwn ? "own" : "other"}`}>
                <div className="sender-name">{msg.sender?.name}</div>
                <div className="message-content">
                  {renderMessageContent(msg.content)}
                </div>
                <div className="message-time">
                  {new Date(msg.createdAt).toLocaleTimeString()}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="message-form" onSubmit={handleSendMessage}>
        <div className="message-input-wrapper">
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a message... (use @ to mention)"
            value={newMessage}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={!socketConnected}
          />
          
          {showMentionDropdown && (
            <div className="mention-dropdown">
              {filteredMentions.map((member, index) => (
                <div
                  key={member._id || member.id}
                  onClick={() => insertMention(member)}
                  className={`mention-item ${index === selectedMentionIndex ? 'selected' : ''}`}
                  onMouseEnter={() => setSelectedMentionIndex(index)}
                >
                  <span className="mention-name">{member.name}</span>
                  {member.email && (
                    <span className="mention-email">{member.email}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        
        <button type="submit" disabled={!socketConnected}>
          {socketConnected ? "Send" : "Connecting..."}
        </button>
      </form>

      {showInviteModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Invite a User</h3>
            <button className="close-btn" onClick={handleCloseInvite}>
              ✖
            </button>
            {loadingUsers ? (
              <p>Loading users...</p>
            ) : (
              <ul className="user-list">
                {allUsers.length === 0 ? (
                  <li>No users found.</li>
                ) : (
                  allUsers.map((u) => {
                    const userId = u._id || u.id;
                    const isInviting = invitingUserId === userId;
                    const isAlreadyMember = chatMembers.some(
                      m => (m._id || m.id) === userId
                    );
                    
                    return (
                      <li key={userId}>
                        <div>
                          <strong>{u.name}</strong> ({u.email})
                          {isAlreadyMember && (
                            <span style={{ 
                              color: 'green', 
                              marginLeft: '8px',
                              fontSize: '0.9em',
                              fontWeight: 'bold'
                            }}>
                              ✓ Already a member
                            </span>
                          )}
                        </div>
                        <button 
                          className="invite-action-btn"
                          onClick={() => handleInviteUser(u)}
                          disabled={isInviting || isAlreadyMember}
                        >
                          {isInviting ? "Sending..." : isAlreadyMember ? "Member" : "Invite"}
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}