// Pruebas con el runner integrado de Node (node --test). Solo datos sintéticos.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseDateToMs, normalizeDuration, normalizeSession, selectPatientSessions,
  filterByRange, computeStats, buildChartData, resolveActivePatientId,
  deriveHistoryStatus, formatDuration, qualityLabel,
  originOf, originLabel, sortRawSessionsDesc, normalizeAll, sumDuration, durationNotice,
  formatTotalDuration, durationKpi, formatRawDuration,
} from "./sessionHistory.ts";

const day = (y: number, m: number, d: number) => new Date(y, m - 1, d).getTime();

test("parseDateToMs: formatos mixtos", () => {
  assert.equal(parseDateToMs("22 jun 2026"), day(2026, 6, 22));
  assert.equal(parseDateToMs("22 de junio de 2026"), day(2026, 6, 22));
  assert.equal(parseDateToMs("2026-06-22"), day(2026, 6, 22));
  assert.equal(parseDateToMs("22/06/2026"), day(2026, 6, 22));
  assert.equal(parseDateToMs("2026-06-22T10:30:00Z"), Date.parse("2026-06-22T10:30:00Z"));
  assert.equal(parseDateToMs(new Date(2026, 5, 22)), day(2026, 6, 22));
  assert.equal(parseDateToMs(1782086400), 1782086400 * 1000);       // epoch s
  assert.equal(parseDateToMs(1782086400000), 1782086400000);        // epoch ms
  assert.equal(parseDateToMs("1782086400"), 1782086400 * 1000);
  assert.equal(parseDateToMs({ toMillis: () => 1782086400000 }), 1782086400000);
  assert.equal(parseDateToMs({ toDate: () => new Date(1782086400000) }), 1782086400000);
  assert.equal(parseDateToMs({ seconds: 1782086400, nanoseconds: 0 }), 1782086400000);
});

test("parseDateToMs: inválidos -> null", () => {
  for (const v of [null, undefined, "", "   ", "ayer", "32/13/2026", "30 foo 2026", {}, NaN, 5, true]) {
    assert.equal(parseDateToMs(v), null, String(v));
  }
});

test("normalizeDuration: tabla de decisión", () => {
  const D = (seconds: number | null, fromMinutes: boolean, source: string) => ({ seconds, fromMinutes, source });
  // Godot: duration en segundos (fromVR). 180 s NO son 180 min.
  assert.deepEqual(normalizeDuration({ duration: 180, fromVR: true, sessionId: "x" }), D(180, false, "fromVR"));
  assert.equal(formatDuration(normalizeDuration({ duration: 180, fromVR: true, sessionId: "x" }).seconds), "3 min");
  // Web/seed sin marcadores de Godot: minutos
  assert.deepEqual(normalizeDuration({ duration: 5 }), D(300, true, "web_legacy"));
  // Sin heurística por magnitud: ya no existe el umbral "<= 180"
  assert.deepEqual(normalizeDuration({ duration: 600 }), D(36000, true, "web_legacy"));
  assert.deepEqual(normalizeDuration({ duration: 150 }), D(9000, true, "web_legacy"));
  // Unidad explícita gana siempre
  assert.deepEqual(normalizeDuration({ duration: 5, durationUnit: "s" }), D(5, false, "unit"));
  assert.deepEqual(normalizeDuration({ duration: 5, durationUnit: "seconds", fromVR: true }), D(5, false, "unit"));
  assert.deepEqual(normalizeDuration({ duration: 5, durationUnit: "min", fromVR: true }), D(300, true, "unit"));
  assert.deepEqual(normalizeDuration({ duration: 180, durationUnit: "Minutes" }), D(10800, true, "unit"));
  // time_elapsed: segundos
  assert.deepEqual(normalizeDuration({ time_elapsed: 95.5 }), D(95.5, false, "time_elapsed"));
  assert.deepEqual(normalizeDuration({ time_elapsed: 95, duration: 3, sessionId: "x" }), D(95, false, "time_elapsed"));
  // No determinada: con sessionId pero sin fromVR (origen dudoso), vacío, negativo, no numérico
  assert.deepEqual(normalizeDuration({ duration: 180, sessionId: "x" }), D(null, false, "unknown"));
  assert.deepEqual(normalizeDuration({}), D(null, false, "unknown"));
  assert.deepEqual(normalizeDuration({ duration: -3 }), D(null, false, "unknown"));
  assert.deepEqual(normalizeDuration({ duration: "abc", fromVR: true }), D(null, false, "unknown"));
  assert.equal(formatDuration(null), "No determinada");
});

