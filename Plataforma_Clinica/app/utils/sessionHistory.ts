// ═══════════════════════════════════════════════════════════════════════════
// HISTORIAL DE SESIONES — normalización pura (sin Firebase, sin React)
//
// Solo lee los documentos tal como llegan de Firestore y produce una vista en
// memoria. NUNCA modifica ni reescribe los resultados almacenados.
//
// Formatos históricos tolerados
//  - Fecha: string "22 jun 2026", "22 de junio de 2026", "2026-06-22" (lo que
//    escribe Godot con get_date_string_from_system), ISO con hora, "22/06/2026",
//    epoch (s o ms, number o string numérico), Date, Timestamp de Firestore
//    (objeto con toDate/toMillis o {seconds, nanoseconds}).
//  - Campos ausentes -> null (la UI muestra "—"); nunca se inventa un 0.
//
// TABLA DE DECISIÓN DE DURACIÓN (en orden de prioridad; no hay heurística por
// magnitud: un valor numérico NUNCA decide por sí solo la unidad)
//   1. durationUnit explícito ("s"/"sec"/"seg"/"second(s)"/"segundos" -> s;
//      "min"/"minute(s)"/"minutos" -> min) con `duration` numérico >= 0.
//   2. time_elapsed numérico >= 0 -> segundos. Unidad inequívoca por origen:
//      los *_game_manager.gd lo calculan con Time.get_ticks_msec()/1000.0
//      (scenes/vault_game_manager.gd:111, city_game_manager.gd:334,
//      luggage_game_manager.gd:239) y firebase_manager.gd:233 lo rotula "s".
//   3. fromVR === true y `duration` -> segundos. Demostrado por el origen:
//      firebase_manager.gd:246 guarda `duration` = int(duration|time_elapsed)
//      y :251 marca fromVR=true; game_manager.gd:249 (gemas) usa int(elapsed)
//      en segundos; firebase_manager.gd:233 lo rotula "s".
//   4. Sin fromVR, sin sessionId, sin unidad (sesión creada por la web o por el
//      seed): `duration` en MINUTOS. Demostrado por el origen: App.tsx
//      handleSaveSession guarda lastConfig.duration, elegido entre
//      DURATIONS=[1,3,5,10] (constants.ts:29) y db.ts publishActiveSession lo
//      multiplica por 60 para Godot ("config.duration * 60"); seed.mjs usa 3/5/10.
//      Los documentos de Godot siempre llevan sessionId (firebase_manager.gd:242),
//      así que su ausencia identifica el origen web/seed. Es una inferencia por
//      ausencia de marcadores: se anota como origen "web_legacy".
//   5. Cualquier otro caso (duration con fromVR distinto de true pero con
//      sessionId, valor negativo/no numérico, sin campo) -> "No determinada".
//
// CALIDAD DE SESIÓN (HistoryQuality), según SOLO los campos que realmente
// persiste scripts/firebase_manager.gd (no los que calcula el juego y no se
// guardan, p. ej. lasers_dodged o luggage_missed):
//   metricas_ausentes : no hay ninguna métrica reconocible (score/precisión
//                       numéricos) o el documento marca sin_datos.
//   interrumpida      : SOLO si el documento lo indica explícitamente
//                       (interrupted/interrumpida === true o status
//                       interrupted/aborted/cancelled/interrumpida). Hoy ningún
//                       origen lo escribe: firebase_manager.gd no guarda status.
//   sin_eventos       : el juego persiste contadores de eventos, todos son 0 y
//                       la puntuación es 0 (el paciente no interactuó). Un 0
//                       con eventos (p. ej. Vault: puntuación 0 tras impactos
//                       láser) NO entra aquí.
//   completa          : métricas y eventos presentes Y el documento declara
//                       finalización (completed === true / status completed).
//   desconocida       : métricas y eventos presentes pero NO consta si la sesión
//                       terminó o se interrumpió (caso habitual hoy) o formato
//                       sin contadores donde no se puede afirmar nada más.
// Se excluyen de promedios y gráficas: metricas_ausentes, sin_eventos e
// interrumpida. completa y desconocida cuentan.
// ═══════════════════════════════════════════════════════════════════════════

