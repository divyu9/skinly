import {
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  GoogleAuthProvider,
  signInWithPopup,
  browserPopupRedirectResolver,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";
import type { User } from "firebase/auth";
import app from "./firebase";

/*
 * Auth, kept out of firebase.ts so the first download does not carry it.
 *
 * It is about 85 KB of script before compression, and the page only needs to
 * know whether somebody is signed in — which useAuth asks for once the app
 * has drawn. Everything that signs in or out imports this module.
 *
 * Auth without the sign-in popup machinery loaded up front.
 *
 * getAuth() wires in the popup/redirect resolver, and that resolver loads an
 * iframe from firebaseapp.com plus apis.google.com on every page — about 110 KB
 * fetched while the hero image is still arriving, for a button most visitors
 * never press. The resolver is passed where it is used instead (signInWithGoogle).
 */
export const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence],
});

/** The Google popup. Called straight from a click handler: the module is already loaded by then (useAuth), so the popup still counts as the click's. */
export const signInWithGoogle = (provider: GoogleAuthProvider = new GoogleAuthProvider()) =>
  signInWithPopup(auth, provider, browserPopupRedirectResolver);

export { onAuthStateChanged, signOut, GoogleAuthProvider };
export type { User };
