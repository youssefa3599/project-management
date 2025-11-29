import { useMutation, useQueryClient, UseMutationResult } from '@tanstack/react-query';
import axios from 'axios';

export interface Comment {
  _id: string;
  content: string;
  author: { _id: string; name: string };
  createdAt: string;
}

export interface Task {
  _id: string;
  title: string;
  description: string;
  status: string;
  comments: Comment[];
}

interface AddCommentVariables {
  content: string;
}

interface AddCommentContext {
  previousTask?: Task;
}

export default function useAddComment(
  taskId: string
): UseMutationResult<Comment, Error, AddCommentVariables, AddCommentContext> {
  const queryClient = useQueryClient();

  return useMutation<Comment, Error, AddCommentVariables, AddCommentContext>({
    mutationFn: ({ content }) =>
      axios.post(`/api/tasks/${taskId}/comments`, { content }).then(res => res.data.comment),

    onMutate: async ({ content }) => {
      await queryClient.cancelQueries({ queryKey: ['task', taskId] });
      const previousTask = queryClient.getQueryData<Task>(['task', taskId]);

      if (previousTask) {
        const optimisticComment: Comment = {
          _id: 'temp-' + Date.now(),
          content,
          author: { _id: 'me', name: 'You' },
          createdAt: new Date().toISOString(),
        };

        queryClient.setQueryData<Task>(['task', taskId], {
          ...previousTask,
          comments: [...previousTask.comments, optimisticComment],
        });
      }

      return { previousTask };
    },

    onError: (err, variables, context) => {
      if (context?.previousTask) {
        queryClient.setQueryData(['task', taskId], context.previousTask);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
    },
  });
}
