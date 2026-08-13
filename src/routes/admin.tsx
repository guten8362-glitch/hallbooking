import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { 
  CheckCircle2, 
  XCircle, 
  FileCheck2, 
  ShieldCheck, 
  Inbox, 
  AlertTriangle, 
  Eye, 
  Download, 
  FileText, 
  Search,
  Filter,
  UserCheck,
  UserPlus,
  Users,
  Plus,
  CalendarDays,
  Clock
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { Button, PageTitle, Row, Surface } from "@/components/ui-kit";
import { formatDate, formatTime, getStageInfo, useBookings, getNextStage, type Booking, getInstitutionLogo } from "@/lib/booking-store";
import { useAuth, isAdminUser, type UserRole } from "@/lib/auth";
import { addUserToDatabase, getAllUsersFromDatabase } from "@/lib/appwrite/users";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Principal Approval Dashboard — VenueX" },
      {
        name: "description",
        content: "Review and approve internal and external auditorium booking requests.",
      },
      { property: "og:title", content: "Principal Approval Dashboard" },
      {
        property: "og:description",
        content: "Approve and confirm campus auditorium requests.",
      },
    ],
  }),
  component: Admin,
});

type AdminTab = "pending" | "all" | "confirmed" | "rejected" | "users";

function Admin() {
  const { user, ready: authReady } = useAuth();
  const { bookings, advance, remove, ready: bookingsReady, getAuditorium } = useBookings();
  const navigate = useNavigate();

  const [tab, setTab] = useState<AdminTab>("pending");
  const [search, setSearch] = useState("");
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [rejectionModalBooking, setRejectionModalBooking] = useState<Booking | null>(null);
  const [rejectionCategory, setRejectionCategory] = useState("Schedule Conflict / Venue Overlap");
  const [rejectionReason, setRejectionReason] = useState("");

  // Add User Form State
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserInstitution, setNewUserInstitution] = useState("MVIT");
  const [newUserRole, setNewUserRole] = useState<UserRole>("user");
  const [userAddedSuccess, setUserAddedSuccess] = useState("");

  const [usersList, setUsersList] = useState<any[]>([]);

  useEffect(() => {
    // SECURITY PATCH: Only fetch users if the current user is actually an admin.
    // This prevents regular users who forcefully navigate here from leaking user data in the Network tab.
    if (user && isAdminUser(user)) {
      getAllUsersFromDatabase().then(setUsersList);
    }
  }, [userAddedSuccess, user]);

  const handleAddUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail || !newUserPassword || !newUserName) return;
    
    await addUserToDatabase({
      name: newUserName,
      email: newUserEmail,
      password: newUserPassword,
      institution: newUserInstitution,
      role: newUserRole,
    });

    setUserAddedSuccess(`✅ User "${newUserName}" (${newUserEmail}) added successfully as ${newUserRole.toUpperCase()}!`);
    setNewUserName("");
    setNewUserEmail("");
    setNewUserPassword("");
    setTimeout(() => setUserAddedSuccess(""), 4000);
  };

  const ready = authReady && bookingsReady;

  if (ready && (!user || !isAdminUser(user))) {
    return (
      <AppShell>
        <div className="surface mx-auto mt-12 max-w-lg p-8 text-center rise">
          <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400">
            <AlertTriangle className="size-8" />
          </div>
          <h1 className="mt-5 text-[1.4rem] font-semibold text-foreground">
            Access Restricted
          </h1>
          <p className="mt-2 text-[0.9rem] text-muted-foreground">
            The Principal / Coordinator Portal is strictly accessible to administrative accounts only.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              to="/login"
              className="press inline-flex h-11 items-center justify-center rounded-xl bg-primary px-6 text-[0.9rem] font-medium text-primary-foreground shadow-sm"
            >
              Sign in as Principal / Admin
            </Link>
            <Link
              to="/auditoriums"
              className="press inline-flex h-11 items-center justify-center rounded-xl border border-border bg-card px-5 text-[0.9rem] font-medium text-foreground hover:bg-muted"
            >
              Go to Home
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  const actionQueue = bookings.filter((b) => {
    const st = b?.stage || "";
    return st === "pending_super_admin";
  });
  const confirmedList = bookings.filter((b) => b?.stage === "confirmed");
  const rejectedList = bookings.filter((b) => b?.stage === "rejected");

  const filteredBookings = bookings.filter((b) => {
    // Tab filter
    const st = b?.stage || "";
    const isPending = st === "pending_super_admin";
    if (tab === "pending" && !isPending) return false;
    if (tab === "confirmed" && st !== "confirmed") return false;
    if (tab === "rejected" && st !== "rejected") return false;

    // Search filter
    if (search.trim()) {
      const query = search.toLowerCase();
      const hallName = getAuditorium(b.auditoriumId)?.name?.toLowerCase() || "";
      return (
        (b?.id || "").toLowerCase().includes(query) ||
        (b?.institution || "").toLowerCase().includes(query) ||
        (b?.department || "").toLowerCase().includes(query) ||
        (b?.coordinator || "").toLowerCase().includes(query) ||
        (b?.eventName || "").toLowerCase().includes(query) ||
        hallName.includes(query)
      );
    }
    return true;
  });

  const handleConfirmBooking = (b: Booking) => {
    advance(b.id, "confirmed");
  };

  const handleConfirmReject = () => {
    if (!rejectionModalBooking) return;
    advance(rejectionModalBooking.id, "rejected", {
      rejectionCategory: rejectionCategory || "Administrative Reason",
      rejectionReason: rejectionReason.trim() || "No specific reason provided by Principal.",
    });
    setRejectionModalBooking(null);
    setRejectionCategory("Schedule Conflict / Venue Overlap");
    setRejectionReason("");
  };

  return (
    <AppShell>
      <PageTitle
        eyebrow="Principal & Authorised Authority Portal"
        title="Venue Approval Dashboard"
        subtitle="Review auditorium requests and issue final booking confirmations."
      />

      {/* Top Filter & Standalone User Management Bar */}
      <div className="mb-4 sm:mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Status Filter Tabs */}
        <div className="flex overflow-x-auto whitespace-nowrap hide-scrollbar gap-2 rounded-2xl bg-muted/60 p-1.5 backdrop-blur border border-border/40">
          <button
            onClick={() => setTab("pending")}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2 text-[0.88rem] font-medium transition-all",
              tab === "pending"
                ? "bg-card text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Pending Approval
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[0.72rem] font-bold",
                tab === "pending" ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" : "bg-muted text-muted-foreground"
              )}
            >
              {actionQueue.length}
            </span>
          </button>

          <button
            onClick={() => setTab("all")}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2 text-[0.88rem] font-medium transition-all",
              tab === "all"
                ? "bg-card text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            All Requests
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[0.72rem] font-bold",
                tab === "all" ? "bg-primary-soft text-primary" : "bg-muted text-muted-foreground"
              )}
            >
              {bookings.length}
            </span>
          </button>

          <button
            onClick={() => setTab("confirmed")}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2 text-[0.88rem] font-medium transition-all",
              tab === "confirmed"
                ? "bg-card text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Confirmed
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[0.72rem] font-bold",
                tab === "confirmed" ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"
              )}
            >
              {confirmedList.length}
            </span>
          </button>

          <button
            onClick={() => setTab("rejected")}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2 text-[0.88rem] font-medium transition-all",
              tab === "rejected"
                ? "bg-card text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Declined
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[0.72rem] font-bold",
                tab === "rejected" ? "bg-red-100 text-red-700" : "bg-muted text-muted-foreground"
              )}
            >
              {rejectedList.length}
            </span>
          </button>
        </div>

        {/* Right Side Action Area: Search + Distinct Standalone Add & Manage Users Box */}
        <div className="flex flex-wrap items-center gap-3">
          {tab !== "users" && (
            <div className="relative min-w-[200px] flex-1 sm:flex-initial">
              <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                suppressHydrationWarning
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search request..."
                className="h-11 w-full rounded-2xl border border-border bg-card pl-9 pr-4 text-[0.88rem] outline-none transition-all placeholder:text-muted-foreground/60 focus:border-primary focus:ring-4 focus:ring-primary/10 shadow-xs"
              />
            </div>
          )}

          {/* Standalone Unique Box for Add & Manage Users */}
          <button
            type="button"
            onClick={() => setTab(tab === "users" ? "pending" : "users")}
            className={cn(
              "press group relative flex items-center gap-2.5 rounded-2xl px-4 h-11 text-[0.88rem] font-bold transition-all duration-300 shadow-md border",
              tab === "users"
                ? "bg-gradient-to-r from-red-600 to-rose-700 text-white border-red-500 ring-4 ring-red-500/20 scale-[1.02]"
                : "bg-slate-900 text-white dark:bg-slate-800 border-slate-700/80 hover:bg-slate-800 hover:scale-[1.02] hover:shadow-lg"
            )}
          >
            <span className="grid size-6.5 place-items-center rounded-xl bg-white/20 text-white transition-transform group-hover:rotate-12">
              <UserPlus className="h-3.5 w-3.5" />
            </span>
            <span>{tab === "users" ? "Back to Requests" : "Add & Manage Users"}</span>
            <span className="rounded-full bg-white/25 px-2 py-0.5 text-[0.7rem] font-extrabold text-white">
              {usersList.length}
            </span>
          </button>
        </div>
      </div>

      {!ready && <div className="shimmer h-48 rounded-2xl" />}

      {/* USER MANAGEMENT & ADD USER TAB */}
      {ready && tab === "users" && (
        <div className="space-y-6">
          {/* Add User Form Card */}
          <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-xs">
            <div className="flex items-center gap-2.5 mb-4 border-b border-border/50 pb-3">
              <div className="grid size-9 place-items-center rounded-xl bg-primary-soft text-primary">
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-foreground">Add New User / Coordinator</h3>
                <p className="text-xs text-muted-foreground">Create accounts for venue applicants, authorised coordinators, or admins.</p>
              </div>
            </div>

            {userAddedSuccess && (
              <div className="mb-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                {userAddedSuccess}
              </div>
            )}

            <form onSubmit={handleAddUserSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Kagne / Mr. Bala"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="h-11 w-full rounded-xl border border-border bg-background px-3.5 text-xs font-medium outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. coordinator@mvit.edu"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="h-11 w-full rounded-xl border border-border bg-background px-3.5 text-xs font-medium outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1">Initial Password</label>
                <input
                  type="password"
                  required
                  placeholder="Set initial password"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  className="h-11 w-full rounded-xl border border-border bg-background px-3.5 text-xs font-medium outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1">Institution</label>
                <select
                  value={newUserInstitution}
                  onChange={(e) => setNewUserInstitution(e.target.value)}
                  className="h-11 w-full rounded-xl border border-border bg-background px-3 text-xs font-medium outline-none focus:border-primary"
                >
                  <option value="MVIT">MVIT (Manakula Vinayagar Institute of Technology)</option>
                  <option value="Medical Hospital">Medical Hospital (SMVMCH)</option>
                  <option value="Medical College">Medical College (SMVMCH)</option>
                  <option value="Nursing College">Nursing College (SMVNC)</option>
                  <option value="Polytechnic College">Polytechnic College (SMVPC)</option>
                  <option value="Sri Manakula Vinayagar Educational Trust">Sri Manakula Vinayagar Educational Trust</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-foreground mb-1">Assigned Role</label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                  className="h-11 w-full rounded-xl border border-border bg-background px-3 text-xs font-bold text-foreground outline-none focus:border-primary"
                >
                  <option value="user">User / Applicant (Can view & book venues)</option>
                  <option value="coordinator">Authorised Coordinator (Can review, approve, reject & verify)</option>
                  <option value="admin">System Administrator (Full Control & User Management)</option>
                </select>
              </div>

              <div className="sm:col-span-2 pt-2">
                <Button type="submit" className="h-11 w-full text-xs">
                  <Plus className="h-4 w-4" /> Register & Add User
                </Button>
              </div>
            </form>
          </div>

          {/* Registered User List */}
          <div className="rounded-3xl border border-border bg-card p-6 shadow-xs">
            <h3 className="font-bold text-base text-foreground mb-3 flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" /> Registered Users Directory ({usersList.length})
            </h3>
            <div className="space-y-3">
              {Array.from(new Set(usersList.map((u) => u.institution || "Unknown"))).map((inst) => {
                const instUsers = usersList.filter((u) => (u.institution || "Unknown") === inst);
                return (
                  <details key={inst} className="border border-border/70 rounded-2xl bg-card overflow-hidden group shadow-xs" open={inst === "MVIT" || inst === "MVIT (Manakula Vinayagar Institute of Technology)"}>
                    <summary className="bg-muted/30 px-4 py-3.5 font-bold text-[0.88rem] text-foreground flex items-center justify-between cursor-pointer select-none outline-none group-open:border-b group-open:border-border/60 hover:bg-muted/50 transition-colors">
                      {inst}
                      <span className="bg-muted px-2 py-0.5 rounded-full text-[0.7rem] text-muted-foreground border border-border/50">{instUsers.length} Users</span>
                    </summary>
                    <div className="divide-y divide-border/40 p-2">
                      {instUsers.map((u) => (
                        <div key={u.email} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl hover:bg-muted/20 gap-2 transition-colors">
                          <div>
                            <p className="font-bold text-[0.82rem] text-foreground">{u.name || "User"} <span className="font-mono text-muted-foreground font-normal text-xs ml-1">({u.email})</span></p>
                          </div>
                          <span className={cn(
                            "px-3 py-1 rounded-full text-[0.65rem] font-bold uppercase tracking-wider self-start sm:self-auto",
                            u.role === "admin" ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" :
                            u.role === "coordinator" ? "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300" :
                            "bg-primary-soft text-primary"
                          )}>
                            {u.role}
                          </span>
                        </div>
                      ))}
                    </div>
                  </details>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {ready && filteredBookings.length === 0 && (
        <Surface className="flex flex-col items-center gap-4 py-16 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary">
            <Inbox className="size-6" />
          </span>
          <p className="text-[0.95rem] text-muted-foreground">
            No venue requests found in this view.
          </p>
        </Surface>
      )}

      {/* Booking List */}
      <div className="space-y-5">
        {filteredBookings.map((b, i) => {
          const stageInfo = getStageInfo(b.stage);
          const hall = getAuditorium(b.auditoriumId);
          const hallDisplayName = hall?.name || (b as any).auditoriumName || (b as any).hallName || "Unknown Venue";

          return (
            <Surface key={b.id} delay={i * 60} className="p-6 sm:p-7">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-[1.15rem] font-semibold text-foreground">
                      {hallDisplayName}
                    </h2>
                  </div>
                  <div className="mt-1.5 flex items-center gap-3 text-[0.88rem] text-muted-foreground font-medium">
                    <span className="flex items-center gap-1.5"><CalendarDays className="size-4 text-primary" /> {formatDate(b.fromDate || b.date, b.toDate)}</span>
                    <span className="text-border">|</span>
                    <span className="flex items-center gap-1.5"><Clock className="size-4 text-primary" /> {formatTime(b.startTime)} – {formatTime(b.endTime)}</span>
                  </div>
                </div>

                <span
                  className={cn(
                    "shrink-0 rounded-full border px-3.5 py-1 text-[0.75rem] font-semibold shadow-xs",
                    stageInfo.bg
                  )}
                >
                  {stageInfo.label}
                </span>
              </div>

              <div className="mb-6 grid gap-2 rounded-xl bg-muted/40 p-4 text-[0.88rem]">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-0.5">
                  <span className="text-muted-foreground mb-1.5 sm:mb-0">Institution / Dept:</span>
                  <div className="flex items-center gap-2 bg-card rounded-lg border border-border/60 px-2 py-1 shadow-sm">
                    <img src={getInstitutionLogo(b.institution)} alt={b.institution} className="h-5 w-5 rounded-md object-contain" />
                    <span className="font-bold text-foreground">{b.institution}</span>
                    <span className="text-muted-foreground font-normal mx-0.5">•</span>
                    <span className="font-medium text-foreground">{b.department}</span>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Event & Purpose:</span>
                  <span className="font-medium text-foreground">{b.eventName} - {b.purpose}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Coordinator / Audience:</span>
                  <span className="font-medium text-foreground">{b.coordinator} ({b.participants} attendees)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Chairs Required on Dais:</span>
                  <span className="font-bold text-primary">{(b as any).chairs || (b as any).daisChairs || (b as any).extra?.chairs || "5"} chairs</span>
                </div>
                {b.organizerNotes && (
                  <div className="mt-2 rounded-xl border border-primary/20 bg-primary-soft/40 p-3 text-[0.82rem] font-medium text-primary shadow-xs">
                    <span className="flex items-center gap-1.5 font-bold"><CheckCircle2 className="size-4" /> Coordinator Approval Note:</span>
                    <p className="mt-1 text-foreground/80 font-normal">{b.organizerNotes}</p>
                  </div>
                )}
                {b.stage === "rejected" && b.rejectionCategory && (
                  <div className="mt-2 rounded-xl border border-red-200 bg-red-50/70 p-3 text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
                    <p className="font-bold text-[0.82rem] flex items-center gap-1.5">
                      <XCircle className="size-4 text-red-600" /> Rejection Category: {b.rejectionCategory}
                    </p>
                    <p className="mt-1 text-[0.82rem] text-red-700 dark:text-red-400">
                      <strong>Reason / Note:</strong> {b.rejectionReason || "No additional explanation provided."}
                    </p>
                  </div>
                )}
              </div>

              {b.stage === "confirmed" && (
                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-[0.85rem] text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
                  <p className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" /> Approved by MVIT Principle
                  </p>
                </div>
              )}

              {/* Admin & Approvers Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4 mt-4">
                <button
                  onClick={() => setSelectedBooking(b)}
                  className="press inline-flex items-center gap-1.5 text-[0.88rem] font-medium text-primary hover:underline"
                >
                  <Eye className="size-4" /> View Request Details
                </button>

                <div className="flex flex-wrap items-center gap-2">
                  {b.stage !== "confirmed" && b.stage !== "rejected" && (
                    <>
                      <button
                        onClick={() => setRejectionModalBooking(b)}
                        className="press inline-flex h-10 items-center gap-1.5 rounded-xl border border-red-200 bg-red-50/50 px-4 text-[0.85rem] font-medium text-red-700 transition-colors hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300"
                      >
                        <XCircle className="size-4" /> Reject Request
                      </button>

                      <Button
                        onClick={() => {
                          advance(b.id, "confirmed");
                        }}
                        className="h-10 text-[0.85rem]"
                      >
                        <CheckCircle2 className="size-4" /> Approve & Confirm Booking
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </Surface>
          );
        })}
      </div>

      {/* Request Details Modal */}
      {selectedBooking && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md rise">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-border bg-card p-6 shadow-2xl sm:p-8">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-[1.25rem] font-semibold text-foreground">
                  {getAuditorium(selectedBooking.auditoriumId)?.name || (selectedBooking as any).auditoriumName || "Unknown Venue"}
                </h2>
              </div>
              <button
                onClick={() => setSelectedBooking(null)}
                className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <XCircle className="size-6" />
              </button>
            </div>

            <div className="space-y-1">
              <Row label="Institution" value={selectedBooking.institution} />
              <Row label="Department" value={selectedBooking.department} />
              <Row label="Coordinator" value={selectedBooking.coordinator} />
              <Row label="Event Name" value={selectedBooking.eventName} />
              <Row label="Purpose" value={selectedBooking.purpose} />
              <Row label="Event Dates" value={formatDate(selectedBooking.fromDate || selectedBooking.date, selectedBooking.toDate)} />
              <Row label="Time Slot" value={`${formatTime(selectedBooking.startTime)} – ${formatTime(selectedBooking.endTime)}`} />
              <Row label="Participants" value={selectedBooking.participants} />
              {selectedBooking.remarks && <Row label="Remarks" value={selectedBooking.remarks} />}
            </div>

            <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-border/60">
              <button
                onClick={() => setSelectedBooking(null)}
                className="press h-10 rounded-xl border border-border px-5 text-[0.88rem] font-medium hover:bg-muted"
              >
                Close
              </button>

              {selectedBooking.stage.startsWith("pending") && (
                <Button
                  onClick={() => {
                    handleConfirmBooking(selectedBooking);
                    setSelectedBooking(null);
                  }}
                  className="h-10 text-[0.88rem]"
                >
                  Confirm & Issue Pass
                </Button>
              )}
            </div>
          </div>
        </div>, document.body
      )}

      {/* Rejection Modal with Category & Purpose Explanation */}
      {rejectionModalBooking && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md rise">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl border border-border bg-card p-6 shadow-2xl sm:p-8">
            <h2 className="text-[1.15rem] font-semibold text-foreground">
              Decline Request ({rejectionModalBooking.id})
            </h2>
            <p className="mt-1 text-[0.85rem] text-muted-foreground">
              Specify the rejection category and detailed explanation for declining this request.
            </p>

            {/* Rejection Category Selection */}
            <div className="mt-4 space-y-1.5">
              <label className="block text-[0.8rem] font-semibold text-foreground">
                Rejection Purpose / Category
              </label>
              <select
                value={rejectionCategory}
                onChange={(e) => setRejectionCategory(e.target.value)}
                className="h-11 w-full rounded-xl border border-border bg-card px-3 text-[0.88rem] font-medium outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10"
              >
                <option value="Schedule Conflict / Venue Overlap">Schedule Conflict / Venue Overlap</option>
                <option value="Venue Under Maintenance / Technical Upgrades">Venue Under Maintenance / Technical Upgrades</option>
                <option value="Incomplete Event Purpose / Information Missing">Incomplete Event Purpose / Information Missing</option>
                <option value="Capacity & Safety Limit Exceeded">Capacity & Safety Limit Exceeded</option>
                <option value="Other Administrative Reason">Other Administrative Reason</option>
              </select>
            </div>

            {/* Rejection Explanation Textarea */}
            <div className="mt-4 space-y-1.5">
              <label className="block text-[0.8rem] font-semibold text-foreground">
                Detailed Explanation / Note for User
              </label>
              <textarea
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explain why the request was declined (e.g. Venue reserved for College Day rehearsal)..."
                className="w-full resize-none rounded-xl border border-border bg-card p-3 text-[0.88rem] outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10"
              />
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-border/60 pt-4">
              <button
                onClick={() => {
                  setRejectionModalBooking(null);
                  setRejectionReason("");
                }}
                className="press h-10 rounded-xl border border-border px-4 text-[0.88rem] font-medium hover:bg-muted"
              >
                Cancel
              </button>

              <button
                onClick={handleConfirmReject}
                className="press h-10 rounded-xl bg-red-600 px-5 text-[0.88rem] font-semibold text-white transition-all hover:bg-red-700 shadow-md"
              >
                Confirm Decline
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
