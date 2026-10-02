// The Firestore SDK and the app's database, as one lazily loaded module.
// See loadFs (fs.ts): code on the first page reaches Firestore through it.
export * from "firebase/firestore";
export { db } from "./firebase-db";
