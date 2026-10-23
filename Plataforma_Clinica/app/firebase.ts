// ─── FIREBASE CONFIG ──────────────────────────────────────────────────────────
// Las credenciales se leen de variables de entorno (archivo .env)
// El archivo .env está en .gitignore y NUNCA debe subirse al repositorio
//
// Modo emulador (solo desarrollo): VITE_USE_EMULATORS=true con `vite` (DEV). Usa el proyecto demo
// "demo-tfg-vr", conecta Auth (127.0.0.1:9099) y Firestore (127.0.0.1:8080) y NO inicializa Analytics.
// En un build de producción esa variable provoca un error en el arranque (ver app/emulators.ts).

import { initializeApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getAnalytics, isSupported } from "firebase/analytics";
import { shouldUseEmulators } from "./emulators";

// Lanza si VITE_USE_EMULATORS=true fuera de DEV. `import.meta.env.DEV` se sustituye por `false` en el
// build, por lo que `useEmulators` es `false` estático y el código de conexión se elimina del bundle.
const emulatorRequested = shouldUseEmulators({
  DEV: import.meta.env.DEV,
  VITE_USE_EMULATORS: import.meta.env.VITE_USE_EMULATORS,
});
const useEmulators = import.meta.env.DEV && emulatorRequested;

const firebaseConfig = useEmulators
  ? {
      // Config ficticia: no se lee ninguna credencial real en modo emulador.
      apiKey:     "demo-api-key",
      authDomain: "localhost",
      projectId:  "demo-tfg-vr",
      appId:      "demo-app-id",
    }
  : {
      apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId:             import.meta.env.VITE_FIREBASE_APP_ID,
      measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
    };

export const app  = initializeApp(firebaseConfig);
export const db   = getFirestore(app);
export const auth = getAuth(app);

if (import.meta.env.DEV && useEmulators) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  console.warn("[firebase] MODO EMULADOR: Auth 127.0.0.1:9099, Firestore 127.0.0.1:8080 (proyecto demo-tfg-vr)");
} else {
  // Analytics solo si el entorno lo soporta (no SSR, no tests)
  isSupported().then(yes => { if (yes) getAnalytics(app); });
}
