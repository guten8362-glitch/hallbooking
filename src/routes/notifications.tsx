import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Bell, CheckCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageTitle, Surface } from "@/components/ui-kit";
import { getStageInfo, useBookings } from "@/lib/booking-store";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — Central Hall Booking" },
      {
        name: "description",
        content: "Updates on approvals, verifications and confirmations for your bookings.",
      },
      { property: "og:title", content: "Notifications" },
      { property: "og:description", content: "Updates on your hall bookings." },
    ],
  }),
  component: Notifications,
});

import { listNotifications } from "@/lib/appwrite/database";
import { useAuth } from "@/lib/auth";

function Notifications() {
  const { bookings, ready, getAuditorium } = useBookings();
  const { user } = useAuth();
  const [clearedAlerts, setClearedAlerts] = useState<string[]>([]);
  const [dbNotifications, setDbNotifications] = useState<any[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("cleared_alerts");
    if (saved) {
      try {
        setClearedAlerts(JSON.parse(saved));
      } catch (e) { }
    }

    listNotifications().then((docs) => {
      if (Array.isArray(docs)) {
        setDbNotifications(docs);
      }
    }).catch(() => {});
  }, []);

  const activeAlerts = bookings.filter((b) => !clearedAlerts.includes(`${b.id}-${b.stage}`));

  const handleClearAll = () => {
    const newCleared = [
      ...clearedAlerts,
      ...activeAlerts.map(b => `${b.id}-${b.stage}`),
      ...dbNotifications.map(n => n.$id)
    ];
    setClearedAlerts(newCleared);
    localStorage.setItem("cleared_alerts", JSON.stringify(newCleared));
  };

  const filteredDbNotifs = dbNotifications.filter((n) => !clearedAlerts.includes(n.$id));

  const totalNotifCount = activeAlerts.length + filteredDbNotifs.length;

  return (
    <AppShell>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <PageTitle title="Notifications" subtitle="Updates on your hall requests (Synced with live database)." />
        
        {totalNotifCount > 0 && (
          <button 
            onClick={handleClearAll}
            className="flex items-center gap-2 rounded-xl bg-muted/60 px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-muted hover:text-foreground transition-all shadow-sm"
          >
            <CheckCheck className="size-4" /> Clear All Alerts
          </button>
        )}
      </div>

      {ready && totalNotifCount === 0 && (
        <Surface className="flex flex-col items-center gap-4 py-16 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary">
            <Bell className="size-6" />
          </span>
          <p className="text-[0.95rem] text-muted-foreground">Nothing to catch up on.</p>
        </Surface>
      )}

      <div className="space-y-3">
        {filteredDbNotifs.map((n, i) => (
          <Surface key={n.$id || i} className="p-5 border-l-4 border-l-primary" delay={i * 40}>
            <div className="flex items-start gap-4">
              <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                <Bell className="size-4" />
              </span>
              <div>
                <p className="text-[0.93rem] font-bold text-foreground">
                  {n.title || "Booking Notification"}
                </p>
                <p className="mt-1 text-[0.85rem] font-medium text-foreground/80">
                  {n.message}
                </p>
                <p className="mt-1.5 text-[0.78rem] text-muted-foreground">
                  {n.$createdAt ? new Date(n.$createdAt).toLocaleString("en-GB") : "Recently"}
                </p>
              </div>
            </div>
          </Surface>
        ))}

        {activeAlerts.map((b, i) => (
          <Surface key={`${b.id}-${b.stage}`} className="p-5" delay={(filteredDbNotifs.length + i) * 40}>
            <div className="flex items-start gap-4">
              <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                <Bell className="size-4" />
              </span>
              <div>
                <p className="text-[0.93rem] font-medium">
                  {getStageInfo(b.stage).label} · {(b as any).auditoriumName || getAuditorium(b.auditoriumId)?.name || "Unknown Venue"}
                </p>
                <p className="mt-1 text-[0.82rem] text-muted-foreground">
                  Request ID: {b.id} · {b.createdAt ? new Date(b.createdAt).toLocaleString("en-GB") : "Recent"}
                </p>
              </div>
            </div>
          </Surface>
        ))}
      </div>
    </AppShell>
  );
}
