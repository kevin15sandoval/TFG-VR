// Pruebas del view-model de resultados (node --test). Solo datos sintéticos.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildResultsView, gameMetrics, pickSessionDoc, classifyError, deriveResultsStatus,
  isPatientMismatch, headlineFor, NOT_AVAILABLE, OMITTED_FIELDS,
} from "./resultsView.ts";

const godot = (extra: Record<string, unknown>) => ({
  id: "doc1", patientId: "p1", patientName: "PACIENTE-SINTETICO-1", sessionId: "session_1",
  date: "2026-06-22", fromVR: true, notes: "", side: "Izquierdo", difficulty: "Media", sessionType: "Alcance", ...extra,
});
const m = (v: ReturnType<typeof buildResultsView>, label: string) => v.metrics.find(x => x.label === label);

test("Gemas: métricas presentes, tiempos por gema omitidos", () => {
  const v = buildResultsView(godot({
    gameId: "gems", game: "Recolectar gemas", duration: 180, score: 640, accuracy: 68,
    totalGems: 9, totalMovements: 11, gemsNormal: 7, gemsGolden: 1, gemsGreen: 0, gemsPurple: 1, gemsRed: 2, gemsRedAvoided: 3,
    avgTimePerGem: 2.4, zonesWorked: { Alto: 3, Medio: 4, Lateral: 1, Bajo: 1 },
    movementsSummary: [{ name: "x", completed: 1, avg_time_s: 1.2 }],
  }));
  assert.equal(v.gameKind, "gems");
  assert.equal(v.score, 640); assert.equal(v.accuracy, 68);
  assert.equal(v.durationLabel, "3 min");
  assert.equal(m(v, "Gemas recogidas")?.value, "9");
  assert.equal(m(v, "Gemas verdes")?.value, "0");
  assert.equal(m(v, "Zona alta")?.value, "3");
  assert.equal(v.origin, "vr"); assert.equal(v.unverified, false); assert.equal(v.unverifiedNotice, null);
  const text = JSON.stringify(v.metrics).toLowerCase();
  assert.ok(!text.includes("tiempo") && !text.includes("avg"));
});

test("Vault: paneles e impactos; sin precisión; puntuaciones por fórmula omitidas", () => {
  const v = buildResultsView(godot({
    gameId: "vault_escape", game: "Laser Limbo Escape", time_elapsed: 240, duration: 240, score: 0,
    completion_percentage: 40.0, panels_collected: 2, total_panels: 5, laser_hits: 3, crosses_midline: 4,
    avg_time_per_panel: 9.1, vertical_range_meters: 0.8, motor_control_score: 77, planning_score: 60, spatial_awareness_score: 50,
  }));
  assert.equal(v.gameKind, "vault");
  assert.equal(v.score, 0);
  assert.equal(v.accuracy, null);
  assert.equal(v.durationLabel, "4 min");
  assert.equal(m(v, "Paneles recogidos")?.value, "2 / 5");
  assert.equal(m(v, "Impactos de láser")?.value, "3");
  assert.equal(m(v, "Finalización")?.value, "40 %");
  assert.notEqual(v.quality, "sin_eventos");
  const labels = v.metrics.map(x => x.label.toLowerCase()).join("|");
  for (const bad of ["motor", "planific", "espacial", "reacci", "tiempo"]) assert.ok(!labels.includes(bad), bad);
});

test("City: objetivos, errores y lados; ROM, negligencia y reacción omitidos", () => {
  const v = buildResultsView(godot({
    gameId: "urban_attention_quest", game: "Urban Attention Quest", duration: 300, score: 1200, accuracy: 80, completion_percentage: 80,
    targets_collected: 8, total_targets: 10, sequence_errors: 1, left_side_targets: 3, right_side_targets: 5,
    neglect_score: 12.5, avg_reaction_time: 1.9, cervical_rom_total: 120, asymmetry_percentage: 25,
  }));
  assert.equal(v.gameKind, "city");
  assert.equal(m(v, "Objetivos recogidos")?.value, "8 / 10");
  assert.equal(m(v, "Objetivos lado izquierdo")?.value, "3");
  assert.equal(v.accuracy, 80);
  assert.ok(!v.metrics.some(x => /negligencia|reacci|cervical|asimetr/i.test(x.label)));
});

test("Luggage: precisión desde accuracy_percentage; pesos y puntuaciones omitidos", () => {
  const v = buildResultsView(godot({
    gameId: "luggage_handler", game: "Luggage Handler", duration: 120, score: 900, accuracy_percentage: 75.5,
    luggage_placed: 6, luggage_dropped: 1, luggage_wrong: 1, max_combo: 4, total_weight_moved: 55.3, strength_score: 70,
  }));
  assert.equal(v.gameKind, "luggage");
  assert.equal(v.accuracy, 75.5);
  assert.equal(m(v, "Maletas colocadas")?.value, "6");
  assert.equal(m(v, "Combo máximo")?.value, "4");
  assert.ok(!v.metrics.some(x => /peso|fuerza|tronco/i.test(x.label)));
});

test("OMITTED_FIELDS: ningún valor de campo omitido aparece en las métricas", () => {
  const raw: Record<string, unknown> = godot({ gameId: "vault_escape", game: "Laser Limbo Escape", duration: 10, score: 1, laser_hits: 1 });
  for (const f of OMITTED_FIELDS) raw[f] = 987654.5;
  for (const kind of ["gems", "vault", "city", "luggage"] as const) {
    const all = JSON.stringify(gameMetrics({ ...raw }, kind));
    assert.ok(!all.includes("987654"), kind);
  }
});

