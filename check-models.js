import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, limit, query } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDuFYb5VIPPyWy-HBQiZXq11cF9AADzrrI",
  authDomain: "skinly-3003b.firebaseapp.com",
  projectId: "skinly-3003b",
  storageBucket: "skinly-3003b.firebasestorage.app",
  messagingSenderId: "658305224396",
  appId: "1:658305224396:web:62bac8dfa0c0cb1e6d7c69"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, 'skinly'); // explicitly use skinly DB!

async function check() {
  try {
    const snap = await getDocs(query(collection(db, 'supportedModels'), limit(10)));
    console.log("supportedModels docs sample:", snap.docs.map(d => d.data()).length);
  } catch (e) {
    console.error(e);
  }
}
check();
