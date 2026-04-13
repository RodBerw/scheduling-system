"use client";

import { useState, useEffect } from "react";
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
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchSchedules = async () => {
    setLoading(true);
    try {
      setSchedules(await getSchedules());
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, []);

  const handleCreate = async () => {
    if (!name || !startDate || !endDate) return;
    setCreating(true);
    try {
      const s = await createSchedule(name, startDate, endDate);
      setCreateOpen(false);
      setName("");
      window.location.href = `/schedule/${s.id}`;
    } catch {
      // silent
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteSchedule(id);
      fetchSchedules();
    } catch {
      // silent
    }
  };

  const openCreateDialog = () => {
    const { start, end } = getDefaultDates();
    setStartDate(start);
    setEndDate(end);
    setName("");
    setCreateOpen(true);
  };

  const formatRange = (start: string, end: string) => {
    const s = new Date(start + "T00:00:00");
    const e = new Date(end + "T00:00:00");
    return `${s.toLocaleDateString("en", { month: "short", day: "numeric" })} - ${e.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}`;
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
        {loading ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Loading...
            </div>
          </div>
        ) : schedules.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl opacity-40">&#128197;</span>
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
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        {s.filledShifts} filled
                      </span>
                      {(s.unfilledShifts ?? 0) > 0 && (
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-orange-400" />
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
                      handleDelete(s.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-xs text-muted-foreground hover:text-destructive transition-all px-2 py-1 rounded"
                  >
                    Delete
                  </button>
                  <span className="text-muted-foreground group-hover:translate-x-0.5 transition-transform">&#8594;</span>
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
            <Button onClick={handleCreate} disabled={creating || !name} className="w-full">
              {creating ? "Creating..." : "Create Schedule"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
