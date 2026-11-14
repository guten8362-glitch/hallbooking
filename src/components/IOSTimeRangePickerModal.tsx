import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Clock, X, Check, ArrowRight, SlidersHorizontal, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface IOSTimeRangePickerProps {
  startTime: string; // "HH:MM" e.g. "09:00"
  endTime: string;   // "HH:MM" e.g. "11:00"
  onChange: (startTime: string, endTime: string) => void;
  onClose: () => void;
}

const HOURS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
const MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];
const PERIODS = ["AM", "PM"];

const parseTime = (val: string) => {
  if (!val || !val.includes(":")) {
    return { hour: "09", minute: "00", period: "AM" };
  }
  const [hStr, mStr] = val.split(":");
  let h = parseInt(hStr, 10);
  const minuteVal = parseInt(mStr, 10);
  const closestMin = Math.round(minuteVal / 5) * 5;
  const minute = String(closestMin >= 60 ? 55 : closestMin).padStart(2, "0");

  let period = "AM";
  if (h >= 12) {
    period = "PM";
    if (h > 12) h -= 12;
  }
  if (h === 0) h = 12;
  const hour = String(h).padStart(2, "0");
  return { hour, minute, period };
};

const to24h = (h12: string, min: string, period: string) => {
  let h = parseInt(h12, 10);
  if (period === "PM" && h < 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${min}`;
};

const format12hDisplay = (h12: string, min: string, period: string) => `${h12}:${min} ${period}`;

export function IOSTimeRangePickerModal({ startTime, endTime, onChange, onClose }: IOSTimeRangePickerProps) {
  // Mode: "clock" (Alarm style circular dial) vs "wheel" (Smooth scroll tumbler)
  const [mode, setMode] = useState<"clock" | "wheel">("clock");

  // Which time slot is active: Start Time or End Time
  const [activeTab, setActiveTab] = useState<"start" | "end">("start");

  // In clock mode: are we picking "hour" or "minute"?
  const [clockUnit, setClockUnit] = useState<"hour" | "minute">("hour");

  const startParsed = useMemo(() => parseTime(startTime), [startTime]);
  const endParsed = useMemo(() => parseTime(endTime), [endTime]);

  // Start Time State
  const [startHour, setStartHour] = useState(startParsed.hour);
  const [startMinute, setStartMinute] = useState(startParsed.minute);
  const [startPeriod, setStartPeriod] = useState(startParsed.period);

  // End Time State
  const [endHour, setEndHour] = useState(endParsed.hour);
  const [endMinute, setEndMinute] = useState(endParsed.minute);
  const [endPeriod, setEndPeriod] = useState(endParsed.period);

  const [error, setError] = useState("");

  // Refs for wheel scroll detection
  const hourRef = useRef<HTMLDivElement>(null);
  const minuteRef = useRef<HTMLDivElement>(null);
  const periodRef = useRef<HTMLDivElement>(null);
  const isProgrammaticScroll = useRef(false);

  // Active values depending on tab
  const curHour = activeTab === "start" ? startHour : endHour;
  const curMinute = activeTab === "start" ? startMinute : endMinute;
  const curPeriod = activeTab === "start" ? startPeriod : endPeriod;

  const setCurHour = useCallback((val: string) => {
    setError("");
    if (activeTab === "start") setStartHour(val);
    else setEndHour(val);
  }, [activeTab]);

  const setCurMinute = useCallback((val: string) => {
    setError("");
    if (activeTab === "start") setStartMinute(val);
    else setEndMinute(val);
  }, [activeTab]);

  const setCurPeriod = useCallback((val: string) => {
    setError("");
    if (activeTab === "start") setStartPeriod(val);
    else setEndPeriod(val);
  }, [activeTab]);

  // Wheel sync scroll on tab or mode change
  useEffect(() => {
    if (mode === "wheel") {
      isProgrammaticScroll.current = true;
      if (hourRef.current) {
        const idx = HOURS.indexOf(curHour);
        if (idx !== -1) hourRef.current.scrollTop = idx * 44;
      }
      if (minuteRef.current) {
        const idx = MINUTES.indexOf(curMinute);
        if (idx !== -1) minuteRef.current.scrollTop = idx * 44;
      }
      if (periodRef.current) {
        const idx = PERIODS.indexOf(curPeriod);
        if (idx !== -1) periodRef.current.scrollTop = idx * 44;
      }
      const t = setTimeout(() => {
        isProgrammaticScroll.current = false;
      }, 150);
      return () => clearTimeout(t);
    }
  }, [mode, activeTab, curHour, curMinute, curPeriod]);

  // Wheel scroll handlers: auto-select on scroll without clicking!
  const handleHourScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isProgrammaticScroll.current) return;
    const target = e.currentTarget;
    const idx = Math.round(target.scrollTop / 44);
    const clamped = Math.max(0, Math.min(HOURS.length - 1, idx));
    const h = HOURS[clamped];
    if (h && h !== curHour) {
      setCurHour(h);
    }
  };

  const handleMinuteScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isProgrammaticScroll.current) return;
    const target = e.currentTarget;
    const idx = Math.round(target.scrollTop / 44);
    const clamped = Math.max(0, Math.min(MINUTES.length - 1, idx));
    const m = MINUTES[clamped];
    if (m && m !== curMinute) {
      setCurMinute(m);
    }
  };

  const handlePeriodScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isProgrammaticScroll.current) return;
    const target = e.currentTarget;
    const idx = Math.round(target.scrollTop / 44);
    const clamped = Math.max(0, Math.min(PERIODS.length - 1, idx));
    const p = PERIODS[clamped];
    if (p && p !== curPeriod) {
      setCurPeriod(p);
    }
  };

  const selectWheelHour = (h: string) => {
    setCurHour(h);
    const idx = HOURS.indexOf(h);
    if (idx !== -1 && hourRef.current) {
      isProgrammaticScroll.current = true;
      hourRef.current.scrollTo({ top: idx * 44, behavior: "smooth" });
      setTimeout(() => { isProgrammaticScroll.current = false; }, 300);
    }
  };

  const selectWheelMinute = (m: string) => {
    setCurMinute(m);
    const idx = MINUTES.indexOf(m);
    if (idx !== -1 && minuteRef.current) {
      isProgrammaticScroll.current = true;
      minuteRef.current.scrollTo({ top: idx * 44, behavior: "smooth" });
      setTimeout(() => { isProgrammaticScroll.current = false; }, 300);
    }
  };

  const selectWheelPeriod = (p: string) => {
    setCurPeriod(p);
    const idx = PERIODS.indexOf(p);
    if (idx !== -1 && periodRef.current) {
      isProgrammaticScroll.current = true;
      periodRef.current.scrollTo({ top: idx * 44, behavior: "smooth" });
      setTimeout(() => { isProgrammaticScroll.current = false; }, 300);
    }
  };

  // Clock Dial Pointer Dragging & Selection
  const clockRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const calculateClockValue = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!clockRef.current) return;
    const rect = clockRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;

    // Angle from top (12 o'clock) clockwise in degrees [0, 360)
    let deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    if (deg < 0) deg += 360;

    if (clockUnit === "hour") {
      let hVal = Math.round(deg / 30) % 12;
      if (hVal === 0) hVal = 12;
      setCurHour(String(hVal).padStart(2, "0"));
    } else {
      let mVal = (Math.round(deg / 30) * 5) % 60;
      setCurMinute(String(mVal).padStart(2, "0"));
    }
  };

  const handleClockPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isDragging.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    calculateClockValue(e);
  };

  const handleClockPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    calculateClockValue(e);
  };

  const handleClockPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    calculateClockValue(e);
    // Smooth auto-transition from hour to minute
    if (clockUnit === "hour") {
      setTimeout(() => setClockUnit("minute"), 200);
    }
  };

  const handleSelectClockNumber = (val: string) => {
    if (clockUnit === "hour") {
      setCurHour(val);
      // Auto-advance to minute
      setTimeout(() => setClockUnit("minute"), 200);
    } else {
      setCurMinute(val);
    }
  };

  // Angle of the clock hand
  const handAngle = useMemo(() => {
    if (clockUnit === "hour") {
      const h = parseInt(curHour, 10);
      return (h % 12) * 30;
    } else {
      const m = parseInt(curMinute, 10);
      return m * 6;
    }
  }, [clockUnit, curHour, curMinute]);

  // Positions for clock face items
  const clockItems = useMemo(() => {
    const list = clockUnit === "hour" ? HOURS : MINUTES;
    const r = 82; // radius in px
    return list.map((val, idx) => {
      // 12 items, 30 deg apart, 12 or 00 is at top (0 deg)
      const deg = idx * 30;
      const rad = (deg - 90) * (Math.PI / 180);
      const x = 110 + r * Math.cos(rad);
      const y = 110 + r * Math.sin(rad);
      return { val, deg, x, y };
    });
  }, [clockUnit]);

  const handleApplyPreset = (sH: string, sM: string, sP: string, eH: string, eM: string, eP: string) => {
    setStartHour(sH);
    setStartMinute(sM);
    setStartPeriod(sP);
    setEndHour(eH);
    setEndMinute(eM);
    setEndPeriod(eP);
    setError("");
  };

  const handleConfirm = () => {
    const s24 = to24h(startHour, startMinute, startPeriod);
    const e24 = to24h(endHour, endMinute, endPeriod);

    if (s24 >= e24) {
      setError("End time must be after Start time.");
      return;
    }

    onChange(s24, e24);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-sm sm:max-w-md max-h-[92vh] overflow-y-auto rounded-3xl border border-white/40 dark:border-white/10 bg-card p-5 shadow-2xl backdrop-blur-2xl transition-all animate-scale-in">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border/50 pb-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="grid size-8 place-items-center rounded-xl bg-primary-soft text-primary">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-semibold text-[1.02rem] text-foreground">Set Event Time Range</h3>
              <p className="text-[0.72rem] text-muted-foreground">Select start and end timings</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Mode Toggle: Clock Dial vs Scroll Wheel */}
            <div className="flex items-center rounded-xl bg-muted/80 p-0.5 border border-border/60">
              <button
                type="button"
                onClick={() => setMode("clock")}
                title="Alarm Clock Dial"
                className={cn(
                  "px-2.5 py-1 text-[0.75rem] font-medium rounded-lg transition-all flex items-center gap-1",
                  mode === "clock"
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Clock className="size-3.5" />
                <span>Clock</span>
              </button>
              <button
                type="button"
                onClick={() => setMode("wheel")}
                title="Scroll Wheel Picker"
                className={cn(
                  "px-2.5 py-1 text-[0.75rem] font-medium rounded-lg transition-all flex items-center gap-1",
                  mode === "wheel"
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <SlidersHorizontal className="size-3.5" />
                <span>Wheel</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Start / End Time Segmented Tab Bar */}
        <div className="mb-3 flex rounded-2xl bg-muted/70 p-1 border border-border/50">
          <button
            type="button"
            onClick={() => {
              setActiveTab("start");
              setClockUnit("hour");
            }}
            className={cn(
              "flex-1 py-2 px-3 rounded-xl text-[0.85rem] font-semibold transition-all flex flex-col items-center justify-center gap-0.5",
              activeTab === "start"
                ? "bg-primary text-primary-foreground shadow-md scale-[1.01]"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span className="text-[0.68rem] opacity-85 uppercase tracking-wider">Start Time</span>
            <span className="font-mono text-base font-bold">{format12hDisplay(startHour, startMinute, startPeriod)}</span>
          </button>

          <div className="flex items-center justify-center px-1.5 text-muted-foreground/60">
            <ArrowRight className="h-4 w-4" />
          </div>

          <button
            type="button"
            onClick={() => {
              setActiveTab("end");
              setClockUnit("hour");
            }}
            className={cn(
              "flex-1 py-2 px-3 rounded-xl text-[0.85rem] font-semibold transition-all flex flex-col items-center justify-center gap-0.5",
              activeTab === "end"
                ? "bg-primary text-primary-foreground shadow-md scale-[1.01]"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span className="text-[0.68rem] opacity-85 uppercase tracking-wider">End Time</span>
            <span className="font-mono text-base font-bold">{format12hDisplay(endHour, endMinute, endPeriod)}</span>
          </button>
        </div>

        {/* Digital Time & AM/PM Controls */}
        <div className="mb-2 flex items-center justify-between rounded-2xl bg-muted/40 border border-border/50 px-4 py-2">
          {/* Hour & Minute Switchers */}
          <div className="flex items-center gap-1.5 font-mono">
            <button
              type="button"
              onClick={() => setClockUnit("hour")}
              className={cn(
                "rounded-xl px-3 py-1 text-2xl font-black transition-all",
                clockUnit === "hour" && mode === "clock"
                  ? "bg-primary text-primary-foreground shadow-sm scale-105"
                  : "bg-muted text-foreground hover:bg-muted/80"
              )}
            >
              {curHour}
            </button>
            <span className="text-xl font-bold text-foreground/70 animate-pulse">:</span>
            <button
              type="button"
              onClick={() => setClockUnit("minute")}
              className={cn(
                "rounded-xl px-3 py-1 text-2xl font-black transition-all",
                clockUnit === "minute" && mode === "clock"
                  ? "bg-primary text-primary-foreground shadow-sm scale-105"
                  : "bg-muted text-foreground hover:bg-muted/80"
              )}
            >
              {curMinute}
            </button>
          </div>

          {/* AM / PM Toggle */}
          <div className="flex rounded-xl bg-muted p-1 border border-border/60">
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setCurPeriod(p)}
                className={cn(
                  "px-3 py-1 rounded-lg text-xs font-bold transition-all",
                  curPeriod === p
                    ? "bg-primary text-primary-foreground shadow-xs font-black"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Picker Display Body: CLOCK DIAL or WHEEL */}
        {mode === "clock" ? (
          /* CLOCK ALARM DIAL */
          <div className="flex flex-col items-center justify-center select-none py-1">
            <p className="text-[0.75rem] font-medium text-muted-foreground mb-1.5">
              {clockUnit === "hour" ? "Spin or click to set Hour (1–12)" : "Spin or click to set Minute (00–55)"}
            </p>

            <div
              ref={clockRef}
              onPointerDown={handleClockPointerDown}
              onPointerMove={handleClockPointerMove}
              onPointerUp={handleClockPointerUp}
              className="relative size-[220px] rounded-full border-2 border-border/70 bg-muted/30 shadow-inner flex items-center justify-center cursor-pointer touch-none"
            >
              {/* Center Pivot Point */}
              <div className="absolute size-3.5 rounded-full bg-primary z-20 shadow-xs pointer-events-none" />

              {/* Clock Hand Line */}
              <div
                className="absolute origin-bottom pointer-events-none z-10 transition-transform duration-100 ease-out"
                style={{
                  width: "2.5px",
                  height: "82px",
                  bottom: "110px",
                  left: "calc(110px - 1.25px)",
                  transform: `rotate(${handAngle}deg)`,
                  backgroundColor: "var(--primary, #e11d48)",
                }}
              >
                {/* Hand Tip Ring Indicator */}
                <div
                  className="absolute -top-4 -left-[15px] size-[32px] rounded-full bg-primary/20 border-2 border-primary shadow-md"
                />
              </div>

              {/* Numbers on the Clock Face */}
              {clockItems.map(({ val, x, y }) => {
                const isSelected = clockUnit === "hour" ? curHour === val : curMinute === val;
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectClockNumber(val);
                    }}
                    style={{
                      left: `${x - 16}px`,
                      top: `${y - 16}px`,
                    }}
                    className={cn(
                      "absolute size-[32px] rounded-full flex items-center justify-center font-mono text-[0.88rem] transition-all z-10",
                      isSelected
                        ? "bg-primary text-primary-foreground font-black shadow-md scale-110"
                        : "text-foreground font-semibold hover:bg-primary-soft hover:text-primary"
                    )}
                  >
                    {val}
                  </button>
                );
              })}
            </div>

            {/* Quick Next Step Guide */}
            {activeTab === "start" && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab("end");
                  setClockUnit("hour");
                }}
                className="mt-2 text-[0.76rem] font-medium text-primary hover:underline flex items-center gap-1"
              >
                <span>Finished start time? Set End Time</span>
                <ArrowRight className="size-3" />
              </button>
            )}
          </div>
        ) : (
          /* SCROLL WHEEL WITH AUTO-SELECTION ON SCROLL */
          <div className="relative h-44 my-2 flex items-center justify-center overflow-hidden rounded-2xl bg-muted/30 border border-border/50 select-none">
            {/* Central Highlight Selection Strip */}
            <div className="absolute inset-x-3 h-11 rounded-xl bg-primary/10 border-y border-primary/40 pointer-events-none z-10 shadow-inner" />

            {/* Top and Bottom Fade Gradients */}
            <div className="absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-card via-card/85 to-transparent pointer-events-none z-20" />
            <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-card via-card/85 to-transparent pointer-events-none z-20" />

            {/* Hours Wheel */}
            <div
              ref={hourRef}
              onScroll={handleHourScroll}
              className="h-full w-1/3 overflow-y-auto py-16 text-center scrollbar-none snap-y snap-mandatory z-0 scroll-smooth"
            >
              {HOURS.map((h) => {
                const active = curHour === h;
                return (
                  <div
                    key={h}
                    onClick={() => selectWheelHour(h)}
                    className={cn(
                      "h-11 flex items-center justify-center snap-center cursor-pointer font-mono transition-all duration-150",
                      active
                        ? "font-black text-primary text-xl scale-115"
                        : "text-muted-foreground/60 hover:text-foreground text-sm scale-90 opacity-60"
                    )}
                  >
                    {h}
                  </div>
                );
              })}
            </div>

            {/* Colon */}
            <div className="z-10 font-bold text-xl text-primary font-mono select-none px-1">:</div>

            {/* Minutes Wheel */}
            <div
              ref={minuteRef}
              onScroll={handleMinuteScroll}
              className="h-full w-1/3 overflow-y-auto py-16 text-center scrollbar-none snap-y snap-mandatory z-0 scroll-smooth"
            >
              {MINUTES.map((m) => {
                const active = curMinute === m;
                return (
                  <div
                    key={m}
                    onClick={() => selectWheelMinute(m)}
                    className={cn(
                      "h-11 flex items-center justify-center snap-center cursor-pointer font-mono transition-all duration-150",
                      active
                        ? "font-black text-primary text-xl scale-115"
                        : "text-muted-foreground/60 hover:text-foreground text-sm scale-90 opacity-60"
                    )}
                  >
                    {m}
                  </div>
                );
              })}
            </div>

            {/* AM / PM Wheel */}
            <div
              ref={periodRef}
              onScroll={handlePeriodScroll}
              className="h-full w-1/3 overflow-y-auto py-16 text-center scrollbar-none snap-y snap-mandatory z-0 scroll-smooth"
            >
              {PERIODS.map((p) => {
                const active = curPeriod === p;
                return (
                  <div
                    key={p}
                    onClick={() => selectWheelPeriod(p)}
                    className={cn(
                      "h-11 flex items-center justify-center snap-center cursor-pointer font-bold transition-all duration-150",
                      active
                        ? "font-black text-primary text-base scale-115"
                        : "text-muted-foreground/60 hover:text-foreground text-xs scale-90 opacity-60"
                    )}
                  >
                    {p}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick Duration Presets */}
        <div className="mt-3 flex flex-wrap gap-1.5 justify-center">
          <button
            type="button"
            onClick={() => handleApplyPreset("09", "00", "AM", "01", "00", "PM")}
            className="px-2.5 py-1 text-[0.72rem] font-semibold rounded-lg bg-muted text-muted-foreground hover:bg-primary-soft hover:text-primary transition-all"
          >
            Half Day (9 AM - 1 PM)
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset("09", "00", "AM", "05", "00", "PM")}
            className="px-2.5 py-1 text-[0.72rem] font-semibold rounded-lg bg-muted text-muted-foreground hover:bg-primary-soft hover:text-primary transition-all"
          >
            Full Day (9 AM - 5 PM)
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset("02", "00", "PM", "05", "00", "PM")}
            className="px-2.5 py-1 text-[0.72rem] font-semibold rounded-lg bg-muted text-muted-foreground hover:bg-primary-soft hover:text-primary transition-all"
          >
            Afternoon (2 PM - 5 PM)
          </button>
        </div>

        {error && (
          <p className="mt-2 text-center text-[0.8rem] font-medium text-destructive bg-destructive/10 p-2 rounded-xl border border-destructive/20">
            {error}
          </p>
        )}

        {/* Modal Buttons */}
        <div className="mt-3 border-t border-border/50 pt-3 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-border bg-card text-[0.88rem] font-medium text-foreground hover:bg-muted transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 py-2.5 rounded-xl bg-primary text-[0.88rem] font-semibold text-primary-foreground shadow-md hover:brightness-110 transition-all flex items-center justify-center gap-1.5"
          >
            <Check className="h-4 w-4" /> Apply Time Slot
          </button>
        </div>
      </div>
    </div>
  );
}
