import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button, Surface } from "@/components/ui-kit";

export const Route = createFileRoute("/bookings/$id/verification")({
  head: () => ({
    meta: [
      { title: "Document under verification — VenueX - Book My Space" },
      {
        name: "description",
        content: "Your signed approval letter is being verified by the coordinator's office.",
      },
      { property: "og:title", content: "Document under verification" },
      { property: "og:description", content: "Your signed letter is being verified." },
    ],
  }),
  component: Verification,
});

function Verification() {
  const navigate = useNavigate();

  return (
    <AppShell>
      <div className="mx-auto max-w-md py-8 text-center">
        <div className="relative mx-auto grid size-24 place-items-center">
          <span aria-hidden className="halo absolute inset-0 rounded-full bg-primary/15 blur-xl" />
          <span className="pop grid size-20 place-items-center rounded-3xl bg-primary-soft text-primary">
            <ShieldCheck className="size-9" strokeWidth={1.6} />
          </span>
        </div>

        <h1 className="fade-up mt-8 text-[1.6rem] font-semibold">Document under verification</h1>
        <p className="fade-up mt-3 text-[0.95rem] text-muted-foreground" style={{ animationDelay: "120ms" }}>
          The coordinator's office is checking your signed approval letter.
        </p>

        <Surface className="mt-8 text-left" delay={200}>
          <p className="text-[0.8rem] text-muted-foreground">Estimated review time</p>
          <p className="mt-1 text-[1.15rem] font-semibold">Within 24 hours</p>
          <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="shimmer h-full w-2/3 rounded-full" />
          </div>
        </Surface>

        <div className="mt-8">
          <Button onClick={() => navigate({ to: "/bookings" })}>Return to My Bookings</Button>
        </div>
      </div>
    </AppShell>
  );
}
