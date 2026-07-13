// Script para agregar campo "status" a sesión activa existente
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAvNPn-wGHRE9ZTnfXMpyWe9TRdGqy-l5E",
  authDomain: "tfg-vr.firebaseapp.com",
  projectId: "tfg-vr",
  storageBucket: "tfg-vr.firebasestorage.app",
  messagingSenderId: "662530825301",
  appId: "1:662530825301:web:2d53a3ecb2ae64ee84b933"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fixStatus() {
  try {
    console.log('🔧 Agregando campo status="pending" a sesión activa...');
    await updateDoc(doc(db, 'sesion_activa', 'current'), {
      status: 'pending'
    });
    console.log('✅ Campo status agregado correctamente');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixStatus();
