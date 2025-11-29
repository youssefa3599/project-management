import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios, { AxiosResponse } from 'axios';

interface Task {
  id: string;
  title: string;
  completed: boolean;
}

// TData = AxiosResponse, TError = Error, TVariables = Task, TContext = { previousTasks?: Task[] }
export default function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation<AxiosResponse, Error, Task, { previousTasks?: Task[] }>({
    mutationFn: (updatedTask: Task) => axios.put(`/api/tasks/${updatedTask.id}`, updatedTask),
    onMutate: async (updatedTask: Task) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] });

      const previousTasks = queryClient.getQueryData<Task[]>(['tasks']);

      queryClient.setQueryData<Task[]>(['tasks'], (old) =>
        old?.map((task) =>
          task.id === updatedTask.id ? { ...task, ...updatedTask } : task
        )
      );

      return { previousTasks };
    },
    onError: (err, variables, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData<Task[]>(['tasks'], context.previousTasks);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}
