import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getSchedules,
  getSchedule,
  createSchedule,
  deleteSchedule,
  getRequirements,
  setRequirements,
} from "@/services/scheduleService";
import type { ScheduleRequirement } from "@/lib/types";

export const scheduleKeys = {
  all: ["schedules"] as const,
  detail: (id: number) => ["schedules", id] as const,
  requirements: (id: number) => ["schedules", id, "requirements"] as const,
};

export function useSchedules() {
  return useQuery({
    queryKey: scheduleKeys.all,
    queryFn: getSchedules,
  });
}

export function useSchedule(id: number) {
  return useQuery({
    queryKey: scheduleKeys.detail(id),
    queryFn: () => getSchedule(id),
    enabled: !isNaN(id),
  });
}

export function useRequirements(scheduleId: number) {
  return useQuery({
    queryKey: scheduleKeys.requirements(scheduleId),
    queryFn: () => getRequirements(scheduleId),
    enabled: !isNaN(scheduleId),
  });
}

export function useCreateSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, startDate, endDate }: { name: string; startDate: string; endDate: string }) =>
      createSchedule(name, startDate, endDate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.all });
    },
  });
}

export function useDeleteSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteSchedule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.all });
    },
  });
}

export function useSetRequirements(scheduleId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (requirements: Omit<ScheduleRequirement, "id" | "scheduleId">[]) =>
      setRequirements(scheduleId, requirements),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.requirements(scheduleId) });
    },
  });
}
