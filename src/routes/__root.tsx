import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { BookingProvider } from "../lib/booking-store";
import { AuthProvider, useAuth } from "../lib/auth";
import { Toaster } from "../components/ui/sonner";
import { setupFCMListener } from "../lib/firebase";


function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "VenueX - Book My Space" },
      {
        name: "description",
        content: "VenueX - Book shared campus spaces in a few simple steps.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
      },
      { rel: "icon", href: "/logo.svg", type: "image/svg+xml" },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "apple-touch-icon", href: "/logo.svg" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const isNavigating = useRouterState({ select: (s) => s.status === "pending" });

  useEffect(() => {

    // Listen for foreground Firebase push notifications
    setupFCMListener((payload) => {
      console.log("Foreground push notification received", payload);
      const title = payload?.notification?.title || payload?.data?.title || "Notification";
      const body = payload?.notification?.body || payload?.data?.body || payload?.data?.message || "";
      
      // Force native OS notification even when app is open
      if ("Notification" in window && Notification.permission === "granted") {
        navigator.serviceWorker.ready.then((registration) => {
          registration.showNotification(title, {
            body: body,
            icon: '/logos/logo4.jpg',
            data: payload?.data
          });
        });
      }
    });

    return () => {};
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthSplashWrapper>
          <BookingProvider>
            <>
              <Outlet />
              <Toaster />
            </>
          </BookingProvider>
        </AuthSplashWrapper>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function AuthSplashWrapper({ children }: { children: React.ReactNode }) {
  const { ready } = useAuth();
  
  // Show splash screen while auth is resolving (checking session)
  return (
    <>
      {!ready && (
        <div className="fixed inset-0 z-[9999] flex h-screen w-screen flex-col items-center justify-center bg-background text-foreground">
          <div className="relative flex flex-col items-center">
            <div className="h-20 w-20 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            <img
              src="/logos/logo4.jpg"
              alt="MVIT Logo"
              className="absolute top-1/2 left-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-xl object-contain shadow-md"
            />
          </div>
          <h1 className="mt-6 text-xl font-bold tracking-tight text-foreground">
            VenueX - Book My Space
          </h1>
          <p className="mt-1 text-xs text-muted-foreground animate-pulse">
            Loading experience...
          </p>
        </div>
      )}
      <div className={`h-full w-full transition-opacity duration-300 ${!ready ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        {children}
      </div>
    </>
  );
}

