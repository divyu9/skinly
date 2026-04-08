import { initializeApp } from 'firebase/app';
import { getFirestore, doc, writeBatch, collection, addDoc, getDocs } from 'firebase/firestore';

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

async function testBulk() {
  try {
    const snap = await getDocs(collection(db, 'coupons'));
    const ids = snap.docs.map(d => d.id).slice(0, 5); // pick 5
    
    console.log("Testing bulk disable...");
    const batch1 = writeBatch(db);
    ids.forEach(id => {
      batch1.update(doc(db, 'coupons', id), { isActive: false });
    });
    await batch1.commit();
    console.log("Disable succeeded");
    
    // Testing bulk delete
    /*
    console.log("Testing bulk delete...");
    const batch2 = writeBatch(db);
    ids.forEach(id => {
      batch2.delete(doc(db, 'coupons', id));
    });
    await batch2.commit();
    console.log("Delete succeeded");
    */
  } catch (e) {
    console.error("FAILED", e);
  }
}

testBulk().then(() => process.exit(0));