test("score 0 legítimo no es ausencia de datos", () => {
  const v = buildResultsView(godot({ gameId: "gems", game: "Recolectar gemas", duration: 60, score: 0, accuracy: 0, totalGems: 0, totalMovements: 2, gemsNormal: 0 }));
  assert.equal(v.score, 0); assert.equal(v.accuracy, 0);
  assert.notEqual(v.quality, "metricas_ausentes");
});

test("sin datos: score y precisión null, 'Métricas no registradas', 'No disponible'", () => {
  const v = buildResultsView(godot({ gameId: "gems", game: "Recolectar gemas" }));
  assert.equal(v.score, null); assert.equal(v.accuracy, null);
  assert.equal(v.quality, "metricas_ausentes");
  assert.equal(v.headline, "Métricas no registradas");
  assert.equal(v.durationLabel, "No determinada");
  assert.equal(m(v, "Gemas recogidas")?.value, NOT_AVAILABLE);
  assert.equal(m(v, "Gemas recogidas")?.available, false);
});

test("interrumpida solo cuando consta; si no, nunca 'completada'", () => {
  const base = { gameId: "gems", game: "Recolectar gemas", duration: 60, score: 10, accuracy: 50, totalGems: 1, gemsNormal: 1 };
  const i = buildResultsView(godot({ ...base, status: "interrupted" }));
  assert.equal(i.quality, "interrumpida"); assert.equal(i.headline, "Sesión interrumpida");
  const u = buildResultsView(godot(base));
  assert.equal(u.quality, "desconocida");
  assert.notEqual(u.headline, "Sesión completada");
  const c = buildResultsView(godot({ ...base, completed: true }));
  assert.equal(c.headline, "Sesión completada");
  assert.equal(headlineFor("sin_eventos"), "Sin actividad registrada");
});

test("web_legacy: minutos, etiquetado como no verificado y sin métricas de juego", () => {
  const v = buildResultsView({ id: "w1", patientId: "p1", date: "22 jun 2026", game: "Seguir luces", gameId: "lights", duration: 5, score: 9000, accuracy: 99, side: "Izquierdo", difficulty: "Media", sessionType: "Coordinación", notes: "" });
  assert.equal(v.origin, "web_manual"); assert.equal(v.unverified, true);
  assert.equal(v.originLabel, "Registro manual de la plataforma");
  assert.equal(v.durationLabel, "5 min");
  assert.match(v.unverifiedNotice ?? "", /no son una medición clínica confirmada/);
  assert.equal(v.metrics.length, 0);
});

test("origen desconocido: etiquetado y duración no determinada", () => {
  const v = buildResultsView({ id: "u1", patientId: "p1", sessionId: "x", score: 5, accuracy: 10, duration: 100 });
  assert.equal(v.origin, "unknown"); assert.equal(v.unverified, true);
  assert.equal(v.originLabel, "Origen no determinado");
  assert.equal(v.durationLabel, "No determinada");
});

test("la vista sale solo del documento (nunca baseScore + duration*120)", () => {
  const d = godot({ gameId: "gems", game: "Recolectar gemas", duration: 60, score: 123, accuracy: 55, totalGems: 2 });
  assert.deepEqual(buildResultsView(d), buildResultsView({ ...d }));
  assert.equal(buildResultsView(d).score, 123);
});

test("pickSessionDoc: vacío, único y duplicados (prefiere VR y más reciente)", () => {
  assert.equal(pickSessionDoc([]), null);
  assert.equal(pickSessionDoc([{ id: "a" }])?.duplicates, 0);
  const t = (ms: number) => ({ toMillis: () => ms });
  const r = pickSessionDoc([
    { id: "web", fromVR: false, createdAt: t(9000) },
    { id: "vr-old", fromVR: true, createdAt: t(1000) },
    { id: "vr-new", fromVR: true, createdAt: t(2000) },
  ]);
  assert.equal(r?.doc.id, "vr-new"); assert.equal(r?.duplicates, 2);
});

test("classifyError y deriveResultsStatus", () => {
  assert.equal(classifyError({ code: "permission-denied" }), "forbidden");
  assert.equal(classifyError({ code: "firestore/permission-denied" }), "forbidden");
  assert.equal(classifyError({ code: "unavailable" }), "error");
  assert.equal(classifyError(new Error("x")), "error");
  const base = { hasTarget: true, loading: false, error: null, found: false, expectResult: false, patientMismatch: false };
  assert.equal(deriveResultsStatus({ ...base, hasTarget: false }), "not_found");
  assert.equal(deriveResultsStatus({ ...base, loading: true }), "loading");
  assert.equal(deriveResultsStatus(base), "not_found");
  assert.equal(deriveResultsStatus({ ...base, expectResult: true }), "waiting");
  assert.equal(deriveResultsStatus({ ...base, found: true }), "ready");
  assert.equal(deriveResultsStatus({ ...base, found: true, patientMismatch: true }), "mismatch");
  assert.equal(deriveResultsStatus({ ...base, error: { code: "permission-denied" } }), "forbidden");
  assert.equal(deriveResultsStatus({ ...base, error: new Error("net"), loading: true }), "error");
});

test("isPatientMismatch", () => {
  assert.equal(isPatientMismatch({ patientId: "p1" }, "p1"), false);
  assert.equal(isPatientMismatch({ patientId: "p2" }, "p1"), true);
  assert.equal(isPatientMismatch({}, "p1"), true);
  assert.equal(isPatientMismatch({ patientId: "p2" }, null), false);
});