export type HistoryRange = "all" | "week" | "month";
export type HistoryStatus = "loading" | "error" | "empty" | "ready";
export type HistoryQuality = "completa" | "sin_eventos" | "metricas_ausentes" | "interrumpida" | "desconocida";
export type HistoryGameKind = "gems" | "vault" | "city" | "luggage" | "web" | "unknown";
/** Procedencia del registro (inferida de marcadores; ver originOf). */
export type HistoryOrigin = "vr" | "web_manual" | "unknown";
export type DurationSource = "unit" | "time_elapsed" | "fromVR" | "web_legacy" | "unknown";

export interface HistorySession {
  id: string;
  patientId: string;
  /** Epoch ms o null si la fecha no se pudo interpretar. */
  dateMs: number | null;
  dateLabel: string;
  game: string;
  /** null => duración no determinada (la UI muestra "No determinada"). */
  durationSec: number | null;
  /** true si la duración venía en minutos y se convirtió a segundos. */
  durationFromMinutes: boolean;
  durationSource: DurationSource;
  gameKind: HistoryGameKind;
  quality: HistoryQuality;
  side: string;
  difficulty: string;
  score: number | null;
  /** 0..100 o null si no existe / fuera de rango. */
  accuracy: number | null;
  fromVR: boolean;
  /** Procedencia: solo "vr" se considera medición confirmada. */
  origin: HistoryOrigin;
  /** createdAt (epoch ms) solo para desempate; null si no existe. */
  createdMs: number | null;
  /** true => se excluye de gráficas y promedios por calidad de datos. */
  insufficient: boolean;
  /** true => excluida de gráficas/promedios por no ser una medición VR confirmada. */
  unverified: boolean;
}

type Raw = Record<string, unknown>;

const MONTHS: Record<string, number> = {
  ene: 0, enero: 0, feb: 1, febrero: 1, mar: 2, marzo: 2, abr: 3, abril: 3,
  may: 4, mayo: 4, jun: 5, junio: 5, jul: 6, julio: 6, ago: 7, agosto: 7,
  sep: 8, sept: 8, septiembre: 8, setiembre: 8, oct: 9, octubre: 9,
  nov: 10, noviembre: 10, dic: 11, diciembre: 11,
};

function validMs(ms: number): number | null {
  // Rango razonable: 2000-01-01 .. 2100-01-01
  return Number.isFinite(ms) && ms >= 946684800000 && ms < 4102444800000 ? ms : null;
}

function epochToMs(n: number): number | null {
  if (!Number.isFinite(n)) return null;
  // < 1e11 se interpreta como segundos (1e11 s ~ año 5138; 1e11 ms ~ 1973)
  return validMs(Math.abs(n) < 1e11 ? n * 1000 : n);
}

/** Convierte cualquier formato de fecha conocido a epoch ms (o null). */
export function parseDateToMs(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return validMs(value.getTime());
  if (typeof value === "number") return epochToMs(value);
  if (typeof value === "object") {
    const o = value as { toMillis?: () => number; toDate?: () => Date; seconds?: number; _seconds?: number };
    try {
      if (typeof o.toMillis === "function") return validMs(o.toMillis());
      if (typeof o.toDate === "function") return validMs(o.toDate().getTime());
    } catch { return null; }
    const secs = o.seconds ?? o._seconds;
    if (typeof secs === "number") return validMs(secs * 1000);
    return null;
  }
  if (typeof value !== "string") return null;
  const s = value.trim();
  if (!s) return null;
  if (/^\d+(\.\d+)?$/.test(s)) return epochToMs(Number(s));

  // YYYY-MM-DD (sin hora): fecha local, no UTC, para no desplazar el día.
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) return validMs(new Date(+m[1], +m[2] - 1, +m[3]).getTime());

  // DD/MM/YYYY o DD-MM-YYYY (formato español)
  m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(s);
  if (m) {
    const d = new Date(+m[3], +m[2] - 1, +m[1]);
    return d.getMonth() === +m[2] - 1 ? validMs(d.getTime()) : null;
  }

  // "22 jun 2026", "22 de junio de 2026", "22 jun. 2026"
  m = /^(\d{1,2})\s+(?:de\s+)?([a-záéíóúñ]+)\.?\s+(?:de\s+)?(\d{4})$/i.exec(s);
  if (m) {
    const mon = MONTHS[m[2].toLowerCase()];
    if (mon === undefined) return null;
    return validMs(new Date(+m[3], mon, +m[1]).getTime());
  }

  // ISO con hora u otros formatos que Date entienda
  if (/^\d{4}-\d{2}-\d{2}[T ]/.test(s)) return validMs(new Date(s).getTime());
  return null;
}

