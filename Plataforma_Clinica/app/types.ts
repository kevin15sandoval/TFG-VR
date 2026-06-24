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
  id: string;
  patientId: string;
  date: string;
  game: string;
  gameId: string;
  duration: number;
  score: number;
  accuracy: number;
  side: string;
  difficulty: string;
  sessionType: string;
  notes?: string;        // Comentarios del fisioterapeuta post-sesión
  gemsNormal?: number;
  gemsGolden?: number;
  gemsGreen?: number;
  gemsPurple?: number;
  gemsRed?: number;
  totalGems?: number;
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
