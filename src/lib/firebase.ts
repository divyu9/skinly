import { initializeApp } from "firebase/app";
import { getFunctions } from "firebase/functions";
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

// Initialize Services (Auth and Firestore load on their own: firebase-auth.ts, firebase-db.ts)
export const functions = getFunctions(app, "us-central1");

/*
 * No Firebase Analytics. It reported to G-XRY71Y8B66, a second GA4 property
 * nobody reads; the site's analytics is G-16S5XDYGYR, loaded by index.html,
 * which already receives every page view and event. The extra tag cost
 * ~150 KB of gtag.js and a share of the main-thread time PageSpeed counted
 * against the page.
 */

export { appCheck };
export default app;
