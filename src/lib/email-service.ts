import { createServerFn } from "@tanstack/react-start";
import { getAllUsersFromDatabase } from "./appwrite/users";
import nodemailer from "nodemailer";

export interface EmailNotificationData {
  to: string[];
  subject: string;
  title: string;
  recipientName?: string;
  statusBadge: {
    label: string;
    color: "green" | "red" | "amber" | "blue";
  };
  message: string;
  bookingDetails: {
    label: string;
    value: string;
  }[];
  actionUrl?: string;
  actionLabel?: string;
}

export const generateEmailHtml = (data: EmailNotificationData): string => {
  const badgeColors = {
    green: { bg: "#dcfce7", text: "#15803d", border: "#bbf7d0" },
    red: { bg: "#fee2e2", text: "#b91c1c", border: "#fecaca" },
    amber: { bg: "#fef3c7", text: "#b45309", border: "#fde68a" },
    blue: { bg: "#e0f2fe", text: "#0369a1", border: "#bae6fd" },
  };

  const badgeStyle = badgeColors[data.statusBadge.color] || badgeColors.blue;

  const rows = data.bookingDetails
    .map(
      (item) => `
      <tr>
        <td style="padding: 10px 0; color: #64748b; font-size: 13px; font-weight: 500; vertical-align: top; width: 38%; border-bottom: 1px solid #f1f5f9;">${item.label}</td>
        <td style="padding: 10px 0; color: #0f172a; font-size: 13px; font-weight: 700; text-align: right; vertical-align: top; width: 62%; border-bottom: 1px solid #f1f5f9;">${item.value}</td>
      </tr>
    `
    )
    .join("");

  const actionButton = data.actionUrl
    ? `
    <div style="text-align: center; margin: 30px 0 10px 0;">
      <a href="${data.actionUrl}" style="display: inline-block; background-color: #e11d48; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; padding: 13px 30px; border-radius: 12px; box-shadow: 0 4px 14px rgba(225, 29, 72, 0.28);">
        ${data.actionLabel || "View in Portal →"}
      </a>
    </div>
  `
    : "";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px 12px; color: #1e293b;">
  <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px -5px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #ffffff; padding: 32px 24px; text-align: center;">
      <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #f43f5e; margin-bottom: 6px;">Auditorium Booking Portal</div>
      <h1 style="margin: 0; font-size: 21px; font-weight: 800; letter-spacing: -0.3px;">VenueX — SMVET Central Booking</h1>
      <p style="margin: 6px 0 0; color: #94a3b8; font-size: 13px; font-weight: 500;">Manakula Vinayagar Educational Trust</p>
    </div>

    <!-- Body -->
    <div style="padding: 28px 24px;">
      ${
        data.recipientName
          ? `<div style="font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 12px;">Hello ${data.recipientName},</div>`
          : ""
      }
      
      <div style="margin-bottom: 16px;">
        <span style="display: inline-block; background-color: ${badgeStyle.bg}; color: ${badgeStyle.text}; border: 1px solid ${badgeStyle.border}; font-weight: 800; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; padding: 5px 12px; border-radius: 9999px;">
          ${data.statusBadge.label}
        </span>
      </div>

      <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 20px 0;">
        ${data.message.replace(/\n/g, "<br>")}
      </p>

      <!-- Details Card -->
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px 20px; margin: 20px 0;">
        <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
          Booking Information
        </div>
        <table style="width: 100%; border-collapse: collapse;">
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>

      ${actionButton}
    </div>

    <!-- Footer -->
    <div style="background-color: #f8fafc; padding: 18px 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
      This is an automated notification from the Central Auditorium Booking Portal.<br>
      Please do not reply directly to this email.
    </div>
  </div>
</body>
</html>
  `;
};

export const sendEmailViaResend = createServerFn({ method: "POST" })
  .validator((d: { to: string[]; subject: string; html: string; text?: string }) => d)
  .handler(async ({ data }) => {
    if (!data.to || data.to.length === 0) {
      return { success: false, error: "No recipient emails provided" };
    }

    const validEmails = Array.from(
      new Set(
        data.to
          .filter((e) => typeof e === "string" && e.includes("@") && !e.includes(" "))
          .map((e) => e.trim().toLowerCase())
      )
    );

    if (validEmails.length === 0) {
      return { success: false, error: "No valid email addresses found" };
    }

    // 1. Primary: Use Gmail App Password via Nodemailer (No custom domain needed, sends to ANY recipient)
    const gmailUser =
      process.env.VITE_GMAIL_USER ||
      process.env.GMAIL_USER ||
      import.meta.env.VITE_GMAIL_USER ||
      "tonystarkakaironman01@gmail.com";

    const gmailPass = (
      process.env.VITE_GMAIL_APP_PASSWORD ||
      process.env.GMAIL_APP_PASSWORD ||
      import.meta.env.VITE_GMAIL_APP_PASSWORD ||
      ""
    ).replace(/\s+/g, "");

    if (gmailUser && gmailPass) {
      try {
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: gmailUser,
            pass: gmailPass,
          },
        });

        const info = await transporter.sendMail({
          from: `"VenueX - Central Auditorium" <${gmailUser}>`,
          to: validEmails.join(", "),
          subject: data.subject,
          html: data.html,
          text: data.text || data.subject,
        });

        console.log("Email dispatched via Gmail SMTP successfully. MessageId:", info.messageId);
        return { success: true, messageId: info.messageId };
      } catch (gmailErr: any) {
        console.error("Gmail SMTP dispatch error:", gmailErr);
      }
    }

    // 2. Secondary / Fallback: Resend API
    const apiKey =
      process.env.VITE_RESEND_API_KEY ||
      process.env.RESEND_API_KEY ||
      import.meta.env.VITE_RESEND_API_KEY ||
      "";
    const from =
      process.env.VITE_RESEND_FROM_EMAIL ||
      import.meta.env.VITE_RESEND_FROM_EMAIL ||
      "VenueX - Book My Space <onboarding@resend.dev>";

    if (apiKey) {
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            from,
            to: validEmails,
            subject: data.subject,
            html: data.html,
            text: data.text || data.subject,
          }),
        });

        const result = await response.json();
        if (!response.ok) {
          console.warn("Resend API warning/error:", response.status, result);
          return { success: false, status: response.status, result };
        }
        return { success: true, result };
      } catch (err: any) {
        console.error("Resend fetch exception:", err);
      }
    }

    return { success: false, error: "No configured email service available" };
  });

export const sendNotificationEmail = async (data: EmailNotificationData) => {
  try {
    const html = generateEmailHtml(data);
    return await sendEmailViaResend({
      data: {
        to: data.to,
        subject: data.subject,
        html,
        text: `${data.title}\n\n${data.message}`,
      },
    });
  } catch (err) {
    console.error("Failed to send notification email:", err);
    return null;
  }
};

/**
 * Resolve applicant's email by inspecting the booking fields and user database
 */
export const resolveApplicantEmail = async (
  booking: any,
  cachedUsers?: any[]
): Promise<string | null> => {
  if (!booking) return null;

  // Direct check on booking document fields
  const candidates = [
    booking.requesterEmail,
    booking.userEmail,
    booking.mail_id,
    booking.email,
  ];

  for (const c of candidates) {
    if (c && typeof c === "string" && c.includes("@") && !c.includes(" ")) {
      return c.trim().toLowerCase();
    }
  }

  // Lookup by requesterId in users collection
  const requesterId = booking.requesterId;
  if (requesterId) {
    try {
      const users = cachedUsers || (await getAllUsersFromDatabase());
      const matched = users.find(
        (u) =>
          u.$id === requesterId ||
          u.user_id === requesterId ||
          u.docId === requesterId
      );
      if (matched) {
        const email = matched.email || (matched as any).mail_id;
        if (email && email.includes("@")) {
          return email.trim().toLowerCase();
        }
      }
    } catch (e) {
      console.warn("Could not lookup user email by requesterId:", e);
    }
  }

  // If coordinator is an email address
  if (booking.coordinator && booking.coordinator.includes("@")) {
    return booking.coordinator.trim().toLowerCase();
  }

  return null;
};

/**
 * Send Schedule Change Notification Email to the applicant user
 */
export const sendBookingScheduleUpdatedEmail = async ({
  booking,
  newDate,
  newStartTime,
  newEndTime,
  auditoriumName,
  updatedBy,
}: {
  booking: any;
  newDate: string;
  newStartTime: string;
  newEndTime: string;
  auditoriumName?: string;
  updatedBy?: string;
}) => {
  try {
    const recipientEmail = await resolveApplicantEmail(booking);
    if (!recipientEmail) {
      console.warn("No recipient email found for schedule update notification.");
      return null;
    }

    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://venuex.ridemap.in";

    return await sendNotificationEmail({
      to: [recipientEmail],
      subject: `🕒 Schedule Updated: ${booking.eventName || "Auditorium Booking"}`,
      title: "Booking Schedule Updated",
      recipientName: booking.coordinator || "Applicant",
      statusBadge: {
        label: "Schedule Updated",
        color: "blue",
      },
      message: `The date and/or time for your auditorium booking has been updated by administration.\n\nPlease review your updated schedule below:`,
      bookingDetails: [
        { label: "Event Name", value: booking.eventName || "Auditorium Event" },
        { label: "Venue", value: auditoriumName || "Central Auditorium" },
        { label: "New Date", value: newDate },
        { label: "New Time Slot", value: `${newStartTime} – ${newEndTime}` },
        { label: "Institution", value: booking.institution || "MVIT" },
        { label: "Updated By", value: updatedBy || "Administration" },
      ],
      actionUrl: `${origin}/bookings/${booking.id || booking.$id}`,
      actionLabel: "View Updated Booking →",
    });
  } catch (err) {
    console.error("sendBookingScheduleUpdatedEmail error:", err);
    return null;
  }
};