function num(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export interface DurationResult { seconds: number | null; fromMinutes: boolean; source: DurationSource }

const UNIT_SECONDS = ["s", "sec", "seg", "second", "seconds", "segundo", "segundos"];
const UNIT_MINUTES = ["min", "minute", "minutes", "minuto", "minutos"];
const UNKNOWN_DURATION: DurationResult = { seconds: null, fromMinutes: false, source: "unknown" };

/** True si el documento NO procede de Godot (Godot siempre escribe sessionId y fromVR=true). */
function isWebOrigin(raw: Raw): boolean {
  return raw.fromVR !== true && str(raw.sessionId) === "";
}

/** Normaliza la duración a segundos según la tabla de decisión de la cabecera. */
export function normalizeDuration(raw: Raw): DurationResult {
  const dur = num(raw.duration);
  const elapsed = num(raw.time_elapsed);
  const unit = str(raw.durationUnit).toLowerCase();

  // 1. Unidad explícita
  if (dur !== null && dur >= 0) {
    if (UNIT_SECONDS.includes(unit)) return { seconds: dur, fromMinutes: false, source: "unit" };
    if (UNIT_MINUTES.includes(unit)) return { seconds: dur * 60, fromMinutes: true, source: "unit" };
  }
  // 2. time_elapsed: segundos por origen
  if (elapsed !== null && elapsed >= 0) return { seconds: elapsed, fromMinutes: false, source: "time_elapsed" };
  if (dur === null || dur < 0) return UNKNOWN_DURATION;
  // 3. Godot (fromVR === true): duration en segundos
  if (raw.fromVR === true) return { seconds: dur, fromMinutes: false, source: "fromVR" };
  // 4. Web/seed sin marcadores de Godot: minutos
  if (isWebOrigin(raw)) return { seconds: dur * 60, fromMinutes: true, source: "web_legacy" };
  // 5. Resto: no determinada
  return UNKNOWN_DURATION;
}

// Contadores de eventos que firebase_manager.gd REALMENTE persiste por juego.
const EVENT_KEYS: Record<Exclude<HistoryGameKind, "web" | "unknown">, string[]> = {
  gems: ["totalGems", "totalMovements", "gemsNormal", "gemsGolden", "gemsGreen", "gemsPurple", "gemsRed", "gemsRedAvoided"],
  vault: ["laser_hits", "panels_collected"],
  city: ["targets_collected", "sequence_errors", "left_side_targets", "right_side_targets"],
  luggage: ["luggage_placed", "luggage_dropped", "luggage_wrong", "trunk_rotations_left", "trunk_rotations_right"],
};
const ALL_EVENT_KEYS = Object.values(EVENT_KEYS).flat();

/** Identifica el juego por gameId (game_type de Godot) o por nombre; si no, web/seed o desconocido. */
export function detectGameKind(raw: Raw): HistoryGameKind {
  const id = str(raw.gameId).toLowerCase() || str(raw.game_type).toLowerCase();
  const name = (str(raw.game) || str(raw.game_name)).toLowerCase();
  if (id === "gems" || name.includes("gemas")) return "gems";
  if (id === "vault_escape" || name.includes("laser limbo")) return "vault";
  if (id === "urban_attention_quest" || name.includes("urban attention")) return "city";
  if (id === "luggage_handler" || name.includes("luggage")) return "luggage";
  return isWebOrigin(raw) ? "web" : "unknown";
}

const STATUS_INTERRUPTED = ["interrupted", "aborted", "cancelled", "canceled", "interrumpida", "cancelada"];
const STATUS_COMPLETED = ["completed", "finished", "completada", "finalizada"];

/** Calidad de la sesión según las reglas de la cabecera. Solo lectura de campos persistidos. */
export function assessQuality(raw: Raw, kind: HistoryGameKind, score: number | null, accuracy: number | null): HistoryQuality {
  const status = str(raw.status).toLowerCase();
  if (raw.sin_datos === true || raw.sinDatos === true || (score === null && accuracy === null)) return "metricas_ausentes";
  if (raw.interrupted === true || raw.interrumpida === true || STATUS_INTERRUPTED.includes(status)) return "interrumpida";

  const keys = kind === "web" ? [] : kind === "unknown" ? ALL_EVENT_KEYS : EVENT_KEYS[kind];
  const counters = keys.map(k => num(raw[k])).filter((n): n is number => n !== null);
  const anyEvent = counters.some(n => n > 0) || (score ?? 0) > 0 || (accuracy ?? 0) > 0;
  if (counters.length > 0 && !anyEvent) return "sin_eventos";

  const completed = raw.completed === true || STATUS_COMPLETED.includes(status);
  return completed ? "completa" : "desconocida";
}

/**
 * Procedencia del documento.
 *  - "vr": Godot escribe siempre fromVR=true y sessionId (firebase_manager.gd:242,251).
 *  - "web_manual": sin esos marcadores y con sessionType: lo crean handleSaveSession
 *    (puntuación calculada por fórmula, NO medida) o seed.mjs (datos de ejemplo).
 *  - "unknown": cualquier otro caso (p. ej. sessionId sin fromVR, o documento vacío).
 */
export function originOf(raw: Raw): HistoryOrigin {
  if (raw.fromVR === true) return "vr";
  if (isWebOrigin(raw) && str(raw.sessionType) !== "") return "web_manual";
  return "unknown";
}

export function originLabel(o: HistoryOrigin): string {
  switch (o) {
    case "vr": return "Registrada por VR";
    case "web_manual": return "Registro manual de la plataforma";
    default: return "Origen no determinado";
  }
}

/** Normaliza un documento de sesión (formato nuevo o histórico). */
export function normalizeSession(raw: Raw): HistorySession {
  const dateMs = parseDateToMs(raw.date) ?? parseDateToMs(raw.createdAt);
  const { seconds, fromMinutes, source } = normalizeDuration(raw);
  const kind = detectGameKind(raw);

  const score = (() => { const n = num(raw.score); return n !== null && n >= 0 ? n : null; })();
  // `accuracy` (gemas, ciudad) o `accuracy_percentage` (Luggage). Vault no persiste precisión.
  const accuracy = [raw.accuracy, raw.accuracy_percentage].map(num)
    .find((n): n is number => n !== null && n >= 0 && n <= 100) ?? null;
  const quality = assessQuality(raw, kind, score, accuracy);
  const origin = originOf(raw);

  return {
    id: String(raw.id ?? ""),
    patientId: String(raw.patientId ?? ""),
    dateMs,
    dateLabel: dateMs === null ? "—" : new Date(dateMs).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }),
    game: str(raw.game) || "—",
    durationSec: seconds,
    durationFromMinutes: fromMinutes,
    durationSource: source,
    gameKind: kind,
    quality,
    side: str(raw.side) || "—",
    difficulty: str(raw.difficulty) || "—",
    score,
    accuracy,
    fromVR: raw.fromVR === true,
    origin,
    createdMs: parseDateToMs(raw.createdAt),
    insufficient: quality === "metricas_ausentes" || quality === "sin_eventos" || quality === "interrumpida",
    unverified: origin !== "vr",
  };
}

