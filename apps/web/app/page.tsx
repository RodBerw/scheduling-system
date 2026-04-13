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
import {
  CalendarDays,
  Plus,
  ChevronRight,
  Trash2,
  Clock,
  Users,
  CalendarPlus,
} from "lucide-react";

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

  const getCompletionPercent = (s: Schedule) => {
    const total = s.totalShifts ?? 0;
    if (total === 0) return 0;
    return Math.round(((s.filledShifts ?? 0) / total) * 100);
  };

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
          <Button onClick={openCreateDialog} size="sm" className="gap-1.5 cursor-pointer">
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
            <span>{error}</span>
            <Button variant="ghost" size="sm" onClick={() => setError(null)} className="text-destructive h-7 px-2 shrink-0 cursor-pointer">
              Dismiss
            </Button>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center h-60 text-muted-foreground" role="status" aria-live="polite">
            <div className="w-10 h-10 border-3 border-primary/30 border-t-primary rounded-full animate-spin mb-3" aria-hidden="true" />
            <p className="text-sm">Loading schedules...</p>
          </div>
        ) : schedules.length === 0 ? (
          <div className="text-center py-16 sm:py-20">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <CalendarPlus className="w-8 h-8 text-primary/60" />
            </div>
            <p className="text-lg font-semibold">No schedules yet</p>
            <p className="text-sm text-muted-foreground mt-1 mb-6 max-w-xs mx-auto">
              Create your first weekly schedule to start managing your restaurant staff
            </p>
            <Button onClick={openCreateDialog} className="gap-2 cursor-pointer">
              <Plus className="w-4 h-4" />
              Create Schedule
            </Button>
          </div>
        ) : (
          <>
            {/* Summary stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
              <div className="bg-card border rounded-xl p-3 sm:p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <CalendarDays className="w-4 h-4" />
                  <span className="text-xs font-medium">Schedules</span>
                </div>
                <p className="text-2xl font-bold">{schedules.length}</p>
              </div>
              <div className="bg-card border rounded-xl p-3 sm:p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Users className="w-4 h-4" />
                  <span className="text-xs font-medium">Filled Shifts</span>
                </div>
                <p className="text-2xl font-bold text-emerald-600">
                  {schedules.reduce((a, s) => a + (s.filledShifts ?? 0), 0)}
                </p>
              </div>
              <div className="bg-card border rounded-xl p-3 sm:p-4 col-span-2 sm:col-span-1">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Clock className="w-4 h-4" />
                  <span className="text-xs font-medium">Open Shifts</span>
                </div>
                <p className="text-2xl font-bold text-amber-600">
                  {schedules.reduce((a, s) => a + (s.unfilledShifts ?? 0), 0)}
                </p>
              </div>
            </div>

            {/* Schedule cards */}
            <div className="grid gap-3">
              {schedules.map((s) => {
                const percent = getCompletionPercent(s);
                const totalShifts = s.totalShifts ?? 0;

                return (
                  <a
                    key={s.id}
                    href={`/schedule/${s.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      router.push(`/schedule/${s.id}`);
                    }}
                    className="block p-4 sm:p-5 rounded-xl border bg-card hover:border-primary/30 hover:shadow-sm transition-all group cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-base truncate">{s.name}</h3>
                          {!s.hasRequirements && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium shrink-0">
                              No requirements
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
                          <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                          {formatRange(s.startDate, s.endDate)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDeleteConfirm(s);
                          }}
                          className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors sm:opacity-0 sm:group-hover:opacity-100 cursor-pointer"
                          aria-label={`Delete schedule ${s.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <ChevronRight className="w-5 h-5 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>

                    {/* Progress section */}
                    {totalShifts > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <div className="flex items-center gap-3 text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true" />
                              {s.filledShifts} filled
                            </span>
                            {(s.unfilledShifts ?? 0) > 0 && (
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-amber-400" aria-hidden="true" />
                                {s.unfilledShifts} open
                              </span>
                            )}
                          </div>
                          <span className="font-semibold text-foreground">{percent}%</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              percent >= 100
                                ? "bg-emerald-500"
                                : percent >= 50
                                  ? "bg-amber-400"
                                  : "bg-primary/60"
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {totalShifts === 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          No shifts generated yet
                        </p>
                      </div>
                    )}
                  </a>
                );
              })}
            </div>
          </>
        )}
      </main>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New Schedule</DialogTitle>
            <DialogDescription>Create a new weekly schedule for your restaurant</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="schedule-name" className="text-sm font-medium">Name</Label>
              <Input
                id="schedule-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Week of April 14"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="start-date" className="text-sm font-medium">Start date</Label>
                <Input id="start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="end-date" className="text-sm font-medium">End date</Label>
                <Input id="end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
            {createError && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg p-2.5">{createError}</p>
            )}
            <Button onClick={handleCreate} disabled={creating || !name || !startDate || !endDate} className="w-full cursor-pointer">
              {creating ? "Creating..." : "Create Schedule"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" />
              Delete Schedule
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{deleteConfirm?.name}&rdquo;? This will remove all shifts and requirements. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} disabled={deleting} className="cursor-pointer">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm.id)}
              disabled={deleting}
              className="cursor-pointer"
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
