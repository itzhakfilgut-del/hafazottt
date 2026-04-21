import { initializeApp } from 'firebase/app';
import { initializeAuth, getAuth, indexedDBLocalCache } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

export const app = initializeApp(firebaseConfig);

// In Capacitor Android, getAuth() mounts a hidden iframe for popups that crashes
// with "Offline is not defined" in Google's api.js. We bypass it via initializeAuth natively.
export const auth = Capacitor.isNativePlatform()
  ? initializeAuth(app, { persistence: indexedDBLocalCache })
  : getAuth(app);

export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
});
