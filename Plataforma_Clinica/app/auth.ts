// ─── AUTENTICACIÓN — FIREBASE AUTH ───────────────────────────────────────────

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  updateProfile,
  type User,
} from "firebase/auth";
import { auth } from "./firebase";

// ── Login ─────────────────────────────────────────────────────────────────────

export async function login(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

// ── Registro ──────────────────────────────────────────────────────────────────

export async function register(email: string, password: string, displayName: string) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName });
  return cred;
}

// ── Logout ────────────────────────────────────────────────────────────────────

export async function logout() {
  return signOut(auth);
}

// ── Recuperar contraseña ──────────────────────────────────────────────────────

export async function resetPassword(email: string) {
  return sendPasswordResetEmail(auth, email);
}

// ── Observador de estado ──────────────────────────────────────────────────────

export function onAuthChange(cb: (user: User | null) => void) {
  return onAuthStateChanged(auth, cb);
}

// ── Mensajes de error en español ─────────────────────────────────────────────

export function authErrorMsg(code: string): string {
  const map: Record<string, string> = {
    "auth/invalid-email":            "El correo electrónico no es válido",
    "auth/user-not-found":           "No existe ninguna cuenta con ese correo",
    "auth/wrong-password":           "Contraseña incorrecta",
    "auth/invalid-credential":       "Correo o contraseña incorrectos",
    "auth/email-already-in-use":     "Ya existe una cuenta con ese correo",
    "auth/weak-password":            "La contraseña debe tener al menos 6 caracteres",
    "auth/too-many-requests":        "Demasiados intentos fallidos. Inténtalo más tarde",
    "auth/network-request-failed":   "Error de conexión. Revisa tu internet",
    "auth/user-disabled":            "Esta cuenta ha sido desactivada",
  };
  return map[code] ?? "Ha ocurrido un error. Inténtalo de nuevo";
}
