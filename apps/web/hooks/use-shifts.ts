import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getShifts,
  generateShifts,
  replaceShift,
  assignEmployee,
  getEligibleEmployees,
} from "@/services/shiftService";
import { scheduleKeys } from "./use-schedules";

export const shiftKeys = {
  list: (scheduleId: number) => ["shifts", scheduleId] as const,
  eligible: (shiftId: number) => ["shifts", "eligible", shiftId] as const,
};

export function useShifts(scheduleId: number) {
  return useQuery({
    queryKey: shiftKeys.list(scheduleId),
    queryFn: () => getShifts(scheduleId),
    enabled: !isNaN(scheduleId),
  });
}

export function useEligibleEmployees(shiftId: number | null) {
  return useQuery({
    queryKey: shiftKeys.eligible(shiftId!),
    queryFn: () => getEligibleEmployees(shiftId!),
    enabled: shiftId !== null,
  });
}

export function useGenerateShifts(scheduleId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => generateShifts(scheduleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shiftKeys.list(scheduleId) });
      queryClient.invalidateQueries({ queryKey: scheduleKeys.detail(scheduleId) });
    },
  });
}

export function useReplaceShift(scheduleId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (shiftId: number) => replaceShift(shiftId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shiftKeys.list(scheduleId) });
      queryClient.invalidateQueries({ queryKey: scheduleKeys.detail(scheduleId) });
    },
  });
}

export function useAssignEmployee(scheduleId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ shiftId, employeeId }: { shiftId: number; employeeId: number | null }) =>
      assignEmployee(shiftId, employeeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shiftKeys.list(scheduleId) });
      queryClient.invalidateQueries({ queryKey: scheduleKeys.detail(scheduleId) });
    },
  });
}
