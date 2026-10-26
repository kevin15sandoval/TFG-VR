// ═══════════════════════════════════════════════════════════════════════════
// PANTALLA DE RESULTADOS — view-model puro (sin Firebase, sin React)
//
// Construye lo que la pantalla muestra a partir del documento REALMENTE
// almacenado en `sesiones`. Nunca calcula puntuación, precisión ni duración a
// partir de la configuración de la sesión, y nunca escribe nada.
//
// Reutiliza las funciones del historial (sessionHistory.ts): procedencia,
// calidad y duración normalizada, para que Historial, PDF y Resultados digan
// lo mismo de una misma sesión.
//
// IDENTIFICADOR: Godot hace POST a /sesiones (id de documento autogenerado,
// firebase_manager.gd:222,269) y guarda la sesión enviada en el CAMPO `sessionId`
// (firebase_manager.gd:242). El id del documento NO es el sessionId, así que
// desde el flujo de conexión se busca por campo (kind "sessionId"); desde el
// Historial se usa el id del documento (kind "docId").
//
// MÉTRICAS POR JUEGO: solo contadores/eventos que firebase_manager.gd persiste
// y que son recuentos directos. Se OMITEN a propósito (no son mediciones
// fiables/validadas): avgTimePerGem y avg_time_s (Gemas), avg_time_per_panel,
// vertical_range_meters y *_score (Vault: motor_control, planning,
// spatial_awareness), asymmetry/neglect/avg_reaction_time/cervical_rom_* y
// clinical_scores (City), pesos, time_under_load, trunk_* y *_score (Luggage).
// Limitación conocida: Godot rellena con 0 los campos que no recibe, por lo
// que un 0 almacenado no distingue "no medido" de "valor cero".
// ═══════════════════════════════════════════════════════════════════════════

import {
  normalizeSession, originLabel, qualityLabel, formatDuration,
  type HistorySession, type HistoryGameKind, type HistoryOrigin, type HistoryQuality,
} from "./sessionHistory.ts";

type Raw = Record<string, unknown>;

export type ResultsStatus = "loading" | "waiting" | "not_found" | "error" | "forbidden" | "mismatch" | "ready";

export interface ResultsTarget {
  /** "sessionId": campo `sessionId` del documento (flujo de conexión). "docId": id del documento. */
  kind: "sessionId" | "docId";
  value: string;
}

/** Texto de una métrica ausente. */
export const NOT_AVAILABLE = "No disponible";

/** Campos que NO se muestran como métricas (ver cabecera). Lo usan las pruebas. */
export const OMITTED_FIELDS = [
  "avgTimePerGem", "movementsSummary",
  "avg_time_per_panel", "vertical_range_meters", "motor_control_score", "planning_score", "spatial_awareness_score",
  "asymmetry_percentage", "neglect_score", "avg_reaction_time", "cervical_rom_total", "processing_speed", "cervical_mobility",
  "total_weight_moved", "max_weight_lifted", "time_under_load", "trunk_asymmetry", "strength_score", "coordination_score",
] as const;

