import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/logout")({
  head: () => ({
    meta: [
      { title: "Sign out — VenueX - Book My Space" },
      {
        name: "description",
        content: "Sign out of your account.",
      },
    ],
  }),
  component: Logout,
});

function Logout() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    const processLogout = async () => {
      try {
        await logout();
      } catch (err) {
        console.error(err);
      }
      if (mounted) {
        window.location.href = "/login";
      }
    };
    processLogout();
    return () => { mounted = false; };
  }, [logout]);

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-background">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
      <p className="mt-4 text-sm text-muted-foreground animate-pulse">Signing out...</p>
    </div>
  );
}
