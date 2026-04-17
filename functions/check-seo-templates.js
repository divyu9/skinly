import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
const firebaseConfig = {
  apiKey: "AIzaSyDuFYb5VIPPyWy-HBQiZXq11cF9AADzrrI",
  authDomain: "skinly-3003b.firebaseapp.com",
  projectId: "skinly-3003b",
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, "skinly");

async function run() {
  const a = await getDocs(collection(db, "seoPageTemplates"));
  const b = await getDocs(collection(db, "seoTemplates"));
  console.log("seoPageTemplates:", a.size);
  console.log("seoTemplates:", b.size);
}
run().catch(console.error);
