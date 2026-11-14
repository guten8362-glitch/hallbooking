import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { createPortal } from "react-dom";
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
  Clock,
  Pencil,
  Save,
  Trash2,
  Loader2,
  ChevronDown
} from "lucide-react";
import { useState, useMemo, useEffect, useRef } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button, PageTitle, Row, Surface } from "@/components/ui-kit";
import { formatDate, formatTime, getStageInfo, useBookings, getNextStage, type Booking, getInstitutionLogo, notifyRole } from "@/lib/booking-store";
import { useAuth, isAdminUser, type UserRole } from "@/lib/auth";
import { addUserToDatabase, getAllUsersFromDatabase, deleteUserFromDatabase } from "@/lib/appwrite/users";
import { updateBooking, createNotification } from "@/lib/appwrite/database";
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

const toDateInputValue = (booking: any): string => {
  if (!booking) return "";
  // 1. Check selectedDates array
  if (Array.isArray(booking.selectedDates) && booking.selectedDates.length > 0) {
    const dStr = String(booking.selectedDates[0]).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(dStr)) return dStr;
  }
  // 2. Check fromDate
  if (booking.fromDate) {
    const trimmed = String(booking.fromDate).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    if (trimmed.includes("T")) {
      const part = trimmed.split("T")[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(part)) return part;
    }
  }
  // 3. Check eventDate
  if (booking.eventDate) {
    const trimmed = String(booking.eventDate).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    if (trimmed.includes("T")) {
      const part = trimmed.split("T")[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(part)) return part;
    }
  }
  // 4. Try parsing booking.date
  if (booking.date) {
    const d = new Date(booking.date);
    if (!isNaN(d.getTime())) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }
  }
  return "";
};

const toTimeInputValue = (timeStr?: string): string => {
  if (!timeStr) return "";
  let val = timeStr.trim();
  if (/am|pm/i.test(val)) {
    const isPM = /pm/i.test(val);
    const clean = val.replace(/am|pm/gi, "").trim();
    const [h, m] = clean.split(":").map(Number);
    let hour = h;
    if (isPM && hour < 12) hour += 12;
    if (!isPM && hour === 12) hour = 0;
    return `${String(hour).padStart(2, "0")}:${String(m || 0).padStart(2, "0")}`;
  }
  if (val.includes(":")) {
    const [h, m] = val.split(":");
    return `${String(parseInt(h, 10)).padStart(2, "0")}:${String(parseInt(m, 10)).padStart(2, "0")}`;
  }
  return val;
};

