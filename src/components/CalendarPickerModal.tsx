import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CalendarRangePickerProps {
  selectedDates?: string[]; // Array of YYYY-MM-DD
  onChange: (dates: string[]) => void;
  minDate?: string;
  onClose?: () => void;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarPickerModal({ selectedDates = [], onChange, minDate, onClose }: CalendarRangePickerProps) {
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  const [localDates, setLocalDates] = useState<string[]>(() => {
    if (selectedDates.length > 0) return [...selectedDates];
    return [todayStr];
  });

  const initialViewDate = useMemo(() => {
    return localDates.length > 0 ? new Date(localDates[0] + "T00:00:00") : new Date();
  }, [localDates]);

  const [currentMonth, setCurrentMonth] = useState(() => initialViewDate.getMonth());
  const [currentYear, setCurrentYear] = useState(() => initialViewDate.getFullYear());

  const minDateObj = useMemo(() => {
    if (!minDate) return new Date();
    const d = new Date(minDate + "T00:00:00");
    d.setHours(0, 0, 0, 0);
    return d;
  }, [minDate]);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    const days = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(currentYear, currentMonth, day);
      const mm = String(currentMonth + 1).padStart(2, "0");
      const dd = String(day).padStart(2, "0");
      const dateStr = `${currentYear}-${mm}-${dd}`;

      d.setHours(0, 0, 0, 0);
      const isPast = d < minDateObj;
      const isDisabled = isPast;
      const isToday = dateStr === todayStr;

      const isSelected = localDates.includes(dateStr);

      days.push({
        day,
        dateStr,
        isDisabled,
        isToday,
        isSelected,
      });
    }

    return { firstDayOfMonth, days };
  }, [currentYear, currentMonth, minDateObj, todayStr, localDates]);

  const handleSelectDay = (dateStr: string) => {
    setLocalDates((prev) => {
      if (prev.includes(dateStr)) {
        // Deselect
        return prev.filter((d) => d !== dateStr);
      } else {
        // Select, but limit to 6
        if (prev.length >= 6) {
          return prev;
        }
        return [...prev, dateStr].sort(); // Keep them sorted
      }
    });
  };

  const handleConfirm = () => {
    onChange(localDates);
    if (onClose) onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-sm max-h-[90vh] overflow-y-auto rounded-3xl border border-white/40 dark:border-white/10 bg-card p-5 shadow-2xl backdrop-blur-2xl transition-all animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-1 border-b border-border/50 pb-3">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-[1.05rem] text-foreground">Select Event Dates</h3>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
        <p className="mb-2 text-[0.8rem] text-muted-foreground">
          Select up to 6 dates for this event.
        </p>

        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-3 px-1">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="flex size-8 items-center justify-center rounded-xl border border-border bg-muted/50 hover:bg-muted text-foreground transition-all"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="font-bold text-[0.92rem] text-foreground">
            {MONTH_NAMES[currentMonth]} {currentYear}
          </span>
          <button
            type="button"
            onClick={handleNextMonth}
            className="flex size-8 items-center justify-center rounded-xl border border-border bg-muted/50 hover:bg-muted text-foreground transition-all"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Days of Week Header */}
        <div className="grid grid-cols-7 gap-1 text-center mb-2">
          {DAYS_OF_WEEK.map((d) => (
            <span key={d} className="text-[0.7rem] font-bold text-muted-foreground uppercase">
              {d}
            </span>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {Array.from({ length: calendarDays.firstDayOfMonth }).map((_, i) => (
            <div key={`pad-${i}`} className="aspect-square" />
          ))}

          {calendarDays.days.map((item) => {
            return (
              <button
                key={item.dateStr}
                type="button"
                disabled={item.isDisabled || (!item.isSelected && localDates.length >= 6)}
                onClick={() => handleSelectDay(item.dateStr)}
                className={cn(
                  "aspect-square flex flex-col items-center justify-center rounded-xl text-[0.85rem] font-medium transition-all relative",
                  item.isDisabled && "opacity-30 cursor-not-allowed text-muted-foreground line-through",
                  (!item.isSelected && localDates.length >= 6 && !item.isDisabled) && "opacity-50 cursor-not-allowed",
                  !item.isDisabled && !item.isSelected && "hover:bg-primary-soft hover:text-primary hover:scale-105 text-foreground",
                  item.isToday && !item.isSelected && "border border-primary/50 font-bold text-primary",
                  item.isSelected && "bg-primary text-primary-foreground font-bold shadow-md scale-105 z-10"
                )}
              >
                {item.day}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-4 border-t border-border/50 pt-3 flex items-center justify-between">
          <span className="text-[0.76rem] font-medium text-foreground">
            {localDates.length} of 6 dates selected
          </span>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={localDates.length === 0}
            className="px-4 py-2 text-[0.82rem] font-semibold text-primary-foreground bg-primary rounded-xl shadow-xs hover:brightness-110 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check className="h-4 w-4" /> Apply Dates
          </button>
        </div>
      </div>
    </div>
  );
}
