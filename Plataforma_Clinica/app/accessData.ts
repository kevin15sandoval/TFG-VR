// ─── LECTURA DEL ROL (único acceso a Firestore del guard de acceso) ───────────
// Recibe `db` por parámetro (no importa ./firebase) para poder probarse contra el emulador desde node.
// Solo lee usuarios/{uid} del propio usuario (regla: allow get si request.auth.uid == uid).
import { doc, getDoc, type Firestore } from "firebase/firestore";

export async function leerRolUsuario(db: Firestore, uid: string): Promise<{ existe: boolean; rol?: unknown }> {
  const snap = await getDoc(doc(db, "usuarios", uid));
  if (!snap.exists()) return { existe: false };
  return { existe: true, rol: snap.data()?.rol };
}
