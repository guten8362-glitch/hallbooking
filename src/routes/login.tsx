import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { AppShell } from "@/components/AppShell";
import { Button, PageTitle, Surface } from "@/components/ui-kit";
import { useAuth, isAdminUser, isCoordinatorUser, getDefaultRouteForUser } from "@/lib/auth";
import { loginWithGoogle } from "@/lib/appwrite/account";
import { account } from "@/lib/appwrite/client";
import { ID } from "appwrite";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type LoginSearch = {
  userId?: string;
  secret?: string;
  expire?: string;
  error?: string;
};

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => {
    return {
      userId: search.userId as string | undefined,
      secret: search.secret as string | undefined,
      expire: search.expire as string | undefined,
      error: search.error as string | undefined,
    };
  },
  component: LoginPage,
});

interface InstitutionalLogo {
  id: string;
  title: string;
  shortName: string;
  src: string;
  depth: number;
  pos: { top?: string; bottom?: string; left?: string; right?: string };
  size: string;
  floatDelay: string;
  floatDuration: string;
  glowColor: string;
}

const INSTITUTION_LOGOS: InstitutionalLogo[] = [
  {
    id: "mvit",
    title: "Manakula Vinayagar Institute of Technology",
    shortName: "MVIT",
    src: "/logos/logo4.jpg", 
    depth: 0.35,
    pos: { top: "10%", left: "4%" },
    size: "w-24 h-24 lg:w-30 lg:h-30",
    floatDelay: "0s",
    floatDuration: "4.8s",
    glowColor: "rgba(34, 197, 94, 0.35)",
  },
  {
    id: "smvec",
    title: "Sri Manakula Vinayagar Engineering College",
    shortName: "SMVEC",
    src: "/logos/logo5.jpg", 
    depth: -0.32,
    pos: { top: "10%", right: "4%" },
    size: "w-24 h-24 lg:w-30 lg:h-30",
    floatDelay: "0.8s",
    floatDuration: "5.4s",
    glowColor: "rgba(223, 24, 39, 0.35)",
  },
  {
    id: "smvpc",
    title: "Sri Manakula Vinayagar Polytechnic College",
    shortName: "SMVPC",
    src: "/logos/logo3.jpg", 
    depth: 0.28,
    pos: { top: "48%", left: "2%" },
    size: "w-22 h-22 lg:w-26 lg:h-26",
    floatDelay: "1.6s",
    floatDuration: "4.2s",
    glowColor: "rgba(249, 115, 22, 0.35)",
  },
  {
    id: "smvnc",
    title: "SMVNC Nursing & Health Sciences",
    shortName: "SMVNC",
    src: "/logos/logo2.jpg", 
    depth: -0.3,
    pos: { bottom: "10%", right: "4%" },
    size: "w-22 h-22 lg:w-26 lg:h-26",
    floatDelay: "2.4s",
    floatDuration: "5.8s",
    glowColor: "rgba(59, 130, 246, 0.35)",
  },
  {
    id: "vce",
    title: "Venkateshwara College of Education",
    shortName: "VCE",
    src: "/logos/logo1.jpg", 
    depth: 0.32,
    pos: { bottom: "10%", left: "4%" },
    size: "w-20 h-20 lg:w-24 lg:h-24",
    floatDelay: "1.2s",
    floatDuration: "5.0s",
    glowColor: "rgba(168, 85, 247, 0.35)",
  },
];

