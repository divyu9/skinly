import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";
const firebaseConfig = {
  apiKey: "AIzaSyDuFYb5VIPPyWy-HBQiZXq11cF9AADzrrI",
  authDomain: "skinly-3003b.firebaseapp.com",
  projectId: "skinly-3003b",
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, "skinly");

async function check() {
  const s = await getDocs(collection(db, "productReviews"));
  console.log("Total productReviews in firestore:", s.size);
}
check().catch(console.error);
