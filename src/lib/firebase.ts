import { initializeApp } from "firebase/app";
import { initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import type { Analytics } from "firebase/analytics";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize App Check (Only when a valid reCAPTCHA site key is configured)
let appCheck;
if (typeof window !== "undefined" && import.meta.env.VITE_RECAPTCHA_SITE_KEY) {
  appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(import.meta.env.VITE_RECAPTCHA_SITE_KEY),
    isTokenAutoRefreshEnabled: true
  });
}

// Initialize Services
/*
 * Auth without the sign-in popup machinery loaded up front.
 *
 * getAuth() wires in the popup/redirect resolver, and that resolver loads an
 * iframe from firebaseapp.com plus apis.google.com on every page — about 110 KB
 * fetched while the hero image is still arriving, for a button most visitors
 * never press. The resolver is passed where it is used instead (signInWithPopup
 * in the headers and the sign-in dialog), so it loads when somebody signs in.
 */
export const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence],
});
export const db = getFirestore(app);
export const storage = getStorage(app);

export const functions = getFunctions(app, "us-central1");

/*
 * Firebase Analytics, started once the page has finished loading.
 *
 * Initialising it here loaded gtag.js for this project's measurement id the
 * moment the bundle ran — 155 KB competing with the hero image on a phone,
 * and the one analytics script the five-second defer in index.html never
 * covered. Nothing reads the handle; it exists for the automatic page view,
 * which still fires, just after the page is up.
 */
export let analytics: Analytics | null = null;
if (typeof window !== "undefined") {
  const start = () => {
    const idle = (window as any).requestIdleCallback || ((cb: () => void) => setTimeout(cb, 1500));
    idle(() => {
      import("firebase/analytics").then(({ getAnalytics, isSupported }) =>
        isSupported().then((ok) => { if (ok) analytics = getAnalytics(app); })
      ).catch(() => {});
    });
  };
  if (document.readyState === "complete") start();
  else window.addEventListener("load", start, { once: true });
}

export { appCheck };
export default app;
