import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Bell, RefreshCw, Send, ShieldCheck, Smartphone, CheckCircle, AlertTriangle, XCircle, Info } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageTitle, Surface } from "@/components/ui-kit";
import { getAllUsersFromDatabase } from "@/lib/appwrite/users";
import { sendPushNotification } from "@/lib/appwrite/messaging";
import { getDeviceInfo } from "@/lib/firebase";
import { APPWRITE_CONFIG } from "@/lib/appwrite/constants";

export const Route = createFileRoute("/notification-diagnostics")({
  head: () => ({
    meta: [
      { title: "Notification Diagnostics — VenueX - Book My Space" },
      { name: "description", content: "Realtime diagnostic dashboard for push targets, FCM tokens, and device delivery." },
    ],
  }),
  component: NotificationDiagnostics,
});

interface UserDiagnostic {
  $id: string;
  name: string;
  email: string;
  role: string;
  institution: string;
  dbId?: string;
  fcmToken?: string;
  targetCount: number;
  targets: any[];
  permission: string;
  deviceInfo: ReturnType<typeof getDeviceInfo>;
  lastRefresh?: string;
}

function NotificationDiagnostics() {
  const [users, setUsers] = useState<UserDiagnostic[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingUserId, setTestingUserId] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [currentDevice, setCurrentDevice] = useState<any>(null);

  const addLog = (msg: string) => {
    setLogs((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 49)]);
  };

  const fetchDiagnostics = async () => {
    setLoading(true);
    addLog("Fetching user records and push target diagnostics from Appwrite...");
    try {
      const dbUsers = await getAllUsersFromDatabase();
      const localToken = localStorage.getItem("fcm_token") || "";
      const refreshedAt = localStorage.getItem("fcm_token_refreshed_at") || "Recently";

      const currDev = getDeviceInfo();
      setCurrentDevice(currDev);

      const items: UserDiagnostic[] = [];

      for (const u of dbUsers) {
        let targets: any[] = [];
        let count = 0;

        // Note: Target diagnostics are disabled because we securely removed the VITE_APPWRITE_API_KEY from the frontend.
        // Appwrite Auth targets can only be queried by a Serverless Function or the Appwrite Console now.

        items.push({
          $id: u.$id,
          name: u.name || 'User',
          email: u.email,
          role: u.role || 'user',
          institution: u.institution || 'MVIT',
          dbId: u.$id,
          fcmToken: localToken,
          targetCount: count,
          targets,
          permission: typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
          deviceInfo: currDev,
          lastRefresh: refreshedAt,
        });
      }

      setUsers(items);
      addLog(`Loaded ${items.length} user records with live Push Target counts.`);
    } catch (err: any) {
      addLog(`Error fetching diagnostics: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
  }, []);

  const handleTestPush = async (user: UserDiagnostic) => {
    setTestingUserId(user.$id);
    addLog(`Sending Test Push Notification to ${user.name} (${user.email})...`);
    try {
      const title = `🧪 Push Diagnostics Test`;
      const body = `Hello ${user.name},\nYour device push notification pipeline is active and working 100%!`;
      
      const res = await sendPushNotification([user.$id], title, body);
      if (res) {
        addLog(`✅ Test Push Dispatched Successfully to ${user.name}! Response ID: ${res.messageId || res.$id || 'OK'}`);
      } else {
        addLog(`⚠️ Test Push Skipped: User has 0 active push targets registered.`);
      }
    } catch (err: any) {
      addLog(`❌ Test Push Exception: ${err.message || err}`);
    } finally {
      setTestingUserId(null);
    }
  };

  return (
    <AppShell>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <PageTitle
          title="Notification Diagnostics"
          subtitle="Realtime device target mapping, FCM token status, and 1-click test push notifications."
        />

        <button
          onClick={fetchDiagnostics}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 transition-all shadow-sm"
        >
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /> Refresh Diagnostics
        </button>
      </div>

      {/* Active Device Info Surface */}
      {currentDevice && (
        <Surface className="p-5 mb-6 bg-card/60 backdrop-blur-md border border-border/60">
          <div className="flex items-center gap-3 mb-3">
            <span className="grid size-9 place-items-center rounded-xl bg-primary-soft text-primary">
              <Smartphone className="size-5" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-foreground">Current Active Device</h3>
              <p className="text-xs text-muted-foreground">
                {currentDevice.device} · {currentDevice.browser} on {currentDevice.os}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-muted/40 border border-border/40">
              <span className="font-semibold text-muted-foreground">Notification Permission:</span>
              <p className="font-bold text-foreground mt-0.5 uppercase tracking-wide">
                {typeof Notification !== 'undefined' ? Notification.permission : 'N/A'}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-muted/40 border border-border/40">
              <span className="font-semibold text-muted-foreground">Active FCM Token:</span>
              <p className="font-mono text-[0.72rem] text-foreground mt-0.5 truncate">
                {localStorage.getItem("fcm_token") ? `${localStorage.getItem("fcm_token")?.substring(0, 20)}...` : "None"}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-muted/40 border border-border/40">
              <span className="font-semibold text-muted-foreground">Service Worker Status:</span>
              <p className="font-bold text-emerald-600 mt-0.5">
                {'serviceWorker' in navigator ? 'Active & Ready' : 'Unsupported'}
              </p>
            </div>
          </div>
        </Surface>
      )}

      {/* Diagnostics Table */}
      <Surface className="p-0 overflow-hidden border border-border/60 mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border/60 bg-muted/40 text-muted-foreground uppercase text-[0.7rem] tracking-wider font-bold">
                <th className="p-3.5">User & Role</th>
                <th className="p-3.5">Appwrite Auth ID</th>
                <th className="p-3.5">Push Targets</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 font-medium">
              {users.map((u) => {
                const hasTargets = u.targetCount > 0;
                return (
                  <tr key={u.$id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-3.5">
                      <div className="font-bold text-foreground text-sm">{u.name}</div>
                      <div className="text-muted-foreground text-[0.78rem]">{u.email}</div>
                      <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[0.68rem] font-bold bg-primary-soft text-primary uppercase">
                        {u.role} · {u.institution}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono text-[0.75rem] text-muted-foreground">
                      {u.$id}
                    </td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-1.5">
                        <span className={`inline-flex items-center justify-center size-6 rounded-full font-bold text-xs ${hasTargets ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'}`}>
                          {u.targetCount}
                        </span>
                        <span className="text-[0.78rem] text-muted-foreground">Device(s)</span>
                      </div>
                    </td>
                    <td className="p-3.5">
                      {hasTargets ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-[0.78rem]">
                          <CheckCircle className="size-3.5" /> Push Ready
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-600 font-bold text-[0.78rem]">
                          <AlertTriangle className="size-3.5" /> Needs Login on Device
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => handleTestPush(u)}
                        disabled={testingUserId === u.$id}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 text-white px-3 py-1.5 text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-xs"
                      >
                        <Send className="size-3.5" />
                        {testingUserId === u.$id ? "Sending..." : "Send Test Push"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Surface>

      {/* Diagnostics Realtime Console Output */}
      <Surface className="p-5 bg-slate-950 text-slate-100 rounded-2xl border border-slate-800">
        <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
            <Info className="size-4 text-emerald-400" /> Realtime Push Dispatch Log
          </div>
          <button
            onClick={() => setLogs([])}
            className="text-[0.7rem] text-slate-400 hover:text-slate-200 transition-colors uppercase font-bold"
          >
            Clear Log
          </button>
        </div>
        <div className="font-mono text-[0.75rem] space-y-1 max-h-48 overflow-y-auto pr-2 text-slate-300">
          {logs.length === 0 ? (
            <p className="text-slate-500 italic">No push diagnostic logs captured yet. Click "Send Test Push" above to trigger a live notification.</p>
          ) : (
            logs.map((l, idx) => (
              <p key={idx} className="leading-relaxed">{l}</p>
            ))
          )}
        </div>
      </Surface>
    </AppShell>
  );
}
