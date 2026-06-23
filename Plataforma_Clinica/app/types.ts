// ─── TIPOS COMPARTIDOS ────────────────────────────────────────────────────────

export type Screen =
  | "dashboard" | "patients" | "patient-profile"
  | "new-session" | "minigames" | "results" | "history"
  | "settings" | "connect-device";

export interface Patient {
  id: string;          // Firestore doc ID (string)
  name: string;
  initials: string;
  age: number;
  affectedSide: string;
  lastSession: string;
  progress: number;
  diagnosis: string;
  sessions: number;
  status: "activo" | "inactivo";
  colorIdx: number;
  notes: string;
}

export interface SessionRecord {
  id: string;          // Firestore doc ID (string)
  patientId: string;   // Referencia al ID del paciente en Firestore
  date: string;
  game: string;
  gameId: string;
  duration: number;
  score: number;
  accuracy: number;
  side: string;
  difficulty: string;
  sessionType: string;
}

export interface SessionConfig {
  patientId: string | null;
  duration: number;
  therapySide: string;
  difficulty: string;
  heightMode: string;
  sessionType: string;
  selectedGame: string;
}
