import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { listBookings, createBooking, updateBooking, deleteBooking, createNotification } from "./appwrite/database";
import { subscribeToBookings } from "./appwrite/realtime";
import { fetchAuditoriums } from "./auditoriums";
import type { Auditorium } from "./auditoriums";
import { getUserIdByEmail, sendPushNotification, sendEmailNotification, sendBookingConfirmationEmail } from "./appwrite/messaging";
import { getAllUsersFromDatabase } from "./appwrite/users";
import { recordAuditLog } from "./services/audit";
import { getStoredImpersonatedUser } from "./services/impersonation";
import { APPWRITE_CONFIG } from "./appwrite/constants";
import { useAuth } from "./auth";

const notifyRole = async (role: string, subject: string, content: string, targetInstitution?: string) => {
  try {
    const users = await getAllUsersFromDatabase();
    
    // Filter users matching role and institution (if institution specified for coordinators)
    let targetUsers = users.filter(u => {
      const isRole = u.role === role || (role === 'admin' && u.role === 'super_admin');
      if (!isRole) return false;
      if (targetInstitution && role === 'coordinator') {
        const uInst = (u.institution || '').toLowerCase().trim();
        const tInst = targetInstitution.toLowerCase().trim();
        return uInst === tInst || uInst.includes(tInst) || tInst.includes(uInst);
      }
      return true;
    });

    // Fallback: If no institution-specific coordinator found, fallback to any coordinator/admin
    if (targetUsers.length === 0 && role === 'coordinator') {
      targetUsers = users.filter(u => u.role === 'coordinator' || u.role === 'admin' || u.role === 'super_admin');
    }

    const userIds: string[] = targetUsers
      .flatMap(u => [(u as any).mail_id, u.email, u.user_id, u.$id])
      .filter((id): id is string => Boolean(id));

    // Send Push Notification with Email Fallback
    if (userIds.length > 0) {
      try {
        const origin = window.location.origin;
        const url = role === 'admin' ? `${origin}/admin` : role === 'coordinator' ? `${origin}/coordinator` : `${origin}/`;
        const pushRes = await sendPushNotification(userIds, subject, content, { url }, targetInstitution);
        if (!pushRes) {
          console.warn("Push notification target missing. Attempting Email notification fallback...");
          await sendEmailNotification(userIds, subject, content);
        }
      } catch (err) {
        console.error("Failed to send push/email notifications", err);
      }
    }
  } catch (err) {
    console.error("Failed to notify role:", role, err);
  }
};

export type BookingStage =
  | "draft"
  | "pending_coordinator"
  | "pending_super_admin"
  | "confirmed"
  | "rejected";

export const STAGES: { key: BookingStage; label: string; approver: string }[] = [
  { key: "pending_coordinator", label: "College Coordinator Approval", approver: "Coordinator" },
  { key: "pending_super_admin", label: "MVIT Principal Approval", approver: "MVIT Principal" },
  { key: "confirmed", label: "Booking Confirmed", approver: "System" },
  { key: "rejected", label: "Booking Rejected", approver: "Authority" },
];

export const getInstitutionLogo = (inst: string) => {
  const norm = (inst || "").toUpperCase();
  if (norm.includes("SMVEC") || norm.includes("SMVMCH") || norm.includes("SMVCH")) return "/logos/logo5.jpg";
  if (norm.includes("SMVPC") || norm.includes("POLYTECHNIC")) return "/logos/logo3.jpg";
  if (norm.includes("SMVNC") || norm.includes("NURSING")) return "/logos/logo2.jpg";
  if (norm.includes("VCE") || norm.includes("EDUCATION")) return "/logos/logo1.jpg";
  return "/logos/logo4.jpg"; // Default to MVIT
};

export const getApprovalWorkflow = (institution?: string) => {
  const principalTitle = "MVIT Principal";
  const inst = (institution || "MVIT").toUpperCase().trim();
  const isMVIT = !institution || inst.includes("MVIT") || inst.includes("MANAKULA VINAYAGAR INSTITUTE") || inst === "SIR MVIT";

  if (isMVIT) {
    return [
      { key: "pending_super_admin", label: `${principalTitle} Approval`, approver: principalTitle },
    ];
  }
  
  return [
    { key: "pending_coordinator", label: "College Coordinator Approval", approver: "College Coordinator" },
    { key: "pending_super_admin", label: `${principalTitle} Approval`, approver: principalTitle },
  ];
};

