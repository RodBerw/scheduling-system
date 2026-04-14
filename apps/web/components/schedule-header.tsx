"use client";

import { Button } from "@/components/ui/button";
import { formatDateRange } from "@/lib/date-utils";
import {
  ArrowLeft,
  CalendarDays,
  MessageSquare,
  X,
  Sparkles,
  RefreshCw,
} from "lucide-react";

interface ScheduleHeaderProps {
  name: string;
  startDate: string;
  endDate: string;
  filledCount: number;
  unfilledCount: number;
  hasShifts: boolean;
  hasRequirements: boolean;
  isGenerating: boolean;
  chatOpen: boolean;
  onGenerate: () => void;
  onToggleChat: () => void;
}

export function ScheduleHeader({
  name,
  startDate,
  endDate,
  filledCount,
  unfilledCount,
  hasShifts,
  hasRequirements,
  isGenerating,
  chatOpen,
  onGenerate,
  onToggleChat,
}: ScheduleHeaderProps) {
  return (
    <header className="flex-shrink-0 bg-card/80 backdrop-blur-sm border-b z-30">
      <div className="flex items-center justify-between px-3 sm:px-6 py-2.5 sm:py-3 gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <a
            href="/"
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors text-sm shrink-0 cursor-pointer"
            aria-label="Back to schedules"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Schedules</span>
          </a>
          <div className="w-px h-5 bg-border hidden sm:block" />
          <div className="min-w-0">
            <h1 className="font-semibold text-sm leading-tight truncate">{name}</h1>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <CalendarDays className="w-3 h-3 shrink-0" />
              <span className="truncate">{formatDateRange(startDate, endDate)}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {hasShifts && (
            <ShiftCounts filledCount={filledCount} unfilledCount={unfilledCount} className="hidden sm:flex" />
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onGenerate}
            disabled={isGenerating || !hasRequirements}
            className="h-8 sm:h-9 gap-1.5 text-xs cursor-pointer"
            title={
              !hasRequirements
                ? "Set requirements first via chat"
                : isGenerating
                  ? "Generating shifts..."
                  : ""
            }
          >
            {isGenerating ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">
              {isGenerating ? "Generating..." : hasShifts ? "Smart Fill" : "Generate Shifts"}
            </span>
            <span className="sm:hidden">
              {isGenerating ? "..." : "Generate"}
            </span>
          </Button>
          <Button
            variant={chatOpen ? "default" : "outline"}
            size="sm"
            onClick={onToggleChat}
            className="lg:hidden h-8 sm:h-9 w-8 sm:w-9 p-0 cursor-pointer"
            aria-label={chatOpen ? "Close chat" : "Open AI assistant"}
          >
            {chatOpen ? <X className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Mobile stats bar */}
      {hasShifts && (
        <div className="flex sm:hidden items-center gap-3 px-3 py-1.5 border-t text-xs text-muted-foreground bg-muted/30">
          <ShiftCounts filledCount={filledCount} unfilledCount={unfilledCount} />
        </div>
      )}
    </header>
  );
}

function ShiftCounts({ filledCount, unfilledCount, className }: { filledCount: number; unfilledCount: number; className?: string }) {
  return (
    <div className={`items-center gap-3 mr-1 text-xs text-muted-foreground ${className ?? "flex"}`}>
      <span className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true" />
        {filledCount} filled
      </span>
      {unfilledCount > 0 && (
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400" aria-hidden="true" />
          {unfilledCount} open
        </span>
      )}
    </div>
  );
}
