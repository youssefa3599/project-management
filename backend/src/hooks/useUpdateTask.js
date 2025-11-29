"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = useUpdateTask;
const react_query_1 = require("@tanstack/react-query");
const axios_1 = __importDefault(require("axios"));
// TData = AxiosResponse, TError = Error, TVariables = Task, TContext = { previousTasks?: Task[] }
function useUpdateTask() {
    const queryClient = (0, react_query_1.useQueryClient)();
    return (0, react_query_1.useMutation)({
        mutationFn: (updatedTask) => axios_1.default.put(`/api/tasks/${updatedTask.id}`, updatedTask),
        onMutate: async (updatedTask) => {
            await queryClient.cancelQueries({ queryKey: ['tasks'] });
            const previousTasks = queryClient.getQueryData(['tasks']);
            queryClient.setQueryData(['tasks'], (old) => old?.map((task) => task.id === updatedTask.id ? { ...task, ...updatedTask } : task));
            return { previousTasks };
        },
        onError: (err, variables, context) => {
            if (context?.previousTasks) {
                queryClient.setQueryData(['tasks'], context.previousTasks);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
        },
    });
}
