import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";

const serviceAccount = JSON.parse(readFileSync("tfg-vr-firebase-adminsdk-fbsvc-4848cd0ce2.json", "utf8"));

const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

async function clearCollection(collectionName) {
  const snapshot = await db.collection(collectionName).get();
  const batch = db.batch();
  
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  
  await batch.commit();
  console.log(`✅ Eliminados ${snapshot.size} documentos de ${collectionName}`);
}

async function clearDatabase() {
  console.log("🗑️  Limpiando base de datos...");
  
  await clearCollection("sesiones");
  await clearCollection("pacientes");
  
  console.log("\n✅ Base de datos limpia");
  process.exit(0);
}

clearDatabase().catch(e => {
  console.error("❌ Error:", e);
  process.exit(1);
});
