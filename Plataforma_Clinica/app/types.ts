// ─── TIPOS COMPARTIDOS ────────────────────────────────────────────────────────

export type Screen =
  | "dashboard" | "patients" | "patient-profile" | "session-detail"
  | "new-session" | "minigames" | "game-spec" | "results" | "history"
  | "settings" | "connect-device";

export interface GameSpecification {
  id: string;
  name: string;
  description: string;
  targetMuscles: string[];
  primaryMovements: string[];
  secondaryMovements: string[];
  workZones: {
    zone: string;
    percentage: number;
    description: string;
  }[];
  therapeuticBenefits: string[];
  contraindications: string[];
  progressionCriteria: {
    beginner: string;
    intermediate: string;
    advanced: string;
  };
  clinicalNotes: string;
}

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

export interface MovementSummary {
  exercise: string;
  count: number;
  type: string;
}

export interface ZonesWorked {
  Alto: number;
  Medio: number;
  Lateral: number;
  Bajo: number;
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
  notes?: string;
  // Métricas clínicas reales (vienen de Godot)
  gemsNormal?: number;
  gemsGolden?: number;
  gemsGreen?: number;
  gemsPurple?: number;
  gemsRed?: number;
  gemsRedAvoided?: number;
  totalGems?: number;
  avgTimePerGem?: number;
  movementsSummary?: MovementSummary[];
  zonesWorked?: ZonesWorked;
  totalMovements?: number;
  fromVR?: boolean;
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
