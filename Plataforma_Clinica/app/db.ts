// ─── CAPA DE DATOS — FIRESTORE ────────────────────────────────────────────────
// Todas las operaciones CRUD contra Firebase Firestore.
// Colecciones:  "pacientes",  "sesiones",  "sesion_activa"

import {
  collection, doc, addDoc, updateDoc, deleteDoc, setDoc,
  onSnapshot, query, orderBy, serverTimestamp,
  Timestamp, writeBatch, getDocs, where,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Patient, SessionRecord, SessionConfig } from "./types";

// ── Colecciones ───────────────────────────────────────────────────────────────

const COL_PATIENTS       = "pacientes";
const COL_SESSIONS       = "sesiones";
const COL_ACTIVE_SESSION = "sesion_activa";   // Godot lee esto al arrancar

// ── PACIENTES ─────────────────────────────────────────────────────────────────

/** Suscripción en tiempo real a todos los pacientes ordenados por nombre */
export function subscribePatients(cb: (patients: Patient[]) => void) {
  const q = query(collection(db, COL_PATIENTS), orderBy("name"));
  return onSnapshot(q, snap => {
    const patients = snap.docs.map(d => ({ ...(d.data() as Omit<Patient, "id">), id: d.id } as unknown as Patient));
    cb(patients);
  });
}

/** Añadir paciente nuevo */
export async function addPatient(data: Omit<Patient, "id">) {
  return addDoc(collection(db, COL_PATIENTS), {
    ...data,
    createdAt: serverTimestamp(),
  });
}

/** Editar paciente existente */
export async function updatePatient(id: string, data: Partial<Omit<Patient, "id">>) {
  return updateDoc(doc(db, COL_PATIENTS, String(id)), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

/** Eliminar paciente y todas sus sesiones */
export async function deletePatient(id: string) {
  const batch = writeBatch(db);

  // Eliminar todas las sesiones del paciente
  const sessSnap = await getDocs(
    query(collection(db, COL_SESSIONS), where("patientId", "==", String(id)))
  );
  sessSnap.forEach(d => batch.delete(d.ref));

  // Eliminar el paciente
  batch.delete(doc(db, COL_PATIENTS, String(id)));
  return batch.commit();
}

// ── SESIONES ──────────────────────────────────────────────────────────────────

/** Suscripción en tiempo real a todas las sesiones ordenadas por fecha desc */
export function subscribeSessions(cb: (sessions: SessionRecord[]) => void) {
  const q = query(collection(db, COL_SESSIONS), orderBy("createdAt", "desc"));
  return onSnapshot(q, snap => {
    const sessions = snap.docs.map(d => {
      const data = d.data();
      return {
        ...(data as Omit<SessionRecord, "id">),
        id: d.id,
        // Convertir Timestamp de Firestore a string legible si hace falta
        date: data.date ?? (data.createdAt instanceof Timestamp
          ? data.createdAt.toDate().toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })
          : String(data.date)),
      } as unknown as SessionRecord;
    });
    cb(sessions);
  });
}

/** Guardar una sesión completada */
export async function addSession(data: Omit<SessionRecord, "id">) {
  return addDoc(collection(db, COL_SESSIONS), {
    ...data,
    createdAt: serverTimestamp(),
  });
}

/** Eliminar una sesión */
export async function deleteSession(id: string) {
  return deleteDoc(doc(db, COL_SESSIONS, String(id)));
}

// ── SEED — datos iniciales ────────────────────────────────────────────────────
// Solo se ejecuta si Firestore está vacío (primera vez)
// Flag para evitar doble ejecución en React StrictMode

let _seedRunning = false;

export async function seedIfEmpty(
  initialPatients: Omit<Patient, "id">[],
  initialSessions: Omit<SessionRecord, "id">[]
) {
  if (_seedRunning) return;
  _seedRunning = true;

  try {
    const pSnap = await getDocs(collection(db, COL_PATIENTS));
    if (!pSnap.empty) return; // Ya hay datos, no hacer nada

    const batch = writeBatch(db);

    // Insertar pacientes y mapear índice -> ID Firestore
    const patientRefs: Record<number, string> = {};
    initialPatients.forEach((p, idx) => {
      const ref = doc(collection(db, COL_PATIENTS));
      batch.set(ref, { ...p, createdAt: serverTimestamp() });
      patientRefs[idx + 1] = ref.id;
    });

    // Insertar sesiones con el patientId correcto de Firestore
    for (const s of initialSessions) {
      const ref = doc(collection(db, COL_SESSIONS));
      const numericId = parseInt(String(s.patientId));
      const firestorePatientId = patientRefs[numericId] ?? String(s.patientId);
      batch.set(ref, { ...s, patientId: firestorePatientId, createdAt: serverTimestamp() });
    }

    await batch.commit();
    console.log("✅ Firebase: datos iniciales insertados");
  } finally {
    _seedRunning = false;
  }
}

// ── SESIÓN ACTIVA (para Godot) ────────────────────────────────────────────────

/** Escribe la config de sesión en Firestore para que Godot la lea al arrancar */
export async function publishActiveSession(
  config: SessionConfig,
  patient: Patient,
  sessionId: string
) {
  return setDoc(doc(db, COL_ACTIVE_SESSION, "current"), {
    patientId:    patient.id,
    patientName:  patient.name,
    sessionId,
    duration:     config.duration * 60,     // Godot usa segundos
    difficulty:   config.difficulty,
    therapySide:  config.therapySide,
    sessionType:  config.sessionType,
    gameId:       config.selectedGame,
    publishedAt:  serverTimestamp(),
  });
}

/** Elimina la sesión activa (al cancelar o terminar) */
export async function clearActiveSession() {
  return deleteDoc(doc(db, COL_ACTIVE_SESSION, "current"));
}
