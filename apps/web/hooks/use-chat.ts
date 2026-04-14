import { useMutation, useQueryClient } from "@tanstack/react-query";
import { sendChatMessage } from "@/services/chatService";
import { shiftKeys } from "./use-shifts";
import { scheduleKeys } from "./use-schedules";

export function useSendChatMessage(scheduleId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ message, history }: { message: string; history: { role: string; content: string }[] }) =>
      sendChatMessage(message, history, scheduleId),
    onSuccess: (data) => {
      if (data.actions?.length > 0) {
        queryClient.invalidateQueries({ queryKey: shiftKeys.list(scheduleId) });
        queryClient.invalidateQueries({ queryKey: scheduleKeys.detail(scheduleId) });
        queryClient.invalidateQueries({ queryKey: scheduleKeys.requirements(scheduleId) });
      }
    },
  });
}
