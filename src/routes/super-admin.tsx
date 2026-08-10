import { useState, useEffect, useMemo } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth, isSuperAdminUser, type User } from "@/lib/auth";
import {
  fetchSuperAdminUsers,
  groupUsersByInstitution,
  filterUsers,
  type SuperAdminUser,
} from "@/lib/services/super-admin";
import { getAuditLogs, type AuditEntry } from "@/lib/services/audit";
import { AppShell } from "@/components/AppShell";
import {
  ShieldAlert,
  Search,
  Filter,
  UserCheck,
  Building2,
  Mail,
  User as UserIcon,
  Shield,
  Activity,
  History,
  X,
  ChevronRight,
  RefreshCw,
} from "lucide-react";

export const Route = createFileRoute("/super-admin")({
  component: SuperAdminDashboard,
});

export function SuperAdminDashboard() {
  const { realUser, user, isImpersonating, startImpersonation, stopImpersonation } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers] = useState<SuperAdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [institutionFilter, setInstitutionFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [selectedUser, setSelectedUser] = useState<SuperAdminUser | null>(null);
  const [showAuditLogs, setShowAuditLogs] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);

  // Security Check: Only super_admin / admin can access
  useEffect(() => {
    if (!realUser || !isSuperAdminUser(realUser)) {
      navigate({ to: "/auditoriums" });
    }
  }, [realUser, navigate]);

  const loadData = async () => {
    // SECURITY PATCH: Only execute the fetch if the user is authorized.
    // This prevents eager fetching from leaking data in the network tab before the redirect hook bounces unauthorized users.
    if (!realUser || !isSuperAdminUser(realUser)) return;
    
    setLoading(true);
    try {
      const data = await fetchSuperAdminUsers();
      setUsers(data);
    } catch (err) {
      console.error("Failed to load super admin users", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (realUser) {
      loadData();
    }
  }, [realUser]);

  const handleOpenAudit = () => {
    setAuditLogs(getAuditLogs());
    setShowAuditLogs(true);
  };

  // Distinct institutions for filter dropdown
  const institutionOptions = useMemo(() => {
    const set = new Set<string>();
    users.forEach((u) => {
      if (u.institution) set.add(u.institution);
    });
    return Array.from(set).sort();
  }, [users]);

  // Filtered users list
  const filteredUsers = useMemo(() => {
    return filterUsers(users, searchQuery, institutionFilter, roleFilter, statusFilter);
  }, [users, searchQuery, institutionFilter, roleFilter, statusFilter]);

  // Grouped by institution
  const groupedUsers = useMemo(() => {
    return groupUsersByInstitution(filteredUsers);
  }, [filteredUsers]);

  const handleStartImpersonation = (targetUser: SuperAdminUser) => {
    startImpersonation(targetUser);
    setSelectedUser(null);
    
    // Navigate to appropriate landing page for that role
    if (targetUser.role === "coordinator") {
      navigate({ to: "/coordinator" });
    } else if (targetUser.role === "organizer") {
      navigate({ to: "/organizer" });
    } else if (targetUser.role === "admin") {
      navigate({ to: "/admin" });
    } else {
      navigate({ to: "/auditoriums" });
    }
  };

  if (!realUser || !isSuperAdminUser(realUser)) {
    return null;
  }

  return (
    <AppShell>
      <div className="space-y-6 pb-12">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-primary/5 p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
              <ShieldAlert className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-foreground">
                  Super Admin Dashboard
                </h1>
                <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-primary">
                  Impersonation Control
                </span>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Manage accounts across all institutions and launch Impersonation Mode seamlessly.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleOpenAudit}
              className="press inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-xs sm:text-sm font-medium text-foreground shadow-2xs hover:bg-accent transition-colors"
            >
              <History className="size-4 text-primary" />
              <span>Audit Trail</span>
            </button>
            
            <button
              onClick={loadData}
              disabled={loading}
              className="press inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-xs sm:text-sm font-medium text-foreground shadow-2xs hover:bg-accent transition-colors"
              title="Refresh User Data"
            >
              <RefreshCw className={`size-4 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
            <div className="text-xs font-medium text-muted-foreground">Total Users</div>
            <div className="text-2xl font-bold text-foreground mt-1">{users.length}</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
            <div className="text-xs font-medium text-muted-foreground">Institutions</div>
            <div className="text-2xl font-bold text-foreground mt-1">{groupedUsers.length}</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
            <div className="text-xs font-medium text-muted-foreground">Online Now</div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-emerald-500 animate-pulse" />
              {users.filter((u) => u.isOnline).length}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
            <div className="text-xs font-medium text-muted-foreground">Matching Search</div>
            <div className="text-2xl font-bold text-primary mt-1">{filteredUsers.length}</div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search Bar */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by name, email, institution, or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-input bg-background pl-10 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              {/* Institution Filter */}
              <select
                value={institutionFilter}
                onChange={(e) => setInstitutionFilter(e.target.value)}
                className="rounded-xl border border-input bg-background px-3 py-2 text-xs sm:text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="all">All Institutions</option>
                {institutionOptions.map((inst) => (
                  <option key={inst} value={inst}>
                    {inst}
                  </option>
                ))}
              </select>

              {/* Role Filter */}
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="rounded-xl border border-input bg-background px-3 py-2 text-xs sm:text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="all">All Roles</option>
                <option value="user">User</option>
                <option value="coordinator">Coordinator</option>
                <option value="organizer">Organizer</option>
                <option value="admin">Admin</option>
                <option value="super_admin">Super Admin</option>
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-xl border border-input bg-background px-3 py-2 text-xs sm:text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>
        </div>

        {/* User Groups by Institution */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <RefreshCw className="size-8 animate-spin text-primary mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Loading users from Appwrite...</p>
          </div>
        ) : groupedUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-12 text-center">
            <UserIcon className="size-10 text-muted-foreground/60 mb-3" />
            <h3 className="text-base font-semibold text-foreground">No users found</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              No user matches the specified search term or filters. Try adjusting your query.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {groupedUsers.map((group) => (
              <div key={group.institution} className="space-y-3">
                {/* Institution Header */}
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="size-4 text-primary" />
                    <h2 className="text-base font-bold text-foreground tracking-tight">
                      {group.institution}
                    </h2>
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                      {group.users.length} {group.users.length === 1 ? "user" : "users"}
                    </span>
                  </div>
                </div>

                {/* User Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {group.users.map((u) => (
                    <div
                      key={u.$id || u.email}
                      className="group relative rounded-2xl border border-border bg-card p-4 transition-all duration-200 hover:border-primary/50 hover:shadow-md flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        {/* Header line: Online dot + Role badge */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className={`size-2.5 rounded-full ${
                                u.isOnline ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"
                              }`}
                              title={u.isOnline ? "Online" : "Offline"}
                            />
                            <span className="text-[0.7rem] font-medium text-muted-foreground capitalize">
                              {u.isOnline ? "Online" : "Offline"}
                            </span>
                          </div>

                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[0.68rem] font-bold uppercase tracking-wider ${
                              u.role === "super_admin" || u.role === "admin"
                                ? "bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300"
                                : u.role === "coordinator"
                                ? "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300"
                                : u.role === "organizer"
                                ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                                : "bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300"
                            }`}
                          >
                            {u.role}
                          </span>
                        </div>

                        {/* User Details */}
                        <div>
                          <h3 className="font-semibold text-foreground text-sm group-hover:text-primary transition-colors truncate">
                            {u.name || u.email.split("@")[0]}
                          </h3>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1 truncate">
                            <Mail className="size-3.5 shrink-0" />
                            <span className="truncate">{u.email}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1 truncate">
                            <Building2 className="size-3.5 shrink-0" />
                            <span className="truncate">{u.institution}</span>
                          </div>
                        </div>
                      </div>

                      {/* Card Actions */}
                      <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedUser(u)}
                          className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                        >
                          View Details
                        </button>

                        <button
                          type="button"
                          onClick={() => handleStartImpersonation(u)}
                          className="press inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-2xs hover:bg-primary/90 transition-all"
                        >
                          <UserCheck className="size-3.5" />
                          <span>Impersonate</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* User Detail Profile Modal */}
        {selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <UserIcon className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground text-base">User Profile</h3>
                    <p className="text-xs text-muted-foreground">Appwrite Account Details</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <X className="size-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs sm:text-sm">
                <div className="flex justify-between py-1.5 border-b border-border/40">
                  <span className="text-muted-foreground">Full Name:</span>
                  <span className="font-semibold text-foreground">{selectedUser.name || "N/A"}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border/40">
                  <span className="text-muted-foreground">Email:</span>
                  <span className="font-medium text-foreground">{selectedUser.email}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border/40">
                  <span className="text-muted-foreground">Institution:</span>
                  <span className="font-medium text-foreground">{selectedUser.institution}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border/40">
                  <span className="text-muted-foreground">Role:</span>
                  <span className="font-bold capitalize text-primary">{selectedUser.role}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border/40">
                  <span className="text-muted-foreground">Status:</span>
                  <span className="font-semibold capitalize text-emerald-600">{selectedUser.status}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-muted-foreground">Appwrite ID:</span>
                  <span className="font-mono text-xs text-muted-foreground">{selectedUser.$id || "—"}</span>
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  onClick={() => setSelectedUser(null)}
                  className="flex-1 rounded-xl border border-border bg-card py-2 text-xs font-semibold text-foreground hover:bg-accent transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => handleStartImpersonation(selectedUser)}
                  className="flex-1 press inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-all"
                >
                  <UserCheck className="size-4" />
                  <span>Impersonate User</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Audit Logs Modal */}
        {showAuditLogs && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <History className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground text-base">Impersonation Audit Logs</h3>
                    <p className="text-xs text-muted-foreground">
                      Track actions taken while acting on behalf of other users
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAuditLogs(false)}
                  className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <X className="size-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {auditLogs.length === 0 ? (
                  <div className="py-12 text-center text-xs text-muted-foreground">
                    No audit records registered yet.
                  </div>
                ) : (
                  auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="rounded-xl border border-border bg-muted/40 p-3 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span className="font-mono text-[0.7rem]">
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                        <span className="font-semibold uppercase text-primary text-[0.68rem] tracking-wider bg-primary/10 px-2 py-0.5 rounded">
                          {log.action}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 text-foreground pt-1">
                        <div>
                          <span className="text-muted-foreground">Performed By: </span>
                          <strong className="text-xs">{log.performedByName || log.performedBy}</strong>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Acting As: </span>
                          <strong className="text-xs text-amber-600 dark:text-amber-400">
                            {log.actingAsName || log.actingAs}
                          </strong>
                        </div>
                      </div>
                      {log.details && (
                        <div className="text-[0.72rem] text-muted-foreground pt-1 border-t border-border/30 font-mono">
                          {typeof log.details === "object"
                            ? JSON.stringify(log.details)
                            : log.details}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setShowAuditLogs(false)}
                  className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
