import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageTitle, Surface } from "@/components/ui-kit";
import { formatDate, formatTime, useBookings } from "@/lib/booking-store";
import { cn } from "@/lib/utils";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];

import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/calendar")({
  head: () => ({
    meta: [
      { title: "Calendar — Central Hall Booking" },
      {
        name: "description",
        content: "View your bookings on a calendar.",
      },
      { property: "og:title", content: "Calendar" },
      {
        property: "og:description",
        content: "See your upcoming hall bookings on a calendar.",
      },
    ],
  }),
  component: CalendarPage,
});

function CalendarPage() {
  const { bookings, ready, getAuditorium } = useBookings();
  const { user } = useAuth();
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const isMVITUser = () => {
    if (!user) return true;
    if (user.role === "admin" || user.role === "super_admin") return true;
    const inst = (user.institution || "").toUpperCase();
    return inst.includes("MVIT") || inst.includes("MANAKULA VINAYAGAR INSTITUTE");
  };

  const mvitFlag = isMVITUser();

  const visibleBookings = bookings.filter((b) => {
    if (mvitFlag) return true;
    
    // External users & External Coordinators see ONLY backside auditorium bookings
    const aud = getAuditorium(b.auditoriumId || (b as any).hallId);
    const audName = (aud?.name || (b as any).auditoriumName || (b as any).hallName || "").toLowerCase();
    const audId = (aud?.id || b.auditoriumId || (b as any).hallId || "").toLowerCase();

    return (
      audId.includes("back") || 
      audId.includes("backside") || 
      audName.includes("back") || 
      audName.includes("backside")
    );
  });

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();

  const isDateInRange = (b: any, targetDateStr: string) => {
    if (b.selectedDates && Array.isArray(b.selectedDates) && b.selectedDates.length > 0) {
      return b.selectedDates.includes(targetDateStr);
    }
    if (b.fromDate) {
      try {
        const target = new Date(targetDateStr + "T00:00:00");
        const from = new Date(b.fromDate + (b.fromDate.includes("T") ? "" : "T00:00:00"));
        const to = new Date((b.toDate || b.fromDate) + ((b.toDate || b.fromDate).includes("T") ? "" : "T00:00:00"));
        
        target.setHours(0,0,0,0);
        from.setHours(0,0,0,0);
        to.setHours(0,0,0,0);
        return target >= from && target <= to;
      } catch (e) {
        // Fallback
      }
    }
    
    // Fallback for older bookings that only use b.date or b.eventDate
    const fallbackDate = b.date || b.eventDate || "";
    if (fallbackDate.includes(targetDateStr)) return true;
    if (fallbackDate.includes("T") && fallbackDate.split("T")[0] === targetDateStr) return true;
    return false;
  };

  const selectedBookings = selectedDate
    ? visibleBookings.filter((b) => isDateInRange(b, selectedDate))
    : [];

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const isToday = (day: number) => {
    const d = new Date(viewYear, viewMonth, day);
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  };

  const isSelected = (day: number) => {
    if (!selectedDate) return false;
    const d = new Date(viewYear, viewMonth, day);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dayStr = String(d.getDate()).padStart(2, "0");
    return selectedDate === `${y}-${m}-${dayStr}`;
  };

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <AppShell>
      <PageTitle
        eyebrow="Schedule"
        title="Auditorium Calendar"
        subtitle="View campus venue bookings with live event titles & schedule details."
      />

      <Surface className="p-4 sm:p-6">
        <div className="mb-6 flex items-center justify-between">
          <button
            type="button"
            onClick={prevMonth}
            className="press rounded-xl border border-border bg-card px-3.5 py-1.5 text-[0.85rem] font-semibold text-foreground hover:bg-muted"
          >
            ← Prev
          </button>
          <h2 className="text-[1.15rem] font-bold text-foreground">
            {MONTHS[viewMonth]} {viewYear}
          </h2>
          <button
            type="button"
            onClick={nextMonth}
            className="press rounded-xl border border-border bg-card px-3.5 py-1.5 text-[0.85rem] font-semibold text-foreground hover:bg-muted"
          >
            Next →
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1.5 text-center">
          {DAYS.map((d, i) => (
            <span
              key={i}
              className="pb-2 text-[0.78rem] font-bold uppercase tracking-wider text-muted-foreground"
            >
              {d}
            </span>
          ))}
          {cells.map((day, i) => {
            if (day === null) {
              return <div key={`e-${i}`} className="aspect-square sm:aspect-auto sm:min-h-[95px] rounded-lg sm:rounded-2xl border border-transparent" />;
            }

            const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const dayBookings = visibleBookings.filter((b) => isDateInRange(b, dateStr));
            const selected = isSelected(day);
            const todayFlag = isToday(day);

            return (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDate(dateStr)}
                className={cn(
                  "group relative flex aspect-square sm:aspect-auto sm:min-h-[95px] flex-col items-center justify-center sm:items-stretch sm:justify-between rounded-xl sm:rounded-2xl p-1 sm:p-2 text-left transition-all duration-200 border",
                  selected
                    ? "border-primary bg-primary/10 shadow-md ring-1 sm:ring-2 ring-primary/40 scale-[1.02] sm:scale-[1.01]"
                    : todayFlag
                    ? "border-primary/60 bg-card shadow-xs"
                    : dayBookings.length > 0
                    ? "border-red-500/30 bg-red-50/40 dark:bg-red-950/20 hover:border-red-500/60"
                    : "border-border/50 bg-card hover:bg-muted/40"
                )}
              >
                {/* Header inside cell: Day number + event count badge */}
                <div className="flex flex-col sm:flex-row items-center sm:justify-between w-full gap-0.5 sm:gap-1">
                  <span
                    className={cn(
                      "grid size-6 sm:size-7 place-items-center rounded-md sm:rounded-lg text-[0.8rem] sm:text-[0.85rem] font-bold transition-all mx-auto sm:mx-0",
                      todayFlag
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : selected
                        ? "bg-primary/20 text-primary font-black"
                        : "text-foreground group-hover:text-primary"
                    )}
                  >
                    {day}
                  </span>

                  {dayBookings.length > 0 && (
                    <span className="flex items-center justify-center rounded-full bg-red-500/15 px-1 sm:px-1.5 py-0.5 text-[0.6rem] sm:text-[0.68rem] font-extrabold text-red-700 dark:text-red-300 border border-red-500/20 leading-none">
                      {dayBookings.length} <span className="hidden sm:inline">&nbsp;{dayBookings.length === 1 ? "Event" : "Events"}</span>
                    </span>
                  )}
                </div>

                {/* Event Writings / Badges directly inside the calendar cell! */}
                <div className="mt-1 flex-1 hidden sm:block space-y-1 overflow-hidden">
                  {dayBookings.slice(0, 2).map((b) => {
                    const aud = getAuditorium(b.auditoriumId || (b as any).hallId);
                    const isConfirmed = b.stage === "confirmed";
                    return (
                      <div
                        key={b.id}
                        className={cn(
                          "truncate rounded-lg px-1.5 py-1 text-[0.72rem] font-semibold leading-tight border transition-all shadow-2xs",
                          isConfirmed
                            ? "bg-red-600 text-white border-red-700 dark:bg-red-700"
                            : "bg-amber-500/90 text-white border-amber-600"
                        )}
                        title={`${(b as any).auditoriumName || aud?.name || "Venue"} (${formatTime(b.startTime)}-${formatTime(b.endTime)}): ${b.eventName || b.coordinator}`}
                      >
                        <div className="truncate font-bold">
                          {(b as any).auditoriumName || aud?.name || "Booked Event"}
                        </div>
                        <div className="truncate text-[0.66rem] opacity-90">
                          {formatTime(b.startTime) || "Booked"} · {b.coordinator || "Event"}
                        </div>
                      </div>
                    );
                  })}

                  {dayBookings.length > 2 && (
                    <div className="text-[0.68rem] font-bold text-muted-foreground pl-1">
                      +{dayBookings.length - 2} more...
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </Surface>

      {/* Selected Date Detailed Event Sheet */}
      {selectedDate && (
        <Surface className="mt-6 animate-slide-up-fade border border-border/80 p-6">
          <div className="mb-4 flex items-center justify-between border-b border-border/60 pb-3">
            <div>
              <span className="text-[0.72rem] font-bold uppercase tracking-wider text-primary">
                Selected Date Schedule
              </span>
              <h3 className="text-[1.15rem] font-bold text-foreground">
                {formatDate(selectedDate)}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setSelectedDate(null)}
              className="press rounded-xl border border-border bg-muted/50 px-3.5 py-1.5 text-[0.82rem] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              Close
            </button>
          </div>

          {ready && selectedBookings.length === 0 && (
            <div className="py-8 text-center">
              <CalendarDays className="mx-auto h-10 w-10 text-muted-foreground/40 mb-2" />
              <p className="text-[0.92rem] font-medium text-muted-foreground">
                No hall bookings scheduled for this date.
              </p>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {selectedBookings.map((b) => {
              const aud = getAuditorium(b.auditoriumId || (b as any).hallId);
              const isConfirmed = b.stage === "confirmed";

              return (
                <div
                  key={b.id}
                  className="group relative flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-4 transition-all hover:border-primary/50 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[0.7rem] font-bold uppercase tracking-wider text-muted-foreground">
                          Auditorium:
                        </span>
                        <span className="text-[0.88rem] font-extrabold text-primary">
                          {(b as any).auditoriumName || aud?.name || "Backside Auditorium"}
                        </span>
                      </div>
                      <h4 className="text-[1.05rem] font-bold text-foreground leading-snug">
                        {(!b.eventName || b.eventName === "h" || b.eventName.trim().length <= 1) 
                          ? `Booked by ${b.coordinator || "User"}` 
                          : b.eventName}
                      </h4>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2.5 py-1 text-[0.72rem] font-bold border",
                        isConfirmed
                          ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300"
                          : "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300"
                      )}
                    >
                      {isConfirmed ? "Confirmed" : "Pending"}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-[0.85rem] text-muted-foreground mb-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">Time:</span>
                      <span>{formatTime(b.startTime)} – {formatTime(b.endTime)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">Booked By:</span>
                      <span>{b.coordinator} ({b.institution})</span>
                    </div>
                    {b.participants && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">Expected Audience:</span>
                        <span>{b.participants} attendees</span>
                      </div>
                    )}
                  </div>

                  <Link
                    to="/bookings/$id"
                    params={{ id: b.id }}
                    className="press inline-flex h-9 w-full items-center justify-center rounded-xl bg-primary-soft text-[0.82rem] font-bold text-primary hover:bg-primary hover:text-white transition-colors"
                  >
                    View Request & Approval Details →
                  </Link>
                </div>
              );
            })}
          </div>
        </Surface>
      )}
    </AppShell>
  );
}
