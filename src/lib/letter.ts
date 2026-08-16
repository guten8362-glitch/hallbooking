import { formatDate, type Booking } from "./booking-store";
import { buildPdf, downloadBlob } from "./pdf";
import type { Auditorium } from "./auditoriums";

export function downloadApprovalLetter(b: Booking, aud?: Auditorium) {
  downloadBlob(
    buildPdf([
      { text: "VenueX - Book My Space", size: 16, bold: true, gap: 0 },
      { text: "Approval Letter", size: 12, gap: 22 },
      { text: `Reference: ${b.id}`, gap: 34 },
      { text: `Auditorium: ${aud?.name ?? "—"}` },
      { text: `Institution: ${b.institution}` },
      { text: `Department: ${b.department}` },
      { text: `Coordinator: ${b.coordinator}` },
      { text: `Event: ${b.eventName}` },
      { text: `Purpose: ${b.purpose}` },
      { text: `Date: ${formatDate(b.date)}` },
      { text: `Time: ${b.startTime} - ${b.endTime}` },
      { text: `Expected Participants: ${b.participants}` },
      {
        text: "The above request has been approved by the Authorised Coordinator.",
        gap: 40,
      },
      { text: "Please sign this letter and upload the signed copy for final verification." },
      { text: "Authorised Coordinator", bold: true, gap: 60 },
      { text: "Signature: ______________________", gap: 40 },
    ]),
    `approval-letter-${b.id}.pdf`,
  );
}

export function downloadConfirmation(b: Booking, aud?: Auditorium) {
  downloadBlob(
    buildPdf([
      { text: "BOOKING CONFIRMED", size: 16, bold: true, gap: 0 },
      { text: `Booking ID: ${b.id}`, gap: 30 },
      { text: `Auditorium: ${aud?.name ?? "—"}` },
      { text: `Date: ${formatDate(b.date)}` },
      { text: `Time: ${b.startTime} - ${b.endTime}` },
      { text: `Institution: ${b.institution}` },
      { text: `Coordinator: ${b.coordinator}` },
      { text: "Present this confirmation at the venue office.", gap: 40 },
    ]),
    `booking-confirmation-${b.id}.pdf`,
  );
}