/** Texto en español para la UI; null si la sesión cuenta normalmente. */
export function qualityLabel(q: HistoryQuality): string | null {
  switch (q) {
    case "metricas_ausentes": return "Métricas no registradas";
    case "sin_eventos": return "Sin actividad registrada";
    case "interrumpida": return "Sesión interrumpida";
    default: return null;
  }
}

/**
 * Comparador determinista (descendente): fecha, luego createdAt, luego id.
 * Sin fecha -> al final. No depende del orden de entrada.
 */
export function compareDesc(
  a: { dateMs: number | null; createdMs: number | null; id: string },
  b: { dateMs: number | null; createdMs: number | null; id: string },
): number {
  const cmp = (x: number | null, y: number | null) =>
    x === y ? 0 : x === null ? 1 : y === null ? -1 : y - x;
  return cmp(a.dateMs, b.dateMs) || cmp(a.createdMs, b.createdMs) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/** Orden descendente por fecha; sin fecha al final; desempate estable por createdAt e id. */
export function sortSessionsDesc(list: HistorySession[]): HistorySession[] {
  return [...list].sort(compareDesc);
}

/** Ordena documentos crudos (cualquier forma) con la misma regla; no los modifica. */
export function sortRawSessionsDesc<T extends Raw>(raws: T[]): T[] {
  const key = (r: T) => ({
    dateMs: parseDateToMs(r.date) ?? parseDateToMs(r.createdAt),
    createdMs: parseDateToMs(r.createdAt),
    id: String(r.id ?? ""),
  });
  return raws.map(r => ({ r, k: key(r) })).sort((x, y) => compareDesc(x.k, y.k)).map(x => x.r);
}

/** Todas las sesiones normalizadas y ordenadas (Dashboard). */
export function normalizeAll(raws: Raw[]): HistorySession[] {
  return sortSessionsDesc(raws.map(normalizeSession));
}

/** Sesiones de un paciente, normalizadas y ordenadas. */
export function selectPatientSessions(raws: Raw[], patientId: string | null | undefined): HistorySession[] {
  if (patientId === null || patientId === undefined) return [];
  const pid = String(patientId);
  return sortSessionsDesc(raws.filter(r => String(r.patientId ?? "") === pid).map(normalizeSession));
}

/** Filtro por rango. Las sesiones sin fecha interpretable solo salen en "all". */
export function filterByRange(list: HistorySession[], range: HistoryRange, now: Date = new Date()): HistorySession[] {
  if (range === "all") return list;
  const cutoff = new Date(now);
  if (range === "week") cutoff.setDate(cutoff.getDate() - 7);
  else cutoff.setMonth(cutoff.getMonth() - 1);
  const c = cutoff.getTime();
  return list.filter(s => s.dateMs !== null && s.dateMs >= c);
}

export interface HistoryStats {
  total: number;
  valid: number;
  insufficient: number;
  /** Sesiones no VR (manuales/origen no determinado) con datos, excluidas de promedios. */
  unverified: number;
  bestScore: number | null;
  avgAccuracy: number | null;
}

/** Cuenta para estadísticas/gráficas: medición VR confirmada y con datos suficientes. */
const counts = (s: HistorySession) => !s.insufficient && !s.unverified;

/** Estadísticas SOLO con sesiones VR suficientes y campos presentes (0 legítimo cuenta). */
export function computeStats(list: HistorySession[]): HistoryStats {
  const valid = list.filter(counts);
  const scores = valid.map(s => s.score).filter((n): n is number => n !== null);
  const accs = valid.map(s => s.accuracy).filter((n): n is number => n !== null);
  return {
    total: list.length,
    valid: valid.length,
    insufficient: list.filter(s => s.insufficient).length,
    unverified: list.filter(s => !s.insufficient && s.unverified).length,
    bestScore: scores.length ? Math.max(...scores) : null,
    avgAccuracy: accs.length ? Math.round(accs.reduce((a, b) => a + b, 0) / accs.length) : null,
  };
}

export interface ChartPoint { s: string; score: number | null; precision: number | null }

/** Puntos de gráfica: cronológico, solo VR con datos suficientes y fecha. */
export function buildChartData(list: HistorySession[]): ChartPoint[] {
  return list
    .filter(s => counts(s) && s.dateMs !== null)
    .sort((a, b) => -compareDesc(a, b))
    .map(s => ({ s: s.dateLabel, score: s.score, precision: s.accuracy }));
}

export interface TotalDuration {
  seconds: number;
  /** Sesiones sumadas. */
  counted: number;
  /** Sesiones sin unidad determinable (excluidas de la suma). */
  undetermined: number;
  /** Sesiones con duración válida pero no VR (excluidas de la suma). */
  unverified: number;
}

/**
 * Suma de tiempo de rehabilitación. Solo sesiones VR con duración determinada;
 * las indeterminables y las no VR se excluyen y se cuentan para avisar.
 */
export function sumDuration(list: HistorySession[]): TotalDuration {
  const r: TotalDuration = { seconds: 0, counted: 0, undetermined: 0, unverified: 0 };
  for (const s of list) {
    if (s.durationSec === null) r.undetermined++;
    else if (s.unverified) r.unverified++;
    else { r.seconds += s.durationSec; r.counted++; }
  }
  return r;
}

/** "2 h 05 min" / "12 min" / "45 s" para totales. */
export function formatTotalDuration(sec: number): string {
  const t = Math.round(sec);
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), r = t % 60;
  if (h > 0) return `${h} h ${String(m).padStart(2, "0")} min`;
  if (m > 0) return r === 0 ? `${m} min` : `${m} min ${r} s`;
  return `${r} s`;
}