test("normalizeSession: sesión Godot de 180 s no aparece como 180 min", () => {
  const s = normalizeSession({ id: "g", patientId: "p1", date: "2026-06-22", fromVR: true, sessionId: "s1", duration: 180,
    score: 900, accuracy: 72, totalGems: 10, gameId: "gems", game: "Recolectar gemas", side: "Izquierdo", difficulty: "Media" });
  assert.equal(s.durationSec, 180);
  assert.equal(formatDuration(s.durationSec), "3 min");
});

test("normalizeSession: campos ausentes -> null, nunca 0 inventado", () => {
  const s = normalizeSession({ id: "b", patientId: "p1", date: "22 jun 2026", score: 5000 });
  assert.equal(s.accuracy, null);
  assert.equal(s.insufficient, false);
  assert.equal(s.side, "—");
});

// ── Calidad por juego (campos que realmente persiste firebase_manager.gd) ──
const godot = (extra: Record<string, unknown>) =>
  ({ patientId: "p1", date: "2026-06-22", fromVR: true, sessionId: "s", duration: 120, ...extra });

test("calidad Gemas: con eventos, 0 legítimo, sin eventos, métricas ausentes", () => {
  const base = { gameId: "gems", game: "Recolectar gemas" };
  const ok = normalizeSession(godot({ ...base, score: 500, accuracy: 70, totalGems: 8, gemsNormal: 8, gemsRed: 0, gemsRedAvoided: 0, totalMovements: 8 }));
  assert.equal(ok.quality, "desconocida"); assert.equal(ok.insufficient, false);
  // 0 puntos y 0 % pero tocó gemas rojas: legítimo
  const zero = normalizeSession(godot({ ...base, score: 0, accuracy: 0, totalGems: 0, gemsRed: 3, totalMovements: 0 }));
  assert.equal(zero.insufficient, false); assert.equal(zero.score, 0); assert.equal(zero.accuracy, 0);
  // solo gemas doradas (antes no se contaban)
  assert.equal(normalizeSession(godot({ ...base, score: 0, accuracy: 0, totalGems: 0, gemsGolden: 2 })).insufficient, false);
  const none = normalizeSession(godot({ ...base, score: 0, accuracy: 0, totalGems: 0, totalMovements: 0, gemsNormal: 0, gemsRed: 0, gemsRedAvoided: 0 }));
  assert.equal(none.quality, "sin_eventos"); assert.equal(none.insufficient, true);
  assert.equal(normalizeSession(godot({ ...base })).quality, "metricas_ausentes");
});

test("calidad Vault: score 0 con impactos láser es legítimo; sin nada, sin eventos; sin precisión no es insuficiente", () => {
  const base = { gameId: "vault_escape", game: "Laser Limbo Escape" };
  const hits = normalizeSession(godot({ ...base, score: 0, laser_hits: 4, panels_collected: 0, total_panels: 0, completion_percentage: 0 }));
  assert.equal(hits.insufficient, false); assert.equal(hits.score, 0); assert.equal(hits.accuracy, null);
  const dodges = normalizeSession(godot({ ...base, score: 120, laser_hits: 0, panels_collected: 0 }));
  assert.equal(dodges.insufficient, false); assert.equal(dodges.accuracy, null);
  const none = normalizeSession(godot({ ...base, score: 0, laser_hits: 0, panels_collected: 0, total_panels: 0 }));
  assert.equal(none.quality, "sin_eventos"); assert.equal(none.insufficient, true);
  assert.equal(normalizeSession(godot({ ...base, laser_hits: 1 })).quality, "metricas_ausentes");
});

