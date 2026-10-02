import { getFirestore } from "firebase/firestore";
import app from "./firebase";

/**
 * The Firestore instance, kept out of firebase.ts on purpose.
 *
 * firebase.ts is imported by the first page (sign-in state, Cloud Functions),
 * and Firestore is the biggest piece of the Firebase SDK, ~220 KB of the
 * script a phone downloads before it can draw anything. Reads go through
 * firebase-hooks-store, which the first query loads on its own; code that is
 * already off the first download imports `db` from here.
 */
export const db = getFirestore(app);