/** Texto de aviso para totales; "" si no hay nada que avisar. */
export function durationNotice(t: TotalDuration): string {
  const parts: string[] = [];
  if (t.undetermined > 0) parts.push(`${t.undetermined} ${t.undetermined === 1 ? "sesión sin duración determinada" : "sesiones sin duración determinada"}`);
  if (t.unverified > 0) parts.push(`${t.unverified} ${t.unverified === 1 ? "registro no VR" : "registros no VR"}`);
  return parts.length ? `No incluye: ${parts.join(" y ")}` : "";
}

/** Mantiene el paciente activo si existe; si no, el primero; si no hay, null. */
export function resolveActivePatientId(patients: { id: string }[], current: string | null | undefined): string | null {
  if (current !== null && current !== undefined && patients.some(p => String(p.id) === String(current))) return String(current);
  return patients.length ? String(patients[0].id) : null;
}

export function deriveHistoryStatus(o: { loading: boolean; error: boolean; count: number }): HistoryStatus {
  if (o.error) return "error";
  if (o.loading) return "loading";
  return o.count === 0 ? "empty" : "ready";
}

/** "5 min", "1 min 30 s", "45 s" o "No determinada". */
export function formatDuration(sec: number | null): string {
  if (sec === null || !Number.isFinite(sec)) return "No determinada";
  const t = Math.round(sec);
  const m = Math.floor(t / 60), r = t % 60;
  if (m === 0) return `${r} s`;
  return r === 0 ? `${m} min` : `${m} min ${r} s`;
}

/** Duración legible de un documento crudo (SessionRecord incluido), con la misma normalización. */
export function formatRawDuration(raw: object): string {
  return formatDuration(normalizeDuration(raw as Raw).seconds);
}

/**
 * KPI "Tiempo total" para el informe PDF (función pura, comprobable sin jsPDF).
 * Solo suma sesiones VR con duración determinada; el aviso va en la etiqueta.
 */
export function durationKpi(raws: object[]): { label: string; value: string } {
  const t = sumDuration(raws.map(r => normalizeSession(r as Raw)));
  const parts: string[] = [];
  if (t.undetermined > 0) parts.push(`${t.undetermined} sin duración determinada`);
  if (t.unverified > 0) parts.push(`${t.unverified} no VR`);
  return {
    label: parts.length ? `Tiempo total (excluye ${parts.join(", ")})` : "Tiempo total",
    value: formatTotalDuration(t.seconds),
  };
}
