import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { AppShell } from "@/components/AppShell";
import { Button, Row, Surface } from "@/components/ui-kit";
import { formatDate, useBookings } from "@/lib/booking-store";
import { ConfirmationLetter } from "@/components/ConfirmationLetter";
import { useRef } from "react";

export const Route = createFileRoute("/bookings/$id/confirmed")({
  head: () => ({
    meta: [
      { title: "Booking confirmed — Central Hall Booking" },
      {
        name: "description",
        content: "Your hall booking is confirmed. Download the confirmation and QR pass.",
      },
      { property: "og:title", content: "Booking confirmed" },
      { property: "og:description", content: "Your hall booking is confirmed." },
    ],
  }),
  component: Confirmed,
});

function Confirmed() {
  const { id } = Route.useParams();
  const { bookings, ready, getAuditorium } = useBookings();
  const navigate = useNavigate();
  const booking = bookings.find((b) => b.id === id);
  const [qr, setQr] = useState("");
  const letterRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  useEffect(() => {
    if (!booking) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:8080";
    const hallName = getAuditorium(booking.auditoriumId || (booking as any).hallId)?.name || "Auditorium";
    const verificationPayload = `${origin}/bookings/${booking.id}/confirmed?id=${booking.id}&hall=${encodeURIComponent(hallName)}&status=CONFIRMED_BY_PRINCIPAL&action=print`;

    QRCode.toDataURL(verificationPayload, {
      margin: 1,
      width: 320,
      color: { dark: "#059669", light: "#ffffff" },
    }).then(setQr);
  }, [booking, getAuditorium]);

  // Auto-print if opened via QR code
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.search.includes("action=print")) {
      const timer = setTimeout(() => {
        window.print();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, []);

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
        <p className="text-[0.95rem] text-muted-foreground">This booking could not be found.</p>
        <Link to="/bookings" className="mt-4 inline-block text-[0.9rem] font-medium text-primary">
          Back to My Bookings
        </Link>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <style>
        {`
          @media print {
            body * {
              visibility: hidden;
            }
            #printable-letter, #printable-letter * {
              visibility: visible;
            }
            #printable-letter {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              margin: 0 !important;
              padding: 0 !important;
              border: none !important;
              box-shadow: none !important;
            }
            @page {
              margin: 0;
            }
          }
        `}
      </style>
      <div className="mx-auto max-w-lg text-center">
        <svg viewBox="0 0 100 100" className="pop mx-auto size-24">
          <circle cx="50" cy="50" r="46" className="fill-primary-soft" />
          <path
            d="M30 52 L44 66 L71 37"
            fill="none"
            stroke="var(--primary)"
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="80"
            strokeDashoffset="80"
            style={{ animation: "draw-tick 0.7s 0.3s cubic-bezier(0.22,1,0.36,1) forwards" }}
          />
        </svg>

        <h1 className="fade-up mt-7 text-[1.7rem] font-semibold">Booking Confirmed</h1>

        <Surface className="mt-8 text-left" delay={160}>
          <Row label="Booking ID" value={booking.id} />
          <Row label="Auditorium" value={getAuditorium(booking.auditoriumId || (booking as any).hallId)?.name} />
          <Row label="Date" value={formatDate(booking.date)} />
          <Row label="Time" value={`${booking.startTime} – ${booking.endTime}`} />
          {qr && (
            <div className="flex flex-col items-center pt-6 border-t border-border/60 mt-4">
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-[0.78rem] font-bold text-emerald-600 dark:text-emerald-400">
                <span className="grid size-4 place-items-center rounded-full bg-emerald-600 text-white text-[0.65rem]">✓</span>
                Valid Official QR Pass
              </div>
              <a href={qr} download={`qr-pass-${booking.id}.png`} className="p-3 bg-white rounded-2xl shadow-md border border-slate-200 block hover:shadow-lg transition-shadow" title="Click to download QR code">
                <img src={qr} alt="Booking QR code" width={170} height={170} className="rounded-lg" />
              </a>
              <p className="mt-3 text-[0.82rem] font-medium text-foreground">
                Scan or Click to download QR Pass
              </p>
              <p className="mt-0.5 text-[0.72rem] text-muted-foreground">
                Issued & Authenticated by MVIT Principal Office
              </p>
            </div>
          )}
        </Surface>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row justify-center print:hidden">
          <Button variant="ghost" onClick={() => navigate({ to: "/bookings/$id", params: { id } })}>
            View Booking Status
          </Button>
          <Button onClick={handlePrint}>
            <Download className="size-4" /> Print / Save Confirmation Letter
          </Button>
        </div>

        <div className="mt-12 overflow-x-auto rounded-xl border border-border shadow-sm print:block print:border-none print:shadow-none">
          <div className="min-w-[800px] print:min-w-0">
            <ConfirmationLetter booking={booking} auditorium={getAuditorium(booking.auditoriumId || (booking as any).hallId)} ref={letterRef} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
