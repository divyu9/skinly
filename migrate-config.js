import fs from 'fs';
import path from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, writeBatch } from 'firebase/firestore';

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

async function migrateCollection(collectionName) {
  const filePath = path.join('./convex-export', collectionName, 'documents.jsonl');
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping ${collectionName} - No documents.jsonl found`);
    return;
  }

  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const lines = fileContent.split('\n').filter(line => line.trim());
  
  if (lines.length === 0) {
    console.log(`Skipping ${collectionName} - Empty file`);
    return;
  }

  console.log(`Migrating ${lines.length} documents for ${collectionName}...`);

  // Firestore batch limit is 500
  const BATCH_SIZE = 450;
  let batch = writeBatch(db);
  let count = 0;
  let totalMigrated = 0;

  for (let i = 0; i < lines.length; i++) {
    try {
      const docData = JSON.parse(lines[i]);
      const docId = docData._id;
      delete docData._id; // Remove Convex internal ID

      const docRef = doc(db, collectionName, docId);
      batch.set(docRef, docData);
      
      count++;
      totalMigrated++;

      if (count === BATCH_SIZE || i === lines.length - 1) {
        await batch.commit();
        console.log(`  Committed batch of ${count} records for ${collectionName}...`);
        batch = writeBatch(db);
        count = 0;
      }
    } catch (e) {
      console.error(`Error parsing JSON on line ${i+1} for ${collectionName}:`, e.message);
    }
  }
  
  console.log(`✅ Finished ${collectionName} (${totalMigrated} docs)`);
}

async function run() {
  const configCollections = [
    'productCategoriesConfig',
    'gadgetTypes',
    'finishTypes',
    'collections',
    'collectionProducts',
    'categoryDisplaySettings',
    'homepageSections',
    'homepageSettings',
    'homepageSectionCards',
    'seoPages'
  ];

  console.log("Migrating missing config tables...");
  for (const col of configCollections) {
    await migrateCollection(col);
  }
  console.log("Done.");
  process.exit(0);
}

run().catch(console.error);
