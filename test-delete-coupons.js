import { initializeApp } from 'firebase/app';
import { getFirestore, doc, writeBatch, collection, getDocs, deleteDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDuFYb5VIPPyWy-HBQiZXq11cF9AADzrrI",
  authDomain: "skinly-3003b.firebaseapp.com",
  projectId: "skinly-3003b",
  storageBucket: "skinly-3003b.firebasestorage.app",
  messagingSenderId: "658305224396",
  appId: "1:658305224396:web:62bac8dfa0c0cb1e6d7c69"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, 'skinly');

async function testDelete() {
  try {
    const snap = await getDocs(collection(db, 'coupons'));
    if (snap.empty) {
      console.log("No coupons to delete");
      return;
    }
    const id = snap.docs[0].id;
    console.log("Deleting coupon", id);
    await deleteDoc(doc(db, 'coupons', id));
    console.log("Success");
  } catch (e) {
    console.error("Error", e);
  }
}

testDelete().then(() => process.exit(0));