export const getInitialStage = (userRole?: string, userTeam?: string, institution?: string): BookingStage => {
  if (userRole === "admin" || userRole === "super_admin") return "pending_super_admin";
  if (userTeam === "mvit_user" || (institution || "").toUpperCase().includes("MVIT")) return "pending_super_admin";
  return "pending_coordinator";
};

export const getNextStage = (currentStage: BookingStage): BookingStage => {
  if (currentStage === "pending_coordinator") return "pending_super_admin";
  if (currentStage === "pending_super_admin") return "confirmed";
  return "confirmed";
};

export const getStageInfo = (stage: string) => {
  switch (stage) {
    case "pending_coordinator":
      return { label: "Pending Coordinator Approval", bg: "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-300/50" };
    case "pending_super_admin":
      return { label: "Pending MVIT Principal Approval", bg: "bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300/50" };
    case "confirmed":
      return { label: "Approved by MVIT Principal", bg: "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300/50" };
    case "rejected":
      return { label: "Booking Rejected", bg: "bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-300/50" };
    default:
      return { label: stage || "Pending", bg: "bg-amber-100 text-amber-700" };
  }
};

export const stageIndex = (s: BookingStage | string) => STAGES.findIndex((x) => x.key === s);

export interface BookingDraft {
  auditoriumId: string;
  institution: string;
  department: string;
  coordinator: string;
  eventName: string;
  purpose: string;
  date: string;
  fromDate: string;
  toDate: string;
  startTime: string;
  endTime: string;
  participants: string;
  daisChairs?: string;
  remarks: string;
  eventImage?: string;
  rejectionCategory?: string;
  rejectionReason?: string;
  approvedBy?: string;
  requesterId?: string;
  selectedDates?: string[];
}

export interface Booking extends BookingDraft {
  id: string;
  createdAt: string;
  stage: BookingStage;
  signedFileName?: string;
  organizerReceiptVerified?: boolean;
  organizerDocsVerified?: boolean;
  organizerNotes?: string;
  facilitiesRequired?: string[];
}

export const emptyDraft = (auditoriumId = ""): BookingDraft => ({
  auditoriumId,
  institution: "",
  department: "",
  coordinator: "",
  eventName: "",
  purpose: "",
  date: "",
  fromDate: "",
  toDate: "",
  startTime: "",
  endTime: "",
  participants: "",
  daisChairs: "",
  remarks: "",
  eventImage: "",
  rejectionCategory: "",
  rejectionReason: "",
  selectedDates: [],
});

interface Store {
  draft: BookingDraft;
  setDraft: (d: BookingDraft) => void;
  bookings: Booking[];
  submitDraft: (userRole?: string, userTeam?: string, explicitData?: BookingDraft, userId?: string) => Promise<Booking>;
  advance: (id: string, stage: BookingStage, patch?: Partial<Booking>) => void;
  remove: (id: string) => void;
  ready: boolean;
  auditoriums: Auditorium[];
  getAuditorium: (id?: string) => Auditorium | undefined;
}

import { Query } from "appwrite";

const StoreContext = createContext<Store | null>(null);

