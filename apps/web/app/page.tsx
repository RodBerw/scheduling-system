"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { getSchedules, createSchedule, deleteSchedule } from "@/services/scheduleService";
import type { Schedule } from "@/lib/types";

function getDefaultDates() {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: monday.toISOString().split("T")[0],
    end: sunday.toISOString().split("T")[0],
  };
}

export default function Home() {
  const router = useRouter();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Schedule | null>(null);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchSchedules = async () => {
    setLoading(true);
    setError(null);
    try {
      setSchedules(await getSchedules());
    } catch {
      setError("Failed to load schedules. Is the API server running?");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, []);

  const handleCreate = async () => {
    if (!name || !startDate || !endDate) return;
    if (endDate < startDate) {
      setCreateError("End date must be on or after start date");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const s = await createSchedule(name, startDate, endDate);
      setCreateOpen(false);
      setName("");
      router.push(`/schedule/${s.id}`);
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : null;
      setCreateError(msg || "Failed to create schedule. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number) => {
    setDeleting(true);
    try {
      await deleteSchedule(id);
      setDeleteConfirm(null);
      fetchSchedules();
    } catch {
      setError("Failed to delete schedule. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  const openCreateDialog = () => {
    const { start, end } = getDefaultDates();
    setStartDate(start);
    setEndDate(end);
    setName("");
    setCreateError(null);
    setCreateOpen(true);
  };

  const formatRange = (start: string, end: string) => {
    const s = new Date(start + "T00:00:00Z");
    const e = new Date(end + "T00:00:00Z");
    return `${s.toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" })} - ${e.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">RS</span>
            </div>
            <div>
              <h1 className="font-semibold text-base">Restaurant Scheduler</h1>
              <p className="text-xs text-muted-foreground">Workforce Management</p>
            </div>
          </div>
          <Button onClick={openCreateDialog}>
            New Schedule
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-center justify-between">
            <span>{error}</span>
            <Button variant="ghost" size="sm" onClick={() => setError(null)} className="text-destructive h-6 px-2">
              Dismiss
            </Button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground" role="status" aria-live="polite">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" aria-hidden="true" />
              Loading...
            </div>
          </div>
        ) : schedules.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl opacity-40" aria-hidden="true">&#128197;</span>
            </div>
            <p className="text-lg font-medium">No schedules yet</p>
            <p className="text-sm text-muted-foreground mt-1 mb-6">
              Create your first schedule to get started
            </p>
            <Button onClick={openCreateDialog}>Create Schedule</Button>
          </div>
        ) : (
          <div className="grid gap-3">
            {schedules.map((s) => (
              <a
                key={s.id}
                href={`/schedule/${s.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  router.push(`/schedule/${s.id}`);
                }}
                className="flex items-center justify-between p-4 rounded-xl border bg-card hover:bg-muted/50 transition-colors group"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{s.name}</h3>
                    {!s.hasRequirements && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">
                        No requirements
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {formatRange(s.startDate, s.endDate)}
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  {(s.totalShifts ?? 0) > 0 ? (
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true" />
                        {s.filledShifts} filled
                      </span>
                      {(s.unfilledShifts ?? 0) > 0 && (
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-orange-400" aria-hidden="true" />
                          {s.unfilledShifts} open
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">No shifts yet</span>
                  )}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDeleteConfirm(s);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-xs text-muted-foreground hover:text-destructive transition-all px-2 py-1 rounded"
                    aria-label={`Delete schedule ${s.name}`}
                  >
                    Delete
                  </button>
                  <span className="text-muted-foreground group-hover:translate-x-0.5 transition-transform" aria-hidden="true">&#8594;</span>
                </div>
              </a>
            ))}
          </div>
        )}
      </main>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New Schedule</DialogTitle>
            <DialogDescription>Create a new weekly schedule</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Week of April 14"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Start date</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">End date</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
            {createError && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg p-2.5">{createError}</p>
            )}
            <Button onClick={handleCreate} disabled={creating || !name || !startDate || !endDate} className="w-full">
              {creating ? "Creating..." : "Create Schedule"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Schedule</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{deleteConfirm?.name}&rdquo;? This will remove all shifts and requirements. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm.id)}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
