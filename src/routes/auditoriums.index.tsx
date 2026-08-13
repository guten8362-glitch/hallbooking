import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, MapPin, Users, MonitorPlay, Sparkles, Building2, ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageTitle } from "@/components/ui-kit";
import { fetchAuditoriums } from "@/lib/auditoriums";
import { useAuth } from "@/lib/auth";
import { ImageCarousel } from "@/components/ImageCarousel";

export const Route = createFileRoute("/auditoriums/")({
  loader: () => fetchAuditoriums(),
  head: () => ({
    meta: [
      { title: "Select an Auditorium — Central Hall Booking" },
      {
        name: "description",
        content:
          "Browse every shared campus venue — capacity, facilities and today's availability at a glance.",
      },
      { property: "og:title", content: "Select an Auditorium" },
      {
        property: "og:description",
        content: "Browse every shared campus venue and pick the right hall for your event.",
      },
    ],
  }),
  component: AuditoriumsIndex,
});

import { useEffect, useState } from "react";
import { useBookings } from "@/lib/booking-store";

export function AuditoriumsIndex() {
  const loaderAuditoriums = Route.useLoaderData();
  const { auditoriums: contextAuditoriums } = useBookings();
  const { user } = useAuth();

  const [auditoriums, setAuditoriums] = useState<any[]>(
    Array.isArray(loaderAuditoriums) && loaderAuditoriums.length > 0
      ? loaderAuditoriums
      : Array.isArray(contextAuditoriums)
      ? contextAuditoriums
      : []
  );

  useEffect(() => {
    if (Array.isArray(contextAuditoriums) && contextAuditoriums.length > 0) {
      setAuditoriums(contextAuditoriums);
    } else {
      fetchAuditoriums().then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setAuditoriums(data);
        }
      });
    }
  }, [contextAuditoriums]);

  const visibleAuditoriums = auditoriums.length > 0 ? auditoriums : (contextAuditoriums || []);

  return (
    <AppShell>
      <PageTitle
        eyebrow="Step 1 of 4"
        title="Select a Venue"
        subtitle="Choose a shared campus venue for your event."
      />

      <div className="space-y-4">
        {visibleAuditoriums.map((a, i) => {


          return (
            <Link
              key={a.id}
              to="/auditoriums/$id"
              params={{ id: a.id }}
              className="surface press rise group flex items-center gap-4 overflow-hidden p-3.5 hover:shadow-[var(--shadow-lift)] sm:gap-6 sm:p-5"
              style={{ animationDelay: `${i * 70}ms` }}
            >
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-muted sm:h-28 sm:w-32">
                  {a.image && (Array.isArray(a.image) ? a.image.length > 0 : true) ? (
                    <ImageCarousel 
                      images={a.image} 
                      className="group-hover:scale-105 transition-transform duration-700 ease-out" 
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-primary-soft text-primary">
                      <Building2 className="h-8 w-8" />
                    </div>
                  )}
                </div>

              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0 max-w-full">
                    <MapPin className="size-4 shrink-0 text-primary" />
                    <h3 className="text-[0.95rem] sm:text-[1.05rem] font-semibold text-foreground truncate min-w-0">
                      {a.name}
                    </h3>
                  </div>

                </div>
                <p className="flex items-center gap-1.5 text-[0.82rem] sm:text-[0.85rem] text-muted-foreground truncate">
                  <Users className="size-3.5 shrink-0" /> <span className="truncate">Capacity {a.capacity} · {a.tagline}</span>
                </p>
                <div className="pt-0.5">
                  <span className="inline-flex rounded-full bg-primary-soft px-2.5 py-0.5 text-[0.72rem] font-medium text-primary">
                    {a.availability}
                  </span>
                </div>
              </div>
              <ChevronRight className="mr-1 size-5 shrink-0 text-muted-foreground transition-transform duration-300 group-hover:translate-x-1 group-hover:text-primary" />
            </Link>
          );
        })}
      </div>
    </AppShell>
  );
}
