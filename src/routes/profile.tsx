import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { PageTitle, Row, Surface } from "@/components/ui-kit";
import { useBookings } from "@/lib/booking-store";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Central Hall Booking" },
      {
        name: "description",
        content: "Your coordinator profile and booking activity on the campus booking system.",
      },
      { property: "og:title", content: "Profile" },
      { property: "og:description", content: "Your coordinator profile and booking activity." },
    ],
  }),
  component: Profile,
});

function Profile() {
  const { bookings, getAuditorium } = useBookings();
  const { user } = useAuth();
  const name = user?.name || "Campus User";
  const institution = user?.institution || "—";
  const navigate = useNavigate();

  // If user is an organizer, they should use the dedicated organizer portal 
  // which has the images, reminders, and full details modal they need.
  useEffect(() => {
    if (user?.role === "organizer") {
      navigate({ to: "/organizer" });
    }
  }, [user, navigate]);

  const isAdminOrCoordinator = user?.role === "admin" || user?.role === "super_admin" || user?.role === "coordinator";

  const userBookings = bookings.filter((b) => {
    if (!user) return false;
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

  // Admin & Coordinator stats (filtered by purview if coordinator)
  const relevantBookings = bookings.filter((b) => {
    if (!user) return false;
    if (user.role === "admin" || user.role === "super_admin") return true;
    if (user.role === "coordinator") {
      const userInst = (user.institution || "").toLowerCase().trim();
      const bInst = (b.institution || "").toLowerCase().trim();
      return !userInst || !bInst || bInst === userInst;
    }
    return true;
  });

  const totalRequestsCount = relevantBookings.length;
  const confirmedRequestsCount = relevantBookings.filter((b) => b.stage === "confirmed").length;
  const declinedRequestsCount = relevantBookings.filter((b) => b.stage === "rejected").length;

  const confirmedCount = userBookings.filter((b) => b.stage === "confirmed").length;
  const pendingCount = userBookings.filter((b) => b.stage !== "confirmed" && b.stage !== "rejected").length;

  const getProfileRoleDisplay = () => {
    if (!user) return "User";
    const inst = (user.institution || "MVIT").trim();

    if (user.role === "admin" || user.role === "super_admin") {
      return "MVIT Principal";
    }
    if (user.role === "coordinator") {
      return `${inst} Principal`;
    }
    if (user.role === "organizer") {
      return `${inst || "MVIT"} Organiser`;
    }
    return `${inst} User`;
  };

  const roleDisplay = getProfileRoleDisplay();
  const displayList = isAdminOrCoordinator ? relevantBookings : userBookings;

  return (
    <AppShell>
      <PageTitle title="Profile" />

      <Surface className="space-y-4">
        <div className="flex items-center gap-4 border-b border-border/50 pb-4">
          <span className="grid size-14 place-items-center rounded-2xl bg-primary text-[1.1rem] font-semibold text-primary-foreground">
            {name.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <p className="text-[1.05rem] font-semibold">{name}</p>
            <p className="text-[0.85rem] text-muted-foreground">{roleDisplay}</p>
            {user?.email && <p className="text-[0.78rem] text-muted-foreground/80">{user.email}</p>}
          </div>
        </div>
        <Row label="Institution" value={institution} />

        {isAdminOrCoordinator ? (
          <>
            <Row label="Total Requests" value={totalRequestsCount} />
            <Row label="Confirmed Requests" value={confirmedRequestsCount} />
            <Row label="Declined Requests" value={declinedRequestsCount} />
          </>
        ) : (
          <>
            <Row label="My Total Bookings" value={userBookings.length} />
            <Row label="Confirmed Bookings" value={confirmedCount} />
            <Row label="Pending Approvals" value={pendingCount} />
          </>
        )}
      </Surface>

      {/* Activity List */}
      {displayList.length > 0 && (
        <div className="mt-6 space-y-3">
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider px-1">
            {isAdminOrCoordinator ? "Recent Campus Requests" : "Your Personal Bookings"}
          </h3>
          <div className="space-y-2.5">
            {displayList.slice(0, 10).map((b) => {
              const aud = getAuditorium(b.auditoriumId);
              return (
                <div key={b.id} className="surface p-4 rounded-xl flex items-center justify-between gap-3">
                  <div>
                    <h4 className="font-semibold text-sm">{b.eventName || "Auditorium Request"}</h4>
                    <p className="text-xs text-muted-foreground">
                      {(b as any).auditoriumName || aud?.name || "Unknown Venue"} • {b.date || "N/A"} • {b.institution || "MVIT"}
                    </p>
                  </div>
                  <span className={`px-2.5 py-1 text-xs font-semibold rounded-full capitalize ${
                    b.stage === 'confirmed' 
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : b.stage === 'rejected'
                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                  }`}>
                    {b.stage === 'rejected' ? 'Declined' : b.stage.replace('_', ' ')}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </AppShell>
  );
}
