importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyDnV6fj-4Sul45w7SNW4WT4MWuEAJF2Y6k",
  authDomain: "bookmyauditorium-81514.firebaseapp.com",
  projectId: "bookmyauditorium-81514",
  storageBucket: "bookmyauditorium-81514.firebasestorage.app",
  messagingSenderId: "876749603919",
  appId: "1:876749603919:web:37d7786c31cf8db201163a",
  measurementId: "G-S4L5S2N4Q6"
};

// Force immediate activation so we don't get stuck with old cached Service Workers
self.addEventListener('install', function(event) {
  self.skipWaiting();
});
self.addEventListener('activate', function(event) {
  event.waitUntil(self.clients.claim());
});

// Initialize Firebase App
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Optional: Background message handler
// We do NOT call showNotification manually here because Appwrite's createPush always includes
// a "notification" payload, which causes Chrome/Android to show a system notification automatically.
// Showing one here would result in duplicate notifications.
messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  // Custom logic can go here (e.g., updating IndexedDB, badges), but NO showNotification!
});

// PWA Installability Requirement: Handle fetch events (pass-through)
self.addEventListener('fetch', function(event) {
  // Pass through all requests to network
  return;
});

// Handle notification click
self.addEventListener('notificationclick', function(event) {
  console.log('[firebase-messaging-sw.js] Notification click Received.', event);

  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(windowClients) {
      // If we have a URL passed in the notification data, try to open that. Otherwise default to root.
      const urlToOpen = (event.notification.data && event.notification.data.url) || self.registration.scope;
      
      // Check if there is already a window/tab open with the target URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        // If it's the exact same URL, focus it
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Check if any app window is open at all, and navigate it
      if (windowClients.length > 0) {
        const client = windowClients[0];
        if ('navigate' in client && 'focus' in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      
      // If no window/tab is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
