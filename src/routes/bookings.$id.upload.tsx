import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { FileText, UploadCloud } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { AppShell } from "@/components/AppShell";
import { Button, PageTitle } from "@/components/ui-kit";
import { useBookings } from "@/lib/booking-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/bookings/$id/upload")({
  head: () => ({
    meta: [
      { title: "Upload signed letter — VenueX - Book My Space" },
      {
        name: "description",
        content: "Upload the signed approval letter as a PDF to move to final verification.",
      },
      { property: "og:title", content: "Upload signed letter" },
      { property: "og:description", content: "Upload your signed approval letter as a PDF." },
    ],
  }),
  component: UploadSigned,
});

function UploadSigned() {
  const { id } = Route.useParams();
  const { advance, bookings } = useBookings();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [over, setOver] = useState(false);

  const booking = bookings.find((b) => b.id === id);

  if (!booking) {
    return (
      <AppShell>
        <div className="surface flex flex-col items-center py-12 text-center">
          <p className="text-[1.05rem] font-semibold text-foreground">Booking not found</p>
          <p className="mt-1 text-[0.88rem] text-muted-foreground">
            The booking request does not exist or has been removed.
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

  if (booking.stage === "pending_super_admin") {
    return (
      <AppShell>
        <div className="surface mt-12 flex flex-col items-center py-12 text-center">
          <p className="text-[1.05rem] font-semibold text-foreground">File Already Uploaded</p>
          <p className="mt-1 text-[0.88rem] text-muted-foreground">
            You have already uploaded the signed PDF for this request.
          </p>
          <Link
            to="/bookings/$id"
            params={{ id }}
            className="mt-6 inline-flex h-10 items-center rounded-xl bg-primary px-5 text-[0.88rem] font-medium text-primary-foreground"
          >
            Go Back
          </Link>
        </div>
      </AppShell>
    );
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  };

  const submit = () => {
    if (!file) return;
    advance(id, "pending_super_admin", { signedFileName: file.name });
    navigate({ to: "/bookings/$id", params: { id } });
  };

  return (
    <AppShell>
      <PageTitle title="Upload signed letter" subtitle="Attach the signed approval letter as a PDF." />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "press flex cursor-pointer flex-col items-center gap-4 rounded-3xl border-2 border-dashed px-6 py-20 text-center transition-all",
          over ? "border-primary bg-primary-soft" : "border-border bg-card hover:border-primary/50",
        )}
      >
        <span className="grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary">
          {file ? <FileText className="size-6" /> : <UploadCloud className="size-6" />}
        </span>
        <p className="text-[0.95rem] font-medium">
          {file ? file.name : "Drag and drop your signed PDF here"}
        </p>
        <p className="text-[0.85rem] text-muted-foreground">
          {file ? "Tap to choose a different file" : "or choose a file from your device"}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </div>

      <div className="mt-8">
        <Button disabled={!file} onClick={submit}>
          Submit
        </Button>
      </div>
    </AppShell>
  );
}