function num(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export interface ResultsMetric { label: string; value: string; available: boolean }

const metric = (label: string, n: number | null, suffix = ""): ResultsMetric =>
  n === null ? { label, value: NOT_AVAILABLE, available: false } : { label, value: `${fmt(n)}${suffix}`, available: true };

/** "x / y" solo si ambos existen; si falta alguno, no disponible. */
const ratio = (label: string, a: number | null, b: number | null): ResultsMetric =>
  a === null || b === null ? { label, value: NOT_AVAILABLE, available: false } : { label, value: `${fmt(a)} / ${fmt(b)}`, available: true };

function zoneValue(raw: Raw, zone: string): number | null {
  const z = raw.zonesWorked;
  return z && typeof z === "object" ? num((z as Raw)[zone]) : null;
}

/** Métricas específicas del juego (solo las no omitidas). Ausente => "No disponible". */
export function gameMetrics(raw: Raw, kind: HistoryGameKind): ResultsMetric[] {
  switch (kind) {
    case "gems":
      return [
        metric("Gemas recogidas", num(raw.totalGems)),
        metric("Gemas normales", num(raw.gemsNormal)),
        metric("Gemas doradas", num(raw.gemsGolden)),
        metric("Gemas verdes", num(raw.gemsGreen)),
        metric("Gemas moradas", num(raw.gemsPurple)),
        metric("Gemas rojas tocadas", num(raw.gemsRed)),
        metric("Gemas rojas evitadas", num(raw.gemsRedAvoided)),
        metric("Movimientos totales", num(raw.totalMovements)),
        metric("Zona alta", zoneValue(raw, "Alto")),
        metric("Zona media", zoneValue(raw, "Medio")),
        metric("Zona lateral", zoneValue(raw, "Lateral")),
        metric("Zona baja", zoneValue(raw, "Bajo")),
      ];
    case "vault":
      return [
        ratio("Paneles recogidos", num(raw.panels_collected), num(raw.total_panels)),
        metric("Finalización", num(raw.completion_percentage), " %"),
        metric("Impactos de láser", num(raw.laser_hits)),
        metric("Cruces de la línea media", num(raw.crosses_midline)),
      ];
    case "city":
      return [
        ratio("Objetivos recogidos", num(raw.targets_collected), num(raw.total_targets)),
        metric("Finalización", num(raw.completion_percentage), " %"),
        metric("Errores de secuencia", num(raw.sequence_errors)),
        metric("Objetivos lado izquierdo", num(raw.left_side_targets)),
        metric("Objetivos lado derecho", num(raw.right_side_targets)),
      ];
    case "luggage":
      return [
        metric("Maletas colocadas", num(raw.luggage_placed)),
        metric("Maletas caídas", num(raw.luggage_dropped)),
        metric("Maletas en lugar incorrecto", num(raw.luggage_wrong)),
        metric("Combo máximo", num(raw.max_combo)),
      ];
    default:
      return [];
  }
}

export interface ResultsView {
  id: string;
  patientId: string;
  patientNameStored: string;
  game: string;
  dateLabel: string;
  durationLabel: string;
  side: string;
  difficulty: string;
  /** null => "—". 0 es un valor legítimo. */
  score: number | null;
  accuracy: number | null;
  origin: HistoryOrigin;
  originLabel: string;
  quality: HistoryQuality;
  qualityLabel: string | null;
  gameKind: HistoryGameKind;
  /** Titular honesto: solo afirma "completada" si el documento lo declara. */
  headline: string;
  /** true => NO es una medición VR confirmada: la pantalla debe etiquetarla. */
  unverified: boolean;
  unverifiedNotice: string | null;
  metrics: ResultsMetric[];
  notes: string;
}

export function headlineFor(q: HistoryQuality): string {
  switch (q) {
    case "completa": return "Sesión completada";
    case "interrumpida": return "Sesión interrumpida";
    case "sin_eventos": return "Sin actividad registrada";
    case "metricas_ausentes": return "Métricas no registradas";
    default: return "Resultado registrado (no consta si la sesión se completó)";
  }
}

/** Construye la vista a partir del documento crudo (con `id`). No lee la configuración de la sesión. */
export function buildResultsView(raw: Raw): ResultsView {
  const s: HistorySession = normalizeSession(raw);
  const unverified = s.origin !== "vr";
  return {
    id: s.id,
    patientId: s.patientId,
    patientNameStored: typeof raw.patientName === "string" ? raw.patientName.trim() : "",
    game: s.game,
    dateLabel: s.dateLabel,
    durationLabel: formatDuration(s.durationSec),
    side: s.side,
    difficulty: s.difficulty,
    score: s.score,
    accuracy: s.accuracy,
    origin: s.origin,
    originLabel: originLabel(s.origin),
    quality: s.quality,
    qualityLabel: qualityLabel(s.quality),
    gameKind: s.gameKind,
    headline: headlineFor(s.quality),
    unverified,
    unverifiedNotice: unverified
      ? "Registro no verificado: no procede de las gafas VR (" + originLabel(s.origin).toLowerCase() + "). Los valores mostrados no son una medición clínica confirmada."
      : null,
    metrics: gameMetrics(raw, s.gameKind),
    notes: typeof raw.notes === "string" ? raw.notes.trim() : "",
  };
}

/**
 * Elige el documento cuando varios comparten sessionId (no debería ocurrir):
 * prefiere el de VR, luego el más reciente por createdAt, luego por id.
 * `duplicates` permite avisar sin ocultar la anomalía.
 */
export function pickSessionDoc<T extends Raw>(docs: T[]): { doc: T; duplicates: number } | null {
  if (docs.length === 0) return null;
  const created = (d: T) => {
    const c = d.createdAt as { toMillis?: () => number } | undefined;
    try { return c && typeof c.toMillis === "function" ? c.toMillis() : 0; } catch { return 0; }
  };
  const sorted = [...docs].sort((a, b) =>
    (Number(b.fromVR === true) - Number(a.fromVR === true)) ||
    (created(b) - created(a)) ||
    (String(a.id ?? "") < String(b.id ?? "") ? -1 : 1));
  return { doc: sorted[0], duplicates: docs.length - 1 };
}

/** "forbidden" para permission-denied / unauthenticated; "error" para el resto. */
export function classifyError(err: unknown): "forbidden" | "error" {
  const code = typeof err === "object" && err !== null ? String((err as { code?: unknown }).code ?? "") : "";
  return code.includes("permission-denied") || code.includes("unauthenticated") ? "forbidden" : "error";
}

/**
 * Estado de la pantalla. `found` = hay documento; `expectResult` = se llega
 * desde el flujo de conexión (el resultado de las gafas aún puede llegar).
 */
export function deriveResultsStatus(o: {
  hasTarget: boolean;
  loading: boolean;
  error: unknown | null;
  found: boolean;
  expectResult: boolean;
  patientMismatch: boolean;
}): ResultsStatus {
  if (!o.hasTarget) return "not_found";
  if (o.error !== null && o.error !== undefined) return classifyError(o.error);
  if (o.loading) return "loading";
  if (o.found) return o.patientMismatch ? "mismatch" : "ready";
  return o.expectResult ? "waiting" : "not_found";
}

/** true si se esperaba un paciente concreto y el documento es de otro (o no tiene paciente). */
export function isPatientMismatch(raw: Raw, expectedPatientId: string | null | undefined): boolean {
  if (expectedPatientId === null || expectedPatientId === undefined || expectedPatientId === "") return false;
  return String(raw.patientId ?? "") !== String(expectedPatientId);
}
