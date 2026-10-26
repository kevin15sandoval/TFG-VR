// ─── AUTENTICACIÓN — FIREBASE AUTH ───────────────────────────────────────────

import {
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { auth } from "./firebase";

// ── Login ─────────────────────────────────────────────────────────────────────

export async function login(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

// ── Registro ──────────────────────────────────────────────────────────────────
// PR5b: el registro público se ha retirado (acceso solo por invitación). Las cuentas las aprovisiona el
// administrador (Auth + usuarios/{uid}). Nota: cerrar el sign-up en Firebase Console es decisión del autor.

// ── Logout ────────────────────────────────────────────────────────────────────

export async function logout() {
  return signOut(auth);
}

// ── Recuperar contraseña ──────────────────────────────────────────────────────

export async function resetPassword(email: string) {
  return sendPasswordResetEmail(auth, email);
}

// ── Verificación de correo ────────────────────────────────────────────────────

export async function reenviarVerificacion(user: User) {
  return sendEmailVerification(user);
}

// ── Observador de estado ──────────────────────────────────────────────────────

export function onAuthChange(cb: (user: User | null) => void) {
  return onAuthStateChanged(auth, cb);
}

// ── Mensajes de error en español ─────────────────────────────────────────────

export function authErrorMsg(code: string): string {
  // Ningún texto debe revelar si una cuenta existe o no (user-not-found y wrong-password = credenciales inválidas).
  const map: Record<string, string> = {
    "auth/invalid-email":            "El correo electrónico no es válido",
    "auth/user-not-found":           "Correo o contraseña incorrectos",
    "auth/wrong-password":           "Correo o contraseña incorrectos",
    "auth/invalid-credential":       "Correo o contraseña incorrectos",
    "auth/too-many-requests":        "Demasiados intentos. Inténtalo de nuevo más tarde",
    "auth/network-request-failed":   "Error de conexión. Revisa tu internet",
    "auth/user-disabled":            "No se puede iniciar sesión con esta cuenta. Contacta con el administrador",
    "auth/user-token-expired":       "Tu sesión ha caducado. Vuelve a iniciar sesión",
    "auth/requires-recent-login":    "Por seguridad, vuelve a iniciar sesión para continuar",
    "auth/operation-not-allowed":    "Esta operación no está permitida. Contacta con el administrador",
    "auth/internal-error":           "Error interno. Inténtalo de nuevo más tarde",
    "auth/timeout":                  "La operación ha tardado demasiado. Inténtalo de nuevo",
  };
  return map[code] ?? "Ha ocurrido un error. Inténtalo de nuevo";
}
