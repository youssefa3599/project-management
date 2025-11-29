"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = useAddComment;
const react_query_1 = require("@tanstack/react-query");
const axios_1 = __importDefault(require("axios"));
function useAddComment(taskId) {
    const queryClient = (0, react_query_1.useQueryClient)();
    return (0, react_query_1.useMutation)({
        mutationFn: ({ content }) => axios_1.default.post(`/api/tasks/${taskId}/comments`, { content }).then(res => res.data.comment),
        onMutate: async ({ content }) => {
            await queryClient.cancelQueries({ queryKey: ['task', taskId] });
            const previousTask = queryClient.getQueryData(['task', taskId]);
            if (previousTask) {
                const optimisticComment = {
                    _id: 'temp-' + Date.now(),
                    content,
                    author: { _id: 'me', name: 'You' },
                    createdAt: new Date().toISOString(),
                };
                queryClient.setQueryData(['task', taskId], {
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