function LoginPage() {
  const { user, ready, login } = useAuth();
  const navigate = useNavigate();
  
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");

  // Parallax Direct DOM Container Ref
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeLogo, setActiveLogo] = useState<InstitutionalLogo | null>(null);

  useEffect(() => {
    let reqId: number;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const { innerWidth, innerHeight } = window;
      targetX = (e.clientX - innerWidth / 2) / (innerWidth / 2);
      targetY = (e.clientY - innerHeight / 2) / (innerHeight / 2);
    };

    window.addEventListener("mousemove", handleMouseMove);

    const updateParallax = () => {
      currentX += (targetX - currentX) * 0.05;
      currentY += (targetY - currentY) * 0.05;

      if (containerRef.current) {
        containerRef.current.style.setProperty("--mx", currentX.toFixed(4));
        containerRef.current.style.setProperty("--my", currentY.toFixed(4));
      }
      reqId = requestAnimationFrame(updateParallax);
    };
    reqId = requestAnimationFrame(updateParallax);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (reqId) cancelAnimationFrame(reqId);
    };
  }, []);

  const { userId, secret } = Route.useSearch();
  const [magicLinkLoading, setMagicLinkLoading] = useState(!!(userId && secret));
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const isConsumingMagicLink = useRef(false);

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return setError("Please enter an email");
    setError("");

    setLoading(true);
    setError(null);
    try {
      const { functions } = await import("@/lib/appwrite/client");
      
      // 1. Verify email using Appwrite Function securely
      const functionId = import.meta.env.VITE_LOGIN_FUNCTION_ID || "login-service";
      const response = await functions.createExecution(
        functionId,
        JSON.stringify({ email }),
        false,
        '/',
        'POST'
      );
      
      if (response.status === 'failed') {
        throw new Error("Failed to verify email");
      }
      
      const data = JSON.parse(response.responseBody);
      if (data.error) {
        throw new Error(data.error);
      }

      // 2. If authorized, trigger Appwrite native OTP email
      const sessionToken = await account.createEmailToken(ID.unique(), email);
      setUserId(sessionToken.userId);
      setShowOtp(true);
      toast.success("OTP sent to your email!");
      
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Email not authorized in the system.");
    } finally {
      setLoading(false);
    }
  };

  const submitOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length < 6) return setError("Please enter the 6-digit OTP");

    setLoading(true);
    setError(null);
    try {
      await account.createSession(userId, otp);
      window.location.replace(window.location.pathname);
    } catch (err: any) {
      console.error(err);
      setError("Invalid OTP or expired.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ready && user && !magicLinkLoading) {
      sessionStorage.setItem("justLoggedIn", "true");
      const targetPath = getDefaultRouteForUser(user);
      navigate({ to: targetPath });
    }
  }, [ready, user, navigate, magicLinkLoading]);

  useEffect(() => {
    if (userId && secret && !isConsumingMagicLink.current) {
      isConsumingMagicLink.current = true;
      const finishMagicLogin = async () => {
        try {
          await account.updateMagicURLSession(userId, secret);
          // Reload without query params so it enters the standard auth flow
          window.location.replace(window.location.pathname);
        } catch (err: any) {
          console.error("Magic link auth failed:", err);
          setError(err.message || "Invalid or expired magic link.");
          setMagicLinkLoading(false);
        }
      };
      finishMagicLogin();
    }
  }, [userId, secret]);

  if (!ready || magicLinkLoading) {
    return (
      <AppShell>
        <div className="shimmer mx-auto mt-20 h-64 max-w-md rounded-2xl" />
        {magicLinkLoading && <p className="text-center mt-4 text-muted-foreground animate-pulse">Verifying secure link...</p>}
      </AppShell>
    );
  }

  const submitGoogle = () => {
    loginWithGoogle();
  };

  return (
    <AppShell>
      <div 
        ref={containerRef}
        className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none"
        style={{
          "--mx": "0",
          "--my": "0",
        } as React.CSSProperties}
        aria-hidden="true"
      >
        <div 
          className="absolute w-[120%] h-[120%] -top-[10%] -left-[10%] opacity-20 pointer-events-none transition-transform duration-300 ease-out"
          style={{
            background: "linear-gradient(135deg, var(--bms-primary-red) 0%, var(--bms-gradient-purple) 100%)",
            transform: "translate3d(calc(var(--mx) * 20px), calc(var(--my) * 20px), 0px)",
            willChange: "transform",
          }}
        />

        {INSTITUTION_LOGOS.map((logo) => {
          const moveX = logo.depth * 90;
          const moveY = logo.depth * 90;
          const rotX = -logo.depth * 15;
          const rotY = logo.depth * 15;

          return (
            <div
              key={logo.id}
              className="absolute pointer-events-auto hidden sm:block"
              style={{
                ...logo.pos,
                transform: `translate3d(calc(var(--mx) * ${moveX}px), calc(var(--my) * ${moveY}px), 0px) rotateX(calc(var(--my) * ${rotX}deg)) rotateY(calc(var(--mx) * ${rotY}deg))`,
                transition: "transform 0.15s ease-out",
                willChange: "transform",
                backfaceVisibility: "hidden",
              }}
              onMouseEnter={() => setActiveLogo(logo)}
              onMouseLeave={() => setActiveLogo(null)}
            >
              <div 
                className="group relative flex flex-col items-center cursor-pointer"
                style={{ animation: `float ${logo.floatDuration} ease-in-out infinite ${logo.floatDelay}` }}
              >
                <div 
                  className={cn(
                    "relative p-2 md:p-3 rounded-3xl bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border border-white/70 dark:border-white/10 shadow-2xl transition-all duration-300 group-hover:scale-110 group-hover:shadow-[0_20px_50px_rgba(0,0,0,0.18)]",
                  )}
                  style={{
                    boxShadow: activeLogo?.id === logo.id 
                      ? `0 18px 40px ${logo.glowColor}` 
                      : "0 10px 30px -10px rgba(0,0,0,0.12)",
                  }}
                >
                  <div className={cn("relative overflow-hidden rounded-2xl bg-white p-2 flex items-center justify-center shadow-inner", logo.size)}>
                    <img 
                      src={logo.src} 
                      alt={logo.title}
                      className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105" 
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="relative z-10 mx-auto max-w-md md:max-w-lg lg:max-w-xl w-full px-4 sm:px-6 md:px-8 py-6 my-auto flex flex-col justify-center min-h-[80vh]">
        <div className="mb-4 overflow-hidden rounded-2xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/40 dark:border-white/10 p-3 shadow-lg">
          <div className="flex items-center justify-between gap-2 px-1 mb-1.5">
            <span className="text-[0.72rem] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Institutions Network
            </span>
            <span className="text-[0.68rem] text-muted-foreground font-medium">Sri Manakula Vinayagar Group</span>
          </div>
          
          <div className="grid grid-cols-5 gap-2">
            {INSTITUTION_LOGOS.map((logo) => (
              <div 
                key={logo.id}
                title={logo.title}
                className="group relative flex items-center justify-center p-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 shadow-xs transition-all duration-300 hover:scale-110 hover:shadow-md hover:border-primary/50 cursor-pointer"
              >
                <img 
                  src={logo.src} 
                  alt={logo.title} 
                  className="h-8 w-8 object-contain group-hover:scale-110 transition-transform duration-200"
                />
              </div>
            ))}
          </div>
        </div>

        <PageTitle
          
          title="Welcome Back"
          
        />

        <Surface className="p-4 sm:p-6 backdrop-blur-2xl bg-card/95 shadow-2xl border-white/40 dark:border-white/10 w-full rounded-3xl">
          {!showOtp ? (
            <form onSubmit={submitEmail} className="flex flex-col gap-4">
              <input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-[0.95rem] transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
              />
              
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-3 rounded-xl bg-primary px-4 py-3 text-[0.95rem] font-semibold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.99] disabled:opacity-50"
              >
                {loading ? "Verifying..." : "Continue with Email"}
              </button>
            </form>
          ) : (
            <form onSubmit={submitOtp} className="flex flex-col gap-4">
              <div className="text-center mb-2">
                <p className="text-[0.9rem] text-muted-foreground">Enter the 6-digit OTP sent to</p>
                <p className="font-semibold">{email}</p>
              </div>
              <input
                type="text"
                placeholder="Enter OTP (e.g. 123456)"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                disabled={loading}
                maxLength={6}
                className="w-full text-center tracking-widest rounded-xl border border-border bg-background px-4 py-3 text-lg transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
              />
              
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-3 rounded-xl bg-primary px-4 py-3 text-[0.95rem] font-semibold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.99] disabled:opacity-50"
              >
                {loading ? "Verifying OTP..." : "Sign In"}
              </button>
              
              <button
                type="button"
                onClick={() => setShowOtp(false)}
                disabled={loading}
                className="mt-2 text-[0.85rem] text-muted-foreground hover:text-primary transition-colors"
              >
                Use a different email
              </button>
            </form>
          )}

          {!showOtp && (
            <>
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-[0.75rem] font-medium uppercase text-muted-foreground">
                  <span className="bg-card px-2">OR</span>
                </div>
              </div>

              <button
                type="button"
                onClick={submitGoogle}
                disabled={loading}
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-[0.95rem] font-semibold transition-all hover:bg-muted/50 hover:border-primary/40 hover:shadow-md active:scale-[0.99] disabled:opacity-50"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>
            </>
          )}

          {error && (
            <p className="mt-4 text-center text-[0.8rem] font-medium text-destructive bg-destructive/10 p-2.5 rounded-xl border border-destructive/20">
              {error}
            </p>
          )}
        </Surface>
      </div>
    </AppShell>
  );
}
