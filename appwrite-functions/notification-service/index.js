import { Client, Messaging, Users, ID, Query, Databases } from 'node-appwrite';
import { Resend } from 'resend';

/**
 * Appwrite Serverless Function for Notification Service
 * Triggered by client-side createExecution() calls.
 * Uses node-appwrite Server SDK with API Key for secure dispatch
 * and Resend.com for booking confirmation emails.
 */
export default async ({ req, res, log, error }) => {
  log('Notification Function triggered');

  // Initialize Appwrite Server SDK using runtime environment variables
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_ENDPOINT || process.env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID || process.env.VITE_APPWRITE_PROJECT_ID || '')
    .setKey(process.env.APPWRITE_API_KEY || process.env.APPWRITE_FUNCTION_API_KEY || '');

  const messaging = new Messaging(client);

  try {
    let payload = {};
    if (typeof req.bodyRaw === 'string' && req.bodyRaw) {
      payload = JSON.parse(req.bodyRaw);
    } else if (typeof req.body === 'string' && req.body) {
      payload = JSON.parse(req.body);
    } else if (typeof req.body === 'object' && req.body !== null) {
      payload = req.body;
    }

    let { action, users, email, recipientEmail, title, body, subject, content, data, icon, badge, bookingDetails } = payload;

    if (action === 'notify_role') {
      const { role, targetInstitution, databaseId, usersCollectionId, notificationsCollectionId } = payload;
      if (!role || !subject || !content) return res.json({ success: false, message: 'Missing parameters for notify_role' }, 400);

      const databases = new Databases(client);
      const dbId = databaseId || process.env.VITE_APPWRITE_DATABASE_ID || process.env.APPWRITE_DATABASE_ID;
      const collId = usersCollectionId || process.env.VITE_USERS_COLLECTION_ID || 'users';
      const notifCollId = notificationsCollectionId || process.env.VITE_NOTIFICATIONS_COLLECTION_ID || 'notifications';

      if (!dbId || !collId) return res.json({ success: false, message: 'Missing DB configuration' }, 400);

      log(`Fetching users for role ${role} securely on backend...`);
      // Fetch all users securely on the backend using the Admin API key
      const usersList = await databases.listDocuments(dbId, collId, [Query.limit(500)]);
      
      let targetUsers = usersList.documents.filter(u => {
        const isRole = u.role === role || (role === 'admin' && u.role === 'super_admin');
        if (!isRole) return false;
        if (targetInstitution && role === 'coordinator') {
          const uInst = (u.institution || '').toLowerCase().trim();
          const tInst = targetInstitution.toLowerCase().trim();
          return uInst === tInst || uInst.includes(tInst) || tInst.includes(uInst);
        }
        return true;
      });

      // Fallback for coordinator if none match institution exactly
      if (targetUsers.length === 0 && role === 'coordinator') {
        targetUsers = usersList.documents.filter(u => u.role === 'coordinator' || u.role === 'admin' || u.role === 'super_admin');
      }

      // Record in-app notifications
      if (notifCollId) {
        for (const u of targetUsers) {
          if (u.$id) {
            try {
              await databases.createDocument(dbId, notifCollId, ID.unique(), {
                userId: u.$id,
                title: subject,
                message: content,
                type: "info"
              });
            } catch (dbErr) {
               log(`Could not create in-app notification for ${u.$id}: ${dbErr.message}`);
            }
          }
        }
      }

      const rawTargets = targetUsers.flatMap(u => [u.mail_id, u.email, u.user_id, u.$id]).filter(Boolean);
      log(`Role ${role} resolved securely to targets: ${rawTargets.join(', ')}`);

      if (rawTargets.length === 0) {
        return res.json({ success: true, message: `No targets found for role ${role}` });
      }

      // Fall-through to 'push' action
      action = 'push';
      users = rawTargets;
      title = subject;
      body = content;
    }

    if (action === 'push') {
      if (!users || !users.length) {
        return res.json({ success: false, message: 'No target users specified for push notification' }, 400);
      }

      log(`Sending Push Notification: "${title}" to raw targets: ${users.join(', ')}`);

      // Resolve emails and validate IDs directly against Appwrite Auth
      const usersSdk = new Users(client);
      const resolvedTargetIds = new Set();

      for (const identifier of users) {
        if (!identifier) continue;
        try {
          if (identifier.includes('@')) {
            // It's an email, look up the Auth User
            const res = await usersSdk.list([Query.equal("email", identifier)]);
            if (res.total > 0) {
              resolvedTargetIds.add(res.users[0].$id);
              log(`Resolved email ${identifier} -> Auth ID ${res.users[0].$id}`);
            } else {
              log(`No Auth user found for email ${identifier}`);
            }
          } else {
            // It's an ID. Validate that it's a real Auth User ID to prevent crashing the Push API.
            try {
              const res = await usersSdk.get(identifier);
              if (res && res.$id) {
                resolvedTargetIds.add(res.$id);
                log(`Validated Auth ID ${identifier}`);
              }
            } catch (err) {
              log(`Skipping invalid Auth ID ${identifier}: ${err.message}`);
            }
          }
        } catch (e) {
          log(`Error looking up user ${identifier}: ${e.message}`);
        }
      }

      const finalTargets = Array.from(resolvedTargetIds);
      log(`Final Validated Push Targets: ${finalTargets.join(', ')}`);

      if (finalTargets.length === 0) {
         return res.json({ success: false, message: 'No valid Auth users found for push notification' }, 400);
      }

      const message = await messaging.createPush(
        ID.unique(),
        title || 'Notification',
        body || '',
        [], // topics
        finalTargets, // resolved target users array
        [], // targets
        data || {},
        undefined, // action
        undefined, // image
        icon || undefined, // icon
        undefined, // sound
        undefined, // color
        undefined, // tag
        badge || undefined, // badge
        false // draft
      );

      return res.json({ success: true, action: 'push', messageId: message.$id });
    }

    // Booking Confirmation Email Handler via Resend.com
    if (action === 'booking_confirmation_email' || action === 'send_booking_email') {
      const resendApiKey = process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY;
      if (!resendApiKey) {
        log('Warning: RESEND_API_KEY not configured in environment. Skipping email dispatch.');
        return res.json({ success: false, message: 'RESEND_API_KEY environment variable missing' }, 200);
      }

      const targetEmail = recipientEmail || email || (bookingDetails && bookingDetails.userEmail);
      const userName = (bookingDetails && bookingDetails.userName) || payload.userName || 'Valued User';
      const bookingId = (bookingDetails && bookingDetails.bookingId) || payload.bookingId || 'N/A';
      const auditoriumName = (bookingDetails && bookingDetails.auditoriumName) || payload.auditoriumName || 'Auditorium';
      const bookingDate = (bookingDetails && bookingDetails.date) || payload.date || 'N/A';
      const bookingTime = (bookingDetails && bookingDetails.time) || payload.time || 'N/A';

      if (!targetEmail) {
        return res.json({ success: false, message: 'Recipient email address missing' }, 400);
      }

      log(`Sending Resend Confirmation Email to: ${targetEmail}`);

      try {
        const resend = new Resend(resendApiKey);
        const htmlTemplate = `
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
      <div class="greeting">Hello ${userName},</div>
      <div class="badge">✓ Auditorium Booking Confirmed ✅</div>
      <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 20px 0;">
        Your auditorium booking has been successfully confirmed. Below are your official booking details:
      </p>

      <div class="card">
        <div class="card-title">Booking Confirmation Details</div>
        <div class="detail-row"><span class="label">Booking ID:</span><span class="value">${bookingId}</span></div>
        <div class="detail-row"><span class="label">Auditorium Name:</span><span class="value">${auditoriumName}</span></div>
        <div class="detail-row"><span class="label">Date:</span><span class="value">${bookingDate}</span></div>
        <div class="detail-row"><span class="label">Time:</span><span class="value">${bookingTime}</span></div>
        <div class="detail-row"><span class="label">Booked By:</span><span class="value">${userName}</span></div>
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

        const resendData = await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || 'Central Hall Booking <onboarding@resend.dev>',
          to: [targetEmail],
          subject: 'Auditorium Booking Confirmed ✅',
          html: htmlTemplate,
        });

        log(`Resend Email Sent Successfully: ${JSON.stringify(resendData)}`);
        return res.json({ success: true, action: 'email', resendData });
      } catch (resendErr) {
        error(`Email sending failed: ${resendErr.message || resendErr}`);
        return res.json({ success: false, error: resendErr.message }, 500);
      }
    }

    if (action === 'email') {
      if (!users || !users.length) {
        return res.json({ success: false, message: 'No target users specified for email notification' }, 400);
      }

      log(`Sending Email Notification: "${subject}" to users: ${users.join(', ')}`);

      const message = await messaging.createEmail(
        ID.unique(),
        subject || 'Notification',
        content || '',
        [], // topics
        users, // target users array
        [], // targets
        [] // cc/bcc
      );

      return res.json({ success: true, action: 'email', messageId: message.$id });
    }

    return res.json({ success: false, message: 'Invalid or missing action in payload' }, 400);
  } catch (err) {
    error(`Error executing Notification Function: ${err.message}`);
    return res.json({ success: false, error: err.message }, 500);
  }
};
