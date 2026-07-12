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
  
  // ═══════════════════════════════════════════════════════════════════════════
  // MÉTRICAS CLÍNICAS REALES (vienen de Godot)
  // ═══════════════════════════════════════════════════════════════════════════
  
  // ─── GEMS GAME ─────────────────────────────────────────────────────────────
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
  
  // ─── URBAN ATTENTION QUEST (CityWorld) ─────────────────────────────────────
  // Negligencia espacial
  left_side_targets?: number;
  right_side_targets?: number;
  asymmetry_percentage?: number;
  neglect_score?: number;  // 0-100
  left_avg_reaction?: number;
  right_avg_reaction?: number;
  
  // Rango de movimiento cervical
  cervical_rom_degrees?: {
    rotation_left: number;
    rotation_right: number;
    extension_up: number;
    flexion_down: number;
    total_rom: number;
  };
  
  // Búsqueda visual
  visual_search_metrics?: {
    avg_search_time_seconds: number;
    gaze_interruption_rate_percent: number;
    interrupted_gazes_count: number;
    gaze_stability_score: number;
  };
  
  // Distribución espacial
  spatial_distribution?: {
    front_targets: number;
    back_targets: number;
    high_targets: number;
    low_targets: number;
    rotation_180_count: number;
  };
  
  // Scores clínicos funcionales
  spatial_awareness?: number;
  orientation?: number;
  processing_speed?: number;
  cervical_mobility?: number;
  visual_search_efficiency?: number;
  gaze_stability?: number;
  clinical_scores?: {
    spatial_awareness: number;
    orientation: number;
    processing_speed: number;
    neglect_clinical: number;
    cervical_mobility: number;
    visual_search_efficiency: number;
    gaze_stability: number;
  };
  
  // Recomendaciones clínicas
  clinical_recommendations?: string[];
  
  // Métricas de ejercicio
  targets_collected?: number;
  total_targets?: number;
  sequence_errors?: number;
  avg_reaction_time?: number;
  completion_percentage?: number;
  target_times?: number[];
  
  // ─── VAULT WORLD (Laser Vault Escape) ──────────────────────────────────────
  panels_collected?: number;
  total_panels?: number;
  panels_completed?: number;
  laser_hits?: number;
  laser_touches?: number;
  avg_time_per_panel?: number;
  planning_score?: number;
  motor_control_score?: number;
  spatial_awareness_score?: number;
  executive_function_score?: number;
  inhibitory_control_score?: number;
  spatial_memory_score?: number;
  vault_completion_time?: number;
  completion_percentage?: number;
  vertical_range_meters?: number;
  crosses_midline?: number;
  
  // ─── LUGGAGE WORLD (Luggage Handler) ───────────────────────────────────────
  luggage_placed?: number;
  luggage_dropped?: number;
  luggage_wrong?: number;
  luggage_delivered?: number;
  total_luggage?: number;
  max_combo?: number;
  total_weight_moved?: number;
  max_weight_lifted?: number;
  time_under_load?: number;
  avg_luggage_weight?: number;
  trunk_rotations_left?: number;
  trunk_rotations_right?: number;
  trunk_asymmetry?: number;
  strength_score?: number;
  endurance_score?: number;
  trunk_mobility_score?: number;
  coordination_score?: number;
  avg_delivery_time?: number;
  
  // ─── METADATOS ─────────────────────────────────────────────────────────────
  fromVR?: boolean;
  game_type?: string;
  game_name?: string;
  time_elapsed?: number;
  therapy_side?: string;
  session_type?: string;
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
