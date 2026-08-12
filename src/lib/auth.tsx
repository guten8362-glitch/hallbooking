import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { ID } from "appwrite";
import { getCurrentUser, logoutUser, getCurrentSession } from "./appwrite/account";
import { updateUserFCMToken, getAllUsersFromDatabase, addUserToDatabase } from "./appwrite/users";
import { account } from "./appwrite/client";
import { requestFCMToken } from "./firebase";
import {
  getStoredImpersonatedUser,
  setStoredImpersonatedUser,
  logImpersonationStart,
  logImpersonationStop,
} from "./services/impersonation";

export type UserRole = "user" | "admin" | "coordinator" | "organizer" | "super_admin";

export interface User {
  email: string;
  phone?: string;
  role: UserRole;
  name?: string;
  institution: string;
  team?: string;
  $id?: string;
}

interface AuthContextType {
  user: User | null; // Active user (impersonatedUser if active, else realUser)
  realUser: User | null; // True logged-in Appwrite user
  impersonatedUser: User | null;
  isImpersonating: boolean;
  startImpersonation: (targetUser: User) => void;
  stopImpersonation: () => void;
  ready: boolean;
  login: (email: string, pass?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  authError: string | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Helper to synchronize FCM tokens with a single Appwrite Push Target per device
export const syncPushTarget = async (token: string, oldToken?: string) => {
  try {
    const currentUser = await account.get();
    
    // Check for existing target and delete old/expired tokens
    if (currentUser.targets && currentUser.targets.length > 0) {
      let targetExists = false;
      
      for (const t of currentUser.targets) {
        if (t.providerType === 'push') {
          // If this exact token is already registered, keep it
          if (t.identifier === token) {
            targetExists = true;
          } 
          // Delete if it matches oldToken or if Appwrite marked it expired
          else if (t.identifier === oldToken || t.expired) {
            try {
              console.log("🗑️ Deleting old/expired push target:", t.$id);
              await account.deletePushTarget(t.$id);
            } catch (err) {
              console.warn("Failed to delete old target:", err);
            }
          }
        }
      }

      if (targetExists) {
        console.log("✅ Appwrite Push Target already exists for this device.");
        return;
      }
    }

    const targetId = ID.unique();
    try {
      await account.createPushTarget(targetId, token, "6a6c0163000e309089af");
      console.log("✅ Appwrite Push Target created with provider ID!");
    } catch (pErr) {
      try {
        await account.createPushTarget(targetId, token);
        console.log("✅ Appwrite Push Target created successfully (fallback)!");
      } catch (pErr2) {
        console.warn("❌ Appwrite Push Target creation failed:", pErr2);
      }
    }
  } catch (err) {
    console.error("Failed to sync push targets:", err);
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [realUser, setRealUser] = useState<User | null>(() => {
    try {
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem("bms_user");
        if (saved) return JSON.parse(saved);
      }
    } catch {
      /* ignore */
    }
    return null;
  });
  const [impersonatedUser, setImpersonatedUser] = useState<User | null>(() => getStoredImpersonatedUser());
  const [ready, setReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      try {
        let currentUser = await getCurrentUser();

        if (!currentUser) {
          try {
            const saved = localStorage.getItem("bms_user");
            if (saved) {
              currentUser = JSON.parse(saved);
            }
          } catch {
            /* ignore */
          }
        }

        if (currentUser) {
          setRealUser(currentUser as User);
          localStorage.setItem("bms_user", JSON.stringify(currentUser));
          
          // Request browser notification permissions automatically
          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
            Notification.requestPermission().catch(() => {});
          }

          // Always fetch and sync the latest FCM token for the active logged-in device
          try {
            const token = await requestFCMToken();
            const prevToken = localStorage.getItem("fcm_token_prev") || undefined;
            if (token) {
              await updateUserFCMToken(currentUser.email, token, currentUser.$id);
              await syncPushTarget(token, prevToken);
              localStorage.setItem("fcm_token", token);
              localStorage.removeItem("fcm_token_prev");
            }
          } catch (e) {
            console.error("FCM Token fetch failed on checkSession:", e);
          }
        } else {
          setRealUser(null);
          setImpersonatedUser(null);
          setStoredImpersonatedUser(null);
          localStorage.removeItem("bms_user");
          localStorage.removeItem("fcm_registered");
        }
      } catch (error) {
        console.error("Session check error:", error);
      } finally {
        setReady(true);
      }
    };
    
    checkSession();
  }, []);

  const startImpersonation = (targetUser: User) => {
    if (!realUser) return;
    logImpersonationStart(realUser, targetUser);
    setImpersonatedUser(targetUser);
    setStoredImpersonatedUser(targetUser);
  };

  const stopImpersonation = () => {
    if (realUser) {
      logImpersonationStop(realUser, impersonatedUser);
    }
    setImpersonatedUser(null);
    setStoredImpersonatedUser(null);
  };

  const login = async (email: string, password?: string): Promise<boolean> => {
    try {
      const cleanEmail = email.trim().toLowerCase();

      // 1. Query database users table first to check if user exists
      let matchedDbUser: User | null = null;
      try {
        const dbUsers = await getAllUsersFromDatabase();
        const found = dbUsers.find(
          (u) => (u.email || "").trim().toLowerCase() === cleanEmail
        );
        if (found) {
          matchedDbUser = found;
        }
      } catch (dbErr) {
        console.warn("Error fetching DB users during login:", dbErr);
      }

      // 2. We no longer use loginWithEmail (hardcoded password) here.
      // Magic Link handles it completely differently.
      // This login() function is now only used as a fallback if the user 
      // already has an active session but needs to sync state,
      // or if we are doing a mock login and they allowed the users DB to be read.
      
      let appwriteUser: User | null = null;
      try {
        appwriteUser = (await getCurrentUser()) as User | null;
      } catch (appwriteErr) {
        console.warn("Appwrite user fetch failed:", appwriteErr);
      }

      // 3. If user wasn't in DB or Appwrite Auth:
      if (!matchedDbUser && !appwriteUser) {
        throw new Error("User not found");
      }

      const activeUser: User = (appwriteUser || matchedDbUser)!;

      // Request and sync FCM Push Tokens safely
      try {
        const token = await requestFCMToken();
        const prevToken = localStorage.getItem("fcm_token_prev") || undefined;
        if (token) {
          await updateUserFCMToken(cleanEmail, token, activeUser.$id);
          await syncPushTarget(token, prevToken);
          localStorage.removeItem("fcm_token_prev");
        }
      } catch (err) {
        console.error("FCM Token Registration failed during login:", err);
      }

      setRealUser(activeUser);
      localStorage.setItem("bms_user", JSON.stringify(activeUser));
      setAuthError(null);
      return true;
    } catch (error: any) {
      console.error("Login failed:", error);
      throw error;
    }
  };

  const logout = async () => {
    stopImpersonation();
    try {
      const currentUser = await account.get();
      // Clean up push targets before logging out
      if (currentUser?.targets && currentUser.targets.length > 0) {
        for (const t of currentUser.targets) {
          if (t.providerType === 'push') {
            try {
              await account.deletePushTarget(t.$id);
            } catch (delErr) {
              console.warn(`Failed to delete push target on logout: ${t.$id}`, delErr);
            }
          }
        }
      }
      await logoutUser();
    } catch (e) {
      console.error("Logout error", e);
    }
    setRealUser(null);
    localStorage.removeItem("bms_user");
    localStorage.removeItem("fcm_registered");
  };

  const activeUser = impersonatedUser || realUser;

  return (
    <AuthContext.Provider
      value={{
        user: activeUser,
        realUser,
        impersonatedUser,
        isImpersonating: !!impersonatedUser,
        startImpersonation,
        stopImpersonation,
        ready,
        login,
        logout,
        authError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export const isCoordinatorUser = (user: User | null) => user?.role === "coordinator" || user?.role === "admin" || user?.role === "super_admin";
export const isAdminUser = (user: User | null) => user?.role === "admin" || user?.role === "super_admin";
export const isOrganizerUser = (user: User | null) => user?.role === "organizer";
export const isSuperAdminUser = (user: User | null) => user?.role === "super_admin";


export const getDefaultRouteForUser = (user: User | null): string => {
  if (!user) return "/login";
  if (user.role === "super_admin") return "/super-admin";
  if (user.role === "admin") return "/admin";
  if (user.role === "coordinator") return "/coordinator";
  if (user.role === "organizer") return "/organizer";
  return "/auditoriums";
};


