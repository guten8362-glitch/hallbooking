import { ID } from 'appwrite';
import { APPWRITE_CONFIG } from './constants';
import { functions } from './client';

/**
 * Appwrite Messaging Wrapper for Client Side
 * Supports both Appwrite Serverless Functions AND direct Appwrite API Key messaging fallback.
 */

export const getUserIdByEmail = async (email: string) => {
  return null;
};

    console.error('Appwrite Messaging REST API Exception:', err);
    return null;
  }
};

export const sendPushNotification = async (userIds: string[], title: string, body: string, data?: any, institution?: string) => {
  const timestamp = new Date().toISOString();
  console.group(`[PUSH NOTIFICATION DIAGNOSTICS - ${timestamp}]`);
  console.log("📋 Request Title:", title);
  console.log("📋 Request Body:", body);
  console.log("👥 Input Target User IDs / Emails:", userIds);

  if (!userIds || userIds.length === 0) {
    console.warn("❌ Recipient Validation Failed: Empty target user IDs array.");
    console.groupEnd();
    return null;
  }

  // The Serverless Function handles all target resolution and validation securely.
  const targetUserIds = userIds.filter(Boolean);

  // Determine dynamic icon based on institution
  let iconUrl = window.location.origin + '/logos/logo4.jpg'; // default (MVIT)
  if (institution) {
    const instStr = institution.toLowerCase();
    if (instStr.includes('kns')) {
      iconUrl = window.location.origin + '/logos/logo1.jpg';
    } else if (instStr.includes('someother')) { // add more mappings as needed
      iconUrl = window.location.origin + '/logos/logo2.jpg';
    }
    // You can easily add more mappings here!
  }

  // Determine badge (small status bar icon, must be transparent/monochrome PNG)
  const badgeUrl = window.location.origin + '/logo192.png'; // Using generic PWA logo for the badge

  // Option 1: Appwrite Serverless Function
  if (APPWRITE_CONFIG.notificationFunctionId) {
    try {
      const payload = {
        action: 'push',
        users: targetUserIds, // These are validated Auth IDs
        title,
        body,
        data,
        icon: iconUrl,
        badge: badgeUrl,
      };
      const res = await functions.createExecution(
        APPWRITE_CONFIG.notificationFunctionId,
        JSON.stringify(payload),
        false // async
      );
      console.log("🚀 Serverless Push Function Triggered:", res);
      console.groupEnd();
      return res;
    } catch (err) {
      console.error('❌ Failed to trigger Push Notification Function:', err);
      console.groupEnd();
      return null;
    }
  }

  console.warn('⚠️ VITE_APPWRITE_NOTIFICATION_FUNCTION_ID is not configured. Notifications cannot be sent securely.');
  console.groupEnd();
  return null;
};

export const sendEmailNotification = async (users: string[], subject: string, content: string) => {
  if (!users || users.length === 0) return null;

  // Appwrite Serverless Function
  if (APPWRITE_CONFIG.notificationFunctionId) {
    try {
      const payload = {
        action: 'email',
        users,
        subject,
        content,
      };
      return await functions.createExecution(
        APPWRITE_CONFIG.notificationFunctionId,
        JSON.stringify(payload),
        false // async
      );
    } catch (err) {
      console.error('Failed to trigger Email Notification Function:', err);
      return null;
    }
  }

  console.warn('Neither VITE_APPWRITE_NOTIFICATION_FUNCTION_ID is configured for Email Notifications.');
  return null;
};

export const sendBookingConfirmationEmail = async (details: {
  userEmail: string;
  userName: string;
  bookingId: string;
  auditoriumName: string;
  date: string;
  time: string;
}) => {
  if (!details || !details.userEmail) return null;

  try {
    // 1. Trigger Appwrite Serverless Function
    if (APPWRITE_CONFIG.notificationFunctionId) {
      const payload = {
        action: 'booking_confirmation_email',
        recipientEmail: details.userEmail,
        bookingDetails: details,
      };
      await functions.createExecution(
        APPWRITE_CONFIG.notificationFunctionId,
        JSON.stringify(payload),
        false // async
      ).catch((err) => console.error("Email sending failed", err));
    }

    // 2. Direct Resend.com API call fallback if VITE_RESEND_API_KEY is present
    const resendKey = import.meta.env.VITE_RESEND_API_KEY;
    if (resendKey) {
      const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
    .container { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
    .header { background: #0f172a; color: #ffffff; padding: 32px 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
    .header p { margin: 6px 0 0; color: #94a3b8; font-size: 13px; }
    .content { padding: 32px 24px; }
    .greeting { font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
    .badge { display: inline-block; background-color: #dcfce7; color: #15803d; font-weight: 700; font-size: 13px; padding: 6px 14px; border-radius: 9999px; margin-bottom: 20px; }
    .card { background-color: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 20px 0; }
    .card-title { font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 14px; border-b: 1px solid #cbd5e1; padding-bottom: 8px; }
    .detail-row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px; }
    .detail-row:last-child { margin-bottom: 0; }
    .label { color: #64748b; font-weight: 500; }
    .value { color: #0f172a; font-weight: 700; text-align: right; }
    .footer { background-color: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Central Auditorium Booking</h1>
      <p>College Booking System</p>
    </div>
    <div class="content">
      <div class="greeting">Hello ${details.userName},</div>
      <div class="badge">✓ Auditorium Booking Confirmed ✅</div>
      <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 20px 0;">
        Your auditorium booking has been successfully confirmed. Below are your official booking details:
      </p>

      <div class="card">
        <div class="card-title">Booking Confirmation Details</div>
        <div class="detail-row"><span class="label">Booking ID:</span><span class="value">${details.bookingId}</span></div>
        <div class="detail-row"><span class="label">Auditorium Name:</span><span class="value">${details.auditoriumName}</span></div>
        <div class="detail-row"><span class="label">Date:</span><span class="value">${details.date}</span></div>
        <div class="detail-row"><span class="label">Time:</span><span class="value">${details.time}</span></div>
        <div class="detail-row"><span class="label">Booked By:</span><span class="value">${details.userName}</span></div>
      </div>

      <p style="font-size: 14px; color: #64748b; margin-top: 24px;">
        Thank you for using our College Auditorium Booking System.
      </p>
    </div>
    <div class="footer">
      This is an automated confirmation email. Please retain this email for your records.
    </div>
  </div>
</body>
</html>
      `;

      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: 'Central Hall Booking <onboarding@resend.dev>',
          to: [details.userEmail],
          subject: 'Auditorium Booking Confirmed ✅',
          html: htmlBody,
        }),
      }).catch((resendErr) => console.error("Email sending failed", resendErr));
    }
  } catch (error) {
    console.error("Email sending failed", error);
  }
};

