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

interface AddMessageVariables {
  content: string;
  parentMessageId?: string | null;
}

interface AddMessageContext {
  previousData?: any;
}

export default function useAddTaskMessage(
  taskId: string,
  currentUser: IUser,
  token: string
): UseMutationResult<IMessage, Error, AddMessageVariables, AddMessageContext> {
  const queryClient = useQueryClient();
  const API_URL = import.meta.env.VITE_API_URL;

  return useMutation<IMessage, Error, AddMessageVariables, AddMessageContext>({
    mutationFn: async ({ content, parentMessageId }) => {
      const response = await axios.post(
        `${API_URL}/api/tasks/${taskId}/chat`,
        { content, parentMessageId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data;
    },

    // ✅ OPTIMISTIC UPDATE for paginated data
    onMutate: async ({ content, parentMessageId }) => {
      console.log("🚀 [Mutation] onMutate - Adding optimistic message");
      
      await queryClient.cancelQueries({ queryKey: ['messages', taskId] });

      const previousData = queryClient.getQueryData(['messages', taskId]);
      
      console.log(`📦 [Mutation] Current pages: ${(previousData as any)?.pages?.length || 0}`);

      // Find parent message if replying
      let parentMessage: IMessage | null = null;
      if (parentMessageId && previousData) {
        const allMessages = (previousData as any).pages?.flatMap((page: PaginatedResponse) => page.messages) || [];
        parentMessage = allMessages.find((m: IMessage) => m._id === parentMessageId) || null;
      }

      // Create optimistic message with unique ID
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
      
      console.log(`➕ [Mutation] Created temp message: ${optimisticMessage._id}`);

      // ✅ Update paginated cache - add to FIRST page (page 1 = newest)
      if (previousData) {
        queryClient.setQueryData(['messages', taskId], (oldData: any) => {
          if (!oldData?.pages || !Array.isArray(oldData.pages) || oldData.pages.length === 0) {
            console.log("📄 [Mutation] No pages exist, creating first page");
            return {
              pages: [{
                success: true,
                messages: [optimisticMessage],
                pagination: {
                  currentPage: 1,
                  totalPages: 1,
                  totalMessages: 1,
                  hasMore: false,
                  limit: 20,
                },
              }],
              pageParams: [1],
            };
          }

          const newPages = [...oldData.pages];
          const firstPage = { ...newPages[0] }; // Page 1 = newest messages
          
          console.log(`📄 [Mutation] Adding to first page (currently has ${firstPage.messages?.length || 0} messages)`);
          
          // Add to first page
          firstPage.messages = [...(firstPage.messages || []), optimisticMessage];
          firstPage.pagination = {
            ...firstPage.pagination,
            totalMessages: (firstPage.pagination?.totalMessages || 0) + 1,
          };
          
          newPages[0] = firstPage;
          
          console.log(`✅ [Mutation] First page now has ${newPages[0].messages.length} messages`);

          return {
            ...oldData,
            pages: newPages,
          };
        });
      }

      return { previousData };
    },

    // ✅ ROLLBACK on error
    onError: (err, variables, context) => {
      console.error('❌ Failed to send message:', err);
      
      if (context?.previousData) {
        queryClient.setQueryData(['messages', taskId], context.previousData);
      }
    },

    // ✅ SUCCESS - replace temp message with real one
    onSuccess: (newMessage, variables, context) => {
      console.log('✅ [Mutation] onSuccess - Message sent successfully');
      console.log(`   Real message ID: ${newMessage._id}`);
      console.log('   ℹ️ Socket has already replaced temp message, no action needed');
      
      // DO NOT INVALIDATE - the socket handler already updated the cache
      // Invalidating would cause a refetch that might not include the new message yet
    },

    // ✅ CLEANUP
    onSettled: () => {
      // Already invalidated in onSuccess
    },
  });
}