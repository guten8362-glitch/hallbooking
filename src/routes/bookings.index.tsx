import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CalendarPlus, ChevronRight, Download, UploadCloud, CheckCircle2, Trash2 } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageTitle } from "@/components/ui-kit";
import { Timeline } from "@/components/Timeline";
import { formatDate, getStageInfo, useBookings } from "@/lib/booking-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/bookings/")({
  head: () => ({
    meta: [
      { title: "My Bookings — Central Auditorium Booking" },
      {
        name: "description",
        content: "Track every auditorium request from approval to final confirmation.",
      },
      { property: "og:title", content: "My Bookings" },
      {
        property: "og:description",
        content: "Track every auditorium request from approval to confirmation.",
      },
    ],
  }),
  component: MyBookings,
});

type TabType = "all" | "open" | "confirmed" | "rejected";

import { useAuth, isCoordinatorUser } from "@/lib/auth";
import { useEffect } from "react";

export function MyBookings() {
  const { user, ready: authReady } = useAuth();
  const { bookings, remove, ready, getAuditorium } = useBookings();
  const [tab, setTab] = useState<TabType>("open");
  const navigate = useNavigate();

  const format12h = (time24: string) => {
    if (!time24 || !time24.includes(":")) return time24;
    const [hStr, mStr] = time24.split(":");
    let h = parseInt(hStr, 10);
    const period = h >= 12 ? "PM" : "AM";
    if (h > 12) h -= 12;
    if (h === 0) h = 12;
    return `${String(h).padStart(2, "0")}:${mStr} ${period}`;
  };

  const getDisplayTime = (b: any) => {
    try {
      const remarks = JSON.parse(b.remarks || "{}");
      if (remarks.startTimeStr && remarks.endTimeStr) {
        return `${format12h(remarks.startTimeStr)} – ${format12h(remarks.endTimeStr)}`;
      }
    } catch {}
    
    if (b.startTime && typeof b.startTime === "string" && b.startTime.includes("T")) {
       return "Time TBD"; 
    }
    return `${b.startTime || ""} – ${b.endTime || ""}`;
  };

  useEffect(() => {
    if (authReady && isCoordinatorUser(user)) {
      navigate({ to: "/coordinator" });
    }
  }, [authReady, user, navigate]);

  const userBookings = bookings.filter((b) => {
    if (!user) return true;
    const uEmail = (user.email || "").toLowerCase().trim();
    const uId = user.$id;

    const bApplicantEmail = (
      b.applicantEmail || 
      b.email || 
      (b as any).requesterEmail || 
      (b as any).targetUserEmail || 
      (b as any).mail_id || 
      ""
    ).toLowerCase().trim();

    const bUserId = b.userId || (b as any).requesterId || (b as any).$id;

    if (uEmail && bApplicantEmail === uEmail) return true;
    if (uId && bUserId === uId) return true;
    if (user.name && b.coordinator && b.coordinator.toLowerCase().trim() === user.name.toLowerCase().trim()) return true;

    return false;
  });

  const openBookings = userBookings.filter(
    (b) => b.stage !== "confirmed" && b.stage !== "rejected"
  );
  const confirmedBookings = userBookings.filter((b) => b.stage === "confirmed");
  const rejectedBookings = userBookings.filter((b) => b.stage === "rejected");

  const filteredBookings = userBookings.filter((b) => {
    if (tab === "open") return b.stage !== "confirmed" && b.stage !== "rejected";
    if (tab === "confirmed") return b.stage === "confirmed";
    if (tab === "rejected") return b.stage === "rejected";
    return true;
  });

  return (
    <AppShell>
      <PageTitle title="My Bookings" subtitle="Follow each request through every stage." />

      {ready && userBookings.length > 0 && (
        <div data-no-swipe="true" className="mb-4 sm:mb-6 flex overflow-x-auto whitespace-nowrap hide-scrollbar gap-2 rounded-2xl bg-muted/60 p-1.5 backdrop-blur border border-border/40">
          <button
            onClick={() => setTab("open")}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2 text-[0.88rem] font-medium transition-all",
              tab === "open"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Open Bookings
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[0.72rem]",
                tab === "open" ? "bg-primary-soft text-primary" : "bg-muted text-muted-foreground"
              )}
            >
              {openBookings.length}
            </span>
          </button>

          <button
            onClick={() => setTab("all")}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2 text-[0.88rem] font-medium transition-all",
              tab === "all"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            All Requests
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[0.72rem]",
                tab === "all" ? "bg-primary-soft text-primary" : "bg-muted text-muted-foreground"
              )}
            >
              {userBookings.length}
            </span>
          </button>

          <button
            onClick={() => setTab("confirmed")}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2 text-[0.88rem] font-medium transition-all",
              tab === "confirmed"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Confirmed
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[0.72rem]",
                tab === "confirmed" ? "bg-primary-soft text-primary" : "bg-muted text-muted-foreground"
              )}
            >
              {confirmedBookings.length}
            </span>
          </button>

          {rejectedBookings.length > 0 && (
            <button
              onClick={() => setTab("rejected")}
              className={cn(
                "flex items-center gap-2 rounded-xl px-4 py-2 text-[0.88rem] font-medium transition-all",
                tab === "rejected"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Rejected
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[0.72rem]",
                  tab === "rejected" ? "bg-red-100 text-red-700" : "bg-muted text-muted-foreground"
                )}
              >
                {rejectedBookings.length}
              </span>
            </button>
          )}
        </div>
      )}

      {!ready && <div className="shimmer h-40 rounded-2xl" />}

      {ready && bookings.length === 0 && (
        <div className="surface rise flex flex-col items-center gap-4 px-6 py-16 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary">
            <CalendarPlus className="size-6" />
          </span>
          <p className="text-[0.95rem] text-muted-foreground">You have no bookings yet.</p>
          <Link
            to="/auditoriums"
            className="press mt-2 inline-flex h-12 items-center rounded-xl bg-primary px-6 text-[0.9rem] font-medium text-primary-foreground"
          >
            Book an auditorium
          </Link>
        </div>
      )}

      {ready && bookings.length > 0 && filteredBookings.length === 0 && (
        <div className="surface flex flex-col items-center gap-3 px-6 py-12 text-center">
          <p className="text-[0.95rem] text-muted-foreground">
            No bookings found under "{tab === "open" ? "Open Bookings" : tab}".
          </p>
          <button
            onClick={() => setTab("all")}
            className="text-[0.85rem] font-medium text-primary hover:underline"
          >
            View all bookings
          </button>
        </div>
      )}

      <div className="space-y-5">
        {filteredBookings.map((b, i) => {
          const stageInfo = getStageInfo(b.stage);
          return (
            <div
              key={b.id}
              className="surface press rise group block p-6 hover:shadow-[var(--shadow-lift)] sm:p-7"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <h2 className="text-[1.2rem] font-bold text-foreground">
                      {getAuditorium(b.auditoriumId || (b as any).hallId)?.name ?? "Auditorium"}
                    </h2>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <p className="inline-flex items-center gap-2 text-[0.88rem] font-medium text-muted-foreground bg-muted/30 px-2 py-1 rounded-md w-fit">
                      <span>🗓️ {formatDate(b.fromDate || b.date, b.toDate)}</span>
                      <span className="text-border mx-1">|</span>
                      <span>⏰ {getDisplayTime(b)}</span>
                    </p>
                    <p className="text-[0.88rem] text-muted-foreground/80 mt-1">
                      Event Name: <span className="font-semibold text-foreground">{b.eventName || b.purpose}</span>
                    </p>
                  </div>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-3.5 py-1 text-[0.75rem] font-semibold shadow-xs",
                    stageInfo.bg
                  )}
                >
                  {stageInfo.label}
                </span>
              </div>

              {b.stage === "rejected" && (
                <div className="mb-6 rounded-2xl border border-red-200 bg-red-50/70 p-4 text-red-900 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
                  <div className="flex items-center gap-2 font-bold text-[0.88rem]">
                    <span className="grid size-6 place-items-center rounded-full bg-red-600 text-white text-xs">✕</span>
                    <span>Request Declined by Principal</span>
                  </div>
                  {b.rejectionCategory && (
                    <p className="mt-2 text-[0.82rem] font-semibold text-red-800 dark:text-red-300">
                      Category: {b.rejectionCategory}
                    </p>
                  )}
                  <p className="mt-1 text-[0.82rem] text-red-700 dark:text-red-400">
                    <strong>Explanation:</strong> {b.rejectionReason || "No additional explanation provided."}
                  </p>
                </div>
              )}

              <div className="mb-6">
                <Timeline stage={b.stage} institution={b.institution} />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
                <button
                  onClick={() => navigate({ to: "/bookings/$id", params: { id: b.id } })}
                  className="press inline-flex items-center gap-1.5 text-[0.88rem] font-semibold text-primary hover:underline"
                >
                  Open booking details
                  <ChevronRight className="size-4 transition-transform group-hover:translate-x-1" />
                </button>

                <div className="flex flex-wrap items-center gap-2">
                  {b.stage === "confirmed" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate({ to: "/bookings/$id/confirmed", params: { id: b.id } });
                      }}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-[0.82rem] font-medium text-white transition-all hover:bg-emerald-700 shadow-sm"
                    >
                      <CheckCircle2 className="size-3.5" />
                      View Official Confirmation Pass
                    </button>
                  )}

                  {b.stage === "pending_coordinator" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm("Are you sure you want to cancel this booking request?")) {
                          remove(b.id);
                        }
                      }}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[0.82rem] font-medium text-muted-foreground transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                    >
                      <Trash2 className="size-3.5" />
                      Cancel Request
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
