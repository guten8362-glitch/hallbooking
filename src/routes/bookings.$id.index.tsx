import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Download, FileCheck2, Trash2, AlertTriangle, ShieldCheck, CheckCircle2, Pencil, X, Save } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Timeline } from "@/components/Timeline";
import { Button, Row, Surface } from "@/components/ui-kit";
import { formatDate, getStageInfo, stageIndex, useBookings } from "@/lib/booking-store";
import { downloadApprovalLetter } from "@/lib/letter";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useAuth, isAdminUser } from "@/lib/auth";
import { updateBooking, createNotification } from "@/lib/appwrite/database";

export const Route = createFileRoute("/bookings/$id/")({
  head: () => ({
    meta: [
      { title: "Booking status — Central Auditorium Booking" },
      {
        name: "description",
        content: "See where your auditorium request stands and complete the next step.",
      },
      { property: "og:title", content: "Booking status" },
      { property: "og:description", content: "See where your auditorium request stands." },
    ],
  }),
  component: BookingDetail,
});

export function BookingDetail() {
  const { id } = Route.useParams();
  const { bookings, remove, ready, getAuditorium } = useBookings();
  const { user } = useAuth();
  const navigate = useNavigate();

  const booking = bookings.find((b) => b.id === id);

  const isAdmin = isAdminUser(user);
  const [isEditing, setIsEditing] = useState(false);
  const [editDate, setEditDate] = useState(booking?.date || "");
  const [editStartTime, setEditStartTime] = useState(booking?.startTime || "");
  const [editEndTime, setEditEndTime] = useState(booking?.endTime || "");
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveEdit = async () => {
    if (!booking) return;
    setIsSaving(true);
    try {
      await updateBooking(booking.id, {
        date: editDate,
        startTime: editStartTime,
        endTime: editEndTime
      });
      await createNotification({
        userId: booking.requesterId,
        title: "Booking Updated",
        message: `Sorry for the inconvenience. The admin has changed your booking (${booking.eventName || booking.id}) date/time to ${editDate} ${editStartTime} - ${editEndTime}.`,
        bookingId: booking.id,
        type: "info"
      });
      setIsEditing(false);
      // Let real-time subscription update the store
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  if (!ready) {
    return (
      <AppShell>
        <div className="shimmer h-64 rounded-2xl" />
      </AppShell>
    );
  }

  if (!booking) {
    return (
      <AppShell>
        <div className="surface flex flex-col items-center py-12 text-center">
          <p className="text-[1.05rem] font-semibold text-foreground">Booking not found</p>
          <p className="mt-1 text-[0.88rem] text-muted-foreground">
            The booking request with ID <span className="font-mono">{id}</span> does not exist or has been removed.
          </p>
          <Link
            to="/bookings"
            className="mt-6 inline-flex h-10 items-center rounded-xl bg-primary px-5 text-[0.88rem] font-medium text-primary-foreground"
          >
            Return to My Bookings
          </Link>
        </div>
      </AppShell>
    );
  }

  const stageInfo = getStageInfo(booking.stage);
  const idx = stageIndex(booking.stage);
  const aud = getAuditorium(booking.auditoriumId || (booking as any).hallId);

  const handleCancelBooking = () => {
    if (confirm("Are you sure you want to cancel and delete this booking request?")) {
      remove(booking.id);
      navigate({ to: "/bookings" });
    }
  };

  return (
    <AppShell>
      <header className="fade-up mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[0.8rem] font-semibold text-muted-foreground">
              {booking.id}
            </span>
            <span
              className={cn(
                "rounded-full border px-3 py-0.5 text-[0.72rem] font-semibold",
                stageInfo.bg
              )}
            >
              {stageInfo.label}
            </span>
          </div>
          <h1 className="mt-1 text-[1.7rem] font-semibold">{aud?.name ?? "Auditorium"}</h1>
          
          {!isEditing ? (
            <p className="mt-1 text-[0.9rem] text-muted-foreground flex items-center gap-2">
              {formatDate(booking.date)} · {booking.startTime} – {booking.endTime}
              {isAdmin && booking.stage !== "rejected" && (
                <button onClick={() => setIsEditing(true)} className="text-primary hover:underline flex items-center gap-1 text-[0.8rem]">
                  <Pencil className="size-3" /> Edit
                </button>
              )}
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap items-center gap-3 bg-muted/30 p-3 rounded-xl border border-border/50">
              <input 
                type="date" 
                value={editDate} 
                onChange={(e) => setEditDate(e.target.value)}
                className="rounded-md border border-border px-2 py-1 text-sm bg-background"
              />
              <input 
                type="time" 
                value={editStartTime} 
                onChange={(e) => setEditStartTime(e.target.value)}
                className="rounded-md border border-border px-2 py-1 text-sm bg-background"
              />
              <span className="text-muted-foreground">-</span>
              <input 
                type="time" 
                value={editEndTime} 
                onChange={(e) => setEditEndTime(e.target.value)}
                className="rounded-md border border-border px-2 py-1 text-sm bg-background"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveEdit} disabled={isSaving}>
                  {isSaving ? "Saving..." : <><Save className="size-3.5 mr-1" /> Save</>}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        {booking.stage === "pending_coordinator" && (
          <Button variant="ghost" onClick={handleCancelBooking} className="text-red-600 hover:bg-red-50 hover:text-red-700">
            <Trash2 className="size-4" /> Cancel Request
          </Button>
        )}
      </header>



      {booking.stage === "confirmed" && (
        <Surface className="mb-6 border-emerald-300/40 bg-emerald-500/10">
          <div className="flex items-start gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-600 text-white">
              <CheckCircle2 className="size-5" />
            </span>
            <div className="flex-1">
              <h2 className="text-[1.05rem] font-semibold">Booking Confirmed</h2>
              <p className="mt-1.5 text-[0.88rem] text-muted-foreground">
                Your auditorium booking is confirmed! Access your venue entry pass and confirmation document below.
              </p>
            </div>
          </div>
          <div className="mt-6">
            <Button onClick={() => navigate({ to: "/bookings/$id/confirmed", params: { id } })}>
              View Confirmation & QR Pass
            </Button>
          </div>
        </Surface>
      )}

      {booking.stage === "rejected" && (
        <Surface className="mb-6 border-red-300/40 bg-red-500/10">
          <div className="flex items-start gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-red-600 text-white">
              <AlertTriangle className="size-5" />
            </span>
            <div className="flex-1">
              <h2 className="text-[1.05rem] font-semibold text-red-700 dark:text-red-300">Request Declined</h2>
              <p className="mt-1.5 text-[0.88rem] text-muted-foreground">
                This auditorium request could not be approved at this time. You may submit a new request for a different date/time.
              </p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/auditoriums"
              className="press inline-flex h-11 whitespace-nowrap items-center justify-center rounded-xl bg-primary px-5 text-[0.9rem] font-medium text-primary-foreground flex-shrink-0"
            >
              Book Another Hall
            </Link>
            {!isAdmin && (
              <Button variant="ghost" onClick={handleCancelBooking} className="text-muted-foreground hover:text-destructive whitespace-nowrap flex-shrink-0">
                Remove Record
              </Button>
            )}
          </div>
        </Surface>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Surface delay={60}>
          <h2 className="mb-5 text-[1.05rem] font-semibold">Progress Tracker</h2>
          <Timeline stage={booking.stage} institution={booking.institution} />
        </Surface>

        <Surface delay={140}>
          <h2 className="mb-4 text-[1.05rem] font-semibold">Booking Details</h2>
          <Row label="Booking ID" value={booking.id} />
          <Row label="Institution" value={booking.institution} />
          <Row label="Department" value={booking.department} />
          <Row label="Event Name" value={booking.eventName} />
          <Row label="Purpose" value={booking.purpose} />
          <Row label="Expected Attendees" value={booking.participants} />
          <Row label="Chairs Required on Dais" value={`${(booking as any).chairs || booking.daisChairs || (booking as any).extra?.chairs || "5"} chairs`} />
          <Row label="Coordinator" value={booking.coordinator} />
          {booking.remarks && <Row label="Remarks" value={booking.remarks} />}
        </Surface>
      </div>

      {idx >= 0 && idx < 2 && (
        <p className="mt-8 text-center text-[0.85rem] text-muted-foreground">
          You will be notified as soon as the Authorised Coordinator reviews your request.
        </p>
      )}
    </AppShell>
  );
}