function Admin() {
  const { user, ready: authReady } = useAuth();
  const { bookings, advance, remove, ready: bookingsReady, getAuditorium } = useBookings();
  const navigate = useNavigate();

  const [tab, setTab] = useState<AdminTab>("pending");
  const [search, setSearch] = useState("");
  const [isEditingBooking, setIsEditingBooking] = useState(false);
  const [editDate, setEditDate] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const handleEditClick = () => {
    if (selectedBooking) {
      setEditDate(toDateInputValue(selectedBooking));
      setEditStartTime(toTimeInputValue(selectedBooking.startTime));
      setEditEndTime(toTimeInputValue(selectedBooking.endTime));
      setIsEditingBooking(true);
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedBooking) return;
    setIsSavingEdit(true);
    try {
      const displayDate = formatDate(editDate);
      await updateBooking(selectedBooking.id, {
        date: displayDate,
        fromDate: editDate,
        toDate: editDate,
        selectedDates: [editDate],
        startTime: editStartTime,
        endTime: editEndTime
      });
      await createNotification({
        userId: selectedBooking.requesterId,
        title: "Booking Updated",
        message: `Sorry for the inconvenience. The admin has changed your booking (${selectedBooking.eventName || selectedBooking.id}) date/time to ${displayDate} ${formatTime(editStartTime)} - ${formatTime(editEndTime)}.`,
        bookingId: selectedBooking.id,
        type: "info"
      });
      
      // Also notify the coordinator/organizer of the change
      await notifyRole(
        'coordinator', 
        `Booking Updated: ${selectedBooking.eventName || 'Booking'}`, 
        `The admin has changed the date/time for ${selectedBooking.eventName || 'this booking'} to ${displayDate} ${formatTime(editStartTime)} - ${formatTime(editEndTime)}.`, 
        selectedBooking.institution, 
        `${window.location.origin}/bookings/${selectedBooking.id}`
      );
      
      // Update selected booking optimistic state so UI refreshes immediately
      setSelectedBooking({
        ...selectedBooking,
        date: displayDate,
        fromDate: editDate,
        toDate: editDate,
        selectedDates: [editDate],
        startTime: editStartTime,
        endTime: editEndTime
      });
      setIsEditingBooking(false);
    } catch (err: any) {
      alert("Failed to update booking date and time: " + (err?.message || "Unknown error"));
    } finally {
      setIsSavingEdit(false);
    }
  };
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [rejectionModalBooking, setRejectionModalBooking] = useState<Booking | null>(null);
  const [rejectionCategory, setRejectionCategory] = useState("Schedule Conflict / Venue Overlap");
  const [rejectionReason, setRejectionReason] = useState("");

  // Add User Form State
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserInstitution, setNewUserInstitution] = useState("MVIT");
  const [newUserRole, setNewUserRole] = useState<UserRole>("user");
  const [userAddedSuccess, setUserAddedSuccess] = useState("");

  const [usersList, setUsersList] = useState<any[]>([]);
  const [userToDelete, setUserToDelete] = useState<any | null>(null);
  const [expandedUserEmail, setExpandedUserEmail] = useState<string | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [pressingUserEmail, setPressingUserEmail] = useState<string | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  const handleStartLongPress = (targetUser: any) => {
    if (user && (targetUser.email || "").toLowerCase() === (user.email || "").toLowerCase()) {
      return;
    }
    setPressingUserEmail(targetUser.email);
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
    longPressTimerRef.current = setTimeout(() => {
      setUserToDelete(targetUser);
      setPressingUserEmail(null);
      if (typeof window !== "undefined" && navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 600);
  };

  const handleCancelLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    setPressingUserEmail(null);
  };

  const handleConfirmDeleteUser = async () => {
    if (!userToDelete) return;

    if (user && (userToDelete.email || "").toLowerCase() === (user.email || "").toLowerCase()) {
      toast.error("You cannot delete your own admin account.");
      setUserToDelete(null);
      return;
    }

    if (
      userToDelete.role === "super_admin" ||
      (userToDelete.email || "").toLowerCase().includes("superadmin") ||
      (userToDelete.email || "").toLowerCase() === "guten8362@gmail.com"
    ) {
      if (user?.role !== "super_admin" && (user?.email || "").toLowerCase() !== "guten8362@gmail.com") {
        toast.error("Super Admin accounts cannot be deleted.");
        setUserToDelete(null);
        return;
      }
    }

    setIsDeletingUser(true);
    try {
      const success = await deleteUserFromDatabase(userToDelete);
      if (success) {
        setUsersList((prev) =>
          prev.filter(
            (u) =>
              (u.email || "").toLowerCase() !== (userToDelete.email || "").toLowerCase() &&
              (!userToDelete.docId || u.docId !== userToDelete.docId)
          )
        );
        toast.success(`User "${userToDelete.name || userToDelete.email}" deleted successfully.`);
        setUserToDelete(null);
      } else {
        toast.error("Failed to delete user. Please try again.");
      }
    } catch (err) {
      console.error("Error deleting user:", err);
      toast.error("An error occurred while deleting user.");
    } finally {
      setIsDeletingUser(false);
    }
  };

  useEffect(() => {
    // SECURITY PATCH: Only fetch users if the current user is actually an admin.
    if (user && isAdminUser(user)) {
      getAllUsersFromDatabase().then(setUsersList);
    }
  }, [userAddedSuccess, user]);

  const handleAddUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail || !newUserName) return;
    
    await addUserToDatabase({
      name: newUserName,
      email: newUserEmail,
      institution: newUserInstitution,
      role: newUserRole,
    });

    setUserAddedSuccess(`✅ User "${newUserName}" (${newUserEmail}) added successfully as ${newUserRole.toUpperCase()}!`);
    setNewUserName("");
    setNewUserEmail("");
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
      const hallName = getAuditorium(b.auditoriumId || (b as any).hallId)?.name?.toLowerCase() || "";
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

              <div>
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-1">
              <div>
                <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" /> Registered Users Directory ({usersList.length})
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Manage authorized users and permissions across institutions.
                </p>
              </div>
              <span className="text-[0.75rem] font-medium text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-full border border-border/50 self-start sm:self-auto flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span>Click any user to manage or delete</span>
              </span>
            </div>

            <div className="space-y-3">
              {Array.from(new Set(usersList.map((u) => u.institution || "Unknown"))).map((inst) => {
                const instUsers = usersList.filter((u) => (u.institution || "Unknown") === inst);
                return (
                  <details key={inst} className="border border-border/70 rounded-2xl bg-card overflow-hidden group shadow-xs" open={inst === "MVIT" || inst === "MVIT (Manakula Vinayagar Institute of Technology)"}>
                    <summary className="bg-muted/30 px-4 py-3.5 font-bold text-[0.88rem] text-foreground flex items-center justify-between cursor-pointer select-none outline-none group-open:border-b group-open:border-border/60 hover:bg-muted/50 transition-colors">
                      {inst}
                      <span className="bg-muted px-2 py-0.5 rounded-full text-[0.7rem] text-muted-foreground border border-border/50">{instUsers.length} Users</span>
                    </summary>
                    <div className="divide-y divide-border/40 p-2 space-y-1">
                      {instUsers.map((u) => {
                        const isCurrentUser = user && (u.email || "").toLowerCase() === (user.email || "").toLowerCase();
                        const isExpanded = expandedUserEmail === u.email;
                        const isPressing = pressingUserEmail === u.email;

                        const initials = (u.name || u.email || "U")
                          .split(" ")
                          .filter(Boolean)
                          .map((n: string) => n[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase();

                        return (
                          <div
                            key={u.email}
                            onClick={() => {
                              if (!isCurrentUser) {
                                setExpandedUserEmail(isExpanded ? null : u.email);
                              }
                            }}
                            onMouseDown={() => !isCurrentUser && handleStartLongPress(u)}
                            onMouseUp={handleCancelLongPress}
                            onMouseLeave={handleCancelLongPress}
                            onTouchStart={() => !isCurrentUser && handleStartLongPress(u)}
                            onTouchEnd={handleCancelLongPress}
                            onTouchMove={handleCancelLongPress}
                            className={cn(
                              "relative rounded-xl p-3 transition-all select-none overflow-hidden",
                              isCurrentUser ? "bg-muted/10 cursor-default" : "cursor-pointer hover:bg-muted/30 active:scale-[0.995]",
                              isExpanded && "bg-muted/30 ring-1 ring-border shadow-xs",
                              isPressing && "bg-red-500/10 ring-2 ring-red-500/40"
                            )}
                          >
                            {/* Animated Long Press Progress Bar */}
                            {isPressing && (
                              <div className="absolute inset-x-0 bottom-0 h-1 bg-red-200 dark:bg-red-950 overflow-hidden">
                                <div className="h-full bg-red-600 transition-all duration-600 w-full animate-pulse" />
                              </div>
                            )}

                            {/* Main User Row */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={cn(
                                  "size-8 rounded-full font-bold text-[0.72rem] flex items-center justify-center shrink-0 border",
                                  isCurrentUser 
                                    ? "bg-primary text-primary-foreground border-primary" 
                                    : "bg-primary/10 text-primary border-primary/20"
                                )}>
                                  {initials}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-bold text-[0.84rem] text-foreground flex items-center flex-wrap gap-1.5 truncate">
                                    <span className="truncate">{u.name || "User"}</span>
                                    {isCurrentUser && (
                                      <span className="text-[0.65rem] px-1.5 py-0.2 rounded-md bg-muted text-muted-foreground border border-border/60 font-semibold">
                                        You
                                      </span>
                                    )}
                                    <span className="font-mono text-muted-foreground font-normal text-xs ml-0.5">({u.email})</span>
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                                <span className={cn(
                                  "px-3 py-1 rounded-full text-[0.65rem] font-bold uppercase tracking-wider",
                                  u.role === "admin" ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" :
                                  u.role === "coordinator" ? "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300" :
                                  "bg-primary-soft text-primary"
                                )}>
                                  {u.role}
                                </span>

                                {!isCurrentUser && (
                                  <div className="flex items-center justify-center w-6 h-6 rounded-md hover:bg-muted text-muted-foreground transition-colors">
                                    <ChevronDown className={cn("size-4 transition-transform duration-200", isExpanded && "rotate-180 text-foreground")} />
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Expanded Action Drawer */}
                            {isExpanded && !isCurrentUser && (
                              <div className="mt-3 pt-3 border-t border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-1 duration-150">
                                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                  <span className="inline-flex items-center bg-muted/60 px-2.5 py-1 rounded-lg border border-border/40 font-medium">
                                    {u.institution || "MVIT"}
                                  </span>
                                  {u.department && (
                                    <span className="inline-flex items-center bg-muted/60 px-2.5 py-1 rounded-lg border border-border/40 font-medium">
                                      {u.department}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedUserEmail(null);
                                    }}
                                    className="h-8 px-3 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                                  >
                                    Close
                                  </button>

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setUserToDelete(u);
                                    }}
                                    className="h-8 px-3.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all hover:scale-[1.02]"
                                  >
                                    <Trash2 className="size-3.5" />
                                    <span>Delete User</span>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
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
          const hall = getAuditorium(b.auditoriumId || (b as any).hallId);
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
                  <div className="mt-1.5 flex items-center flex-wrap gap-3 text-[0.88rem] text-muted-foreground font-medium">
                    <span className="flex items-center gap-1.5"><CalendarDays className="size-4 text-primary" /> {formatDate(b.fromDate || b.date, b.toDate)}</span>
                    <span className="text-border hidden sm:inline">|</span>
                    <span className="flex items-center gap-1.5"><Clock className="size-4 text-primary" /> {formatTime(b.startTime)} – {formatTime(b.endTime)}</span>
                    {b.stage !== "rejected" && (
                      <button
                        onClick={() => { 
                          setSelectedBooking(b); 
                          setEditDate(toDateInputValue(b));
                          setEditStartTime(toTimeInputValue(b.startTime));
                          setEditEndTime(toTimeInputValue(b.endTime));
                          setIsEditingBooking(true);
                        }}
                        className="ml-2 inline-flex items-center justify-center rounded-full bg-primary/10 p-1.5 text-primary hover:bg-primary hover:text-white transition-colors"
                        title="Edit Date/Time"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                    )}
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
                <div className="flex flex-wrap items-center gap-4">
                  <button
                    onClick={() => { setSelectedBooking(b); setIsEditingBooking(false); }}
                    className="press inline-flex items-center gap-1.5 text-[0.88rem] font-medium text-primary hover:underline"
                  >
                    <Eye className="size-4" /> View Request Details
                  </button>
                </div>

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
      {selectedBooking && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-border bg-card p-6 shadow-2xl sm:p-8">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-[1.25rem] font-semibold text-foreground">
                  {getAuditorium(selectedBooking.auditoriumId || (selectedBooking as any).hallId)?.name || (selectedBooking as any).auditoriumName || "Unknown Venue"}
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
              
              {!isEditingBooking ? (
                <>
                  <Row 
                    label="Event Dates" 
                    value={
                      <div className="flex items-center gap-2">
                        {formatDate(selectedBooking.fromDate || selectedBooking.date, selectedBooking.toDate)}
                        {selectedBooking.stage !== "rejected" && (
                          <button onClick={handleEditClick} className="text-primary hover:underline flex items-center gap-1 text-[0.8rem] ml-2">
                            <Pencil className="size-3" /> Edit
                          </button>
                        )}
                      </div>
                    } 
                  />
                  <Row label="Time Slot" value={`${formatTime(selectedBooking.startTime)} – ${formatTime(selectedBooking.endTime)}`} />
                </>
              ) : (
                <div className="my-3 flex flex-col gap-3 rounded-2xl bg-muted/40 p-4 border border-border/60 shadow-xs">
                  <h4 className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                    <Pencil className="size-4 text-primary" /> Edit Date & Time
                  </h4>
                  <div className="flex flex-col gap-2.5">
                    <div>
                      <label className="text-[0.76rem] font-semibold text-muted-foreground block mb-1">
                        Event Date
                      </label>
                      <input 
                        type="date" 
                        value={editDate} 
                        onChange={(e) => setEditDate(e.target.value)}
                        className="h-11 w-full rounded-xl border border-border px-3 text-[0.92rem] font-medium bg-background text-foreground shadow-xs focus:ring-2 focus:ring-primary/20 outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[0.76rem] font-semibold text-muted-foreground block mb-1">
                          Start Time
                        </label>
                        <input 
                          type="time" 
                          value={editStartTime} 
                          onChange={(e) => setEditStartTime(e.target.value)}
                          className="h-11 w-full rounded-xl border border-border px-3 text-[0.92rem] font-medium bg-background text-foreground shadow-xs focus:ring-2 focus:ring-primary/20 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[0.76rem] font-semibold text-muted-foreground block mb-1">
                          End Time
                        </label>
                        <input 
                          type="time" 
                          value={editEndTime} 
                          onChange={(e) => setEditEndTime(e.target.value)}
                          className="h-11 w-full rounded-xl border border-border px-3 text-[0.92rem] font-medium bg-background text-foreground shadow-xs focus:ring-2 focus:ring-primary/20 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-1">
                    <Button size="sm" onClick={handleSaveEdit} disabled={isSavingEdit}>
                      {isSavingEdit ? "Saving..." : <><Save className="size-3.5 mr-1" /> Save Details</>}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setIsEditingBooking(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
              
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
      {rejectionModalBooking && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md">
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
        </div>, document.body
      )}

      {/* Delete User Confirmation Modal */}
      {userToDelete && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-3xl border border-border/80 bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400">
                <Trash2 className="size-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Delete User</h3>
                <p className="text-xs text-muted-foreground">Remove user record permanently</p>
              </div>
            </div>

            <div className="rounded-2xl bg-muted/40 border border-border/60 p-4 mb-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Name:</span>
                <span className="font-semibold text-foreground">{userToDelete.name || "User"}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Email:</span>
                <span className="font-mono font-medium text-foreground">{userToDelete.email}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Role:</span>
                <span className="uppercase font-bold text-foreground">{userToDelete.role}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Institution:</span>
                <span className="font-semibold text-foreground">{userToDelete.institution || "MVIT"}</span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
              Are you sure you want to remove <strong className="text-foreground">{userToDelete.name || userToDelete.email}</strong>? This user will no longer be able to log in or make auditorium bookings.
            </p>

            <div className="flex items-center justify-end gap-3 border-t border-border/60 pt-4">
              <button
                type="button"
                disabled={isDeletingUser}
                onClick={() => setUserToDelete(null)}
                className="press h-10 rounded-xl border border-border px-4 text-[0.88rem] font-medium hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isDeletingUser}
                onClick={handleConfirmDeleteUser}
                className="press flex items-center gap-2 h-10 rounded-xl bg-red-600 px-5 text-[0.88rem] font-semibold text-white transition-all hover:bg-red-700 shadow-md disabled:opacity-50"
              >
                {isDeletingUser ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="size-4" />
                    <span>Delete User</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </AppShell>
  );
}
