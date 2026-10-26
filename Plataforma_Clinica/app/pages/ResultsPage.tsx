import { useEffect, useMemo, useState } from "react";
import { CheckCircle, AlertTriangle, Loader2, Headset, ShieldAlert, SearchX, History as HistoryIcon, RotateCcw } from "lucide-react";
import type { Patient } from "../types";
import { Card } from "../components/shared";
import { subscribeSessionResult } from "../db";
import {
  buildResultsView, deriveResultsStatus, isPatientMismatch, pickSessionDoc, NOT_AVAILABLE,
  type ResultsTarget,
} from "../utils/resultsView";

interface ResultsPageProps {
  /** Sesión a mostrar. null/vacío => "no encontrada". */
  target: ResultsTarget | null;
  patients: Patient[];
  /** Si se indica, un documento de otro paciente NO se muestra. */
  expectedPatientId?: string | null;
  /** true cuando se llega desde el envío a las gafas: el resultado aún puede estar por llegar. */
  expectResult?: boolean;
  onNewSession: () => void;
  onViewHistory: () => void;
}

type Raw = Record<string, unknown>;
const LOAD_TIMEOUT_MS = 15000;
interface Snap { key: string; docs: Raw[] | null; error: unknown | null }

// Solo LECTURA: abrir esta pantalla no escribe en Firestore ni crea sesiones.
export function ResultsPage({ target, patients, expectedPatientId, expectResult = false, onNewSession, onViewHistory }: ResultsPageProps) {
  const key = target && target.value ? `${target.kind}:${target.value}` : "";
  const [snap, setSnap] = useState<Snap>({ key: "", docs: null, error: null });

  useEffect(() => {
    if (!key || !target) return;
    let active = true; // descarta lecturas obsoletas de una sesión anterior
    let unsub: () => void = () => {};
    try {
      unsub = subscribeSessionResult(
        target,
        docs => { if (active) setSnap({ key, docs, error: null }); },
        error => { if (active) setSnap({ key, docs: null, error }); },
      );
    } catch (error) {
      setSnap({ key, docs: null, error });
    }
    return () => { active = false; unsub(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Si el estado guardado pertenece a otra sesión se ignora por completo (sin datos residuales).
  const current = snap.key === key ? snap : null;

  // Sin respuesta del servidor tras LOAD_TIMEOUT_MS: se informa como error de carga en lugar de esperar para siempre.
  const [timedOutKey, setTimedOutKey] = useState("");
  useEffect(() => {
    if (!key || current !== null) return;
    const t = setTimeout(() => setTimedOutKey(key), LOAD_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [key, current]);
  const picked = useMemo(() => (current?.docs ? pickSessionDoc(current.docs) : null), [current]);
  const status = deriveResultsStatus({
    hasTarget: key !== "",
    loading: key !== "" && current === null,
    error: current?.error ?? (timedOutKey === key && current === null ? { code: "timeout" } : null),
    found: picked !== null,
    expectResult,
    patientMismatch: picked ? isPatientMismatch(picked.doc, expectedPatientId) : false,
  });
  const view = status === "ready" && picked ? buildResultsView(picked.doc) : null;
  const patientName = view
    ? (patients.find(p => String(p.id) === view.patientId)?.name ?? (view.patientNameStored || "Paciente no identificado"))
    : "";

  const actions = (
    <div className="flex items-center gap-3 justify-end mt-6">
      <button onClick={onViewHistory} className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer">
        <HistoryIcon size={14} /> Ver historial
      </button>
      <button onClick={onNewSession} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer">
        <RotateCcw size={14} /> Nueva sesión
      </button>
    </div>
  );

  const notice = (icon: React.ReactNode, title: string, text: string, role: "status" | "alert" = "status") => (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <Card className="p-8 text-center" >
        <div role={role} aria-live="polite" data-results-status={status}>
          <div className="mx-auto mb-3 flex justify-center">{icon}</div>
          <h1 className="text-lg font-bold text-slate-800 mb-1">{title}</h1>
          <p className="text-sm text-slate-500">{text}</p>
        </div>
      </Card>
      {actions}
    </div>
  );

  if (status === "loading") return notice(<Loader2 size={32} className="animate-spin text-blue-500" />, "Cargando resultados…", "Leyendo la sesión desde Firestore.");
  if (status === "waiting") return notice(<Headset size={32} className="text-violet-500 animate-pulse" />, "Esperando el resultado de las gafas", "Todavía no hay resultados guardados para esta sesión. Aparecerán aquí cuando las gafas los envíen.");
  if (status === "not_found") return notice(<SearchX size={32} className="text-slate-400" />, "Sesión no encontrada", "No existe ninguna sesión registrada con ese identificador.");
  if (status === "forbidden") return notice(<ShieldAlert size={32} className="text-amber-500" />, "Sin permisos", "Tu cuenta no tiene permiso para ver los resultados de esta sesión.", "alert");
  if (status === "error") return notice(<AlertTriangle size={32} className="text-rose-500" />, "No se pudieron cargar los resultados", "Comprueba tu conexión e inténtalo de nuevo.", "alert");
  if (status === "mismatch" || !view) return notice(<AlertTriangle size={32} className="text-amber-500" />, "La sesión no corresponde al paciente esperado", "Por seguridad no se muestran los datos de una sesión de otro paciente.", "alert");

  const completed = view.quality === "completa";
  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto" data-results-status="ready">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {completed ? <CheckCircle size={18} className="text-emerald-500" /> : <AlertTriangle size={18} className="text-amber-500" />}
            <span className={`text-sm font-semibold uppercase tracking-wide ${completed ? "text-emerald-600" : "text-amber-700"}`}>{view.headline}</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Resultados de sesión</h1>
          <p className="text-slate-500 text-sm mt-0.5">{patientName} · {view.game} · {view.dateLabel}</p>
          <p className={`text-xs mt-1 ${view.unverified ? "text-amber-700" : "text-slate-400"}`}>{view.originLabel}</p>
        </div>
        <div className="text-right">
          <div className="text-4xl font-black text-slate-800 font-mono" data-testid="score">{view.score === null ? "—" : view.score.toLocaleString()}</div>
          <div className="text-xs text-slate-400 font-medium uppercase tracking-wide">{view.unverified ? "Puntuación registrada (no verificada)" : "Puntuación"}</div>
        </div>
      </div>

      {view.unverifiedNotice && (
        <p className="mb-5 px-4 py-3 rounded-xl bg-amber-50 border border-amber-100 text-xs text-amber-800" role="note">{view.unverifiedNotice}</p>
      )}
      {view.qualityLabel && view.quality !== "interrumpida" && (
        <p className="mb-5 px-4 py-3 rounded-xl bg-amber-50 border border-amber-100 text-xs text-amber-800" role="note">{view.qualityLabel}: esta sesión se excluye de gráficas y promedios del historial.</p>
      )}
      {view.quality === "interrumpida" && (
        <p className="mb-5 px-4 py-3 rounded-xl bg-amber-50 border border-amber-100 text-xs text-amber-800" role="note">El registro indica que la sesión se interrumpió; sus valores son parciales y se excluyen de gráficas y promedios.</p>
      )}
      {view.quality === "desconocida" && (
        <p className="mb-5 text-xs text-slate-500" role="note">Los datos disponibles no indican si la sesión se completó o se interrumpió; se muestran tal como se registraron.</p>
      )}
      {picked && picked.duplicates > 0 && (
        <p className="mb-5 px-4 py-3 rounded-xl bg-rose-50 border border-rose-100 text-xs text-rose-700" role="alert">Hay {picked.duplicates + 1} documentos con este identificador de sesión; se muestra el más fiable (VR y más reciente).</p>
      )}

      <Card className="p-5 mb-6">
        <h2 className="text-sm font-bold text-slate-700 mb-4">Datos de la sesión</h2>
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          {[
            ["Duración", view.durationLabel],
            ["Precisión", view.accuracy === null ? "—" : `${view.accuracy}%`],
            ["Lado", view.side],
            ["Dificultad", view.difficulty],
          ].map(([k, v]) => (
            <div key={k}><dt className="text-xs text-slate-400 font-medium">{k}</dt><dd className="font-bold text-slate-800" data-field={k}>{v}</dd></div>
          ))}
        </dl>
      </Card>

      {view.metrics.length > 0 && (
        <Card className="p-5 mb-6">
          <h2 className="text-sm font-bold text-slate-700 mb-4">Métricas del juego{view.unverified ? " (no verificadas)" : ""}</h2>
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {view.metrics.map(m => (
              <div key={m.label}>
                <dt className="text-xs text-slate-400 font-medium">{m.label}</dt>
                <dd className={m.available ? "font-bold text-slate-800" : "text-slate-400"} data-metric={m.label}>{m.available ? m.value : NOT_AVAILABLE}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}

      {view.notes && (
        <Card className="p-5 mb-6">
          <h2 className="text-sm font-bold text-slate-700 mb-2">Notas</h2>
          <p className="text-sm text-slate-600 whitespace-pre-wrap">{view.notes}</p>
        </Card>
      )}
      {actions}
    </div>
  );
}
