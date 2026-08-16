import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useBookings, getApprovalWorkflow, getStageInfo } from "@/lib/booking-store";
import { CheckCircle2, Copy, Sparkles, ArrowRight } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/submitted/$id")({
  head: () => ({
    meta: [
      { title: "Booking request submitted — VenueX - Book My Space" },
      {
        name: "description",
        content: "Your auditorium request has been submitted successfully for approval.",
      },
      { property: "og:title", content: "Booking request submitted" },
      {
        property: "og:description",
        content: "Your auditorium request has been sent through the approval workflow.",
      },
    ],
  }),
  component: Submitted,
});

function Submitted() {
  const { id } = Route.useParams();
  const { bookings, getAuditorium } = useBookings();
  const booking = bookings.find((b) => b.id === id);
  const [copied, setCopied] = useState(false);

  const workflow = getApprovalWorkflow(booking?.institution || "MVIT");

  const copyId = () => {
    if (!id) return;
    navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-lg py-6 text-center">
        {/* Animated Pop Checkmark */}
        <div className="relative mx-auto grid size-24 place-items-center">
          <span aria-hidden className="halo absolute inset-0 rounded-full bg-emerald-500/20 blur-xl" />
          <svg viewBox="0 0 100 100" className="pop size-24">
            <circle cx="50" cy="50" r="46" className="fill-emerald-100 dark:fill-emerald-950/40" />
            <path
              d="M30 52 L44 66 L71 37"
              fill="none"
              stroke="#059669"
              strokeWidth="7"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="80"
              strokeDashoffset="80"
              style={{ animation: "draw-tick 0.7s 0.35s cubic-bezier(0.22,1,0.36,1) forwards" }}
            />
          </svg>
        </div>

        {/* Required Submission Message */}
        <h1 className="fade-up mt-6 text-[1.6rem] font-bold text-foreground" style={{ animationDelay: "200ms" }}>
          Your booking request has been submitted successfully.
        </h1>
        
        <p
          className="fade-up mt-2 text-[0.92rem] font-medium text-muted-foreground"
          style={{ animationDelay: "300ms" }}
        >
          Your request will be processed through the approval workflow.
        </p>

        {/* Booking ID Reference Card */}
        <div 
          className="fade-up mt-6 rounded-2xl border border-primary/20 bg-primary-soft/40 p-4 text-center shadow-xs"
          style={{ animationDelay: "380ms" }}
        >
          <span className="text-[0.72rem] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
            Booking ID (Keep for Future Reference)
          </span>
          <div className="flex items-center justify-center gap-2">
            <span className="font-mono text-2xl font-extrabold text-primary">{id}</span>
            <button
              type="button"
              onClick={copyId}
              className="rounded-xl border border-primary/30 p-2 text-primary hover:bg-primary hover:text-white transition-all"
              title="Copy Booking ID"
            >
              {copied ? <CheckCircle2 className="size-4" /> : <Copy className="size-4" />}
            </button>
          </div>
          {copied && <span className="text-[0.72rem] text-emerald-600 font-semibold mt-1 block">Copied to clipboard!</span>}
        </div>

        {/* Approval Workflow Pipeline Steps */}
        <div 
          className="fade-up mt-6 text-left rounded-2xl border border-border bg-card p-5 shadow-xs"
          style={{ animationDelay: "440ms" }}
        >
          <h3 className="text-[0.88rem] font-bold text-foreground mb-3 flex items-center gap-1.5">
            <Sparkles className="size-4 text-primary" /> Multi-Stage Approval Workflow
          </h3>
          <div className="space-y-2.5">
            {workflow.map((step, idx) => (
              <div key={step.key} className="flex items-center gap-3 text-[0.82rem]">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-primary font-bold text-xs">
                  {idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground">{step.label}</p>
                  <p className="text-[0.75rem] text-muted-foreground">{step.approver}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Link
          to="/bookings"
          className="press fade-up mt-8 flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-[0.95rem] font-semibold text-primary-foreground shadow-md hover:brightness-110"
          style={{ animationDelay: "500ms" }}
        >
          <span>Track Approval Progress in My Bookings</span>
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </AppShell>
  );
}
