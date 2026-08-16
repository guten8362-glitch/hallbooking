import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDnV6fj-4Sul45w7SNW4WT4MWuEAJF2Y6k",
  authDomain: `${import.meta.env.VITE_FIREBASE_PROJECT_ID || "bookmyauditorium-81514"}.firebaseapp.com`,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "bookmyauditorium-81514",
  storageBucket: `${import.meta.env.VITE_FIREBASE_PROJECT_ID || "bookmyauditorium-81514"}.firebasestorage.app`,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "876749603919",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:876749603919:web:37d7786c31cf8db201163a",
  measurementId: "G-S4L5S2N4Q6",
};

let app: any;
let messaging: any;

try {
  if (firebaseConfig.apiKey) {
    app = initializeApp(firebaseConfig);
    // Only initialize messaging in the browser (client-side) to prevent SSR crashes
    if (typeof window !== 'undefined') {
      messaging = getMessaging(app);
      console.log("Firebase initialized successfully");
    }
  }
} catch (error) {
  console.error("Firebase initialization error:", error);
}

export const getDeviceInfo = () => {
  if (typeof window === 'undefined' || !navigator) {
    return { device: 'Unknown', browser: 'Unknown', os: 'Unknown' };
  }
  const ua = navigator.userAgent;
  let os = 'Unknown OS';
  if (ua.includes('Win')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  else if (ua.includes('Linux')) os = 'Linux';

  let browser = 'Unknown Browser';
  if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Safari')) browser = 'Safari';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Edg')) browser = 'Edge';

  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const device = isMobile ? 'Mobile' : 'Desktop';

  return { device, browser, os, userAgent: ua };
};

export const requestFCMToken = async () => {
  try {
    if (!messaging || typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;

    let registration: ServiceWorkerRegistration | undefined;
    try {
      registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js?v=2', { scope: '/' });
      await navigator.serviceWorker.ready;
    } catch (swErr) {
      console.warn("FCM: Service worker registration warning:", swErr);
    }

    const vapidKey = (import.meta.env.VITE_FIREBASE_VAPID_KEY || "BEyLts8jhRrkXM4rWaa1Xt5F2tpBNf30o__1buuwJu1btW11T-Kuxeh0FWk94j_ree-FYlRokDO4K6YSsgGTPFg").trim();

    let token: string | null = null;
    try {
      token = await getToken(messaging, {
        vapidKey,
        ...(registration ? { serviceWorkerRegistration: registration } : {})
      });
    } catch (getTokenErr: any) {
      console.warn("FCM getToken with vapidKey failed, trying fallback:", getTokenErr?.message || getTokenErr);
      try {
        token = await getToken(messaging, {
          ...(registration ? { serviceWorkerRegistration: registration } : {})
        });
      } catch (fallbackErr: any) {
        console.warn("FCM getToken fallback error:", fallbackErr?.message || fallbackErr);
      }
    }

    if (token) {
      const prevToken = localStorage.getItem("fcm_token");
      if (prevToken && prevToken !== token) {
        console.log("[FCM TOKEN ROTATED/REFRESHED]", { oldToken: prevToken.substring(0, 10) + "...", newToken: token.substring(0, 10) + "..." });
        localStorage.setItem("fcm_token_refreshed_at", new Date().toISOString());
        localStorage.setItem("fcm_token_prev", prevToken);
      }
      localStorage.setItem("fcm_token", token);
      console.log("FCM Token generated successfully!", token);
    }
    return token;
  } catch (error: any) {
    console.warn("FCM token generation handled:", error?.message || error);
    return null;
  }
};

export const setupFCMListener = (onMessageReceived: (payload: any) => void) => {
  if (!messaging) return;
  onMessage(messaging, (payload) => {
    console.log("FCM Message received in foreground:", payload);
    onMessageReceived(payload);
  });
};
