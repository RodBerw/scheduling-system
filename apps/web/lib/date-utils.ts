export function formatDateRange(start: string, end: string) {
  const s = new Date(start + "T00:00:00Z");
  const e = new Date(end + "T00:00:00Z");
  return `${s.toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" })} - ${e.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`;
}

export function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

export function getDefaultDates() {
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

export interface DayInfo {
  date: string;
  dayName: string;
  dayNum: number;
  month: string;
  isToday: boolean;
  dayOfWeek: number;
}

export function getDays(startDate: string, endDate: string): DayInfo[] {
  const days: DayInfo[] = [];
  const today = new Date().toISOString().split("T")[0];
  const start = new Date(startDate + "T00:00:00Z");
  const end = new Date(endDate + "T00:00:00Z");
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const d = new Date(start);
  while (d <= end) {
    const dateStr = d.toISOString().split("T")[0];
    days.push({
      date: dateStr,
      dayName: dayNames[d.getUTCDay()],
      dayNum: d.getUTCDate(),
      month: months[d.getUTCMonth()],
      isToday: dateStr === today,
      dayOfWeek: d.getUTCDay(),
    });
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return days;
}