test("calidad City: usa targets/errores/lados; accuracy = completion", () => {
  const base = { gameId: "urban_attention_quest", game: "Urban Attention Quest" };
  const ok = normalizeSession(godot({ ...base, score: 300, accuracy: 60, targets_collected: 6, total_targets: 10 }));
  assert.equal(ok.insufficient, false); assert.equal(ok.accuracy, 60);
  const errs = normalizeSession(godot({ ...base, score: 0, accuracy: 0, targets_collected: 0, total_targets: 10, sequence_errors: 2 }));
  assert.equal(errs.insufficient, false);
  const none = normalizeSession(godot({ ...base, score: 0, accuracy: 0, targets_collected: 0, total_targets: 10, sequence_errors: 0, left_side_targets: 0, right_side_targets: 0 }));
  assert.equal(none.quality, "sin_eventos");
});

test("calidad Luggage: accuracy_percentage como precisión; contadores propios", () => {
  const base = { gameId: "luggage_handler", game: "Luggage Handler" };
  const ok = normalizeSession(godot({ ...base, score: 400, accuracy_percentage: 66.7, luggage_placed: 4, luggage_dropped: 1, luggage_wrong: 1 }));
  assert.equal(ok.accuracy, 66.7); assert.equal(ok.insufficient, false);
  const zero = normalizeSession(godot({ ...base, score: 0, accuracy_percentage: 0, luggage_placed: 0, luggage_dropped: 2, luggage_wrong: 0 }));
  assert.equal(zero.insufficient, false); assert.equal(zero.accuracy, 0);
  const none = normalizeSession(godot({ ...base, score: 0, accuracy_percentage: 0, luggage_placed: 0, luggage_dropped: 0, luggage_wrong: 0, trunk_rotations_left: 0, trunk_rotations_right: 0 }));
  assert.equal(none.quality, "sin_eventos");
});

test("calidad: interrumpida y completa solo si el documento lo declara", () => {
  const g = { gameId: "gems", score: 100, accuracy: 50, totalGems: 3 };
  assert.equal(normalizeSession(godot({ ...g, status: "interrupted" })).quality, "interrumpida");
  assert.equal(normalizeSession(godot({ ...g, interrumpida: true })).insufficient, true);
  assert.equal(normalizeSession(godot({ ...g, status: "completed" })).quality, "completa");
  assert.equal(normalizeSession(godot({ ...g, completed: true })).insufficient, false);
  assert.equal(normalizeSession(godot(g)).quality, "desconocida"); // sin campo: no se inventa
});

test("calidad: web/seed antigua y formato desconocido (fallback prudente)", () => {
  // web/seed: score + accuracy sin contadores -> desconocida, cuenta
  const web = normalizeSession({ patientId: "p1", date: "22 jun 2026", game: "Seguir luces", gameId: "lights", duration: 5, score: 7800, accuracy: 81 });
  assert.equal(web.gameKind, "web"); assert.equal(web.quality, "desconocida"); assert.equal(web.insufficient, false);
  // web con 0/0 y sin contadores: no se afirma "sin eventos"
  const web0 = normalizeSession({ patientId: "p1", game: "X", score: 0, accuracy: 0 });
  assert.equal(web0.quality, "desconocida"); assert.equal(web0.insufficient, false);
  // formato desconocido sin métricas -> ausentes
  assert.equal(normalizeSession({ patientId: "p1", game: "Nuevo", fromVR: true, sessionId: "s", foo: 1 }).quality, "metricas_ausentes");
  // desconocido con contadores conocidos a 0 -> sin eventos
  const u0 = normalizeSession({ patientId: "p1", game: "Nuevo", fromVR: true, sessionId: "s", score: 0, accuracy: 0, laser_hits: 0 });
  assert.equal(u0.gameKind, "unknown"); assert.equal(u0.quality, "sin_eventos");
  // desconocido con score y sin contadores -> desconocida, incluida
  const u1 = normalizeSession({ patientId: "p1", game: "Nuevo", fromVR: true, sessionId: "s", score: 40 });
  assert.equal(u1.quality, "desconocida"); assert.equal(u1.insufficient, false);
  // accuracy fuera de rango se descarta
  assert.equal(normalizeSession({ patientId: "p1", score: 5, accuracy: 140 }).accuracy, null);
  // sin_datos explícito
  assert.equal(normalizeSession({ patientId: "p1", sin_datos: true, score: 10, accuracy: 50 }).quality, "metricas_ausentes");
  assert.equal(qualityLabel("sin_eventos"), "Sin actividad registrada");
  assert.equal(qualityLabel("desconocida"), null);
});

