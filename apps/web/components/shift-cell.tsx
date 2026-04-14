"use client";

import type { Shift, Period } from "@/lib/types";
import { ROLE_CONFIG, PERIOD_CONFIG } from "@/lib/constants";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Clock, User, UserX } from "lucide-react";

interface ShiftCellProps {
  shift: Shift;
  period: Period;
  isChanged: boolean;
  onClick: () => void;
}

export function ShiftCell({ shift, period, isChanged, onClick }: ShiftCellProps) {
  const role = ROLE_CONFIG[shift.role];
  const isFilled = !!shift.assignedEmployee;

  return (
    <Tooltip>
      <TooltipTrigger
        onClick={onClick}
        className={`group w-full text-left rounded-lg px-2 py-2 text-xs transition-all duration-200 cursor-pointer ${isFilled
            ? `${role.color} ring-1 shadow-sm ${role.hoverBg} hover:shadow-md hover:ring-2`
            : "bg-muted/30 text-muted-foreground border border-dashed border-muted-foreground/25 hover:bg-muted/60 hover:border-muted-foreground/40"
          } ${isChanged ? "animate-highlight-fade ring-2 ring-primary" : ""}`}
      >
        {isFilled ? (
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${role.dot} ring-2 ring-white/80`} />
              <span className="font-semibold truncate text-[11px] leading-tight">
                {shift.assignedEmployee?.name.split(" ")[0]}
              </span>
            </div>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0 ${role.badge}`}>
              {role.label}
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <UserX className="w-3 h-3 flex-shrink-0 opacity-40" />
              <span className="font-medium truncate text-[11px] opacity-60">
                Open
              </span>
            </div>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground/60 flex-shrink-0">
              {role.label}
            </span>
          </div>
        )}
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="flex items-center gap-2">
          {isFilled ? (
            <User className="w-3.5 h-3.5 opacity-70" />
          ) : (
            <UserX className="w-3.5 h-3.5 opacity-70" />
          )}
          <p className="font-medium">
            {shift.assignedEmployee?.name || "Unfilled slot"}
          </p>
        </div>
        <p className="text-xs opacity-80 mt-1 flex items-center gap-1.5">
          <Clock className="w-3 h-3" />
          {shift.role} &middot; {PERIOD_CONFIG[period].label}
        </p>
        {shift.explanation && (
          <p className="text-xs opacity-60 mt-1 italic">{shift.explanation}</p>
        )}
        <p className="text-xs mt-1.5 font-medium opacity-70">
          {isFilled ? "Click to replace or reassign" : "Click to assign someone"}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
