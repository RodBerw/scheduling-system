"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useEligibleEmployees, useAssignEmployee, useReplaceShift } from "@/hooks/use-shifts";
import type { Shift } from "@/lib/types";
import { RefreshCw, UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";

const PERIOD_LABELS = { morning: "Morning", afternoon: "Afternoon", evening: "Evening" };
const ROLE_LABELS = { manager: "Manager", cook: "Cook", waiter: "Waiter", dishwasher: "Dishwasher" };
const ROLE_DOT = { manager: "bg-violet-500", cook: "bg-amber-500", waiter: "bg-sky-500", dishwasher: "bg-emerald-500" };

interface ShiftDialogProps {
  shift: Shift | null;
  scheduleId: number;
  onClose: () => void;
  onChanged: () => void;
}

export function ShiftDialog({ shift, scheduleId, onClose, onChanged }: ShiftDialogProps) {
  const { data: eligible = [], isLoading: loading } = useEligibleEmployees(shift?.id ?? null);
  const assignMutation = useAssignEmployee(scheduleId);
  const replaceMutation = useReplaceShift(scheduleId);

  const actionLoading = assignMutation.isPending || replaceMutation.isPending;

  const handleAssign = async (employeeId: number) => {
    if (!shift) return;
    try {
      await assignMutation.mutateAsync({ shiftId: shift.id, employeeId });
      toast.success("Employee assigned successfully");
      onChanged();
      onClose();
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : null;
      toast.error(msg || "Failed to assign employee. Please try again.");
    }
  };

  const handleAutoReplace = async () => {
    if (!shift) return;
    try {
      await replaceMutation.mutateAsync(shift.id);
      toast.success("Employee replaced successfully");
      onChanged();
      onClose();
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : null;
      toast.error(msg || "Failed to find a replacement. Please try again.");
    }
  };

  const handleUnassign = async () => {
    if (!shift) return;
    try {
      await assignMutation.mutateAsync({ shiftId: shift.id, employeeId: null });
      toast.success("Employee removed from shift");
      onChanged();
      onClose();
    } catch {
      toast.error("Failed to unassign employee. Please try again.");
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00Z");
    return d.toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  };

  if (!shift) return null;

  const others = eligible.filter((e) => e.id !== shift.assignedEmployeeId);

  return (
    <Dialog open={!!shift} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${ROLE_DOT[shift.role]}`} aria-hidden="true" />
            {ROLE_LABELS[shift.role]} Shift
          </DialogTitle>
          <DialogDescription>
            {formatDate(shift.date)} &middot; {PERIOD_LABELS[shift.period]}
          </DialogDescription>
        </DialogHeader>

        {/* Current assignment */}
        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Currently assigned</p>
            {shift.assignedEmployee ? (
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                <div>
                  <p className="font-medium text-sm">{shift.assignedEmployee.name}</p>
                  <p className="text-xs text-muted-foreground">{shift.assignedEmployee.maxHoursPerWeek}h/week max</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAutoReplace}
                    disabled={actionLoading}
                    className="gap-1.5 cursor-pointer"
                    aria-label={`Auto-replace ${shift.assignedEmployee.name} with another available ${ROLE_LABELS[shift.role].toLowerCase()}`}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Replace
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleUnassign}
                    disabled={actionLoading}
                    className="text-destructive hover:text-destructive gap-1.5 cursor-pointer"
                  >
                    <UserMinus className="w-3.5 h-3.5" />
                    Remove
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-lg border border-dashed text-sm text-muted-foreground">
                No one assigned
              </div>
            )}
          </div>

          {shift.explanation && (
            <p className="text-xs text-muted-foreground italic">{shift.explanation}</p>
          )}

          {/* Available employees */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Available {ROLE_LABELS[shift.role].toLowerCase()}s
              {loading && " (loading...)"}
            </p>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {others.length === 0 && !loading && (
                <p className="text-xs text-muted-foreground py-2">No other eligible employees available</p>
              )}
              {others.map((emp) => (
                <button
                  key={emp.id}
                  onClick={() => handleAssign(emp.id)}
                  disabled={actionLoading}
                  className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-muted transition-colors text-left"
                  aria-label={`Assign ${emp.name} to this shift`}
                >
                  <div>
                    <p className="text-sm font-medium">{emp.name}</p>
                    <p className="text-xs text-muted-foreground">{emp.maxHoursPerWeek}h/week max</p>
                  </div>
                  <Badge variant="outline" className="text-xs flex items-center gap-1">
                    <UserPlus className="w-3 h-3" />
                    Assign
                  </Badge>
                </button>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
