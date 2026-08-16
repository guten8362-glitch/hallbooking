import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { Check, MapPin, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button, Surface } from "@/components/ui-kit";
import { fetchAuditorium, type Auditorium } from "@/lib/auditoriums";
import { listBookings } from "@/lib/appwrite/database";
import { useBookings } from "@/lib/booking-store";
import { cn } from "@/lib/utils";
import { ImageCarousel } from "@/components/ImageCarousel";

export const Route = createFileRoute("/auditoriums/$id")({
  loader: async ({ params }) => {
    const auditorium = await fetchAuditorium(params.id);
    if (!auditorium) throw notFound();
    // Removed listBookings() to prevent navigation blocking and lag.
    return { auditorium, confirmedBookings: [] };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Venue unavailable" }, { name: "robots", content: "noindex" }] };
    }
    const a = loaderData.auditorium;
    const title = `${a.name} — VenueX - Book My Space`;
    const description = `${a.name}: capacity ${a.capacity}, ${a.facilities.join(", ").toLowerCase()}. Check availability and book.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: Details,
});

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

function Details() {
  const { auditorium, confirmedBookings } = Route.useLoaderData() as { auditorium: Auditorium, confirmedBookings: any[] };
  const navigate = useNavigate();
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const onScroll = () => setOffset(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const today = new Date();
  const days = Array.from({ length: 21 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });

  const { bookings: storeBookings } = useBookings();

  const allVenueBookings = useMemo(() => {
    const combinedMap = new Map<string, any>();
    
    (confirmedBookings || []).forEach(b => {
      if (b.status === "rejected" || b.stage === "rejected") return;
      const id = b.$id || `${b.eventName}-${b.eventDate}`;
      combinedMap.set(id, b);
    });

    (storeBookings || []).forEach(b => {
      if (b.stage === "rejected") return;
      const bHallId = (b.auditoriumId || b.hallId || "").toLowerCase();
      const bHallName = (b.auditoriumName || b.hallName || "").toLowerCase();
      const targetId = auditorium.id.toLowerCase();
      const targetName = auditorium.name.toLowerCase();
      if (bHallId === targetId || bHallId.includes(targetId) || bHallName.includes(targetName)) {
        const id = b.$id || `${b.eventName}-${b.fromDate || b.date}`;
        combinedMap.set(id, b);
      }
    });

    return Array.from(combinedMap.values());
  }, [confirmedBookings, storeBookings, auditorium.id, auditorium.name]);

  const bookedDaysMap = new Map<string, any>();
  allVenueBookings.forEach(b => {
    let from = b.fromDate || (b.eventDate ? b.eventDate.split('T')[0] : "");
    let to = b.toDate || from;
    let startTimeStr = "09:00";
    let endTimeStr = "17:00";
    try {
      const remarks = typeof b.remarks === "string" ? JSON.parse(b.remarks || "{}") : (b.remarks || {});
      if (remarks.fromDate) from = remarks.fromDate;
      if (remarks.toDate) to = remarks.toDate;
      if (remarks.startTimeStr) startTimeStr = remarks.startTimeStr;
      if (remarks.endTimeStr) endTimeStr = remarks.endTimeStr;
    } catch {}

    if (from && to) {
      const d = new Date(from);
      const endD = new Date(to);
      let safety = 0;
      while (d <= endD && safety < 60) {
        const dStr = d.toISOString().split('T')[0];
        bookedDaysMap.set(dStr, {
          eventName: b.eventName || b.eventTitle || "Booked Event",
          organizer: b.coordinatorName || b.applicantName || "Organizer",
          time: `${startTimeStr} - ${endTimeStr}`
        });
        d.setDate(d.getDate() + 1);
        safety++;
      }
    }
  });

  return (
    <AppShell>
      <div className="rise mb-8 h-64 overflow-hidden rounded-3xl bg-muted sm:h-96">
        {auditorium.image && (Array.isArray(auditorium.image) ? auditorium.image.length > 0 : true) && (
          <ImageCarousel
            images={auditorium.image}
            style={{ transform: `translateY(${Math.min(offset * 0.18, 60)}px) scale(1.12)` }}
          />
        )}
      </div>

      <header className="fade-up mb-8">
        <h1 className="text-[1.8rem] font-semibold sm:text-[2.2rem]">{auditorium.name}</h1>
        <p className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.9rem] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Users className="size-4 text-primary" /> Capacity {auditorium.capacity}
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin className="size-4 text-primary" /> {auditorium.location}
          </span>
        </p>
      </header>

      <div className="grid gap-5 sm:grid-cols-2">
        <Surface delay={60}>
          <h2 className="mb-4 text-[1.05rem] font-semibold">Facilities</h2>
          <ul className="space-y-3">
            {auditorium.facilities && auditorium.facilities.length > 0 ? (
              auditorium.facilities.map((f) => (
                <li key={f} className="flex items-center gap-3 text-[0.92rem]">
                  <span className="grid size-6 place-items-center rounded-full bg-primary-soft text-primary">
                    <Check className="size-3.5" />
                  </span>
                  {f}
                </li>
              ))
            ) : auditorium.tagline ? (
              auditorium.tagline.split(auditorium.tagline.includes(",") ? "," : " ").filter(Boolean).map((f, i) => (
                <li key={i} className="flex items-start gap-3 text-[0.92rem] leading-relaxed">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
                    <Check className="size-3.5" />
                  </span>
                  {f.trim()}
                </li>
              ))
            ) : (
              <li className="text-[0.92rem] text-muted-foreground italic">No facilities specified</li>
            )}
          </ul>
        </Surface>

        <Surface delay={140}>
          <h2 className="mb-1 text-[1.05rem] font-semibold">Availability</h2>
          <p className="mb-5 text-[0.82rem] text-muted-foreground">Next three weeks</p>
          <div className="grid grid-cols-7 gap-1.5 text-center">
            {DAYS.map((d, i) => (
              <span key={i} className="pb-1 text-[0.7rem] font-medium text-muted-foreground">
                {d}
              </span>
            ))}
            {days.map((d, i) => {
              const dStr = d.toISOString().split("T")[0];
              const booking = bookedDaysMap.get(dStr);
              return (
                <span
                  key={i}
                  title={booking ? `Booked for: ${booking.eventName}` : "Available"}
                  className={cn(
                    "grid aspect-square place-items-center rounded-lg text-[0.78rem] transition-colors cursor-default",
                    booking
                      ? "bg-red-500 text-white font-bold shadow-sm"
                      : "bg-primary-soft font-medium text-primary hover:bg-primary/20",
                  )}
                >
                  {d.getDate()}
                </span>
              );
            })}
          </div>
        </Surface>
      </div>

      <div className="mt-10 mb-8 flex justify-center sm:justify-start">
        <Button onClick={() => navigate({ to: "/book/$id", params: { id: auditorium.id } })}>
          Book This Auditorium
        </Button>
      </div>
    </AppShell>
  );
}
