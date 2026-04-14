"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SummaryStats } from "@/components/summary-stats";
import { ScheduleCard } from "@/components/schedule-card";
import { CreateScheduleDialog } from "@/components/create-schedule-dialog";
import { DeleteScheduleDialog } from "@/components/delete-schedule-dialog";
import { useSchedules, useCreateSchedule, useDeleteSchedule } from "@/hooks/use-schedules";
import { getDefaultDates } from "@/lib/date-utils";
import type { Schedule } from "@/lib/types";
import { CalendarDays, Plus, CalendarPlus } from "lucide-react";
import { toast } from "sonner";

export default function Home() {
  const router = useRouter();
  const { data: schedules = [], isLoading: loading, error } = useSchedules();
  const createMutation = useCreateSchedule();
  const deleteMutation = useDeleteSchedule();

  const [createOpen, setCreateOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Schedule | null>(null);

  const handleCreate = async (name: string, startDate: string, endDate: string) => {
    if (!name || !startDate || !endDate) return;
    if (endDate < startDate) {
      toast.error("End date must be on or after start date");
      return;
    }
    try {
      const s = await createMutation.mutateAsync({ name, startDate, endDate });
      setCreateOpen(false);
      toast.success("Schedule created successfully");
      router.push(`/schedule/${s.id}`);
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : null;
      toast.error(msg || "Failed to create schedule. Please try again.");
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteMutation.mutateAsync(deleteConfirm.id);
      setDeleteConfirm(null);
      toast.success("Schedule deleted");
    } catch {
      toast.error("Failed to delete schedule. Please try again.");
    }
  };

  const defaults = getDefaultDates();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <CalendarDays className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-semibold text-base">Restaurant Scheduler</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">Workforce Management</p>
            </div>
          </div>
          <Button onClick={() => setCreateOpen(true)} size="sm" className="gap-1.5 cursor-pointer">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Schedule</span>
            <span className="sm:hidden">New</span>
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-center justify-between gap-2">
            <span>Failed to load schedules. Is the API server running?</span>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center h-60 text-muted-foreground" role="status" aria-live="polite">
            <div className="w-10 h-10 border-3 border-primary/30 border-t-primary rounded-full animate-spin mb-3" aria-hidden="true" />
            <p className="text-sm">Loading schedules...</p>
          </div>
        ) : schedules.length === 0 && !error ? (
          <div className="text-center py-16 sm:py-20">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <CalendarPlus className="w-8 h-8 text-primary/60" />
            </div>
            <p className="text-lg font-semibold">No schedules yet</p>
            <p className="text-sm text-muted-foreground mt-1 mb-6 max-w-xs mx-auto">
              Create your first weekly schedule to start managing your restaurant staff
            </p>
            <Button onClick={() => setCreateOpen(true)} className="gap-2 cursor-pointer">
              <Plus className="w-4 h-4" />
              Create Schedule
            </Button>
          </div>
        ) : (
          <>
            <SummaryStats schedules={schedules} />
            <div className="grid gap-3">
              {schedules.map((s) => (
                <ScheduleCard
                  key={s.id}
                  schedule={s}
                  onNavigate={(id) => router.push(`/schedule/${id}`)}
                  onDelete={setDeleteConfirm}
                />
              ))}
            </div>
          </>
        )}
      </main>

      <CreateScheduleDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultStartDate={defaults.start}
        defaultEndDate={defaults.end}
        isPending={createMutation.isPending}
        onCreate={handleCreate}
      />

      <DeleteScheduleDialog
        scheduleName={deleteConfirm?.name ?? null}
        isPending={deleteMutation.isPending}
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}
