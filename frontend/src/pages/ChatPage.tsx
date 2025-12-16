import React, { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { connectSocket, disconnectSocket } from "../utils/socket";
import TaskChatGoals, { ITaskGoal } from "../components/TaskChatGoals";
import useAddTaskMessage, { IMessage, IUser } from "../hooks/useAddTaskMessage";
import "./ChatPage.css";

const getUserId = (u?: IUser | null) => u?._id || u?.id || "";

interface PaginatedResponse {
  success: boolean;
  messages: IMessage[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalMessages: number;
    hasMore: boolean;
    limit: number;
  };
}

export default function ChatPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const { user, token } = useAuth();
  const API_URL = import.meta.env.VITE_API_URL;
  const queryClient = useQueryClient();

  const [goals, setGoals] = useState<ITaskGoal[]>([]);
  const [chatMembers, setChatMembers] = useState<IUser[]>([]);
  const [showMembersDropdown, setShowMembersDropdown] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [allUsers, setAllUsers] = useState<IUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [replyingTo, setReplyingTo] = useState<IMessage | null>(null);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [mentionCursorPosition, setMentionCursorPosition] = useState(0);
  const [filteredMentions, setFilteredMentions] = useState<IUser[]>([]);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [userHasScrolledUp, setUserHasScrolledUp] = useState(false);

  const socketRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messageRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const loadMoreTriggerRef = useRef<HTMLDivElement | null>(null);
  const hasScrolledToBottomRef = useRef(false);
  
  // Reset initial load flag when taskId changes
  useEffect(() => {
    console.log(`🔄 [TASK CHANGE] Task ID changed to: ${taskId}`);
    setIsInitialLoad(true);
    hasScrolledToBottomRef.current = false;
    setUserHasScrolledUp(false);
  }, [taskId]);

  // ✅ INFINITE QUERY: Fetch paginated messages
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: loadingMessages,
  } = useInfiniteQuery<PaginatedResponse>({
    queryKey: ['messages', taskId],
    queryFn: async ({ pageParam = 1 }) => {
      if (!taskId || !token) {
        return {
          success: true,
          messages: [],
          pagination: {
            currentPage: 1,
            totalPages: 0,
            totalMessages: 0,
            hasMore: false,
            limit: 20,
          },
        };
      }
      
      console.log(`📡 Fetching page ${pageParam} for task: ${taskId}`);
      const res = await axios.get(
        `${API_URL}/api/tasks/${taskId}/chat?page=${pageParam}&limit=20`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      console.log(`📥 Fetched ${res.data.messages.length} messages (Page ${pageParam})`);
      console.log(`📊 Response pagination:`, res.data.pagination);
      
      return res.data;
    },
    getNextPageParam: (lastPage) => {
      console.log(`🔍 getNextPageParam - current: ${lastPage.pagination.currentPage}, hasMore: ${lastPage.pagination.hasMore}`);
      if (lastPage.pagination.hasMore) {
        return lastPage.pagination.currentPage + 1;
      }
      return undefined;
    },
    enabled: !!taskId && !!token,
    refetchOnWindowFocus: false,
    initialPageParam: 1,
  });

  // ✅ Flatten all pages - pages come in ORDER (page 1 = newest, page 2 = older)
  const messages = React.useMemo(() => {
    console.log("\n\n🔄 ========================================");
    console.log("🔄 [MESSAGES MEMO] Processing pages...");
    
    if (!data?.pages) {
      console.log("⚠️ [MESSAGES MEMO] No data or pages");
      console.log("🔄 ========================================\n\n");
      return [];
    }
    
    console.log(`📦 [MESSAGES MEMO] Total pages loaded: ${data.pages.length}`);
    
    // Debug: Show what we received
    console.log("\n📄 [MESSAGES MEMO] Pages as received from API:");
    data.pages.forEach((page, idx) => {
      console.log(`   Page ${idx}: pageNumber=${page.pagination.currentPage}, messages=${page.messages.length}`);
      if (page.messages.length > 0) {
        console.log(`      First msg: "${page.messages[0]?.content?.substring(0, 30)}..." at ${page.messages[0]?.createdAt}`);
        console.log(`      Last msg: "${page.messages[page.messages.length - 1]?.content?.substring(0, 30)}..." at ${page.messages[page.messages.length - 1]?.createdAt}`);
      }
    });
    
    // Pages array: [page1_newest, page2_older, page3_evenOlder]
    // We need to REVERSE the pages order, then flatten
    console.log("\n🔄 [MESSAGES MEMO] Reversing pages order...");
    const reversedPages = [...data.pages].reverse();
    
    console.log("\n📄 [MESSAGES MEMO] Pages after reversing:");
    reversedPages.forEach((page, idx) => {
      console.log(`   Position ${idx}: pageNumber=${page.pagination.currentPage}, messages=${page.messages.length}`);
    });
    
    const allMessages = reversedPages.flatMap(page => page.messages);
    
    // ✅ Remove duplicates based on _id
    const uniqueMessages = allMessages.filter((msg, index, self) => 
      index === self.findIndex((m) => m._id === msg._id)
    );
    
    if (allMessages.length !== uniqueMessages.length) {
      console.log(`⚠️ [MESSAGES MEMO] Removed ${allMessages.length - uniqueMessages.length} duplicate messages`);
    }
    
    console.log(`\n📊 [MESSAGES MEMO] Total messages after flattening: ${uniqueMessages.length}`);
    if (uniqueMessages.length > 0) {
      console.log(`   🔹 FIRST message: "${uniqueMessages[0]?.content?.substring(0, 40)}..." at ${uniqueMessages[0]?.createdAt}`);
      console.log(`   🔹 LAST message: "${uniqueMessages[uniqueMessages.length - 1]?.content?.substring(0, 40)}..." at ${uniqueMessages[uniqueMessages.length - 1]?.createdAt}`);
    }
    console.log("🔄 ========================================\n\n");
    
    return uniqueMessages;
  }, [data]);

  // ✅ Track user scroll behavior
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || isInitialLoad) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isAtBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 50;
      
      // If user scrolls up from bottom, mark that they're browsing history
      if (!isAtBottom && hasScrolledToBottomRef.current) {
        if (!userHasScrolledUp) {
          console.log("👆 [SCROLL TRACKER] User scrolled up - enabling history loading");
          setUserHasScrolledUp(true);
        }
      }
      
      // If user scrolls back to bottom, disable history loading
      if (isAtBottom && userHasScrolledUp) {
        console.log("👇 [SCROLL TRACKER] User back at bottom - disabling history loading");
        setUserHasScrolledUp(false);
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [isInitialLoad, userHasScrolledUp]);

  // ✅ INTERSECTION OBSERVER: Load more ONLY when user has scrolled up
  useEffect(() => {
    // Only set up observer if user has intentionally scrolled up
    if (isInitialLoad || loadingMessages || !hasScrolledToBottomRef.current || !userHasScrolledUp) {
      console.log("⏸️ [OBSERVER] Skipping setup - user hasn't scrolled up yet");
      return;
    }
    
    if (!loadMoreTriggerRef.current || !hasNextPage || isFetchingNextPage) {
      console.log("⏸️ [OBSERVER] Skipping setup - conditions not met");
      return;
    }

    console.log("👁️ [OBSERVER] Setting up intersection observer (user is browsing history)...");
    
    const observer = new IntersectionObserver(
      (entries) => {
        // Only trigger if user is actively browsing history (scrolled up)
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage && userHasScrolledUp) {
          console.log("🔄 [OBSERVER] Trigger visible - Loading more messages...");
          
          const container = messagesContainerRef.current;
          const scrollHeightBefore = container?.scrollHeight || 0;
          const scrollTopBefore = container?.scrollTop || 0;

          fetchNextPage().then(() => {
            setTimeout(() => {
              if (container) {
                const scrollHeightAfter = container.scrollHeight;
                const heightDifference = scrollHeightAfter - scrollHeightBefore;
                container.scrollTop = scrollTopBefore + heightDifference;
                console.log(`✅ [OBSERVER] Restored scroll position after loading older messages`);
              }
            }, 100);
          });
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(loadMoreTriggerRef.current);
    console.log("✅ [OBSERVER] Observer attached to trigger");

    return () => {
      console.log("🔌 [OBSERVER] Disconnecting observer");
      observer.disconnect();
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, isInitialLoad, loadingMessages, userHasScrolledUp]);

  // ✅ REACT QUERY: Send message mutation
  const sendMessageMutation = useAddTaskMessage(taskId!, user!, token!);

  // Fetch task members
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

  // Fetch goals
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

  // Socket setup
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
      console.log(`   Content: ${msg.content?.substring(0, 50)}`);
      console.log(`   Timestamp: ${msg.createdAt}`);
      
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
        parentMessage: msg.parentMessage || null,
        status: 'sent',
      };
      
      console.log("🔄 [Socket] Updating cache with new message...");
      
      // ✅ Add to FIRST page (page 1 = newest messages)
      queryClient.setQueryData(['messages', taskId], (oldData: any) => {
        if (!oldData?.pages || !Array.isArray(oldData.pages) || oldData.pages.length === 0) {
          console.log("⚠️ [Socket] No pages in cache, skipping update");
          return oldData;
        }
        
        console.log(`📦 [Socket] Current pages in cache: ${oldData.pages.length}`);
        
        const currentUserId = getUserId(user);
        const msgSenderId = typeof msg.sender === 'string' 
          ? msg.sender 
          : (msg.sender._id || msg.sender.id);
        
        console.log(`👤 [Socket] Current user: ${currentUserId}, Message sender: ${msgSenderId}`);
        
        const newPages = [...oldData.pages];
        const firstPage = newPages[0]; // Page 1 = newest messages
        
        if (!firstPage || !firstPage.messages) {
          console.log("⚠️ [Socket] First page has no messages");
          return oldData;
        }
        
        console.log(`📄 [Socket] First page has ${firstPage.messages.length} messages`);
        
        // If from current user, replace temp message
        if (msgSenderId === currentUserId) {
          console.log("🔍 [Socket] Message is from current user, looking for temp message...");
          const firstPageMessages = [...firstPage.messages];
          const tempMsgIndex = firstPageMessages.findIndex((m: IMessage) => 
            m._id.startsWith('temp-')
          );
          
          if (tempMsgIndex !== -1) {
            console.log(`✅ [Socket] Found temp message at index ${tempMsgIndex}, replacing...`);
            firstPageMessages[tempMsgIndex] = formattedMessage;
            newPages[0] = {
              ...firstPage,
              messages: firstPageMessages,
            };
            return { ...oldData, pages: newPages };
          } else {
            console.log("⚠️ [Socket] No temp message found to replace");
          }
        }
        
        console.log("➕ [Socket] Adding new message to first page");
        // Add new message to first page (page 1 = newest)
        newPages[0] = {
          ...firstPage,
          messages: [...firstPage.messages, formattedMessage],
          pagination: {
            ...firstPage.pagination,
            totalMessages: (firstPage.pagination?.totalMessages || 0) + 1,
          },
        };
        
        console.log(`✅ [Socket] Updated first page, now has ${newPages[0].messages.length} messages`);
        
        return { ...oldData, pages: newPages };
      });
    };

    const onDisconnect = (reason: string) => {
      console.log("❌ Socket disconnected:", reason);
      setSocketConnected(false);
    };

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
  }, [token, taskId, API_URL, user, queryClient]);

  // Handle mention autocomplete
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

  const insertMention = (member: IUser) => {
    const beforeMention = newMessage.slice(0, mentionCursorPosition);
    const afterMention = newMessage.slice(mentionCursorPosition + mentionSearch.length + 1);
    
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    console.log(`\n⌨️ [KEY DOWN] Key pressed: "${e.key}"`);
    console.log(`   ShiftKey: ${e.shiftKey}`);
    console.log(`   CtrlKey: ${e.ctrlKey}`);
    console.log(`   AltKey: ${e.altKey}`);
    console.log(`   Mention dropdown open: ${showMentionDropdown}`);
    
    if (showMentionDropdown) {
      console.log(`📋 [KEY DOWN] Mention dropdown is open, handling mention navigation`);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMentionIndex(prev => 
          prev < filteredMentions.length - 1 ? prev + 1 : prev
        );
        console.log(`   Arrow Down - selected index updated`);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMentionIndex(prev => prev > 0 ? prev - 1 : prev);
        console.log(`   Arrow Up - selected index updated`);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        console.log(`   ⚠️ Enter pressed in mention dropdown - PREVENTING form submit`);
        if (filteredMentions[selectedMentionIndex]) {
          insertMention(filteredMentions[selectedMentionIndex]);
          console.log(`   ✅ Inserted mention: ${filteredMentions[selectedMentionIndex].name}`);
        }
      } else if (e.key === 'Escape') {
        setShowMentionDropdown(false);
        console.log(`   Escape pressed - closed mention dropdown`);
      }
    } else {
      if (e.key === 'Enter' && !e.shiftKey) {
        console.log(`\n🎯 [KEY DOWN] Enter pressed WITHOUT shift - SHOULD SUBMIT FORM`);
        console.log(`   Current message: "${newMessage}"`);
        console.log(`   Message length: ${newMessage.length}`);
        console.log(`   Trimmed length: ${newMessage.trim().length}`);
        // Don't prevent default - let form submit naturally
      } else if (e.key === 'Enter' && e.shiftKey) {
        console.log(`\n↵ [KEY DOWN] Enter pressed WITH shift - new line (not submitting)`);
      }
    }
  };

  const renderMessageContent = (content: string) => {
    const mentionRegex = /@"([^"]+)"|@(\w+)/g;
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

      const mentionedName = match[1] || match[2];
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

  const handleReply = (message: IMessage) => {
    setReplyingTo(message);
    inputRef.current?.focus();
  };

  const cancelReply = () => {
    setReplyingTo(null);
  };

  const scrollToMessage = (messageId: string) => {
    const messageElement = messageRefs.current[messageId];
    if (messageElement) {
      messageElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
      
      messageElement.classList.add('message-highlight');
      setTimeout(() => {
        messageElement.classList.remove('message-highlight');
      }, 2000);
    }
  };

  const retryMessage = (failedMsg: IMessage) => {
    console.log("🔄 Retrying message:", failedMsg._id);
    
    sendMessageMutation.mutate({
      content: failedMsg.content,
      parentMessageId: failedMsg.parentMessage?._id || null,
    });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log("\n📤 ========================================");
    console.log("📤 [SEND MESSAGE] Form submitted");
    console.log(`   Event type: ${e.type}`);
    console.log(`   Message value: "${newMessage}"`);
    console.log(`   Message trimmed: "${newMessage.trim()}"`);
    console.log(`   Message length: ${newMessage.length}`);
    console.log(`   Trimmed length: ${newMessage.trim().length}`);
    console.log("📤 ========================================\n");
    
    // Validation checks
    if (!newMessage.trim()) {
      console.warn("⚠️ [SEND MESSAGE] Message is empty after trim - BLOCKING SEND");
      return;
    }
    
    if (!taskId) {
      console.error("❌ [SEND MESSAGE] No taskId - BLOCKING SEND");
      return;
    }
    
    if (!token) {
      console.error("❌ [SEND MESSAGE] No token - BLOCKING SEND");
      return;
    }
    
    if (!user) {
      console.error("❌ [SEND MESSAGE] No user - BLOCKING SEND");
      return;
    }
    
    console.log("\n✅ ========================================");
    console.log("✅ [SEND MESSAGE] All validations passed!");
    console.log(`   TaskId: ${taskId}`);
    console.log(`   Token present: ${!!token}`);
   
    console.log(`   Socket connected: ${socketConnected}`);
    console.log(`   Mutation pending: ${sendMessageMutation.isPending}`);
    console.log("✅ ========================================\n");

    const content = newMessage.trim();
    const parentMessageId = replyingTo?._id || null;
    
    console.log("\n📝 ========================================");
    console.log("📝 [SEND MESSAGE] Message details:");
    console.log(`   Content: "${content}"`);
    console.log(`   Content length: ${content.length}`);
    console.log(`   Replying to: ${replyingTo ? replyingTo._id : 'none'}`);
    console.log(`   Parent message: ${parentMessageId || 'none'}`);
    console.log("📝 ========================================\n");

    // Clear input and reply state
    setNewMessage("");
    setReplyingTo(null);
    console.log("🧹 [SEND MESSAGE] Cleared input and reply state");

    // Trigger mutation
    console.log("\n🚀 ========================================");
    console.log("🚀 [SEND MESSAGE] Calling mutation...");
    console.log("🚀 ========================================\n");
    
    try {
      sendMessageMutation.mutate({
        content,
        parentMessageId,
      });
      console.log("✅ [SEND MESSAGE] Mutation called successfully");
    } catch (error) {
      console.error("\n❌ ========================================");
      console.error("❌ [SEND MESSAGE] Error calling mutation:", error);
      console.error("❌ ========================================\n");
    }
  };

  // ✅ Auto-scroll to bottom on initial load and new messages
  useEffect(() => {
    console.log(`\n📜 ========================================`);
    console.log(`📜 [SCROLL EFFECT] Triggered`);
    console.log(`   isFetchingNextPage: ${isFetchingNextPage}`);
    console.log(`   messages.length: ${messages.length}`);
    console.log(`   isInitialLoad: ${isInitialLoad}`);
    console.log(`   loadingMessages: ${loadingMessages}`);
    console.log(`   messagesEndRef.current exists: ${!!messagesEndRef.current}`);
    console.log(`   messagesContainerRef.current exists: ${!!messagesContainerRef.current}`);

    if (messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      console.log(`   📏 Container scroll info:`);
      console.log(`      scrollTop: ${container.scrollTop}`);
      console.log(`      scrollHeight: ${container.scrollHeight}`);
      console.log(`      clientHeight: ${container.clientHeight}`);
    }

    // Skip if loading next page
    if (isFetchingNextPage) {
      console.log(`   ⏸️ Fetching next page, skipping scroll`);
      console.log(`📜 ========================================\n`);
      return;
    }

    // Wait for initial data to load
    if (loadingMessages || messages.length === 0) {
      console.log(`   ⏸️ Still loading messages or no messages, skipping scroll`);
      console.log(`📜 ========================================\n`);
      return;
    }

    const container = messagesContainerRef.current;
    if (!container) {
      console.log(`   ❌ Container ref is null`);
      console.log(`📜 ========================================\n`);
      return;
    }

    if (isInitialLoad) {
      console.log(`   🎯 INITIAL LOAD - Will scroll to bottom (forced)`);
      console.log(`   ⏰ Setting timeout for DOM to fully render...`);
      
      // Use multiple timeouts to ensure scroll completes
      const timeoutId1 = setTimeout(() => {
        if (container) {
          console.log(`   ✅ First scroll attempt...`);
          container.scrollTop = container.scrollHeight;
        }
      }, 50);
      
      const timeoutId2 = setTimeout(() => {
        if (container) {
          console.log(`   ✅ Second scroll attempt (ensuring bottom)...`);
          container.scrollTop = container.scrollHeight;
          
          console.log(`   🎯 Final scroll position: ${container.scrollTop}`);
          console.log(`   ✅ Marking initial load as complete AND scroll to bottom complete`);
          setIsInitialLoad(false);
          hasScrolledToBottomRef.current = true;
          
          console.log(`   📊 After scroll - Container position:`);
          console.log(`      scrollTop: ${container.scrollTop}`);
          console.log(`      scrollHeight: ${container.scrollHeight}`);
          console.log(`      clientHeight: ${container.clientHeight}`);
          console.log(`      Is at bottom: ${Math.abs(container.scrollHeight - container.scrollTop - container.clientHeight) < 5}`);
        }
      }, 200);

      console.log(`📜 ========================================\n`);
      return () => {
        clearTimeout(timeoutId1);
        clearTimeout(timeoutId2);
      };
    } else {
      console.log(`   📩 NEW MESSAGE - Scrolling to bottom (forced)`);
      // Force scroll to bottom for new messages too
      container.scrollTop = container.scrollHeight;
      console.log(`   ✅ Forced scroll to bottom`);
      console.log(`📜 ========================================\n`);
    }
  }, [messages.length, isFetchingNextPage, isInitialLoad, loadingMessages]);

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

      <div className="messages-container" ref={messagesContainerRef}>
        {hasNextPage && (
          <div ref={loadMoreTriggerRef} className="load-more-trigger">
            {isFetchingNextPage ? (
              <div className="loading-more">Loading older messages...</div>
            ) : (
              <div className="load-more-hint">↑ Scroll up to load more</div>
            )}
          </div>
        )}

        {loadingMessages ? (
          <div className="loading">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="no-messages">
            No messages yet. Type @ to mention someone!
          </div>
        ) : (
          messages.map((msg) => {
            const senderUserId = getUserId(msg.sender);
            const currentUserId = getUserId(user);
            const isOwn = senderUserId === currentUserId;
            
            return (
              <div 
                key={msg._id} 
                className={`message ${isOwn ? "own" : "other"} ${msg.status === 'failed' ? 'failed' : ''}`}
                ref={(el) => messageRefs.current[msg._id] = el}
              >
                {msg.parentMessage && (
                  <div 
                    className="quoted-message"
                    onClick={() => scrollToMessage(msg.parentMessage!._id)}
                    title="Click to jump to original message"
                  >
                    <div className="quoted-message-bar"></div>
                    <div className="quoted-message-content">
                      <div className="quoted-message-author">
                        {msg.parentMessage.sender?.name}
                      </div>
                      <div className="quoted-message-text">
                        {msg.parentMessage.content}
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="message-header">
                  <span className="sender-name">{msg.sender?.name}</span>
                  <button 
                    className="reply-btn"
                    onClick={() => handleReply(msg)}
                    title="Reply to this message"
                  >
                    ↩️
                  </button>
                </div>
                
                <div className="message-content">
                  {renderMessageContent(msg.content)}
                </div>
                
                <div className="message-time">
                  {new Date(msg.createdAt).toLocaleTimeString()}
                  
                  {msg.status === 'sending' && (
                    <span className="message-status sending" title="Sending...">
                      ⏳
                    </span>
                  )}
                  {msg.status === 'failed' && (
                    <button 
                      className="retry-btn"
                      onClick={() => retryMessage(msg)}
                      title="Failed to send. Click to retry."
                    >
                      ⚠️ Retry
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="message-form" onSubmit={handleSendMessage}>
        {replyingTo && (
          <div className="replying-banner">
            <div className="replying-info">
              <span className="replying-label">Replying to {replyingTo.sender?.name}</span>
              <span className="replying-preview">{replyingTo.content}</span>
            </div>
            <button 
              type="button" 
              className="cancel-reply-btn"
              onClick={cancelReply}
            >
              ✖
            </button>
          </div>
        )}
        
        <div className="message-input-wrapper">
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a message... (use @ to mention)"
            value={newMessage}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={!socketConnected || sendMessageMutation.isPending}
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
        
        <button 
          type="submit" 
          disabled={!socketConnected || sendMessageMutation.isPending}
        >
          {sendMessageMutation.isPending ? "Sending..." : socketConnected ? "Send" : "Connecting..."}
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