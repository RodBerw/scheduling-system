import type { Period, Role } from "@/lib/types";

export const PERIODS: Period[] = ["morning", "afternoon", "evening"];

export const PERIOD_CONFIG: Record<Period, { label: string; icon: string; time: string }> = {
  morning: { label: "Morning", icon: "AM", time: "6am - 12pm" },
  afternoon: { label: "Afternoon", icon: "PM", time: "12pm - 6pm" },
  evening: { label: "Evening", icon: "NT", time: "6pm - 12am" },
};

export const ROLE_CONFIG: Record<Role, { label: string; color: string; dot: string; badge: string; hoverBg: string }> = {
  manager: {
    label: "MGR",
    color: "bg-violet-50 text-violet-700 ring-violet-200/60",
    dot: "bg-violet-500",
    badge: "bg-violet-100 text-violet-600",
    hoverBg: "hover:bg-violet-100/80 hover:ring-violet-300",
  },
  cook: {
    label: "COOK",
    color: "bg-amber-50 text-amber-700 ring-amber-200/60",
    dot: "bg-amber-500",
    badge: "bg-amber-100 text-amber-600",
    hoverBg: "hover:bg-amber-100/80 hover:ring-amber-300",
  },
  waiter: {
    label: "WAIT",
    color: "bg-sky-50 text-sky-700 ring-sky-200/60",
    dot: "bg-sky-500",
    badge: "bg-sky-100 text-sky-600",
    hoverBg: "hover:bg-sky-100/80 hover:ring-sky-300",
  },
  dishwasher: {
    label: "DISH",
    color: "bg-emerald-50 text-emerald-700 ring-emerald-200/60",
    dot: "bg-emerald-500",
    badge: "bg-emerald-100 text-emerald-600",
    hoverBg: "hover:bg-emerald-100/80 hover:ring-emerald-300",
  },
};

export const ROLE_LABELS: Record<Role, string> = {
  manager: "Manager",
  cook: "Cook",
  waiter: "Waiter",
  dishwasher: "Dishwasher",
};

export const PERIOD_LABELS: Record<Period, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
};