const raws = [
  { id: "1", patientId: "p1", date: "2026-06-01", score: 100, accuracy: 60, fromVR: true, sessionId: "a", totalGems: 3, duration: 60 },
  { id: "2", patientId: "p1", date: "2026-06-20", score: 300, accuracy: 80, fromVR: true, sessionId: "b", totalGems: 5, duration: 60 },
  { id: "3", patientId: "p1", date: "2026-06-22", sin_datos: true, score: 0, accuracy: 0, fromVR: true },
  { id: "4", patientId: "p1", date: "fecha rara", score: 200, accuracy: 70 },
  { id: "5", patientId: "p2", date: "2026-06-21", score: 999, accuracy: 99 },
];

test("selectPatientSessions: filtra por paciente y ordena desc, sin fecha al final", () => {
  const l = selectPatientSessions(raws, "p1");
  assert.deepEqual(l.map(s => s.id), ["3", "2", "1", "4"]);
  assert.deepEqual(selectPatientSessions(raws, "nadie"), []);
  assert.deepEqual(selectPatientSessions(raws, null), []);
});

test("filterByRange con 'now' inyectado", () => {
  const l = selectPatientSessions(raws, "p1");
  const now = new Date(2026, 5, 23);
  assert.equal(filterByRange(l, "all", now).length, 4);
  assert.deepEqual(filterByRange(l, "week", now).map(s => s.id), ["3", "2"]);
  assert.deepEqual(filterByRange(l, "month", now).map(s => s.id), ["3", "2", "1"]); // 23 may <= 1 jun
});

test("computeStats / buildChartData excluyen insuficientes (no cuentan como 0 %)", () => {
  const l = selectPatientSessions(raws, "p1");
  const st = computeStats(l);
  assert.equal(st.total, 4);
  assert.equal(st.insufficient, 1);
  assert.equal(st.unverified, 1); // id 4: sin marcadores de VR ni de la web
  assert.equal(st.bestScore, 300);
  assert.equal(st.avgAccuracy, 70); // (60+80+70)/3
  const chart = buildChartData(l);
  assert.deepEqual(chart.map(c => c.score), [100, 300]); // sin la insuficiente ni la sin fecha
});

test("computeStats vacío / todo insuficiente -> null", () => {
  assert.deepEqual(computeStats([]), { total: 0, valid: 0, insufficient: 0, unverified: 0, bestScore: null, avgAccuracy: null });
  const only = selectPatientSessions([raws[2]], "p1");
  const st = computeStats(only);
  assert.equal(st.avgAccuracy, null);
  assert.equal(st.bestScore, null);
});

test("resolveActivePatientId", () => {
  const ps = [{ id: "a" }, { id: "b" }];
  assert.equal(resolveActivePatientId(ps, "b"), "b");
  assert.equal(resolveActivePatientId(ps, "zzz"), "a");
  assert.equal(resolveActivePatientId(ps, null), "a");
  assert.equal(resolveActivePatientId([], "a"), null);
});

test("deriveHistoryStatus: carga / error / vacío / datos", () => {
  assert.equal(deriveHistoryStatus({ loading: true, error: false, count: 0 }), "loading");
  assert.equal(deriveHistoryStatus({ loading: false, error: true, count: 5 }), "error");
  assert.equal(deriveHistoryStatus({ loading: true, error: true, count: 0 }), "error");
  assert.equal(deriveHistoryStatus({ loading: false, error: false, count: 0 }), "empty");
  assert.equal(deriveHistoryStatus({ loading: false, error: false, count: 2 }), "ready");
});

test("formatDuration", () => {
  assert.equal(formatDuration(null), "No determinada");
  assert.equal(formatDuration(45), "45 s");
  assert.equal(formatDuration(300), "5 min");
  assert.equal(formatDuration(90), "1 min 30 s");
});

