import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./firebase-admin.json', 'utf8'));

initializeApp({
  credential: cert(serviceAccount),
  databaseId: 'skinly' // Using the specific database ID as we found earlier
});

const db = getFirestore();

async function check() {
  try {
    const snap = await db.collection('productCategoriesConfig').get();
    console.log("productCategoriesConfig docs count:", snap.size);
    
    const gtSnap = await db.collection('gadgetTypes').get();
    console.log("gadgetTypes docs count:", gtSnap.size);
  } catch (e) {
    console.error(e.message);
  }
}
check();
