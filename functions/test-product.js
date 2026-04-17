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
  const q = query(collection(db, "products"), where("slug", "==", "magneto-x-type-c-ssd-enclosure-with-m-2-nvme-support"));
  const s = await getDocs(q);
  s.forEach(doc => {
    console.log("Product:", doc.data());
  });
}
check().catch(console.error);