// ── D1: sesiones con y sin createdAt ─────────────────────────────────────────
const ts = (ms: number) => ({ toMillis: () => ms });
const godotNoCreated = { id: "g1", patientId: "p9", date: "2026-06-22", fromVR: true, sessionId: "s-g1", gameId: "gems", game: "Gemas", score: 0, accuracy: 0, totalGems: 4, duration: 180 };
const withCreated = { id: "w1", patientId: "p9", date: "2026-06-22", createdAt: ts(new Date(2026, 5, 22, 12).getTime()), fromVR: true, sessionId: "s-w1", gameId: "gems", game: "Gemas", score: 500, accuracy: 70, totalGems: 6, duration: 120, durationUnit: "s" };

test("D1: documento Godot sin createdAt aparece en el historial; fecha tomada de `date`", () => {
  const l = selectPatientSessions([godotNoCreated, withCreated], "p9");
  assert.equal(l.length, 2);
  const g = l.find(s => s.id === "g1")!;
  assert.equal(g.dateMs, day(2026, 6, 22));
  assert.equal(g.createdMs, null);
  assert.equal(g.score, 0); // 0 legítimo, no ausencia
  assert.equal(g.insufficient, false);
});

test("D1: sin date ni createdAt -> dateMs null, al final y solo en 'Todas'", () => {
  const sinFecha = { id: "n1", patientId: "p9", fromVR: true, sessionId: "x", score: 10, accuracy: 50, totalGems: 1, duration: 60 };
  const l = selectPatientSessions([sinFecha, godotNoCreated, withCreated], "p9");
  assert.equal(l[l.length - 1].id, "n1");
  assert.equal(l[l.length - 1].dateMs, null);
  assert.equal(l[l.length - 1].dateLabel, "—");
  const now = new Date(2026, 5, 23);
  assert.equal(filterByRange(l, "all", now).length, 3);
  assert.deepEqual(filterByRange(l, "week", now).map(s => s.id).sort(), ["g1", "w1"]);
  assert.equal(filterByRange(l, "month", now).some(s => s.id === "n1"), false);
});

test("D1: solo createdAt (sin date) usa createdAt como fecha", () => {
  const s = normalizeSession({ id: "c", patientId: "p9", createdAt: ts(new Date(2026, 5, 20, 8).getTime()), fromVR: true, sessionId: "q" });
  assert.equal(s.dateMs, new Date(2026, 5, 20, 8).getTime());
});

test("D1: orden determinista con fechas iguales o desconocidas, independiente del orden de entrada", () => {
  const a = { id: "a", patientId: "p", date: "2026-06-22" };
  const b = { id: "b", patientId: "p", date: "2026-06-22", createdAt: ts(new Date(2026, 5, 22, 9).getTime()) };
  const c = { id: "c", patientId: "p", date: "2026-06-22", createdAt: ts(new Date(2026, 5, 22, 15).getTime()) };
  const d1 = { id: "d", patientId: "p" }, d2 = { id: "e", patientId: "p" };
  const expected = ["c", "b", "a", "d", "e"]; // mayor createdAt primero; sin createdAt tras con createdAt; desempate por id
  for (const input of [[a, b, c, d1, d2], [d2, d1, c, b, a], [b, d2, a, c, d1]]) {
    assert.deepEqual(selectPatientSessions(input, "p").map(s => s.id), expected);
    assert.deepEqual(sortRawSessionsDesc(input).map(s => s.id), expected);
    assert.deepEqual(normalizeAll(input).map(s => s.id), expected);
  }
});

test("D1: el filtrado por paciente sigue en cliente (no se mezclan pacientes)", () => {
  const l = selectPatientSessions([godotNoCreated, withCreated, { id: "z", patientId: "otro", date: "2026-06-22", fromVR: true, sessionId: "z" }], "p9");
  assert.deepEqual(l.map(s => s.id).sort(), ["g1", "w1"]);
});