export function BookingProvider({ children }: { children: ReactNode }) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [draft, setDraftState] = useState<BookingDraft>(emptyDraft());
  const [ready, setReady] = useState(false);
  const [auditoriums, setAuditoriums] = useState<Auditorium[]>([]);

  // SECURITY FIX: Wait for the user to be authenticated before fetching protected collections
  const { user } = useAuth();

  useEffect(() => {
    // If the user hasn't loaded yet or isn't logged in, clear the store and don't fetch.
    if (!user) {
      setBookings([]);
      setAuditoriums([]);
      setReady(true);
      return;
    }

    const initData = async () => {
      try {
        const hallsData = await fetchAuditoriums();
        setAuditoriums(hallsData);

        // We fetch all bookings so the calendar can display availability accurately for everyone.
        // The UI (e.g. My Bookings) will filter this list client-side.
        const queries: any[] = [];

        const bookingsData = await listBookings(queries);
        // Map Appwrite documents to Booking interface
        const mappedBookings = bookingsData.map((doc: any) => {
          let extra: any = {};
          let originalRemarks = doc.remarks;
          try {
            if (doc.remarks) {
              extra = JSON.parse(doc.remarks);
              // We successfully parsed it as JSON, so this was an internal payload, not raw user text.
              // Clear doc.remarks so we don't accidentally display the raw JSON to the user.
              doc.remarks = ""; 
            }
          } catch {
            // It wasn't JSON, meaning it might be an older legacy string, keep it as is.
          }
          let mappedId = extra.auditoriumId;
          let mappedHallName = null;

          if (Array.isArray(doc.hallId) && doc.hallId.length > 0) {
            mappedId = doc.hallId[0].$id;
            mappedHallName = doc.hallId[0].name;
          } else if (typeof doc.hallId === 'object' && doc.hallId !== null) {
            mappedId = doc.hallId.$id;
            mappedHallName = doc.hallId.name;
          } else if (typeof doc.hallId === 'string' && doc.hallId.length > 0) {
            mappedId = doc.hallId;
          }

          const realHall = hallsData.find(h => h.id === mappedId || (h.name || "").toLowerCase() === String(mappedId).toLowerCase());
          
          let resolvedName = realHall?.name || "";
          
          // Fallback if hall is missing due to Appwrite permissions or deletion
          if (!resolvedName) {
            resolvedName = mappedHallName || doc.hallName || doc.auditoriumName || extra.auditoriumName || extra.hallName || `Unknown Venue`;
            const clean = String(mappedId).toLowerCase().trim();
            if (clean.includes("av") || clean.includes("audio")) resolvedName = "Audio Visual (AV) Room";
            else if (clean.includes("conf") || clean.includes("central")) resolvedName = "Central Conference Hall";
            else if (clean.includes("ground")) resolvedName = "Ground Floor Auditorium";
            else if (clean.includes("back")) resolvedName = "Backside Auditorium";
          }

          return {
            ...doc,
            id: doc.$id,
            createdAt: doc.createdAt || doc.$createdAt,
            auditoriumId: mappedId,
            auditoriumName: mappedHallName || doc.hallName || doc.auditoriumName || extra.auditoriumName || extra.hallName || resolvedName,
            institution: doc.collegeId || extra.institution,
            department: doc.department || extra.department,
            eventName: doc.eventName || extra.eventName,
            purpose: doc.eventDescription || extra.purpose,
            participants: doc.expectedAudience ? String(doc.expectedAudience) : extra.participants,
            coordinator: doc.coordinatorName || extra.coordinator,
            date: doc.eventDate ? new Date(doc.eventDate).toISOString().split('T')[0] : extra.date,
            fromDate: doc.eventDate ? new Date(doc.eventDate).toISOString().split('T')[0] : extra.fromDate,
            toDate: doc.eventDate ? new Date(doc.eventDate).toISOString().split('T')[0] : extra.toDate,
            startTime: extra.startTimeStr || doc.startTime,
            endTime: extra.endTimeStr || doc.endTime,
            stage: doc.status === 'confirm' ? 'confirmed' : doc.status === 'forwarded' ? 'pending_coordinator' : doc.status === 'rejected' ? 'rejected' : 'pending_super_admin',
            ...extra
          } as Booking;
        }) as Booking[];
        setBookings(mappedBookings);
      } catch (err) {
        console.error("Failed to fetch initial data:", err);
      } finally {
        setReady(true);
      }
    };

    initData();

    // Subscribe to Appwrite Realtime for bookings
      const unsubscribe = subscribeToBookings((response) => {
        if (response.events.includes('databases.*.collections.*.documents.*.create')) {
          const doc: any = response.payload;
          let extra: any = {};
          try {
            if (doc.remarks) {
              extra = JSON.parse(doc.remarks);
              doc.remarks = "";
            }
          } catch {}
          let mappedId = extra.auditoriumId;
          let mappedHallName = null;

          if (Array.isArray(doc.hallId) && doc.hallId.length > 0) {
            mappedId = doc.hallId[0].$id;
            mappedHallName = doc.hallId[0].name;
          } else if (typeof doc.hallId === 'object' && doc.hallId !== null) {
            mappedId = doc.hallId.$id;
            mappedHallName = doc.hallId.name;
          } else if (typeof doc.hallId === 'string' && doc.hallId.length > 0) {
            mappedId = doc.hallId;
          }

          const newBooking = {
            ...doc, 
            id: doc.$id, 
            auditoriumId: mappedId,
            auditoriumName: mappedHallName || doc.hallName || doc.auditoriumName || extra.auditoriumName || extra.hallName,
            institution: doc.collegeId || extra.institution, 
            department: doc.department || extra.department,
            eventName: doc.eventName || extra.eventName,
            purpose: doc.eventDescription || extra.purpose,
            participants: doc.expectedAudience ? String(doc.expectedAudience) : extra.participants,
            coordinator: doc.coordinatorName || extra.coordinator, 
            date: doc.eventDate ? new Date(doc.eventDate).toISOString().split('T')[0] : extra.date,
            fromDate: doc.eventDate ? new Date(doc.eventDate).toISOString().split('T')[0] : extra.fromDate,
            startTime: extra.startTimeStr || doc.startTime, 
            endTime: extra.endTimeStr || doc.endTime, 
            stage: doc.status === 'confirm' ? 'confirmed' : doc.status === 'forwarded' ? 'pending_coordinator' : doc.status === 'rejected' ? 'rejected' : 'pending_super_admin', 
            ...extra
          } as Booking;
          setBookings(prev => [newBooking, ...prev.filter(b => b.id !== newBooking.id)]);
        }
        
        if (response.events.includes('databases.*.collections.*.documents.*.update')) {
          const doc: any = response.payload;
          let extra: any = {};
          try {
            if (doc.remarks) {
              extra = JSON.parse(doc.remarks);
              doc.remarks = "";
            }
          } catch {}
          let mappedId = extra.auditoriumId;
          let mappedHallName = null;

          if (Array.isArray(doc.hallId) && doc.hallId.length > 0) {
            mappedId = doc.hallId[0].$id;
            mappedHallName = doc.hallId[0].name;
          } else if (typeof doc.hallId === 'object' && doc.hallId !== null) {
            mappedId = doc.hallId.$id;
            mappedHallName = doc.hallId.name;
          } else if (typeof doc.hallId === 'string' && doc.hallId.length > 0) {
            mappedId = doc.hallId;
          }

          const updatedBooking = {
            ...doc, 
            id: doc.$id, 
            auditoriumId: mappedId,
            auditoriumName: mappedHallName || doc.hallName || doc.auditoriumName || extra.auditoriumName || extra.hallName, 
            institution: doc.collegeId || extra.institution, 
            department: doc.department || extra.department,
            eventName: doc.eventName || extra.eventName,
            purpose: doc.eventDescription || extra.purpose,
            participants: doc.expectedAudience ? String(doc.expectedAudience) : extra.participants,
            coordinator: doc.coordinatorName || extra.coordinator, 
            date: doc.eventDate ? new Date(doc.eventDate).toISOString().split('T')[0] : extra.date,
            fromDate: doc.eventDate ? new Date(doc.eventDate).toISOString().split('T')[0] : extra.fromDate,
            startTime: extra.startTimeStr || doc.startTime, 
            endTime: extra.endTimeStr || doc.endTime, 
            stage: doc.status === 'confirm' ? 'confirmed' : doc.status === 'forwarded' ? 'pending_coordinator' : doc.status === 'rejected' ? 'rejected' : 'pending_super_admin', 
            ...extra
          } as Booking;
          setBookings(prev => prev.map(b => b.id === updatedBooking.id ? updatedBooking : b));
        }

      if (response.events.includes('databases.*.collections.*.documents.*.delete')) {
        setBookings(prev => prev.filter(b => b.id !== response.payload.$id));
      }
    });

    return () => {
      unsubscribe();
    };
  }, [user?.$id]);



  const value = useMemo<Store>(
    () => ({
      draft,
      setDraft: setDraftState,
      bookings,
      auditoriums,
      ready,
      getAuditorium: (id?: string) => {
        if (!id) return undefined;
        const cleanId = id.trim().toLowerCase();
        
        // 1. Direct ID match or exact name match
        let found = auditoriums.find(a => 
          a.id === id || 
          a.id.toLowerCase() === cleanId || 
          (a.name || "").toLowerCase().trim() === cleanId
        );
        if (found) return found;

        // 2. Partial / slug match for standard campus halls
        if (cleanId.includes("av") || cleanId.includes("audio")) {
          found = auditoriums.find(a => a.name.toLowerCase().includes("av") || a.name.toLowerCase().includes("audio"));
          if (found) return found;
          return { id: "av-room", name: "Audio Visual (AV) Room", capacity: 150, tagline: "Air-Conditioned • Audio Visual System", availability: "Available", image: ["/logos/logo4.jpg"], location: "Main Building, First Floor", facilities: ["Air Conditioner", "Projector"], about: "" };
        }
        if (cleanId.includes("conf") || cleanId.includes("central")) {
          found = auditoriums.find(a => a.name.toLowerCase().includes("conf"));
          if (found) return found;
          return { id: "conference-hall", name: "Central Conference Hall", capacity: 250, tagline: "Executive Seating", availability: "Available", image: ["/logos/logo4.jpg"], location: "Administrative Block, Second Floor", facilities: ["Air Conditioner"], about: "" };
        }
        if (cleanId.includes("ground")) {
          found = auditoriums.find(a => a.name.toLowerCase().includes("ground"));
          if (found) return found;
          return { id: "ground-floor-auditorium", name: "Ground Floor Auditorium", capacity: 500, tagline: "Large Capacity", availability: "Available", image: ["/logos/logo4.jpg"], location: "Main Building, Ground Floor", facilities: ["Stage Lighting"], about: "" };
        }
        if (cleanId.includes("back")) {
          found = auditoriums.find(a => a.name.toLowerCase().includes("back"));
          if (found) return found;
          return { id: "backside-auditorium", name: "Backside Auditorium", capacity: 350, tagline: "Open Layout", availability: "Available", image: ["/logos/logo4.jpg"], location: "Campus Back Block", facilities: ["PA System"], about: "" };
        }

        // Fallback for custom readable names
        if (!/^[a-f0-9]{20,24}$/i.test(id) && id.length > 2 && id !== "h") {
          return { id, name: id, capacity: 0, tagline: "", availability: "Available", image: ["/logos/logo4.jpg"], location: "Campus Venue", facilities: [], about: "" };
        }

        // Return empty name so the UI knows it wasn't found and can fallback to the booking's saved auditoriumName
        return { id, name: "", capacity: 0, tagline: "", availability: "Available", image: ["/logos/logo4.jpg"], location: "Campus Venue", facilities: [], about: "" };
      },
      submitDraft: async (userRole?: string, userTeam?: string, explicitData?: BookingDraft, userId?: string) => {
        const data = explicitData || draft;
        const initialStage = getInitialStage(userRole, userTeam, data.institution);

        let activeUserId = userId;
        let activeUserEmail = "";
        if (typeof window !== "undefined") {
          try {
            const rawUser = localStorage.getItem("bms_user");
            if (rawUser) {
              const parsed = JSON.parse(rawUser);
              activeUserId = activeUserId || parsed.$id || parsed.id;
              activeUserEmail = parsed.email || "";
            }
          } catch {}
        }

        const resolvedAudName = auditoriums.find(a => a.id === data.auditoriumId)?.name || 'the venue';
        const bookingData = {
          ...data,
          auditoriumName: resolvedAudName,
          stage: initialStage,
          requesterId: activeUserId,
          requesterEmail: activeUserEmail,
        };
        
        try {
          const doc = await createBooking(bookingData);
          const booking: Booking = { ...bookingData, id: doc.$id, createdAt: doc.$createdAt } as Booking;
          
          setBookings((prev) => [booking, ...prev.filter(b => b.id !== booking.id)]);

          // Audit record if impersonating
          const impersonated = getStoredImpersonatedUser();
          if (impersonated) {
            const rawUser = localStorage.getItem("bms_user");
            const realUser = rawUser ? JSON.parse(rawUser) : null;
            recordAuditLog({
              performedBy: realUser?.$id || realUser?.email || "super_admin",
              performedByName: realUser?.name || realUser?.email || "Super Admin",
              actingAs: impersonated.$id || impersonated.email,
              actingAsName: impersonated.name || impersonated.email,
              action: "CREATE_BOOKING",
              details: {
                bookingId: doc.$id,
                eventName: booking.eventName,
                institution: booking.institution,
              },
            });
          }
          
          const audName = auditoriums.find(a => a.id === booking.auditoriumId)?.name || 'the venue';
          
          let displayDate = "Unknown Date";
          if (booking.selectedDates && booking.selectedDates.length > 0) {
            displayDate = booking.selectedDates.length === 1 
              ? formatDate(booking.selectedDates[0]) 
              : `${booking.selectedDates.length} Dates: ${formatDate(booking.selectedDates[0])} to ${formatDate(booking.selectedDates[booking.selectedDates.length - 1])}`;
          } else if (booking.fromDate) {
            displayDate = formatDate(booking.fromDate, booking.toDate);
          } else if ((booking as any).date) {
            displayDate = (booking as any).date;
          }

          const details = `🏢 Venue: ${audName}\n📅 Date: ${displayDate}\n🕒 Time: ${booking.startTime} - ${booking.endTime}\n👤 By: ${booking.coordinator} (${booking.institution})`;
          
          if (initialStage === 'pending_super_admin') {
            notifyRole('admin', `🎟️ New Booking Request: ${booking.eventName}`, details);
          } else {
            notifyRole('coordinator', `🎟️ New Booking Request: ${booking.eventName}`, details, booking.institution);
          }

          return booking;
        } catch (err) {
          console.error("API error during booking creation:", err);
          throw err;
        }
      },
      advance: async (id, stage, patch = {}) => {
        // SECURITY FIX: Prevent normal users from advancing or modifying booking stages
        if (!user || user.role === 'user') {
          throw new Error("Unauthorized: Only administrators can modify booking status.");
        }

        // Optimistic UI update
        setBookings((prev) =>
          prev.map((b) => (b.id === id ? { ...b, ...patch, stage } : b)),
        );

        const b = bookings.find(x => x.id === id);
        const updateData: any = { ...b, ...patch, stage };
        const audName = b ? (auditoriums.find(a => a.id === b.auditoriumId)?.name || 'the venue') : 'the venue';
        const details = b ? `🏢 Venue: ${audName}\n📅 Date: ${b.date}\n👤 By: ${b.coordinator} (${b.institution})` : '';

        // Audit record if impersonating
        const impersonated = getStoredImpersonatedUser();
        if (impersonated) {
          const rawUser = localStorage.getItem("bms_user");
          const realUser = rawUser ? JSON.parse(rawUser) : null;
          recordAuditLog({
            performedBy: realUser?.$id || realUser?.email || "super_admin",
            performedByName: realUser?.name || realUser?.email || "Super Admin",
            actingAs: impersonated.$id || impersonated.email,
            actingAsName: impersonated.name || impersonated.email,
            action: `ADVANCE_STAGE_${stage.toUpperCase()}`,
            details: {
              bookingId: id,
              eventName: b?.eventName,
              newStage: stage,
            },
          });
        }

        const applicantName = b?.coordinator || 'Applicant';

        if (stage === "confirmed") {
          updateData.approvedBy = draft.coordinator || "MVIT Principal";
          const approver = updateData.approvedBy;
          
          let requesterEmail = (b as any)?.requesterEmail;
          if (!requesterEmail && b?.requesterId) {
             const allUsers = await getAllUsersFromDatabase();
             const reqUser = allUsers.find(u => u.$id === b.requesterId || u.user_id === b.requesterId);
             if (reqUser) requesterEmail = (reqUser as any).mail_id || reqUser.email;
          }

          createNotification({ 
            userId: b?.requesterId,
            title: "✅ Booking Confirmed", 
            message: `Hello ${applicantName}, your booking for ${b?.eventName || id} was successfully approved.`, 
            bookingId: id, 
            type: "success" 
          });
          const recipients = [requesterEmail, b?.requesterId].filter(Boolean) as string[];
          if (recipients.length > 0) {
            sendPushNotification(
              recipients, 
              `✅ Booking Approved: ${b.eventName || 'Booking'}`, 
              `Hello ${applicantName},\n\nYour auditorium booking has been APPROVED by ${approver}.\n\n${details}`
            );
          }

          // Trigger Resend Confirmation Email (Non-blocking)
          const targetEmail = (b as any)?.requesterEmail || (b as any)?.mail_id || (b as any)?.email;
          if (targetEmail) {
            sendBookingConfirmationEmail({
              userEmail: targetEmail,
              userName: applicantName,
              bookingId: id,
              auditoriumName: audName,
              date: b?.date || 'N/A',
              time: `${b?.startTime || ''} - ${b?.endTime || ''}`,
            }).catch((emailErr) => console.error("Email sending failed", emailErr));
          }
          notifyRole('coordinator', `✅ Confirmed: ${b?.eventName || 'Booking'}`, `The booking for ${applicantName} has been finalized by the Principal.\n${details}`, b?.institution);
          
          // Notify the Organizer (Stores / Hall in-charge) to arrange facilities
          notifyRole('organizer', `✅ Prepare Venue: ${b?.eventName || 'Booking'}`, `The Principal approved this booking for ${applicantName}.\nPlease arrange chairs and facilities.\n${details}`);
        } else if (stage === "rejected") {
          if (!updateData.rejectionReason) {
            updateData.rejectionReason = "Rejected by authority";
          }
          const rejector = updateData.rejectedBy || "Authority";
          
          let requesterEmail = (b as any)?.requesterEmail;
          if (!requesterEmail && b?.requesterId) {
             const allUsers = await getAllUsersFromDatabase();
             const reqUser = allUsers.find(u => u.$id === b.requesterId || u.user_id === b.requesterId);
             if (reqUser) requesterEmail = (reqUser as any).mail_id || reqUser.email;
          }

          createNotification({ 
            userId: b?.requesterId,
            title: "Booking Rejected", 
            message: `Hello ${applicantName}, your booking for ${b?.eventName || id} was rejected. Reason: ${updateData.rejectionReason}`, 
            bookingId: id, 
            type: "error" 
          });
          const recipients = [requesterEmail, b?.requesterId].filter(Boolean) as string[];
          if (recipients.length > 0) {
            sendPushNotification(
              recipients, 
              `❌ Booking Rejected: ${b.eventName || 'Booking'}`, 
              `Hello ${applicantName},\n\nYour auditorium booking has been REJECTED.\nReason: ${updateData.rejectionReason}\nRejected By: ${rejector}\n\n${details}`
            );
          }
          if (b?.institution !== 'MVIT') {
             // If it was rejected, notify coordinator of that institution too
             notifyRole('coordinator', `❌ Rejected: ${b?.eventName || 'Booking'}`, `The external booking for ${applicantName} was rejected.\nReason: ${updateData.rejectionReason}\n${details}`, b?.institution);
          }
        } else if (stage === "pending_super_admin") {
          notifyRole('admin', `⏳ Final Approval Needed: ${b?.eventName || 'Booking'}`, `Coordinator has forwarded this booking for your approval.\n${details}`);
        }

        try {
          await updateBooking(id, updateData);
        } catch (err) {
          console.error("Failed to update booking:", err);
          // Optional: Revert optimistic update here if needed
        }
      },
      remove: async (id) => {
        // SECURITY FIX: Prevent normal users from deleting bookings
        if (!user || user.role === 'user') {
          throw new Error("Unauthorized: Only administrators can delete bookings.");
        }

        // Optimistic UI update
        setBookings((prev) => prev.filter((b) => b.id !== id));

        // Audit record if impersonating
        const impersonated = getStoredImpersonatedUser();
        if (impersonated) {
          const rawUser = localStorage.getItem("bms_user");
          const realUser = rawUser ? JSON.parse(rawUser) : null;
          recordAuditLog({
            performedBy: realUser?.$id || realUser?.email || "super_admin",
            performedByName: realUser?.name || realUser?.email || "Super Admin",
            actingAs: impersonated.$id || impersonated.email,
            actingAsName: impersonated.name || impersonated.email,
            action: "DELETE_BOOKING",
            details: { bookingId: id },
          });
        }

        try {
          await deleteBooking(id);
        } catch (err) {
          console.error("Failed to delete booking:", err);
        }
      },
    }),
    [draft, bookings, ready, auditoriums],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useBookings() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useBookings must be used inside BookingProvider");
  return ctx;
}

export const formatTime = (isoOrTime: string) => {
  if (!isoOrTime) return "—";
  try {
    if (!isoOrTime.includes("T") && !isoOrTime.includes("-")) return isoOrTime;
    const d = new Date(isoOrTime);
    if (isNaN(d.getTime())) return isoOrTime;
    let hours = d.getHours();
    const minutes = d.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    const minutesStr = minutes < 10 ? '0' + minutes : minutes;
    return hours + ':' + minutesStr + ' ' + ampm;
  } catch {
    return isoOrTime;
  }
};

export const formatDate = (iso: string, toIso?: string) => {
  if (!iso) return "—";
  
  const formatSingle = (dateString: string) => {
    try {
      const d = new Date(dateString + (dateString.includes("T") ? "" : "T00:00:00"));
      if (isNaN(d.getTime())) return dateString;
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    } catch {
      return dateString;
    }
  };

  const startStr = formatSingle(iso);
  if (toIso && toIso !== iso) {
    const endStr = formatSingle(toIso);
    return `${startStr} – ${endStr}`;
  }
  return startStr;
};
