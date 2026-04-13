"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getEligibleEmployees, assignEmployee, replaceShift } from "@/services/shiftService";
import type { Shift, Employee } from "@/lib/types";

const PERIOD_LABELS = { morning: "Morning", afternoon: "Afternoon", evening: "Evening" };
const ROLE_LABELS = { manager: "Manager", cook: "Cook", waiter: "Waiter", dishwasher: "Dishwasher" };
const ROLE_DOT = { manager: "bg-violet-500", cook: "bg-amber-500", waiter: "bg-sky-500", dishwasher: "bg-emerald-500" };

interface ShiftDialogProps {
  shift: Shift | null;
  onClose: () => void;
  onChanged: () => void;
}

export function ShiftDialog({ shift, onClose, onChanged }: ShiftDialogProps) {
  const [eligible, setEligible] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shift) return;
    setLoading(true);
    setError(null);
    getEligibleEmployees(shift.id)
      .then(setEligible)
      .catch(() => {
        setEligible([]);
        setError("Failed to load eligible employees");
      })
      .finally(() => setLoading(false));
  }, [shift]);

  const handleAssign = async (employeeId: number) => {
    if (!shift) return;
    setActionLoading(true);
    setError(null);
    try {
      await assignEmployee(shift.id, employeeId);
      onChanged();
      onClose();
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : null;
      setError(msg || "Failed to assign employee. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAutoReplace = async () => {
    if (!shift) return;
    setActionLoading(true);
    setError(null);
    try {
      await replaceShift(shift.id);
      onChanged();
      onClose();
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : null;
      setError(msg || "Failed to find a replacement. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnassign = async () => {
    if (!shift) return;
    setActionLoading(true);
    setError(null);
    try {
      await assignEmployee(shift.id, null);
      onChanged();
      onClose();
    } catch {
      setError("Failed to unassign employee. Please try again.");
    } finally {
      setActionLoading(false);
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

        {/* Error feedback */}
        {error && (
          <div className="p-2.5 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

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
                    aria-label={`Auto-replace ${shift.assignedEmployee.name} with another available ${ROLE_LABELS[shift.role].toLowerCase()}`}
                  >
                    Auto-replace
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleUnassign}
                    disabled={actionLoading}
                    className="text-destructive hover:text-destructive"
                  >
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
                  <Badge variant="outline" className="text-xs">
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
