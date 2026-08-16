import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button, PageTitle, Row, Surface } from "@/components/ui-kit";
import { formatDate, useBookings } from "@/lib/booking-store";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/review")({
  head: () => ({
    meta: [
      { title: "Review your booking — VenueX - Book My Space" },
      {
        name: "description",
        content: "Check your event details once before sending the request to the coordinator.",
      },
      { property: "og:title", content: "Review your booking" },
      { property: "og:description", content: "Check your event details before submitting." },
    ],
  }),
  component: Review,
});

export function Review() {
  const { user } = useAuth();
  const { draft, submitDraft, ready, getAuditorium } = useBookings();
  const navigate = useNavigate();
  const auditorium = getAuditorium(draft.auditoriumId);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (ready && !draft.auditoriumId) navigate({ to: "/auditoriums" });
  }, [ready, draft.auditoriumId, navigate]);

  const submit = async () => {
    setError("");
    setSubmitting(true);
    try {
      const booking = await submitDraft(user?.role, user?.team, undefined, user?.$id);
      navigate({ to: "/submitted/$id", params: { id: booking.id } });
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to submit booking request. Please check if the hall is available.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      <PageTitle
        eyebrow="Step 3 of 4"
        title="Review your booking"
        subtitle="Please confirm everything looks right before submitting to the Authorised Coordinator."
      />

      <Surface>
        <Row label="Auditorium" value={auditorium?.name ?? "Auditorium"} />
        <Row label="Institution / College" value={draft.institution || "MVIT"} />
        <Row label="Department" value={draft.department} />
        <Row label="Authorised Coordinator" value={draft.coordinator} />
        <Row label="Event Name" value={draft.eventName} />
        <Row label="Purpose" value={draft.purpose} />
        <Row label="Event Date" value={formatDate(draft.date)} />
        <Row
          label="Time Slot"
          value={draft.startTime ? `${draft.startTime} – ${draft.endTime}` : "—"}
        />
        <Row label="Expected Attendees" value={draft.participants} />
        {draft.daisChairs && <Row label="Chairs Required on Dais" value={draft.daisChairs} />}
        {draft.remarks && <Row label="Remarks" value={draft.remarks} />}
      </Surface>

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-[0.88rem] font-medium text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button
          variant="ghost"
          disabled={submitting}
          onClick={() => navigate({ to: "/book/$id", params: { id: draft.auditoriumId || "av-room" } })}
        >
          Back to Edit
        </Button>
        <Button disabled={submitting} onClick={submit}>
          {submitting ? "Submitting..." : "Submit Booking Application"}
        </Button>
      </div>
    </AppShell>
  );
}
