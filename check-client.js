import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDuFYb5VIPPyWy-HBQiZXq11cF9AADzrrI",
  authDomain: "skinly-3003b.firebaseapp.com",
  projectId: "skinly-3003b",
  storageBucket: "skinly-3003b.firebasestorage.app",
  messagingSenderId: "658305224396",
  appId: "1:658305224396:web:62bac8dfa0c0cb1e6d7c69",
  measurementId: "G-XRY71Y8B66"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, 'skinly'); // Provide databaseId here!

async function check() {
  try {
    const snap = await getDocs(collection(db, 'productCategoriesConfig'));
    console.log("productCategoriesConfig docs count:", snap.size);
    
    const gtSnap = await getDocs(collection(db, 'gadgetTypes'));
    console.log("gadgetTypes docs count:", gtSnap.size);
    
    const ftSnap = await getDocs(collection(db, 'finishTypes'));
    console.log("finishTypes docs count:", ftSnap.size);
  } catch (e) {
    console.error(e);
  }
}
check();
