// hooks/useAddTaskMessage.ts
import { useMutation, useQueryClient, UseMutationResult } from '@tanstack/react-query';
import axios from 'axios';

export interface IUser {
  id?: string;
  _id?: string;
  name: string;
  email?: string;
  role?: "admin" | "editor" | "viewer";
}

export interface IMessage {
  _id: string;
  sender: IUser;
  content: string;
  createdAt: string;
  parentMessage?: IMessage | null;
  status?: 'sending' | 'sent' | 'failed';
}

interface AddMessageVariables {
  content: string;
  parentMessageId?: string | null;
}

interface AddMessageContext {
  previousMessages?: IMessage[];
}

export default function useAddTaskMessage(
  taskId: string,
  currentUser: IUser,
  token: string
): UseMutationResult<IMessage, Error, AddMessageVariables, AddMessageContext> {
  const queryClient = useQueryClient();
  const API_URL = import.meta.env.VITE_API_URL;

  return useMutation<IMessage, Error, AddMessageVariables, AddMessageContext>({
    // 1. The actual API call
    mutationFn: async ({ content, parentMessageId }) => {
      const response = await axios.post(
        `${API_URL}/api/tasks/${taskId}/chat`,
        { content, parentMessageId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data;
    },

    // 2. OPTIMISTIC UPDATE - runs immediately before API call
    onMutate: async ({ content, parentMessageId }) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey: ['messages', taskId] });

      // Snapshot the previous value
      const previousMessages = queryClient.getQueryData<IMessage[]>(['messages', taskId]);

      // Find parent message if replying
      let parentMessage: IMessage | null = null;
      if (parentMessageId && previousMessages) {
        parentMessage = previousMessages.find(m => m._id === parentMessageId) || null;
      }

      // Create optimistic message
      const optimisticMessage: IMessage = {
        _id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        content,
        sender: {
          _id: currentUser._id || currentUser.id || '',
          id: currentUser.id || currentUser._id || '',
          name: currentUser.name,
          email: currentUser.email,
        },
        createdAt: new Date().toISOString(),
        parentMessage,
        status: 'sending',
      };

      // Optimistically update the cache
      if (previousMessages) {
        queryClient.setQueryData<IMessage[]>(
          ['messages', taskId],
          [...previousMessages, optimisticMessage]
        );
      }

      // Return context with previous state for rollback
      return { previousMessages };
    },

    // 3. ROLLBACK - if mutation fails
    onError: (err, variables, context) => {
      console.error('❌ Failed to send message:', err);
      
      // Rollback to previous state
      if (context?.previousMessages) {
        queryClient.setQueryData(['messages', taskId], context.previousMessages);
      }
    },

    // 4. SUCCESS - replace temp message with real one
    onSuccess: (newMessage, variables, context) => {
      console.log('✅ Message sent successfully');
      
      // Replace temp message with real message from server
      const previousMessages = queryClient.getQueryData<IMessage[]>(['messages', taskId]);
      
      if (previousMessages) {
        const updatedMessages = previousMessages.map(msg =>
          msg._id.startsWith('temp-') && msg.content === newMessage.content
            ? { ...newMessage, status: 'sent' as const }
            : msg
        );
        
        queryClient.setQueryData(['messages', taskId], updatedMessages);
      }
    },

    // 5. CLEANUP - always runs after success or error
    onSettled: () => {
      // Refetch to ensure we're in sync with server
      queryClient.invalidateQueries({ queryKey: ['messages', taskId] });
    },
  });
}