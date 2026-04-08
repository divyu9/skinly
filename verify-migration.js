import fs from 'fs';
import path from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getCountFromServer } from 'firebase/firestore';

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

async function checkCollections() {
  const exportDir = './convex-export';
  const dirs = fs.readdirSync(exportDir).filter(f => fs.statSync(path.join(exportDir, f)).isDirectory() && f !== '_storage' && f !== '_tables');
  
  console.log("Checking migration status...");
  console.log("--------------------------------------------------");
  console.log("Collection".padEnd(30) + "Convex".padEnd(15) + "Firebase".padEnd(15) + "Status");
  console.log("--------------------------------------------------");

  for (const dir of dirs) {
    const jsonlPath = path.join(exportDir, dir, 'documents.jsonl');
    let convexCount = 0;
    if (fs.existsSync(jsonlPath)) {
      const content = fs.readFileSync(jsonlPath, 'utf-8');
      convexCount = content.split('\n').filter(l => l.trim()).length;
    }

    if (convexCount === 0) continue; // skip empty collections

    try {
      const coll = collection(db, dir);
      const snapshot = await getCountFromServer(coll);
      const firebaseCount = snapshot.data().count;
      
      let status = "✅ OK";
      if (firebaseCount === 0 && convexCount > 0) status = "❌ MISSING";
      else if (firebaseCount < convexCount) status = "⚠️ PARTIAL";
      
      console.log(dir.padEnd(30) + String(convexCount).padEnd(15) + String(firebaseCount).padEnd(15) + status);
    } catch (e) {
      console.log(dir.padEnd(30) + String(convexCount).padEnd(15) + "ERROR".padEnd(15) + "❌ FAILED");
    }
  }
}

checkCollections().then(() => process.exit(0)).catch(console.error);
