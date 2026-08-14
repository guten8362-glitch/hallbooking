import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, Bell, CalendarCheck, CalendarDays, Home, LogOut, ShieldCheck, User, Building2, ShieldAlert } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useAuth, isCoordinatorUser, isSuperAdminUser } from "@/lib/auth";
import { subscribeToNotifications } from "@/lib/appwrite/realtime";
import { WelcomeSplashModal } from "@/components/WelcomeSplashModal";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { NotificationBanner } from "@/components/NotificationBanner";

const navItems = [
  { to: "/auditoriums", label: "Book Venue", icon: Building2 },
  { to: "/bookings", label: "My Bookings", icon: CalendarCheck },
  { to: "/coordinator", label: "Coordinator", icon: ShieldCheck, adminOnly: true },
  { to: "/admin", label: "Admin Panel", icon: ShieldCheck, adminOnly: true },
  { to: "/super-admin", label: "Super Admin", icon: ShieldAlert, superAdminOnly: true },
  { to: "/organizer", label: "Confirmed Venues", icon: CalendarCheck, adminOnly: true },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/profile", label: "Profile", icon: User },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [hovered, setHovered] = useState<string | null>(null);
  const { user, realUser, isImpersonating, ready } = useAuth();
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);

  // Swipe gesture state for 1:1 tab switching
  const [touchStart, setTouchStart] = useState<{ x: number; y: number; time: number } | null>(null);
  const [touchDeltaX, setTouchDeltaX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const prevIndexRef = useRef<number>(-1);
  const [slideAnimClass, setSlideAnimClass] = useState("animate-fade-in");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const isPublicRoute = pathname === "/login" || pathname === "/" || pathname.endsWith("/confirmed");
    if (ready && !user && !isPublicRoute) {
      navigate({ to: "/login" });
    }
  }, [user, ready, pathname, navigate]);

  useEffect(() => {
    if (!user || !mounted) return;

    let unsubscribe = () => {};
    try {
      unsubscribe = subscribeToNotifications((response) => {
        if (!response || !response.events) return;
        if (response.events.includes('databases.*.collections.*.documents.*.create')) {
          const payload = response.payload as any;
          if (payload.userId && payload.userId !== user.$id) return;
          if (payload.targetUserEmail && payload.targetUserEmail !== user.email) return;

          console.log("[IN-APP NOTIFICATION RECEIVED]", payload.title || payload.message);

          if ("Notification" in window) {
            if (Notification.permission === "granted") {
              try {
                new Notification(payload.title || "New Notification", {
                  body: payload.message || "",
                  icon: "/logo192.png",
                });
              } catch (e) {
                console.warn("Native Notification failed", e);
              }
            } else if (Notification.permission !== "denied") {
              Notification.requestPermission().then(p => {
                if (p === "granted") {
                  try {
                    new Notification(payload.title || "New Notification", {
                      body: payload.message || "",
                      icon: "/logo192.png",
                    });
                  } catch (e) {
                    console.warn("Native Notification failed", e);
                  }
                }
              });
            }
          }
        }
      });
    } catch (err) {
      console.warn("Notifications realtime error:", err);
    }

    return () => {
      if (typeof unsubscribe === "function") {
        try {
          unsubscribe();
        } catch {
          /* ignore */
        }
      }
    };
  }, [user, mounted]);

  const visibleNavItems = useMemo(() => {
    return navItems.filter((i) => {
      if (i.superAdminOnly) return isSuperAdminUser(realUser);

      const isCoordinatorOrAdmin = isCoordinatorUser(user) || user?.role === "admin";
      const isOrganizer = user?.role === "organizer";

      if (isOrganizer) {
        if (i.to === "/organizer" || i.to === "/profile" || i.to === "/calendar") return true;
        return false;
      } else if (isCoordinatorOrAdmin) {
        if (i.to === "/bookings" || i.to === "/auditoriums" || i.to === "/organizer") return false;
        if (i.to === "/coordinator" && user?.role === "admin") return false;
        if (i.to === "/coordinator" || i.to === "/profile" || i.to === "/calendar") return true;
        if ((user?.role === "admin" || user?.role === "super_admin") && i.to === "/admin") return true;
        return false;
      } else {
        if (i.adminOnly || i.to === "/coordinator" || i.to === "/organizer") return false;
        return true;
      }
    });
  }, [user, realUser]);

  const getTabPath = (path: string) => {
    if (path.startsWith("/book/") || path.startsWith("/review")) return "/auditoriums";
    if (path.startsWith("/submitted/")) return "/bookings";
    return path;
  };

  const activeIdx = useMemo(() => {
    const currentTabPath = getTabPath(pathname);
    return visibleNavItems.findIndex((item) => currentTabPath.startsWith(item.to));
  }, [pathname, visibleNavItems]);

  useEffect(() => {
    if (activeIdx !== -1 && prevIndexRef.current !== -1 && activeIdx !== prevIndexRef.current) {
      if (activeIdx > prevIndexRef.current) {
        setSlideAnimClass("animate-slide-in-right");
      } else {
        setSlideAnimClass("animate-slide-in-left");
      }
    }
    if (activeIdx !== -1) {
      prevIndexRef.current = activeIdx;
    }
  }, [activeIdx]);

  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement | null;
    if (target && target.closest('button, a, input, select, textarea, [role="tablist"], [data-no-swipe="true"], .overflow-x-auto, .hide-scrollbar')) {
      setTouchStart(null);
      return;
    }
    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY, time: Date.now() });
    setTouchDeltaX(0);
    setIsDragging(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStart) return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchStart.x;
    const dy = touch.clientY - touchStart.y;

    if (Math.abs(dx) > Math.abs(dy) * 1.1 && Math.abs(dx) > 5) {
      setTouchDeltaX(dx);
      setIsDragging(true);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart) return;
    
    const touch = e.changedTouches[0];
    const finalDx = touch.clientX - touchStart.x;
    const finalDy = touch.clientY - touchStart.y;
    const duration = Date.now() - touchStart.time;
    const absDx = Math.abs(finalDx);
    const absDy = Math.abs(finalDy);
    const velocity = absDx / Math.max(duration, 1);

    if (absDx > absDy * 1.1 && (absDx >= 30 || velocity > 0.2)) {
      const currentTabPath = getTabPath(pathname);
      const currentIdx = visibleNavItems.findIndex((item) => currentTabPath.startsWith(item.to));

      if (currentIdx !== -1) {
        if (finalDx < 0 && currentIdx < visibleNavItems.length - 1) {
          // Swiped LEFT -> Go to NEXT (Right) Tab
          navigate({ to: visibleNavItems[currentIdx + 1].to });
        } else if (finalDx > 0 && currentIdx > 0) {
          // Swiped RIGHT -> Go to PREVIOUS (Left) Tab
          navigate({ to: visibleNavItems[currentIdx - 1].to });
        }
      }
    }

    setTouchStart(null);
    setTouchDeltaX(0);
    setIsDragging(false);
  };

  const showUserUI = mounted && user;

  return (
    <div className={cn("min-h-screen overflow-x-hidden", pathname === "/login" && "h-[100dvh] overflow-hidden flex flex-col justify-center")}>
      {/* Impersonation Banner at absolute top */}
      <ImpersonationBanner />

      {/* 4-Second Post-Login Blurred Background Splash Popup */}
      {showUserUI && pathname !== "/login" && <WelcomeSplashModal />}

      {/* Top Header Bar: Top Left Back Navigation & Top Right Logo */}
      {showUserUI && pathname !== "/login" && (
        <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/80 backdrop-blur-md print:hidden">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
            {/* Top Left Back Button */}
            <button
              type="button"
              onClick={() => window.history.back()}
              className="press group inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-1.5 text-[0.82rem] font-semibold text-foreground shadow-xs transition-all hover:bg-muted hover:border-primary/40 hover:shadow-sm"
              title="Go back to previous page"
            >
              <ArrowLeft className="h-4 w-4 text-primary transition-transform group-hover:-translate-x-1" />
              <span>Back</span>
            </button>

            {/* Top Right Logo & Title */}
            <div className="flex items-center gap-2.5">
              <span className="text-[0.88rem] font-bold text-foreground tracking-tight hidden sm:inline">
                Central Hall Booking
              </span>
              <img
                src="/logos/logo4.jpg"
                alt="MVIT Logo"
                className="h-8 w-8 rounded-lg object-contain border border-border/60 shadow-2xs"
              />
            </div>
          </div>
        </header>
      )}

      <main
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        key={pathname}
        className={cn(
          "mx-auto w-full touch-pan-y",
          isDragging ? "" : slideAnimClass,
          pathname === "/login" ? "max-w-none w-full px-0 flex-1 flex flex-col justify-center py-0" : "max-w-5xl px-4 sm:px-6 pt-6 sm:pt-10",
          showUserUI ? "pb-36 sm:pb-44" : ""
        )}
        style={{
          transform: isDragging && touchDeltaX ? `translate3d(${touchDeltaX * 0.75}px, 0px, 0px)` : "none",
          transition: isDragging ? "none" : "transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)",
          willChange: "transform",
        }}
      >
        <NotificationBanner />
        {children}
      </main>

      {showUserUI && (
        <nav
          className="fixed bottom-3 sm:bottom-6 left-1/2 z-50 -translate-x-1/2 w-[95%] max-w-lg sm:w-auto print:hidden"
          onMouseLeave={() => setHovered(null)}
        >
          <div className="flex items-center justify-between sm:justify-start gap-1 sm:gap-2 rounded-2xl sm:rounded-[2rem] border border-white/40 dark:border-white/10 bg-white/90 dark:bg-slate-900/90 px-2 py-2 sm:px-5 sm:py-3 shadow-2xl backdrop-blur-xl">
            {visibleNavItems.map((i) => {
              const active = pathname.startsWith(i.to);
              const isHovered = hovered === i.to;
              const Icon = i.icon;
              const isHighlight = active || isHovered;
              return (
                <Link
                  key={i.to}
                  to={i.to}
                  onMouseEnter={() => setHovered(i.to)}
                  className="relative flex flex-1 sm:flex-initial flex-col items-center justify-center gap-1 rounded-xl px-1 py-1 sm:px-3 sm:py-1.5 transition-all duration-200 min-w-0"
                >
                  <span
                    className={cn(
                      "flex items-center justify-center rounded-xl sm:rounded-2xl transition-all duration-200",
                      isHighlight
                        ? "size-8 sm:size-10 bg-primary text-primary-foreground shadow-md"
                        : "size-8 sm:size-10 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon
                      className={cn(
                        "transition-all duration-200",
                        isHighlight ? "size-4 sm:size-5" : "size-4 sm:size-[0.95rem]",
                        active && "animate-spring-bounce",
                      )}
                    />
                  </span>
                  <span
                    className={cn(
                      "text-[0.6rem] sm:text-[0.7rem] font-medium transition-all duration-200 truncate max-w-full text-center leading-none",
                      active ? "text-primary font-semibold" : "text-muted-foreground",
                    )}
                  >
                    {i.label}
                  </span>
                </Link>
              );
            })}

            <div className="mx-0.5 h-6 sm:h-8 w-px bg-border/70 shrink-0 sm:mx-1" />

            <button
              onClick={() => navigate({ to: "/logout" })}
              className="relative flex flex-1 sm:flex-initial flex-col items-center justify-center gap-1 rounded-xl px-1 py-1 sm:px-3 sm:py-1.5 transition-all duration-200 min-w-0"
            >
              <span className="flex size-8 sm:size-10 items-center justify-center rounded-xl sm:rounded-2xl text-muted-foreground hover:text-foreground">
                <LogOut className="size-4 sm:size-[0.95rem]" />
              </span>
              <span className="text-[0.6rem] sm:text-[0.7rem] font-medium text-muted-foreground truncate max-w-full text-center leading-none">
                Logout
              </span>
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
