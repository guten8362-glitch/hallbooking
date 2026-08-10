import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { 
  CheckCircle2, 
  XCircle, 
  Eye, 
  Download, 
  Search, 
  Calendar as CalendarIcon, 
  ShieldCheck, 
  FileText,
  ShieldAlert,
  UserCheck,
  CalendarDays,
  Clock,
  Plus,
  Users
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button, Surface, PageTitle } from "@/components/ui-kit";
import { formatDate, formatTime, useBookings, getStageInfo, getNextStage, type Booking, getInstitutionLogo } from "@/lib/booking-store";
import { downloadConfirmation } from "@/lib/letter";
import { useAuth, isCoordinatorUser } from "@/lib/auth";
import { addUserToDatabase, getAllUsersFromDatabase } from "@/lib/appwrite/users";
import { type UserRole } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/coordinator")({
  head: () => ({
    meta: [
      { title: "Coordinator & Approval Portal — Central Hall Booking" },
      { name: "description", content: "Review, approve, or decline campus auditorium requests." },
    ],
  }),
  component: CoordinatorPortal,
});

export function CoordinatorPortal() {
  const { user } = useAuth();
  const { bookings, advance, getAuditorium, ready } = useBookings();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"pending" | "confirmed" | "rejected" | "calendar" | "users">("pending");
  
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [approvalModalBooking, setApprovalModalBooking] = useState<Booking | null>(null);
  const [approvalRemarks, setApprovalRemarks] = useState("");
  const [rejectionModalBooking, setRejectionModalBooking] = useState<Booking | null>(null);
  const [rejectionCategory, setRejectionCategory] = useState("Schedule Conflict");
  const [rejectionReason, setRejectionReason] = useState("");
  const [adminViewRole, setAdminViewRole] = useState<"super_admin" | "coordinator">("super_admin");

  // Add User Form State
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<UserRole>("user");
  const [userAddedSuccess, setUserAddedSuccess] = useState("");
  const [usersList, setUsersList] = useState<any[]>([]);

  useEffect(() => {
    // SECURITY PATCH: Only fetch if authorized
    if (user && (isCoordinatorUser(user) || user.role === "admin")) {
      getAllUsersFromDatabase().then((allUsers) => {
        // Coordinator can only see users from their institution
        const coordInst = (user?.institution || "").toLowerCase().trim();
        setUsersList(allUsers.filter(u => (u.institution || "").toLowerCase().trim() === coordInst));
      });
    }
  }, [userAddedSuccess, user]);

  const handleAddUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail || !newUserPassword || !newUserName) return;
    
    await addUserToDatabase({
      name: newUserName,
      email: newUserEmail,
      password: newUserPassword,
      institution: user?.institution || "MVIT",
      role: newUserRole,
    });

    setUserAddedSuccess(`✅ User "${newUserName}" (${newUserEmail}) added successfully as ${newUserRole.toUpperCase()}!`);
    setNewUserName("");
    setNewUserEmail("");
    setNewUserPassword("");
    setTimeout(() => setUserAddedSuccess(""), 4000);
  };

  const isAdmin = user?.role === "admin";

  const allowedBookings = useMemo(() => {
    if (isAdmin && adminViewRole === "super_admin") return bookings;
    const coordInst = (user?.institution || "").toLowerCase().trim();
    return bookings.filter(b => (b.institution || "").toLowerCase().trim() === coordInst);
  }, [bookings, isAdmin, adminViewRole, user?.institution]);

  const pendingBookings = useMemo(() => {
    return allowedBookings.filter(b => {
      if (isAdmin && adminViewRole === "super_admin") return b.stage === "pending_super_admin";
      return b.stage === "pending_coordinator";
    });
  }, [allowedBookings, isAdmin, adminViewRole]);

  const confirmedBookings = useMemo(() => allowedBookings.filter(b => b.stage === "confirmed"), [allowedBookings]);
  const rejectedBookings = useMemo(() => allowedBookings.filter(b => b.stage === "rejected"), [allowedBookings]);

  const displayedBookings = useMemo(() => {
    let list: Booking[] = [];
    if (tab === "pending") list = pendingBookings;
    else if (tab === "confirmed") list = confirmedBookings;
    else if (tab === "rejected") list = rejectedBookings;
    else list = allowedBookings;

    if (!search.trim()) return list;

    const query = search.toLowerCase();
    return list.filter((b) => {
      const hall = getAuditorium(b.auditoriumId);
      return (
        (b?.id || "").toLowerCase().includes(query) ||
        (b?.institution || "").toLowerCase().includes(query) ||
        (b?.coordinator || "").toLowerCase().includes(query) ||
        (b?.eventName || "").toLowerCase().includes(query) ||
        (hall && (hall.name || "").toLowerCase().includes(query))
      );
    });
  }, [tab, pendingBookings, confirmedBookings, rejectedBookings, allowedBookings, search, getAuditorium]);

  const handleApproveSubmit = () => {
    if (!approvalModalBooking) return;
    const nextStage = getNextStage(approvalModalBooking.stage);
    advance(approvalModalBooking.id, nextStage, {
      organizerNotes: approvalRemarks.trim() || undefined,
    });
    setApprovalModalBooking(null);
    setApprovalRemarks("");
  };

  const handleRejectSubmit = () => {
    if (!rejectionModalBooking) return;
    advance(rejectionModalBooking.id, "rejected", {
      rejectionCategory,
      rejectionReason,
    });
    setRejectionModalBooking(null);
    setRejectionReason("");
  };

  if (!ready) {
    return (
      <AppShell>
        <div className="shimmer h-64 rounded-2xl" />
      </AppShell>
    );
  }

  if (user && !isCoordinatorUser(user) && user.role !== "admin") {
    return (
      <AppShell>
        <div className="mx-auto max-w-md py-16 text-center">
          <div className="mx-auto mb-4 grid size-16 place-items-center rounded-2xl bg-red-100 dark:bg-red-950/40 text-red-600">
            <ShieldAlert className="size-8" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Access Restricted</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This portal is restricted to Authorised Coordinators & Approving Authorities.
          </p>
          <Link to="/auditoriums" className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-xs hover:brightness-110">
            Return to Venue List
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageTitle 
        title="Venue Approval Dashboard" 
        subtitle="Review, approve, or reject venue requests with optional remarks & calendar conflict checks." 
      />
      <div className="mb-4 sm:mb-6">
        {isAdmin && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-3.5 rounded-2xl border border-border bg-muted/40 shadow-xs mb-6">
            <label className="text-[0.88rem] font-semibold flex items-center gap-2 shrink-0 text-foreground">
              <UserCheck className="size-4 text-primary" /> Select Approver Role / View:
            </label>
            <select 
              value={adminViewRole}
              onChange={(e) => setAdminViewRole(e.target.value as any)}
              className="flex-1 h-10 rounded-xl border border-border bg-card px-3 text-[0.88rem] outline-none hover:border-primary/50 transition-colors focus:ring-4 focus:ring-primary/10"
            >
              <option value="super_admin">All Pending Approvals (Super Admin) (Principal / Management)</option>
              <option value="coordinator">My Institution Approvals (Coordinator View)</option>
            </select>
          </div>
        )}
      </div>

      <div className="mb-4 sm:mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex overflow-x-auto whitespace-nowrap hide-scrollbar items-center gap-1.5 rounded-2xl bg-muted/60 p-1.5 border border-border/50">
          <button
            onClick={() => setTab("pending")}
            className={cn("flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all", tab === "pending" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground")}
          >
            Pending Approval
            <span className={cn("rounded-full px-2 py-0.5 text-[0.7rem]", tab === "pending" ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" : "bg-muted text-muted-foreground")}>
              {pendingBookings.length}
            </span>
          </button>
          <button
            onClick={() => setTab("confirmed")}
            className={cn("flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all", tab === "confirmed" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground")}
          >
            Confirmed
            <span className={cn("rounded-full px-2 py-0.5 text-[0.7rem]", tab === "confirmed" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-muted text-muted-foreground")}>
              {confirmedBookings.length}
            </span>
          </button>
          <button
            onClick={() => setTab("rejected")}
            className={cn("flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all", tab === "rejected" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground")}
          >
            Rejected
            <span className={cn("rounded-full px-2 py-0.5 text-[0.7rem]", tab === "rejected" ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" : "bg-muted text-muted-foreground")}>
              {rejectedBookings.length}
            </span>
          </button>
          <button
            onClick={() => setTab("calendar")}
            className={cn("flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all", tab === "calendar" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground")}
          >
            <CalendarIcon className="h-3.5 w-3.5" /> Schedule Calendar
          </button>
        </div>

        {/* Right Side Action Area: Search + Distinct Standalone Manage Users Box */}
        <div className="flex flex-wrap items-center gap-3">
          {tab !== "calendar" && tab !== "users" && (
            <div className="relative min-w-[200px] flex-1 sm:flex-initial">
              <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input type="text" suppressHydrationWarning placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-11 w-full rounded-2xl border border-border bg-card pl-9 pr-4 text-[0.88rem] outline-none transition-all placeholder:text-muted-foreground/60 focus:border-primary focus:ring-4 focus:ring-primary/10 shadow-xs" />
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
              <Users className="h-3.5 w-3.5" />
            </span>
            {tab === "users" ? "Back to Requests" : "Add & Manage Users"}
            <span className="rounded-full bg-white/25 px-2 py-0.5 text-[0.7rem] font-extrabold text-white">
              {usersList.length}
            </span>
          </button>
        </div>
      </div>

      {tab === "calendar" ? (
        <div className="rounded-3xl border border-border bg-card p-6 shadow-xs">
          <div className="mb-4 flex items-center justify-between border-b border-border/50 pb-3">
            <h3 className="font-bold text-base text-foreground flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-primary" /> Venue Booking Availability Calendar
            </h3>
          </div>
          <div className="space-y-4">
            {allowedBookings.map((b) => {
              const hall = getAuditorium(b.auditoriumId);
              const stageInfo = getStageInfo(b.stage);
              return (
                <div key={b.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl border border-border/70 bg-muted/30 gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground">{hall?.name || "Auditorium"}</span>
                      <span className={cn("px-2.5 py-0.5 rounded-full text-[0.68rem] font-bold border", stageInfo.bg)}>{stageInfo.label}</span>
                    </div>
                    <p className="text-xs font-semibold text-muted-foreground flex items-center gap-2">
                      <span className="flex items-center gap-1"><CalendarDays className="size-3.5" /> {formatDate(b.fromDate || b.date, b.toDate)}</span>
                      <span className="flex items-center gap-1"><Clock className="size-3.5" /> {formatTime(b.startTime)} – {formatTime(b.endTime)}</span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : tab === "users" ? (
        <div className="space-y-6">
          {/* Add User Form Card */}
          <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-xs">
            <div className="flex items-center gap-2.5 mb-4 border-b border-border/50 pb-3">
              <div className="grid size-9 place-items-center rounded-xl bg-primary-soft text-primary">
                <UserCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-foreground">Add New User / Applicant</h3>
                <p className="text-xs text-muted-foreground">Create accounts for venue applicants for {user?.institution || "your institution"}.</p>
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
                  placeholder="e.g. faculty@smvpc.edu"
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
                <label className="block text-xs font-bold text-foreground mb-1">Assigned Role</label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                  className="h-11 w-full rounded-xl border border-border bg-background px-3 text-xs font-bold text-foreground outline-none focus:border-primary"
                >
                  <option value="user">User / Applicant (Can view & book venues)</option>
                </select>
              </div>

              <div className="sm:col-span-2 pt-2">
                <Button type="submit" className="h-11 w-full text-xs">
                  Register & Add User
                </Button>
              </div>
            </form>
          </div>

          {/* Registered User List */}
          <div className="rounded-3xl border border-border bg-card p-6 shadow-xs">
            <h3 className="font-bold text-base text-foreground mb-3 flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" /> Registered Users Directory ({usersList.length})
            </h3>
            <div className="space-y-2.5">
              {usersList.map((u) => (
                <div key={u.email} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-2xl border border-border/70 bg-muted/20 gap-2">
                  <div>
                    <p className="font-bold text-xs text-foreground">{u.name || "User"} <span className="font-mono text-muted-foreground font-normal">({u.email})</span></p>
                    <p className="text-[0.75rem] text-muted-foreground">Institution: {u.institution}</p>
                  </div>
                  <span className={cn(
                    "px-3 py-1 rounded-full text-[0.7rem] font-bold uppercase tracking-wider self-start sm:self-auto",
                    u.role === "admin" ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" :
                    u.role === "coordinator" ? "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300" :
                    "bg-primary-soft text-primary"
                  )}>
                    {u.role}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {displayedBookings.length === 0 ? (
            <div className="rounded-3xl border border-border bg-card p-12 text-center">
              <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
                <FileText className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-foreground">No venue requests found</h3>
            </div>
          ) : (
            displayedBookings.map((b, i) => {
              const stageInfo = getStageInfo(b.stage);
              const hall = getAuditorium(b.auditoriumId);
              const hallDisplayName = hall?.name || (b as any).hallName || (b as any).auditoriumName || "Campus Auditorium";
              return (
                <Surface key={b.id} delay={i * 50} className="p-6 sm:p-7">
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold text-foreground">{hallDisplayName}</h2>
                      </div>
                      <div className="mt-1.5 flex items-center gap-3 text-xs font-semibold text-muted-foreground">
                        <span className="flex items-center gap-1.5"><CalendarDays className="size-3.5 text-primary" /> {formatDate(b.fromDate || b.date, b.toDate)}</span>
                        <span className="text-border">|</span>
                        <span className="flex items-center gap-1.5"><Clock className="size-3.5 text-primary" /> {formatTime(b.startTime)} – {formatTime(b.endTime)}</span>
                      </div>
                    </div>
                    <span className={cn("rounded-full border px-3.5 py-1 text-xs font-bold shadow-xs", stageInfo.bg)}>{stageInfo.label}</span>
                  </div>

                  <div className="mb-5 grid gap-2 rounded-2xl bg-muted/40 p-4 text-xs">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-0.5"><span className="text-muted-foreground mb-1.5 sm:mb-0">Institution / Dept:</span>
                      <div className="flex items-center gap-2 bg-card rounded-lg border border-border/60 px-2 py-1 shadow-sm">
                        <img src={getInstitutionLogo(b.institution)} alt={b.institution} className="h-5 w-5 rounded-md object-contain" />
                        <span className="font-bold text-foreground">{b.institution}</span>
                        <span className="text-muted-foreground font-normal mx-0.5">•</span>
                        <span className="font-medium text-foreground">{b.department}</span>
                      </div>
                    </div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Event & Purpose:</span><span className="font-semibold text-foreground">{b.eventName} - {b.purpose}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Coordinator / Audience:</span><span className="font-semibold text-foreground">{b.coordinator} ({b.participants} attendees)</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Chairs Required on Dais:</span><span className="font-bold text-primary">{(b as any).chairs || (b as any).daisChairs || (b as any).extra?.chairs || "5"} chairs</span></div>
                    {b.organizerNotes && <div className="mt-2 rounded-xl bg-primary-soft/40 p-2.5 text-primary text-xs font-medium flex items-center gap-1.5"><CheckCircle2 className="size-4" /> <strong>Approval Note:</strong> {b.organizerNotes}</div>}
                    {b.stage === "rejected" && (
                      <div className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3 text-red-800 dark:border-red-950 dark:bg-red-950/40 dark:text-red-300">
                        <p className="font-bold flex items-center gap-1.5"><XCircle className="h-4 w-4 text-red-600" /> Rejection Category: {b.rejectionCategory || "General"}</p>
                        <p className="mt-1 text-xs text-red-700 dark:text-red-400"><strong>Explanation:</strong> {b.rejectionReason || "No explanation provided."}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
                    <button onClick={() => setSelectedBooking(b)} className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"><Eye className="h-4 w-4" /> Full Booking Details</button>
                    <div className="flex flex-wrap items-center gap-2">
                      {b.stage !== "confirmed" && b.stage !== "rejected" && (
                        <>
                          <button onClick={() => setRejectionModalBooking(b)} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-4 text-xs font-bold text-red-700 hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300 transition-colors">
                            <XCircle className="h-4 w-4" /> Reject Request
                          </button>
                          <Button onClick={() => setApprovalModalBooking(b)} className="h-10 text-xs">
                            <CheckCircle2 className="h-4 w-4" /> {isAdmin ? "Confirm & Finalize" : "Approve & Forward"}
                          </Button>
                        </>
                      )}
                      {b.stage === "confirmed" && (
                        <button onClick={() => navigate({ to: "/bookings/$id/confirmed", params: { id: b.id } })} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border bg-card px-4 text-xs font-bold text-foreground hover:bg-muted">
                          <Eye className="h-4 w-4" /> View Confirmation Letter
                        </button>
                      )}
                    </div>
                  </div>
                </Surface>
              );
            })
          )}
        </div>
      )}

      {approvalModalBooking && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md">
          <div className="w-full max-w-md bg-card p-6 rounded-3xl border shadow-2xl">
            <h2 className="text-lg font-bold mb-1">{isAdmin ? "Confirm & Finalize Request" : "Approve & Forward Request"} ({approvalModalBooking.id})</h2>
            <div className="space-y-3 mt-4">
              <div>
                <label className="block text-xs font-bold mb-1">Optional Remarks</label>
                <textarea rows={3} value={approvalRemarks} onChange={(e) => setApprovalRemarks(e.target.value)} className="w-full rounded-xl border bg-background p-3 text-xs outline-none" />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setApprovalModalBooking(null)} className="flex-1 h-10 rounded-xl border bg-muted/50 text-xs font-bold">Cancel</button>
                <Button onClick={handleApproveSubmit} className="flex-1 h-10 text-xs">Confirm Approval</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {rejectionModalBooking && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md">
          <div className="w-full max-w-md bg-card p-6 rounded-3xl border shadow-2xl">
            <h2 className="text-lg font-bold mb-1">Decline Request ({rejectionModalBooking.id})</h2>
            <div className="space-y-3 mt-4">
              <div>
                <label className="block text-xs font-bold mb-1">Rejection Category</label>
                <select value={rejectionCategory} onChange={(e) => setRejectionCategory(e.target.value)} className="h-10 w-full rounded-xl border bg-background px-3 text-xs outline-none">
                  <option value="Schedule Conflict">Schedule Conflict</option>
                  <option value="Venue Maintenance">Venue Maintenance</option>
                  <option value="Incomplete Info">Incomplete Event Info</option>
                  <option value="Safety Limit">Exceeds Safety Limit</option>
                  <option value="Other">Other Reason</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Explanation</label>
                <textarea rows={3} value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} className="w-full rounded-xl border bg-background p-3 text-xs outline-none" />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setRejectionModalBooking(null)} className="flex-1 h-10 rounded-xl border bg-muted/50 text-xs font-bold">Cancel</button>
                <button onClick={handleRejectSubmit} disabled={!rejectionReason.trim()} className="flex-1 h-10 rounded-xl bg-red-600 text-white text-xs font-bold disabled:opacity-50">Confirm Rejection</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedBooking && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md">
          <div className="w-full max-w-lg bg-card p-6 rounded-3xl border shadow-2xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold">{getAuditorium(selectedBooking.auditoriumId)?.name}</h2>
              </div>
              <button onClick={() => setSelectedBooking(null)} className="rounded-full p-1 text-muted-foreground hover:bg-muted"><XCircle className="size-5" /></button>
            </div>
            <div className="space-y-2 text-xs bg-muted/40 p-4 rounded-2xl mb-4">
              <div className="flex justify-between"><span className="text-muted-foreground">Institution:</span> <span className="font-semibold">{selectedBooking.institution}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Department:</span> <span className="font-semibold">{selectedBooking.department}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Coordinator:</span> <span className="font-semibold">{selectedBooking.coordinator}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Event:</span> <span className="font-semibold">{selectedBooking.eventName}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Dates:</span> <span className="font-semibold">{formatDate(selectedBooking.fromDate || selectedBooking.date, selectedBooking.toDate)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Time Slot:</span> <span className="font-semibold">{formatTime(selectedBooking.startTime)} – {formatTime(selectedBooking.endTime)}</span></div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setSelectedBooking(null)} className="px-4 py-2 rounded-xl bg-muted text-xs font-bold">Close</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