// ── D2: duración con la misma normalización en todas las pantallas ──────────
test("D2: 180 s nunca es 180 min (Godot con y sin durationUnit, time_elapsed)", () => {
  assert.equal(formatRawDuration({ fromVR: true, sessionId: "a", duration: 180 }), "3 min");
  assert.equal(formatRawDuration({ fromVR: true, sessionId: "a", duration: 180, durationUnit: "s" }), "3 min");
  assert.equal(formatRawDuration({ fromVR: true, sessionId: "a", time_elapsed: 180 }), "3 min");
  assert.notEqual(formatRawDuration({ fromVR: true, sessionId: "a", duration: 180 }), "180 min");
});

test("D2: unidad indeterminable -> 'No determinada' y se excluye de sumas con aviso", () => {
  assert.equal(formatRawDuration({ sessionId: "a", duration: 180 }), "No determinada"); // sessionId sin fromVR
  assert.equal(formatRawDuration({}), "No determinada");
  const list = [
    { fromVR: true, sessionId: "a", duration: 120 },
    { fromVR: true, sessionId: "b", duration: 60, durationUnit: "s" },
    { sessionId: "c", duration: 999 },
    { duration: 5, sessionType: "Alcance" },
  ].map(r => normalizeSession(r));
  const t = sumDuration(list);
  assert.equal(t.seconds, 180);
  assert.equal(t.counted, 2);
  assert.equal(t.undetermined, 1);
  assert.equal(t.unverified, 1);
  assert.equal(durationNotice(t), "No incluye: 1 sesión sin duración determinada y 1 registro no VR");
  assert.equal(durationNotice({ seconds: 1, counted: 1, undetermined: 0, unverified: 0 }), "");
});

test("D2: formatTotalDuration y KPI del PDF", () => {
  assert.equal(formatTotalDuration(180), "3 min");
  assert.equal(formatTotalDuration(7500), "2 h 05 min");
  assert.equal(formatTotalDuration(45), "45 s");
  const k = durationKpi([{ fromVR: true, sessionId: "a", duration: 180 }, { sessionId: "b", duration: 1 }]);
  assert.equal(k.value, "3 min");
  assert.equal(k.label, "Tiempo total (excluye 1 sin duración determinada)");
  assert.deepEqual(durationKpi([]), { label: "Tiempo total", value: "0 s" });
});

// ── D3: procedencia y no mezclar simulados con confirmados ──────────────────
test("D3: procedencia VR / manual de la plataforma / no determinada", () => {
  assert.equal(originOf({ fromVR: true, sessionId: "a" }), "vr");
  assert.equal(originOf({ sessionType: "Alcance", duration: 5 }), "web_manual");
  assert.equal(originOf({ sessionId: "a" }), "unknown");
  assert.equal(originOf({}), "unknown");
  assert.equal(originLabel("vr"), "Registrada por VR");
  assert.equal(originLabel("web_manual"), "Registro manual de la plataforma");
  assert.equal(originLabel("unknown"), "Origen no determinado");
});

test("D3: promedios y gráfica excluyen web_manual/desconocido; el 0 legítimo VR sí cuenta", () => {
  const vr0 = { id: "v0", patientId: "p", date: "2026-06-20", fromVR: true, sessionId: "a", gameId: "gems", totalGems: 3, score: 0, accuracy: 0, duration: 60 };
  const vr1 = { id: "v1", patientId: "p", date: "2026-06-21", fromVR: true, sessionId: "b", gameId: "gems", totalGems: 3, score: 400, accuracy: 80, duration: 60 };
  const web = { id: "w", patientId: "p", date: "2026-06-22", game: "Recolectar gemas", sessionType: "Alcance", duration: 5, score: 9000, accuracy: 99 };
  const unk = { id: "u", patientId: "p", date: "2026-06-19", score: 8000, accuracy: 95 };
  const l = selectPatientSessions([vr0, vr1, web, unk], "p");
  assert.equal(l.length, 4);
  const st = computeStats(l);
  assert.equal(st.valid, 2);
  assert.equal(st.unverified, 2);
  assert.equal(st.bestScore, 400);
  assert.equal(st.avgAccuracy, 40);
  assert.deepEqual(buildChartData(l).map(c => c.score), [0, 400]);
  assert.equal(l.find(s => s.id === "w")!.origin, "web_manual");
  assert.equal(l.find(s => s.id === "u")!.origin, "unknown");
});
