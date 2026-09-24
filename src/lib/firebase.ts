import { initializeApp } from "firebase/app";
import { initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
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
 * No Firebase Analytics. It reported to G-XRY71Y8B66, a second GA4 property
 * nobody reads; the site's analytics is G-16S5XDYGYR, loaded by index.html,
 * which already receives every page view and event. The extra tag cost
 * ~150 KB of gtag.js and a share of the main-thread time PageSpeed counted
 * against the page.
 */

export { appCheck };
export default app;
