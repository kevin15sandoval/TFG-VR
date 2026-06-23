import { useState, useMemo, useCallback, useEffect } from "react";
import {
  LayoutDashboard, Users, PlayCircle, Gamepad2, History,
  Settings, Brain, TrendingUp, Search, Plus, Eye, Hand,
  Move, Shield, Sparkles, CheckCircle, Timer, Award,
  ChevronRight, ArrowRight, RotateCcw, Headset, Activity,
  Calendar, Download, Filter, Target, Trophy, User,
  BarChart3, Gem, ArrowLeft, Zap, Layers, Crosshair,
  Pencil, Trash2, X, Save, Bell, Monitor, Lock, ChevronDown,
  Loader2, LogOut,
} from "lucide-react";
import type { User as FirebaseUser } from "firebase/auth";
import { logout } from "./auth";
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import type { Patient, SessionRecord, SessionConfig, Screen } from "./types";
import {
  subscribePatients, subscribeSessions,
  addPatient, updatePatient, deletePatient,
  addSession, seedIfEmpty, publishActiveSession,
  createDeviceLink, subscribeDeviceLink, sendSessionToDevice,
} from "./db";

// ─── TIPOS — importados desde ./types ─────────────────────────────────────────
// Patient, SessionRecord, SessionConfig, Screen

// ─── DATOS DE SEED (solo se usan si Firestore está vacío) ─────────────────────

const SEED_PATIENTS: Omit<Patient, "id">[] = [
  { name: "Carmen Rodríguez López",   initials: "CR", age: 67, affectedSide: "Izquierdo", lastSession: "20 jun 2026", progress: 72, diagnosis: "Ictus isquémico",    sessions: 24, status: "activo",   colorIdx: 0, notes: "Buena tolerancia al esfuerzo." },
  { name: "José Manuel García Vega",  initials: "JG", age: 58, affectedSide: "Derecho",   lastSession: "19 jun 2026", progress: 45, diagnosis: "Ictus hemorrágico",  sessions: 12, status: "activo",   colorIdx: 1, notes: "Inicio reciente. Progreso estable." },
  { name: "María Antonia Pérez Ruiz", initials: "MP", age: 74, affectedSide: "Ambos",     lastSession: "18 jun 2026", progress: 88, diagnosis: "Ictus isquémico",    sessions: 38, status: "activo",   colorIdx: 2, notes: "Excelente adherencia. Cerca del alta." },
  { name: "Antonio Fernández Sanz",   initials: "AF", age: 62, affectedSide: "Derecho",   lastSession: "17 jun 2026", progress: 31, diagnosis: "AIT recurrente",     sessions:  8, status: "activo",   colorIdx: 3, notes: "Requiere supervisión continua." },
  { name: "Isabel Martínez Torres",   initials: "IM", age: 70, affectedSide: "Izquierdo", lastSession: "15 jun 2026", progress: 60, diagnosis: "Ictus isquémico",    sessions: 19, status: "activo",   colorIdx: 4, notes: "Motivada. Mejora semana a semana." },
  { name: "Francisco López Moreno",   initials: "FL", age: 55, affectedSide: "Derecho",   lastSession: "14 jun 2026", progress: 52, diagnosis: "Ictus lacunar",      sessions: 15, status: "inactivo", colorIdx: 5, notes: "En pausa por viaje familiar." },
];

// Las sesiones de seed se insertan con IDs temporales; seedIfEmpty los remapea
const SEED_SESSIONS: Omit<SessionRecord, "id">[] = [
  { patientId: "1", date: "20 jun 2026", game: "Recolectar gemas",    gameId: "gems",    duration: 5,  score: 8450,  accuracy: 84, side: "Izquierdo", difficulty: "Media",  sessionType: "Alcance" },
  { patientId: "2", date: "19 jun 2026", game: "Atrapar objetos",     gameId: "catch",   duration: 3,  score: 4210,  accuracy: 71, side: "Derecho",   difficulty: "Fácil",  sessionType: "Precisión" },
  { patientId: "3", date: "18 jun 2026", game: "Seguir luces",        gameId: "lights",  duration: 10, score: 12300, accuracy: 91, side: "Ambos",     difficulty: "Media",  sessionType: "Coordinación" },
  { patientId: "4", date: "17 jun 2026", game: "Objetivos laterales", gameId: "lateral", duration: 5,  score: 3120,  accuracy: 58, side: "Derecho",   difficulty: "Difícil",sessionType: "Movilidad de tronco" },
  { patientId: "5", date: "15 jun 2026", game: "Evitar obstáculos",   gameId: "avoid",   duration: 3,  score: 5680,  accuracy: 77, side: "Izquierdo", difficulty: "Difícil",sessionType: "Equilibrio" },
  { patientId: "1", date: "18 jun 2026", game: "Atrapar objetos",     gameId: "catch",   duration: 3,  score: 5200,  accuracy: 79, side: "Izquierdo", difficulty: "Media",  sessionType: "Precisión" },
  { patientId: "1", date: "15 jun 2026", game: "Seguir luces",        gameId: "lights",  duration: 5,  score: 7100,  accuracy: 81, side: "Izquierdo", difficulty: "Media",  sessionType: "Coordinación" },
  { patientId: "1", date: "12 jun 2026", game: "Objetivos laterales", gameId: "lateral", duration: 10, score: 9800,  accuracy: 76, side: "Ambos",     difficulty: "Difícil",sessionType: "Movilidad de tronco" },
  { patientId: "2", date: "15 jun 2026", game: "Recolectar gemas",    gameId: "gems",    duration: 5,  score: 3800,  accuracy: 65, side: "Derecho",   difficulty: "Fácil",  sessionType: "Alcance" },
  { patientId: "3", date: "15 jun 2026", game: "Recolectar gemas",    gameId: "gems",    duration: 5,  score: 11200, accuracy: 89, side: "Ambos",     difficulty: "Difícil",sessionType: "Alcance" },
];

// ─── INITIAL DATA ─────────────────────────────────────────────────────────────

const INITIAL_PATIENTS: Patient[] = [
  { id: 1, name: "Carmen Rodríguez López", initials: "CR", age: 67, affectedSide: "Izquierdo", lastSession: "20 jun 2026", progress: 72, diagnosis: "Ictus isquémico", sessions: 24, status: "activo", colorIdx: 0, notes: "Buena tolerancia al esfuerzo. Trabaja bien con el lado izquierdo." },
  { id: 2, name: "José Manuel García Vega", initials: "JG", age: 58, affectedSide: "Derecho", lastSession: "19 jun 2026", progress: 45, diagnosis: "Ictus hemorrágico", sessions: 12, status: "activo", colorIdx: 1, notes: "Inicio reciente. Progreso estable." },
  { id: 3, name: "María Antonia Pérez Ruiz", initials: "MP", age: 74, affectedSide: "Ambos", lastSession: "18 jun 2026", progress: 88, diagnosis: "Ictus isquémico", sessions: 38, status: "activo", colorIdx: 2, notes: "Excelente adherencia. Cerca del alta." },
  { id: 4, name: "Antonio Fernández Sanz", initials: "AF", age: 62, affectedSide: "Derecho", lastSession: "17 jun 2026", progress: 31, diagnosis: "AIT recurrente", sessions: 8, status: "activo", colorIdx: 3, notes: "Requiere supervisión continua." },
  { id: 5, name: "Isabel Martínez Torres", initials: "IM", age: 70, affectedSide: "Izquierdo", lastSession: "15 jun 2026", progress: 60, diagnosis: "Ictus isquémico", sessions: 19, status: "activo", colorIdx: 4, notes: "Motivada. Mejora semana a semana." },
  { id: 6, name: "Francisco López Moreno", initials: "FL", age: 55, affectedSide: "Derecho", lastSession: "14 jun 2026", progress: 52, diagnosis: "Ictus lacunar", sessions: 15, status: "inactivo", colorIdx: 5, notes: "En pausa por viaje familiar." },
];

const INITIAL_SESSIONS: SessionRecord[] = [
  { id: 1, patientId: 1, date: "20 jun 2026", game: "Recolectar gemas", gameId: "gems", duration: 5, score: 8450, accuracy: 84, side: "Izquierdo", difficulty: "Media", sessionType: "Alcance" },
  { id: 2, patientId: 2, date: "19 jun 2026", game: "Atrapar objetos", gameId: "catch", duration: 3, score: 4210, accuracy: 71, side: "Derecho", difficulty: "Fácil", sessionType: "Precisión" },
  { id: "3", patientId: "3", date: "18 jun 2026", game: "Seguir luces", gameId: "lights", duration: 10, score: 12300, accuracy: 91, side: "Ambos", difficulty: "Media", sessionType: "Coordinación" },
  { id: "4", patientId: "4", date: "17 jun 2026", game: "Objetivos laterales", gameId: "lateral", duration: 5, score: 3120, accuracy: 58, side: "Derecho", difficulty: "Difícil", sessionType: "Movilidad de tronco" },
  { id: "5", patientId: "5", date: "15 jun 2026", game: "Evitar obstáculos", gameId: "avoid", duration: 3, score: 5680, accuracy: 77, side: "Izquierdo", difficulty: "Difícil", sessionType: "Equilibrio" },
  { id: "6", patientId: "1", date: "18 jun 2026", game: "Atrapar objetos", gameId: "catch", duration: 3, score: 5200, accuracy: 79, side: "Izquierdo", difficulty: "Media", sessionType: "Precisión" },
  { id: "7", patientId: "1", date: "15 jun 2026", game: "Seguir luces", gameId: "lights", duration: 5, score: 7100, accuracy: 81, side: "Izquierdo", difficulty: "Media", sessionType: "Coordinación" },
  { id: "8", patientId: "1", date: "12 jun 2026", game: "Objetivos laterales", gameId: "lateral", duration: 10, score: 9800, accuracy: 76, side: "Ambos", difficulty: "Difícil", sessionType: "Movilidad de tronco" },
  { id: "9", patientId: "2", date: "15 jun 2026", game: "Recolectar gemas", gameId: "gems", duration: 5, score: 3800, accuracy: 65, side: "Derecho", difficulty: "Fácil", sessionType: "Alcance" },
  { id: "10", patientId: "3", date: "15 jun 2026", game: "Recolectar gemas", gameId: "gems", duration: 5, score: 11200, accuracy: 89, side: "Ambos", difficulty: "Difícil", sessionType: "Alcance" },
];

const HISTORY_CHART_BY_PATIENT: Record<number, { s: string; score: number; precision: number }[]> = {
  1: [
    { s: "S1", score: 2100, precision: 61 }, { s: "S2", score: 2850, precision: 65 },
    { s: "S3", score: 3400, precision: 68 }, { s: "S4", score: 4100, precision: 71 },
    { s: "S5", score: 4800, precision: 74 }, { s: "S6", score: 5200, precision: 76 },
    { s: "S7", score: 5800, precision: 79 }, { s: "S8", score: 6100, precision: 81 },
    { s: "S9", score: 6700, precision: 83 }, { s: "S10", score: 7200, precision: 85 },
    { s: "S11", score: 7800, precision: 87 }, { s: "S12", score: 8450, precision: 88 },
  ],
  2: [
    { s: "S1", score: 1200, precision: 48 }, { s: "S2", score: 1600, precision: 52 },
    { s: "S3", score: 2100, precision: 57 }, { s: "S4", score: 2800, precision: 61 },
    { s: "S5", score: 3100, precision: 63 }, { s: "S6", score: 3500, precision: 65 },
    { s: "S7", score: 3800, precision: 67 }, { s: "S8", score: 4210, precision: 71 },
  ],
  3: [
    { s: "S1", score: 5200, precision: 70 }, { s: "S2", score: 6100, precision: 73 },
    { s: "S3", score: 7400, precision: 77 }, { s: "S4", score: 8200, precision: 80 },
    { s: "S5", score: 9100, precision: 83 }, { s: "S6", score: 9800, precision: 86 },
    { s: "S7", score: 10500, precision: 88 }, { s: "S8", score: 11200, precision: 89 },
    { s: "S9", score: 11800, precision: 90 }, { s: "S10", score: 12300, precision: 91 },
  ],
  4: [
    { s: "S1", score: 900, precision: 40 }, { s: "S2", score: 1200, precision: 44 },
    { s: "S3", score: 1600, precision: 48 }, { s: "S4", score: 2000, precision: 52 },
    { s: "S5", score: 2400, precision: 55 }, { s: "S6", score: 2800, precision: 57 },
    { s: "S7", score: 3120, precision: 58 },
  ],
  5: [
    { s: "S1", score: 2200, precision: 58 }, { s: "S2", score: 2700, precision: 61 },
    { s: "S3", score: 3100, precision: 64 }, { s: "S4", score: 3600, precision: 67 },
    { s: "S5", score: 4100, precision: 70 }, { s: "S6", score: 4700, precision: 73 },
    { s: "S7", score: 5200, precision: 75 }, { s: "S8", score: 5680, precision: 77 },
  ],
  6: [
    { s: "S1", score: 2600, precision: 60 }, { s: "S2", score: 3100, precision: 63 },
    { s: "S3", score: 3700, precision: 66 }, { s: "S4", score: 4200, precision: 68 },
    { s: "S5", score: 4800, precision: 71 }, { s: "S6", score: 5100, precision: 72 },
  ],
};

const MINIGAMES = [
  { id: "gems", name: "Recolectar gemas", description: "Ejercicio de alcance funcional y coordinación ojo-mano", Icon: Sparkles, difficulty: "Media", diffColor: "amber", area: "Alcance · Coordinación ojo-mano", bg: "bg-blue-50", iconBg: "bg-blue-100", iconColor: "text-blue-600", border: "border-blue-200" },
  { id: "lateral", name: "Objetivos laterales", description: "Trabajo de rotación de tronco y movilidad lateral", Icon: Move, difficulty: "Difícil", diffColor: "red", area: "Rotación de tronco · Movilidad lateral", bg: "bg-violet-50", iconBg: "bg-violet-100", iconColor: "text-violet-600", border: "border-violet-200" },
  { id: "catch", name: "Atrapar objetos", description: "Ejercicio de reacción y precisión motora", Icon: Hand, difficulty: "Fácil", diffColor: "green", area: "Reacción · Precisión motora", bg: "bg-emerald-50", iconBg: "bg-emerald-100", iconColor: "text-emerald-600", border: "border-emerald-200" },
  { id: "lights", name: "Seguir luces", description: "Trabajo de atención visual y control motor", Icon: Eye, difficulty: "Media", diffColor: "amber", area: "Atención visual · Control motor", bg: "bg-amber-50", iconBg: "bg-amber-100", iconColor: "text-amber-600", border: "border-amber-200" },
  { id: "avoid", name: "Evitar obstáculos", description: "Control inhibitorio y precisión del movimiento", Icon: Shield, difficulty: "Difícil", diffColor: "red", area: "Control inhibitorio · Precisión", bg: "bg-rose-50", iconBg: "bg-rose-100", iconColor: "text-rose-600", border: "border-rose-200" },
];

const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700", "bg-violet-100 text-violet-700",
  "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-700",
  "bg-pink-100 text-pink-700", "bg-teal-100 text-teal-700",
];

const DIAGNOSES = ["Ictus isquémico", "Ictus hemorrágico", "AIT recurrente", "Ictus lacunar", "Hemorragia subaracnoidea"];
const SIDES = ["Izquierdo", "Derecho", "Ambos"];
const DIFFICULTIES = ["Fácil", "Media", "Difícil"];
const HEIGHTS = ["Baja", "Media", "Alta", "Mixta"];
const SESSION_TYPES = ["Alcance", "Coordinación", "Precisión", "Equilibrio", "Movilidad de tronco"];
const DURATIONS = [1, 3, 5, 10];

const DEFAULT_CONFIG: SessionConfig = {
  patientId: null, duration: 5, therapySide: "Izquierdo",
  difficulty: "Media", heightMode: "Media", sessionType: "Alcance", selectedGame: "",
};

function cx(...cls: (string | false | null | undefined)[]) {
  return cls.filter(Boolean).join(" ");
}

function getInitials(name: string) {
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length === 0) return "??";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

function formatDate(d: Date) {
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

// ─── UTILITIES ────────────────────────────────────────────────────────────────

// ─── SHARED UI COMPONENTS ─────────────────────────────────────────────────────

function AvatarIcon({ initials, colorIdx = 0, size = "md" }: { initials: string; colorIdx?: number; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "w-8 h-8 text-xs", md: "w-10 h-10 text-sm", lg: "w-12 h-12 text-base" };
  return (
    <div className={cx("rounded-full flex items-center justify-center font-bold flex-shrink-0", sizes[size], AVATAR_COLORS[colorIdx % AVATAR_COLORS.length])}>
      {initials}
    </div>
  );
}

function Badge({ children, color = "blue" }: { children: React.ReactNode; color?: string }) {
  const map: Record<string, string> = {
    blue: "bg-blue-100 text-blue-700", green: "bg-emerald-100 text-emerald-700",
    purple: "bg-violet-100 text-violet-700", amber: "bg-amber-100 text-amber-700",
    red: "bg-rose-100 text-rose-700", gray: "bg-slate-100 text-slate-600",
  };
  return <span className={cx("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold", map[color] ?? map.blue)}>{children}</span>;
}

function ProgressBar({ value, colorClass = "bg-emerald-500" }: { value: number; colorClass?: string }) {
  return (
    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
      <div className={cx("h-full rounded-full transition-all duration-700", colorClass)} style={{ width: `${Math.min(value, 100)}%` }} />
    </div>
  );
}

function OptionPill({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cx("px-4 py-2 rounded-lg border text-sm font-medium transition-all duration-150 cursor-pointer", selected ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-200" : "bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600")}>
      {label}
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{children}</p>;
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cx("bg-white rounded-xl border border-slate-100 shadow-sm", className)}>{children}</div>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-800">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 cursor-pointer transition-colors"><X size={16} /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function ConfirmDialog({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center mx-auto mb-4"><Trash2 size={20} className="text-rose-500" /></div>
        <h3 className="text-base font-bold text-slate-800 text-center mb-2">¿Confirmar eliminación?</h3>
        <p className="text-sm text-slate-500 text-center mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer transition-all">Cancelar</button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm font-bold cursor-pointer transition-all">Eliminar</button>
        </div>
      </div>
    </div>
  );
}

// ─── PATIENT FORM ─────────────────────────────────────────────────────────────

function PatientForm({ initial, usedColorIdxs, onSave, onClose }: {
  initial?: Partial<Patient>;
  usedColorIdxs: number[];
  onSave: (p: Omit<Patient, "id" | "sessions" | "lastSession" | "progress">) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [age, setAge] = useState(String(initial?.age ?? ""));
  const [affectedSide, setAffectedSide] = useState(initial?.affectedSide ?? "Izquierdo");
  const [diagnosis, setDiagnosis] = useState(initial?.diagnosis ?? DIAGNOSES[0]);
  const [status, setStatus] = useState<"activo" | "inactivo">(initial?.status ?? "activo");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const nextColor = useMemo(() => {
    for (let i = 0; i < AVATAR_COLORS.length; i++) {
      if (!usedColorIdxs.includes(i)) return i;
    }
    return Math.floor(Math.random() * AVATAR_COLORS.length);
  }, [usedColorIdxs]);

  function validate() {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "El nombre es obligatorio";
    const ageN = parseInt(age);
    if (isNaN(ageN) || ageN < 1 || ageN > 120) e.age = "Edad inválida (1-120)";
    return e;
  }

  function handleSubmit() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    const initials = getInitials(name);
    onSave({ name: name.trim(), initials, age: parseInt(age), affectedSide, diagnosis, status, colorIdx: initial?.colorIdx ?? nextColor, notes });
    onClose();
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-semibold text-slate-500 mb-1 block">Nombre completo *</label>
        <input value={name} onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: "" })); }} placeholder="Nombre y apellidos" className={cx("w-full px-3 py-2.5 rounded-xl border text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all", errors.name ? "border-rose-400" : "border-slate-200 focus:border-blue-400")} />
        {errors.name && <p className="text-xs text-rose-500 mt-1">{errors.name}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-slate-500 mb-1 block">Edad *</label>
          <input value={age} onChange={e => { setAge(e.target.value); setErrors(p => ({ ...p, age: "" })); }} placeholder="Ej: 65" type="number" min={1} max={120} className={cx("w-full px-3 py-2.5 rounded-xl border text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all", errors.age ? "border-rose-400" : "border-slate-200 focus:border-blue-400")} />
          {errors.age && <p className="text-xs text-rose-500 mt-1">{errors.age}</p>}
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 mb-1 block">Estado</label>
          <select value={status} onChange={e => setStatus(e.target.value as "activo" | "inactivo")} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white cursor-pointer transition-all">
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
          </select>
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-500 mb-1 block">Diagnóstico</label>
        <select value={diagnosis} onChange={e => setDiagnosis(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white cursor-pointer transition-all">
          {DIAGNOSES.map(d => <option key={d}>{d}</option>)}
        </select>
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-500 mb-1 block">Lado afectado</label>
        <div className="flex gap-2">
          {SIDES.map(s => <OptionPill key={s} label={s} selected={affectedSide === s} onClick={() => setAffectedSide(s)} />)}
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-500 mb-1 block">Notas clínicas</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Observaciones, tolerancia al esfuerzo..." className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 resize-none transition-all" />
      </div>
      <div className="flex gap-3 pt-2">
        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer transition-all">Cancelar</button>
        <button onClick={handleSubmit} className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold cursor-pointer transition-all flex items-center justify-center gap-2">
          <Save size={14} /> {initial ? "Guardar cambios" : "Añadir paciente"}
        </button>
      </div>
    </div>
  );
}

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────

const NAV = [
  { id: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { id: "patients", label: "Pacientes", Icon: Users },
  { id: "new-session", label: "Nueva sesión", Icon: PlayCircle },
  { id: "minigames", label: "Minijuegos", Icon: Gamepad2 },
  { id: "history", label: "Historial", Icon: History },
  { id: "settings", label: "Configuración", Icon: Settings },
] as const;

function Sidebar({ current, onNavigate, activeCount, user, onLogout }: {
  current: Screen; onNavigate: (s: Screen) => void;
  activeCount: number; user: FirebaseUser; onLogout: () => void;
}) {
  return (
    <aside className="w-64 flex-shrink-0 bg-[#0C1B3A] flex flex-col min-h-screen">
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/25 flex items-center justify-center flex-shrink-0">
            <Brain className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <div className="text-white font-bold text-[15px] leading-tight">NeuroVR Rehab</div>
            <div className="text-slate-500 text-[11px] leading-tight font-medium tracking-wide">Plataforma clínica</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map(({ id, label, Icon }) => {
          const active = current === id || (id === "patients" && current === "patient-profile");
          return (
            <button key={id} onClick={() => onNavigate(id as Screen)}
              className={cx("w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 text-left cursor-pointer",
                active ? "bg-blue-600 text-white shadow-lg shadow-blue-900/40" : "text-slate-400 hover:text-white hover:bg-white/10")}>
              <Icon size={17} className="flex-shrink-0" />
              {label}
              {id === "new-session" && !active && <span className="ml-auto w-2 h-2 rounded-full bg-emerald-400" />}
              {id === "patients" && !active && activeCount > 0 && (
                <span className="ml-auto bg-blue-500/30 text-blue-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{activeCount}</span>
              )}
            </button>
          );
        })}
      </nav>
      <div className="px-4 py-4 border-t border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-400/25 flex items-center justify-center flex-shrink-0">
            <span className="text-[11px] font-bold text-blue-300">
              {(user.displayName ?? user.email ?? "U").slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-white text-xs font-semibold leading-tight truncate">
              {user.displayName ?? user.email ?? "Usuario"}
            </div>
            <div className="text-slate-500 text-[11px] leading-tight truncate">{user.email}</div>
          </div>
          <button onClick={onLogout} title="Cerrar sesión"
            className="w-7 h-7 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors flex-shrink-0">
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </aside>
  );
}

// ─── PAGINACIÓN ───────────────────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
type PageSize = typeof PAGE_SIZE_OPTIONS[number];

function usePagination<T>(items: T[], defaultSize: PageSize = 10) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(defaultSize);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const paged = items.slice(start, start + pageSize);

  function changeSize(s: PageSize) { setPageSize(s); setPage(1); }
  function changePage(p: number) { setPage(Math.max(1, Math.min(p, totalPages))); }

  return { paged, page: safePage, pageSize, totalPages, total: items.length, changeSize, changePage };
}

function Paginacion({ page, pageSize, totalPages, total, changeSize, changePage }: {
  page: number; pageSize: PageSize; totalPages: number; total: number;
  changeSize: (s: PageSize) => void; changePage: (p: number) => void;
}) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const pages: (number | "…")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("…");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push("…");
    pages.push(totalPages);
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 flex-wrap gap-3">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span>Mostrar</span>
        <select value={pageSize} onChange={e => changeSize(Number(e.target.value) as PageSize)}
          className="border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-600 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer">
          {PAGE_SIZE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span>por página · <strong>{from}–{to}</strong> de <strong>{total}</strong></span>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={() => changePage(page - 1)} disabled={page === 1}
          className="w-7 h-7 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer transition-colors">
          <ArrowLeft size={12} />
        </button>
        {pages.map((p, i) =>
          p === "…"
            ? <span key={`e${i}`} className="w-7 h-7 flex items-center justify-center text-xs text-slate-400">…</span>
            : <button key={p} onClick={() => changePage(p as number)}
                className={cx("w-7 h-7 rounded-lg text-xs font-semibold border transition-colors cursor-pointer",
                  page === p ? "bg-blue-600 border-blue-600 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50")}>
                {p}
              </button>
        )}
        <button onClick={() => changePage(page + 1)} disabled={page === totalPages}
          className="w-7 h-7 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer transition-colors">
          <ArrowRight size={12} />
        </button>
      </div>
    </div>
  );
}

// ─── SCREEN: DASHBOARD ────────────────────────────────────────────────────────

function DashboardScreen({ patients, sessions, onNewSession, onViewHistory, onPatients, onSelectPatient }: {
  patients: Patient[]; sessions: SessionRecord[];
  onNewSession: () => void; onViewHistory: () => void; onPatients: () => void;
  onSelectPatient: (p: Patient) => void;
}) {
  const activeCount = patients.filter(p => p.status === "activo").length;
  const totalMinutes = sessions.reduce((acc, s) => acc + s.duration, 0);
  const avgProgress = patients.length ? Math.round(patients.reduce((a, p) => a + p.progress, 0) / patients.length) : 0;
  const recentSessions = [...sessions].sort((a, b) => b.id - a.id).slice(0, 5);

  const stats = [
    { label: "Pacientes activos", value: String(activeCount), Icon: Users, iconBg: "bg-blue-100", iconColor: "text-blue-600", trend: `${patients.length} total` },
    { label: "Sesiones realizadas", value: String(sessions.length), Icon: Activity, iconBg: "bg-emerald-100", iconColor: "text-emerald-600", trend: "Total acumulado" },
    { label: "Tiempo rehabilitación", value: `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`, Icon: Timer, iconBg: "bg-violet-100", iconColor: "text-violet-600", trend: "Total acumulado" },
    { label: "Progreso medio", value: `${avgProgress}%`, Icon: TrendingUp, iconBg: "bg-amber-100", iconColor: "text-amber-600", trend: "Todos los pacientes" },
  ];

  const recentPatients = [...patients].sort((a, b) => b.id - a.id).slice(0, 5);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-sm text-slate-500 font-medium mb-1 flex items-center gap-1.5"><Calendar size={13} /> Lunes, 22 de junio de 2026</p>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard clínico</h1>
          <p className="text-slate-500 text-sm mt-1">Bienvenida, Dra. Martínez. Aquí tienes el resumen de hoy.</p>
        </div>
        <button onClick={onNewSession} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-blue-200 transition-all cursor-pointer">
          <Plus size={16} /> Nueva sesión
        </button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(s => (
          <Card key={s.label} className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className={cx("w-9 h-9 rounded-lg flex items-center justify-center", s.iconBg)}>
                <s.Icon size={18} className={s.iconColor} />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-800 mb-0.5">{s.value}</div>
            <div className="text-sm font-medium text-slate-600 mb-1">{s.label}</div>
            <div className="text-xs text-slate-400">{s.trend}</div>
          </Card>
        ))}
      </div>
      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-700">Últimos pacientes</h2>
              <button onClick={onPatients} className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 cursor-pointer">Ver todos <ChevronRight size={12} /></button>
            </div>
            <div className="divide-y divide-slate-50">
              {recentPatients.map(p => (
                <div key={p.id} className="px-5 py-3.5 flex items-center gap-3 hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => onSelectPatient(p)}>
                  <AvatarIcon initials={p.initials} colorIdx={p.colorIdx} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-700 truncate">{p.name}</div>
                    <div className="text-xs text-slate-400">{p.lastSession}</div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className="text-xs font-bold text-emerald-600">{p.progress}%</div>
                    <div className="w-14 mt-1"><ProgressBar value={p.progress} colorClass={p.progress >= 70 ? "bg-emerald-500" : p.progress >= 40 ? "bg-amber-400" : "bg-rose-400"} /></div>
                  </div>
                </div>
              ))}
              {patients.length === 0 && <div className="px-5 py-8 text-center text-xs text-slate-400">No hay pacientes registrados</div>}
            </div>
          </Card>
        </div>
        <div className="lg:col-span-3">
          <Card>
            <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-700">Últimas sesiones</h2>
              <button onClick={onViewHistory} className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 cursor-pointer">Ver historial <ChevronRight size={12} /></button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-50">
                    {["Paciente", "Ejercicio", "Fecha", "Puntuación", "Precisión"].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {recentSessions.map(s => {
                    const pat = patients.find(p => p.id === s.patientId);
                    if (!pat) return null;
                    return (
                      <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3"><div className="flex items-center gap-2.5"><AvatarIcon initials={pat.initials} colorIdx={pat.colorIdx} size="sm" /><span className="font-medium text-slate-700 text-xs truncate max-w-[100px]">{pat.name.split(" ")[0]} {pat.name.split(" ")[1]}</span></div></td>
                        <td className="px-4 py-3 text-xs text-slate-500">{s.game}</td>
                        <td className="px-4 py-3 text-xs text-slate-400">{s.date}</td>
                        <td className="px-4 py-3 text-right"><span className="text-xs font-bold text-slate-700 font-mono">{s.score.toLocaleString()}</span></td>
                        <td className="px-4 py-3 text-right"><Badge color={s.accuracy >= 80 ? "green" : s.accuracy >= 65 ? "amber" : "red"}>{s.accuracy}%</Badge></td>
                      </tr>
                    );
                  })}
                  {sessions.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-xs text-slate-400">No hay sesiones registradas</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── SCREEN: PATIENTS (CRUD) ──────────────────────────────────────────────────

function PatientsScreen({ patients, onSelectPatient, onAdd, onEdit, onDelete, onViewProfile }: {
  patients: Patient[];
  onSelectPatient: (p: Patient) => void;
  onAdd: (p: Omit<Patient, "id" | "sessions" | "lastSession" | "progress">) => void;
  onEdit: (id: string, p: Omit<Patient, "id" | "sessions" | "lastSession" | "progress">) => void;
  onDelete: (id: string) => void;
  onViewProfile: (p: Patient) => void;
}) {
  const [query, setQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<Patient | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Patient | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "activo" | "inactivo">("all");

  const usedColors = patients.map(p => p.colorIdx);

  const filtered = useMemo(() => patients.filter(p => {
    const matchQ = p.name.toLowerCase().includes(query.toLowerCase()) || p.diagnosis.toLowerCase().includes(query.toLowerCase());
    const matchS = filterStatus === "all" || p.status === filterStatus;
    return matchQ && matchS;
  }), [patients, query, filterStatus]);

  const pag = usePagination(filtered, 10);

  // Reset a página 1 cuando cambia el filtro
  useMemo(() => { pag.changePage(1); }, [query, filterStatus]); // eslint-disable-line

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Pacientes</h1>
          <p className="text-slate-500 text-sm mt-0.5">{patients.filter(p => p.status === "activo").length} activos · {patients.length} total</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-blue-200 transition-all cursor-pointer">
          <Plus size={15} /> Añadir paciente
        </button>
      </div>
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por nombre o diagnóstico..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as typeof filterStatus)}
          className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30 cursor-pointer">
          <option value="all">Todos</option><option value="activo">Activos</option><option value="inactivo">Inactivos</option>
        </select>
      </div>
      {filtered.length === 0 && (
        <div className="text-center py-16 text-slate-400"><Users size={36} className="mx-auto mb-3 opacity-30" /><p className="text-sm">No se encontraron pacientes</p></div>
      )}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {pag.paged.map(p => (
          <Card key={p.id} className="p-5 hover:shadow-md transition-shadow duration-200">
            <div className="flex items-start gap-3 mb-4 cursor-pointer" onClick={() => onViewProfile(p)}>
              <AvatarIcon initials={p.initials} colorIdx={p.colorIdx} size="lg" />
              <div className="flex-1 min-w-0">
                <div className="font-bold text-slate-800 text-sm leading-tight">{p.name}</div>
                <div className="text-xs text-slate-400 mt-0.5">{p.diagnosis}</div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <Badge color="gray">{p.age} años</Badge>
                  <Badge color={p.affectedSide === "Izquierdo" ? "blue" : p.affectedSide === "Derecho" ? "purple" : "amber"}>{p.affectedSide}</Badge>
                  <Badge color={p.status === "activo" ? "green" : "gray"}>{p.status}</Badge>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => setEditTarget(p)} className="w-7 h-7 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 flex items-center justify-center cursor-pointer transition-colors"><Pencil size={13} /></button>
                <button onClick={() => setDeleteTarget(p)} className="w-7 h-7 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-500 flex items-center justify-center cursor-pointer transition-colors"><Trash2 size={13} /></button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs mb-4">
              <div className="bg-slate-50 rounded-lg px-3 py-2"><div className="text-slate-400 mb-0.5">Última sesión</div><div className="font-semibold text-slate-700">{p.lastSession}</div></div>
              <div className="bg-slate-50 rounded-lg px-3 py-2"><div className="text-slate-400 mb-0.5">Sesiones totales</div><div className="font-semibold text-slate-700">{p.sessions}</div></div>
            </div>
            <div className="mb-4">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs text-slate-500 font-medium">Progreso rehabilitación</span>
                <span className="text-xs font-bold text-emerald-600">{p.progress}%</span>
              </div>
              <ProgressBar value={p.progress} colorClass={p.progress >= 70 ? "bg-emerald-500" : p.progress >= 40 ? "bg-amber-400" : "bg-rose-400"} />
            </div>
            <button onClick={() => onSelectPatient(p)} className="w-full py-2 bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white rounded-lg text-xs font-semibold transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer border border-blue-100 hover:border-blue-600">
              <PlayCircle size={13} /> Iniciar sesión
            </button>
            <button onClick={() => onViewProfile(p)} className="mt-2 w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer border border-slate-200">
              <User size={13} /> Ver perfil completo
            </button>
          </Card>
        ))}
      </div>

      {filtered.length > 0 && (
        <div className="mt-4 bg-white rounded-xl border border-slate-100 shadow-sm">
          <Paginacion {...pag} />
        </div>
      )}

      {showAdd && (
        <Modal title="Añadir nuevo paciente" onClose={() => setShowAdd(false)}>
          <PatientForm usedColorIdxs={usedColors} onSave={onAdd} onClose={() => setShowAdd(false)} />
        </Modal>
      )}
      {editTarget && (
        <Modal title="Editar paciente" onClose={() => setEditTarget(null)}>
          <PatientForm initial={editTarget} usedColorIdxs={usedColors} onSave={(data) => { onEdit(editTarget.id, data); setEditTarget(null); }} onClose={() => setEditTarget(null)} />
        </Modal>
      )}
      {deleteTarget && (
        <ConfirmDialog
          message={`¿Eliminar a ${deleteTarget.name}? Se eliminarán también todas sus sesiones.`}
          onConfirm={() => { onDelete(deleteTarget.id); setDeleteTarget(null); }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

// ─── SCREEN: NEW SESSION (3 steps) ────────────────────────────────────────────

// ─── SCREEN: NEW SESSION — Paciente → Minijuego → Configuración ───────────────

function StepIndicator({ step }: { step: number }) {
  const labels = ["Paciente", "Minijuego", "Configuración"];
  return (
    <div className="flex items-center mb-8">
      {labels.map((label, i) => {
        const n = i + 1; const done = step > n; const active = step === n;
        return (
          <div key={label} className="flex items-center">
            <div className="flex items-center gap-2">
              <div className={cx("w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                done ? "bg-emerald-500 text-white" : active ? "bg-blue-600 text-white shadow-md shadow-blue-200" : "bg-slate-100 text-slate-400")}>
                {done ? <CheckCircle size={14} /> : n}
              </div>
              <span className={cx("text-sm font-medium", active ? "text-slate-800" : done ? "text-emerald-600" : "text-slate-400")}>{label}</span>
            </div>
            {i < labels.length - 1 && <div className={cx("mx-3 h-px w-12", done ? "bg-emerald-400" : "bg-slate-200")} />}
          </div>
        );
      })}
    </div>
  );
}

function NewSessionScreen({ patients, sessions, initialPatient, initialGame, onLaunch }: {
  patients: Patient[]; sessions: SessionRecord[];
  initialPatient?: Patient | null; initialGame?: string;
  onLaunch: (config: SessionConfig) => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(initialPatient ? 2 : 1);
  const [config, setConfig] = useState<SessionConfig>({
    ...DEFAULT_CONFIG,
    patientId: initialPatient?.id ?? null,
    selectedGame: initialGame ?? "",
    therapySide: initialPatient?.affectedSide ?? "Izquierdo",
  });
  const [query, setQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(initialPatient ?? null);

  const filtered = useMemo(() => patients.filter(p =>
    p.name.toLowerCase().includes(query.toLowerCase()) ||
    p.diagnosis.toLowerCase().includes(query.toLowerCase())
  ), [patients, query]);
  const pagPat = usePagination(filtered, 10);
  const set = (key: keyof SessionConfig, val: string | number | null) =>
    setConfig(c => ({ ...c, [key]: val }));

  const lastPlayedMap = useMemo(() => {
    if (!selectedPatient) return {} as Record<string, string>;
    const map: Record<string, string> = {};
    for (const g of MINIGAMES) {
      const last = sessions
        .filter(s => s.patientId === selectedPatient.id && s.gameId === g.id)
        .sort((a, b) => (b.id > a.id ? 1 : -1))[0];
      if (last) map[g.id] = last.date;
    }
    return map;
  }, [sessions, selectedPatient]);

  const selectedGame = MINIGAMES.find(g => g.id === config.selectedGame);

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-slate-800">Nueva sesión VR</h1>
        <p className="text-slate-500 text-sm mt-1">Configura la sesión para conectar con Meta Quest 3</p>
      </div>
      <StepIndicator step={step} />

      {step === 1 && (
        <div>
          <div className="relative mb-5">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar paciente por nombre o diagnóstico..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all" />
          </div>
          <div className="grid md:grid-cols-2 gap-3 mb-4">
            {pagPat.paged.map(p => (
              <button key={p.id} onClick={() => { setSelectedPatient(p); set("patientId", p.id); set("therapySide", p.affectedSide); }}
                className={cx("flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all cursor-pointer",
                  selectedPatient?.id === p.id ? "border-blue-500 bg-blue-50 shadow-md shadow-blue-100" : "border-slate-100 bg-white hover:border-blue-200 hover:bg-blue-50/50")}>
                <AvatarIcon initials={p.initials} colorIdx={p.colorIdx} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-slate-800 truncate">{p.name}</div>
                  <div className="text-xs text-slate-400">{p.diagnosis} · {p.age} años</div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge color={p.affectedSide === "Izquierdo" ? "blue" : p.affectedSide === "Derecho" ? "purple" : "amber"}>{p.affectedSide}</Badge>
                    <span className="text-xs text-slate-400">{p.sessions} sesiones · {p.progress}%</span>
                  </div>
                </div>
                {selectedPatient?.id === p.id && <CheckCircle size={18} className="text-blue-600 flex-shrink-0" />}
              </button>
            ))}
            {filtered.length === 0 && <div className="col-span-2 py-10 text-center text-xs text-slate-400">No hay pacientes</div>}
          </div>
          {filtered.length > 0 && <div className="mb-4 bg-white rounded-xl border border-slate-100 shadow-sm"><Paginacion {...pagPat} /></div>}
          <div className="flex justify-end">
            <button disabled={!selectedPatient} onClick={() => setStep(2)}
              className={cx("flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all cursor-pointer",
                selectedPatient ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200" : "bg-slate-100 text-slate-400 cursor-not-allowed")}>
              Siguiente <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          {selectedPatient && (
            <div className="flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-100 shadow-sm mb-5">
              <AvatarIcon initials={selectedPatient.initials} colorIdx={selectedPatient.colorIdx} size="sm" />
              <div className="flex-1">
                <div className="text-sm font-bold text-slate-800">{selectedPatient.name}</div>
                <div className="text-xs text-slate-400">{selectedPatient.diagnosis} · Lado {selectedPatient.affectedSide}</div>
              </div>
              <button onClick={() => { setSelectedPatient(null); set("patientId", null); setStep(1); }}
                className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer">Cambiar</button>
            </div>
          )}
          <p className="text-sm text-slate-500 mb-4">Selecciona el ejercicio. Se indica la última vez que jugó este paciente.</p>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
            {MINIGAMES.map(g => {
              const lastPlayed = lastPlayedMap[g.id];
              const isSelected = config.selectedGame === g.id;
              return (
                <button key={g.id} onClick={() => set("selectedGame", g.id)}
                  className={cx("text-left p-5 rounded-xl border-2 transition-all cursor-pointer",
                    isSelected ? "border-blue-500 bg-blue-50 shadow-md shadow-blue-100" : `${g.bg} ${g.border} hover:shadow-sm`)}>
                  <div className="flex items-start justify-between mb-3">
                    <div className={cx("w-11 h-11 rounded-xl flex items-center justify-center", g.iconBg)}><g.Icon size={22} className={g.iconColor} /></div>
                    <Badge color={g.diffColor as "amber" | "red" | "green"}>{g.difficulty}</Badge>
                  </div>
                  <h3 className="font-bold text-sm text-slate-800 mb-1">{g.name}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed mb-3">{g.description}</p>
                  <div className="text-xs text-slate-400 font-medium mb-2">{g.area}</div>
                  <div className={cx("flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg",
                    lastPlayed ? "bg-white/80 text-slate-600" : "bg-white/50 text-slate-400")}>
                    <Calendar size={10} />
                    {lastPlayed ? <span>Última vez: <strong>{lastPlayed}</strong></span> : <span>Sin sesiones previas</span>}
                  </div>
                  {isSelected && <div className="mt-2 flex items-center gap-1.5 text-blue-600 text-xs font-semibold"><CheckCircle size={13} /> Seleccionado</div>}
                </button>
              );
            })}
          </div>
          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"><ArrowLeft size={14} /> Atrás</button>
            <button disabled={!config.selectedGame} onClick={() => setStep(3)}
              className={cx("flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold cursor-pointer transition-all",
                config.selectedGame ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200" : "bg-slate-100 text-slate-400 cursor-not-allowed")}>
              Siguiente <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {[
              { key: "duration" as const, label: "Duración", Icon: Timer, iconBg: "bg-blue-100", iconColor: "text-blue-600", options: DURATIONS.map(d => ({ val: d, label: `${d} min` })) },
              { key: "therapySide" as const, label: "Lado a trabajar", Icon: Hand, iconBg: "bg-violet-100", iconColor: "text-violet-600", options: SIDES.map(s => ({ val: s, label: s })) },
              { key: "difficulty" as const, label: "Dificultad", Icon: Zap, iconBg: "bg-amber-100", iconColor: "text-amber-600", options: DIFFICULTIES.map(d => ({ val: d, label: d })) },
              { key: "heightMode" as const, label: "Altura de objetivos", Icon: Layers, iconBg: "bg-emerald-100", iconColor: "text-emerald-600", options: HEIGHTS.map(h => ({ val: h, label: h })) },
              { key: "sessionType" as const, label: "Tipo de sesión", Icon: Target, iconBg: "bg-rose-100", iconColor: "text-rose-600", options: SESSION_TYPES.map(t => ({ val: t, label: t })) },
            ].map(({ key, label, Icon, iconBg, iconColor, options }) => (
              <Card key={key} className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className={cx("w-7 h-7 rounded-lg flex items-center justify-center", iconBg)}><Icon size={14} className={iconColor} /></div>
                  <SectionLabel>{label}</SectionLabel>
                </div>
                <div className="flex flex-wrap gap-2">
                  {options.map(o => <OptionPill key={String(o.val)} label={o.label} selected={config[key] === o.val} onClick={() => set(key, o.val)} />)}
                </div>
              </Card>
            ))}
          </div>
          <div className="lg:col-span-1">
            <div className="sticky top-6">
              <Card className="p-5 mb-4">
                <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2"><User size={14} className="text-blue-500" /> Resumen</h3>
                {selectedGame && (
                  <div className={cx("flex items-center gap-3 mb-3 p-3 rounded-lg border", selectedGame.bg, selectedGame.border)}>
                    <div className={cx("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", selectedGame.iconBg)}>
                      <selectedGame.Icon size={16} className={selectedGame.iconColor} />
                    </div>
                    <div><div className="text-xs font-bold text-slate-800">{selectedGame.name}</div><div className="text-xs text-slate-500">{selectedGame.difficulty}</div></div>
                  </div>
                )}
                {selectedPatient && (
                  <div className="flex items-center gap-3 mb-4 p-3 bg-blue-50 rounded-lg">
                    <AvatarIcon initials={selectedPatient.initials} colorIdx={selectedPatient.colorIdx} size="sm" />
                    <div><div className="text-xs font-bold text-slate-800">{selectedPatient.name}</div><div className="text-xs text-slate-400">{selectedPatient.diagnosis}</div></div>
                  </div>
                )}
                <div className="space-y-1.5 text-xs">
                  {[["Duración", `${config.duration} min`], ["Lado", config.therapySide], ["Dificultad", config.difficulty], ["Altura", config.heightMode], ["Tipo", config.sessionType]].map(([l, v]) => (
                    <div key={l} className="flex justify-between py-1.5 border-b border-slate-50 last:border-0">
                      <span className="text-slate-400">{l}</span><span className="font-bold text-slate-700">{v}</span>
                    </div>
                  ))}
                </div>
              </Card>
              <div className="flex gap-2">
                <button onClick={() => setStep(2)} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"><ArrowLeft size={14} /> Atrás</button>
                <button onClick={() => onLaunch(config)} className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-blue-300/40 cursor-pointer transition-all">
                  <Headset size={16} /> Iniciar VR
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SCREEN: PATIENT PROFILE ──────────────────────────────────────────────────

function PatientProfileScreen({ patient, sessions, onBack, onStartSession, onEdit, onDelete }: {
  patient: Patient; sessions: SessionRecord[];
  onBack: () => void; onStartSession: (p: Patient) => void;
  onEdit: () => void; onDelete: () => void;
}) {
  const patientSessions = useMemo(() =>
    sessions.filter(s => s.patientId === patient.id).sort((a, b) => b.id > a.id ? 1 : -1),
    [sessions, patient.id]
  );
  const pagSess = usePagination(patientSessions, 10);

  const bestScore = patientSessions.length ? Math.max(...patientSessions.map(s => s.score)) : 0;
  const avgAccuracy = patientSessions.length
    ? Math.round(patientSessions.reduce((a, s) => a + s.accuracy, 0) / patientSessions.length) : 0;
  const totalMinutes = patientSessions.reduce((a, s) => a + s.duration, 0);

  // Gráfico de evolución a partir de sesiones reales
  const chartData = patientSessions.slice().reverse().map((s, i) => ({
    s: `S${i + 1}`, score: s.score, precision: s.accuracy,
  }));

  const sideColor = patient.affectedSide === "Izquierdo" ? "blue" : patient.affectedSide === "Derecho" ? "purple" : "amber";

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-7">
        <button onClick={onBack} className="w-9 h-9 rounded-xl border border-slate-200 hover:bg-slate-50 flex items-center justify-center cursor-pointer transition-colors text-slate-500">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-800">Perfil del paciente</h1>
          <p className="text-slate-500 text-sm">{patient.diagnosis} · {patient.sessions} sesiones registradas</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onEdit} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer transition-all">
            <Pencil size={14} /> Editar
          </button>
          <button onClick={onStartSession.bind(null, patient)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-md shadow-blue-200 cursor-pointer transition-all">
            <PlayCircle size={14} /> Iniciar sesión
          </button>
        </div>
      </div>

      {/* Ficha principal */}
      <div className="grid lg:grid-cols-3 gap-5 mb-6">
        <Card className="lg:col-span-2 p-6">
          <div className="flex items-start gap-5">
            <AvatarIcon initials={patient.initials} colorIdx={patient.colorIdx} size="lg" />
            <div className="flex-1">
              <h2 className="text-xl font-bold text-slate-800 mb-1">{patient.name}</h2>
              <p className="text-sm text-slate-500 mb-3">{patient.diagnosis}</p>
              <div className="flex flex-wrap gap-2 mb-4">
                <Badge color="gray">{patient.age} años</Badge>
                <Badge color={sideColor}>Lado {patient.affectedSide}</Badge>
                <Badge color={patient.status === "activo" ? "green" : "gray"}>{patient.status}</Badge>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Última sesión",   value: patient.lastSession },
                  { label: "Total sesiones",  value: String(patient.sessions) },
                  { label: "Tiempo total",    value: `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m` },
                  { label: "Precisión media", value: patientSessions.length ? `${avgAccuracy}%` : "—" },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-slate-50 rounded-xl px-3 py-2.5">
                    <div className="text-xs text-slate-400 mb-0.5">{label}</div>
                    <div className="text-sm font-bold text-slate-700">{value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Progreso */}
        <Card className="p-6">
          <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
            <TrendingUp size={14} className="text-emerald-500" /> Progreso de rehabilitación
          </h3>
          <div className="flex items-center justify-center mb-4">
            <div className="relative w-28 h-28">
              <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#F1F5F9" strokeWidth="10" />
                <circle cx="50" cy="50" r="40" fill="none"
                  stroke={patient.progress >= 70 ? "#10B981" : patient.progress >= 40 ? "#F59E0B" : "#F43F5E"}
                  strokeWidth="10" strokeLinecap="round"
                  strokeDasharray={`${patient.progress * 2.51} 251`} />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-black text-slate-800">{patient.progress}%</span>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            {[
              { label: "Mejor puntuación", value: bestScore ? bestScore.toLocaleString() : "—", Icon: Trophy, color: "text-amber-500" },
              { label: "Total sesiones",   value: String(patientSessions.length), Icon: Activity, color: "text-blue-500" },
            ].map(({ label, value, Icon, color }) => (
              <div key={label} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                <div className={cx("flex items-center gap-2 text-xs text-slate-400")}><Icon size={12} className={color} /> {label}</div>
                <span className="text-xs font-bold text-slate-700">{value}</span>
              </div>
            ))}
          </div>

          {/* Notas clínicas */}
          {patient.notes && (
            <div className="mt-4 bg-amber-50 border border-amber-100 rounded-xl p-3">
              <p className="text-xs font-semibold text-amber-700 mb-1">Notas clínicas</p>
              <p className="text-xs text-amber-600 leading-relaxed">{patient.notes}</p>
            </div>
          )}
        </Card>
      </div>

      {/* Gráfico evolución */}
      {chartData.length > 1 && (
        <Card className="p-5 mb-5">
          <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
            <BarChart3 size={14} className="text-blue-500" /> Evolución de puntuación y precisión
          </h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5FB" />
                <XAxis dataKey="s" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="score" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} width={50} />
                <YAxis yAxisId="prec" orientation="right" domain={[40, 100]} tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} width={35} unit="%" />
                <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #E2E8F0", fontSize: "12px" }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                <Line yAxisId="score" type="monotone" dataKey="score" stroke="#3B82F6" strokeWidth={2.5} dot={{ fill: "#3B82F6", r: 3 }} name="Puntuación" />
                <Line yAxisId="prec" type="monotone" dataKey="precision" stroke="#10B981" strokeWidth={2} strokeDasharray="5 3" dot={false} name="Precisión %" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Tabla de sesiones */}
      <Card>
        <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <Calendar size={14} className="text-slate-400" /> Historial de sesiones ({patientSessions.length})
          </h3>
          <button onClick={onDelete} className="flex items-center gap-1.5 text-xs text-rose-500 hover:text-rose-600 font-semibold cursor-pointer transition-colors">
            <Trash2 size={12} /> Eliminar paciente
          </button>
        </div>
        {patientSessions.length === 0 ? (
          <div className="py-12 text-center text-slate-400"><Activity size={28} className="mx-auto mb-2 opacity-30" /><p className="text-sm">Sin sesiones registradas todavía</p></div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-50">
                    {["Fecha", "Ejercicio", "Duración", "Lado", "Dificultad", "Puntuación", "Precisión"].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {pagSess.paged.map(row => (
                    <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-xs text-slate-500">{row.date}</td>
                      <td className="px-4 py-3 text-xs font-medium text-slate-700">{row.game}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{row.duration} min</td>
                      <td className="px-4 py-3"><Badge color={row.side === "Izquierdo" ? "blue" : row.side === "Derecho" ? "purple" : "amber"}>{row.side}</Badge></td>
                      <td className="px-4 py-3"><Badge color={row.difficulty === "Fácil" ? "green" : row.difficulty === "Media" ? "amber" : "red"}>{row.difficulty}</Badge></td>
                      <td className="px-4 py-3 text-xs font-bold text-slate-700 font-mono">{row.score.toLocaleString()}</td>
                      <td className="px-4 py-3"><Badge color={row.accuracy >= 80 ? "green" : row.accuracy >= 65 ? "amber" : "red"}>{row.accuracy}%</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {patientSessions.length > 0 && <Paginacion {...pagSess} />}
          </>
        )}
      </Card>
    </div>
  );
}

// ─── SCREEN: CONNECT DEVICE ──────────────────────────────────────────────────
// MODO ACTUAL: Envío directo a sesion_activa (sin código de vinculación)
// TODO: Cuando la APK tenga pantalla de código, descomentar el sistema de
//       vinculación por código de 4 caracteres (ver createDeviceLink, subscribeDeviceLink)

function ConnectDeviceScreen({ config, patients, onSessionSent, onBack }: {
  config: SessionConfig; patients: Patient[];
  onSessionSent: (sessionId: string) => void; onBack: () => void;
}) {
  const [status, setStatus] = useState<"idle" | "sending" | "ready" | "error">("idle");
  const patient = patients.find(p => p.id === config.patientId);
  const game = MINIGAMES.find(g => g.id === config.selectedGame);

  async function handleSend() {
    if (!patient) return;
    setStatus("sending");
    const sessionId = `session_${Date.now()}`;
    try {
      await publishActiveSession(config, patient, sessionId);
      setStatus("ready");
      // Navegar a resultados tras 2s
      setTimeout(() => onSessionSent(sessionId), 2000);
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={onBack} className="w-9 h-9 rounded-xl border border-slate-200 hover:bg-slate-50 flex items-center justify-center cursor-pointer transition-colors text-slate-500">
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Iniciar sesión en Meta Quest 3</h1>
          <p className="text-slate-500 text-sm">Envía la sesión a las gafas para comenzar</p>
        </div>
      </div>

      {/* Resumen */}
      {patient && game && (
        <Card className="p-5 mb-6">
          <div className="flex items-center gap-4 flex-wrap">
            <AvatarIcon initials={patient.initials} colorIdx={patient.colorIdx} />
            <div className="flex-1">
              <div className="font-bold text-slate-800 text-sm">{patient.name}</div>
              <div className="text-xs text-slate-400">{patient.diagnosis}</div>
            </div>
            <div className={cx("flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold", game.bg, game.border)}>
              <game.Icon size={13} className={game.iconColor} /> {game.name}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Badge color="blue">{config.duration} min</Badge>
              <Badge color="amber">{config.difficulty}</Badge>
              <Badge color={config.therapySide === "Izquierdo" ? "blue" : config.therapySide === "Derecho" ? "purple" : "amber"}>{config.therapySide}</Badge>
            </div>
          </div>
        </Card>
      )}

      {/* Estado */}
      <Card className="p-8 text-center mb-6">
        {status === "idle" && (
          <div className="py-2">
            <div className="w-20 h-20 rounded-2xl bg-violet-100 flex items-center justify-center mx-auto mb-4">
              <Headset size={36} className="text-violet-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Listo para enviar</h3>
            <p className="text-sm text-slate-500 mb-1">Asegúrate de que las gafas están encendidas</p>
            <p className="text-xs text-slate-400">y la app NeuroVR Rehab está abierta</p>
          </div>
        )}
        {status === "sending" && (
          <div className="py-4">
            <Loader2 size={36} className="animate-spin text-blue-500 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-600">Enviando sesión a las gafas...</p>
          </div>
        )}
        {status === "ready" && (
          <div className="py-2">
            <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={36} className="text-emerald-600" />
            </div>
            <h3 className="text-lg font-bold text-emerald-700 mb-2">¡Sesión enviada!</h3>
            <p className="text-sm text-slate-500">El juego arrancará automáticamente en las gafas</p>
            <p className="text-xs text-slate-400 mt-1">El paciente ya puede ponerse el headset</p>
          </div>
        )}
        {status === "error" && (
          <div className="py-4">
            <X size={36} className="text-rose-500 mx-auto mb-3" />
            <p className="text-sm font-semibold text-rose-600">Error al enviar la sesión</p>
            <p className="text-xs text-slate-400 mt-1">Comprueba tu conexión e inténtalo de nuevo</p>
          </div>
        )}
      </Card>

      {/* Instrucciones */}
      <Card className="p-5 mb-6">
        <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
          <Headset size={15} className="text-violet-500" /> Pasos para iniciar
        </h3>
        <div className="space-y-2">
          {[
            "1. Enciende las gafas Meta Quest 3",
            "2. Abre la app NeuroVR Rehab en las gafas",
            "3. Pulsa el botón de abajo para enviar la sesión",
            "4. El juego arrancará automáticamente en las gafas",
            "5. Ayuda al paciente a ponerse el headset",
          ].map(step => (
            <div key={step} className="flex items-center gap-2 text-xs text-slate-600">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
              {step}
            </div>
          ))}
        </div>
      </Card>

      {status === "idle" && (
        <button onClick={handleSend}
          className="w-full py-4 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-300/40 transition-all">
          <Headset size={18} /> Enviar sesión a las gafas <ArrowRight size={16} />
        </button>
      )}
      {status === "error" && (
        <button onClick={() => setStatus("idle")}
          className="w-full py-4 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-all">
          <RotateCcw size={16} /> Reintentar
        </button>
      )}
    </div>
  );
}

// ─── SCREEN: MINIGAMES ────────────────────────────────────────────────────────

function MinigamesScreen({ onStartSession }: { onStartSession: (gameId: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Catálogo de minijuegos</h1>
          <p className="text-slate-500 text-sm mt-1">Ejercicios terapéuticos diseñados para rehabilitación de ictus en VR</p>
        </div>
        <button onClick={() => onStartSession("")} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-blue-200 transition-all cursor-pointer">
          <Plus size={15} /> Nueva sesión
        </button>
      </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
        {MINIGAMES.map(g => (
          <Card key={g.id} className={cx("overflow-hidden hover:shadow-md transition-shadow duration-200", selected === g.id ? "ring-2 ring-blue-500" : "")}>
            <div className={cx("h-2 w-full", g.iconBg)} />
            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className={cx("w-12 h-12 rounded-xl flex items-center justify-center", g.iconBg)}><g.Icon size={24} className={g.iconColor} /></div>
                <Badge color={g.diffColor as "amber" | "red" | "green"}>Dificultad {g.difficulty}</Badge>
              </div>
              <h3 className="font-bold text-slate-800 mb-1.5">{g.name}</h3>
              <p className="text-sm text-slate-500 leading-relaxed mb-4">{g.description}</p>
              <div className="bg-slate-50 rounded-lg px-3 py-2 mb-4">
                <p className="text-xs text-slate-400 font-medium mb-0.5">Área terapéutica</p>
                <p className="text-xs font-semibold text-slate-700">{g.area}</p>
              </div>
              <button onClick={() => setSelected(g.id === selected ? null : g.id)}
                className={cx("w-full py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer", selected === g.id ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600")}>
                {selected === g.id ? "✓ Seleccionado" : "Seleccionar"}
              </button>
            </div>
          </Card>
        ))}
      </div>
      {selected && (
        <div className="mt-6 p-5 bg-blue-50 border-2 border-blue-200 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle size={20} className="text-blue-600" />
            <div>
              <p className="text-sm font-bold text-slate-800">{MINIGAMES.find(g => g.id === selected)?.name} seleccionado</p>
              <p className="text-xs text-slate-500">Configura la sesión para iniciar el ejercicio</p>
            </div>
          </div>
          <button onClick={() => onStartSession(selected)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-blue-200 transition-all cursor-pointer">
            <Headset size={16} /> Configurar sesión
          </button>
        </div>
      )}
    </div>
  );
}

// ─── SCREEN: RESULTS ──────────────────────────────────────────────────────────

function ResultsScreen({ config, patients, onNewSession, onSave }: {
  config: SessionConfig; patients: Patient[];
  onNewSession: () => void; onSave: () => void;
}) {
  const patient = patients.find(p => p.id === config.patientId) ?? patients[0];
  const game = MINIGAMES.find(g => g.id === config.selectedGame) ?? MINIGAMES[0];
  const historyData = HISTORY_CHART_BY_PATIENT[patient?.id ?? 1] ?? [];

  // Simulated results based on difficulty
  const baseScore = config.difficulty === "Fácil" ? 3500 : config.difficulty === "Media" ? 6000 : 8500;
  const simulatedScore = baseScore + Math.floor(config.duration * 120);
  const simulatedAccuracy = config.difficulty === "Fácil" ? 75 : config.difficulty === "Media" ? 82 : 70;

  const chartData = [...historyData.slice(-4), { s: "Hoy", score: simulatedScore }];

  const gems = { normal: 28, dorada: 12, roja_evitada: 8, roja_tocada: 2, verde: 5, morada: 2 };
  const totalCollected = gems.normal + gems.dorada + gems.verde + gems.morada;
  const gemTypes = [
    { label: "Gemas normales", value: gems.normal, color: "bg-blue-400", textColor: "text-blue-600" },
    { label: "Gemas doradas", value: gems.dorada, color: "bg-amber-400", textColor: "text-amber-600" },
    { label: "Gemas verdes", value: gems.verde, color: "bg-emerald-400", textColor: "text-emerald-600" },
    { label: "Gemas moradas", value: gems.morada, color: "bg-violet-400", textColor: "text-violet-600" },
    { label: "Rojas evitadas ✓", value: gems.roja_evitada, color: "bg-emerald-300", textColor: "text-emerald-600" },
    { label: "Rojas tocadas ✗", value: gems.roja_tocada, color: "bg-rose-400", textColor: "text-rose-600" },
  ];

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <div className="mb-7 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1"><CheckCircle size={18} className="text-emerald-500" /><span className="text-sm font-semibold text-emerald-600 uppercase tracking-wide">Sesión completada</span></div>
          <h1 className="text-2xl font-bold text-slate-800">Resultados de sesión</h1>
          <p className="text-slate-500 text-sm mt-0.5">{patient?.name ?? "—"} · {game?.name ?? "—"} · {config.duration} min</p>
        </div>
        <div className="text-right">
          <div className="text-4xl font-black text-slate-800 font-mono">{simulatedScore.toLocaleString()}</div>
          <div className="text-xs text-slate-400 font-medium uppercase tracking-wide">Puntuación final</div>
        </div>
      </div>
      <div className="grid lg:grid-cols-3 gap-5 mb-6">
        <Card className="lg:col-span-2 p-5">
          <h2 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2"><Gem size={15} className="text-blue-500" /> Desglose de gemas</h2>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {gemTypes.map(g => (
              <div key={g.label} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <div className={cx("w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm", g.color)}>{g.value}</div>
                <span className={cx("text-xs font-semibold", g.textColor)}>{g.label}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
            <span className="text-sm text-slate-500 font-medium">Total recolectadas</span>
            <span className="text-lg font-black text-slate-800 font-mono">{totalCollected}</span>
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2"><BarChart3 size={15} className="text-violet-500" /> Métricas de sesión</h2>
          <div className="space-y-3">
            {[
              { label: "Tiempo total", value: `${config.duration}:00`, Icon: Timer },
              { label: "Tiempo/objetivo", value: "6.4 s", Icon: Crosshair },
              { label: "Lado trabajado", value: config.therapySide, Icon: Hand },
              { label: "Dificultad", value: config.difficulty, Icon: Zap },
              { label: "Tipo", value: config.sessionType, Icon: Target },
              { label: "Precisión", value: `${simulatedAccuracy}%`, Icon: Award },
            ].map(({ label, value, Icon }) => (
              <div key={label} className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-slate-400"><Icon size={12} /> {label}</div>
                <span className="text-xs font-bold text-slate-700">{value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <Card className="p-5 mb-6">
        <h2 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2"><TrendingUp size={15} className="text-emerald-500" /> Evolución reciente del paciente</h2>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5FB" />
              <XAxis dataKey="s" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} width={50} />
              <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #E2E8F0", fontSize: "12px" }} labelStyle={{ fontWeight: "bold", color: "#1E293B" }} />
              <Area type="monotone" dataKey="score" stroke="#3B82F6" strokeWidth={2.5} fill="url(#sg)" dot={{ fill: "#3B82F6", r: 4 }} activeDot={{ r: 6 }} name="Puntuación" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <div className="flex items-center gap-3 justify-end">
        <button onClick={onNewSession} className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"><RotateCcw size={14} /> Nueva sesión</button>
        <button onClick={onSave} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-emerald-200 transition-all cursor-pointer"><Download size={15} /> Guardar sesión</button>
      </div>
    </div>
  );
}

// ─── SCREEN: HISTORY ──────────────────────────────────────────────────────────

function HistoryScreen({ patients, sessions }: { patients: Patient[]; sessions: SessionRecord[] }) {
  const [activePatientId, setActivePatientId] = useState(patients[0]?.id ?? 1);
  const [filterDate, setFilterDate] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  const patient = patients.find(p => p.id === activePatientId) ?? patients[0];
  const patientSessions = useMemo(() => sessions.filter(s => s.patientId === activePatientId), [sessions, activePatientId]);

  const filteredSessions = useMemo(() => {
    if (filterDate === "all") return patientSessions;
    const now = new Date("2026-06-22");
    const cutoff = new Date(now);
    if (filterDate === "week") cutoff.setDate(now.getDate() - 7);
    else cutoff.setMonth(now.getMonth() - 1);
    return patientSessions;
  }, [patientSessions, filterDate]);

  const pagSessions = usePagination(filteredSessions, 10);
  const pagPatients = usePagination(patients, 25);

  const chartData = HISTORY_CHART_BY_PATIENT[activePatientId] ?? [];
  const bestScore = patientSessions.length ? Math.max(...patientSessions.map(s => s.score)) : 0;
  const avgAccuracy = patientSessions.length ? Math.round(patientSessions.reduce((a, s) => a + s.accuracy, 0) / patientSessions.length) : 0;

  if (!patient) return <div className="p-8 text-center text-slate-400">No hay pacientes registrados</div>;

  const metrics = [
    { label: "Mejor puntuación", value: bestScore ? bestScore.toLocaleString() : "—", Icon: Trophy, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Precisión media", value: patientSessions.length ? `${avgAccuracy}%` : "—", Icon: Award, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Total sesiones", value: String(patientSessions.length), Icon: Activity, color: "text-violet-600", bg: "bg-violet-50" },
    { label: "Progreso global", value: `${patient.progress}%`, Icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50" },
  ];

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Historial de paciente</h1>
          <p className="text-slate-500 text-sm mt-1">Evolución clínica y registro de sesiones</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer">
          <Download size={14} /> Exportar PDF
        </button>
      </div>
      <Card className="p-4 mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          {pagPatients.paged.map(p => (
            <button key={p.id} onClick={() => setActivePatientId(p.id)}
              className={cx("flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer", activePatientId === p.id ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-slate-200 text-slate-600 hover:border-blue-200")}>
              <AvatarIcon initials={p.initials} colorIdx={p.colorIdx} size="sm" />
              {p.name.split(" ")[0]} {p.name.split(" ")[1]}
            </button>
          ))}
        </div>
        {patients.length > pagPatients.pageSize && <Paginacion {...pagPatients} />}
      </Card>
      <Card className="p-5 mb-6">
        <div className="flex items-center gap-4">
          <AvatarIcon initials={patient.initials} colorIdx={patient.colorIdx} size="lg" />
          <div className="flex-1">
            <div className="font-bold text-slate-800 text-base">{patient.name}</div>
            <div className="text-sm text-slate-400 mb-2">{patient.diagnosis} · {patient.age} años · Lado: <strong>{patient.affectedSide}</strong></div>
            <div className="flex items-center gap-3">
              <div className="flex-1 max-w-xs"><ProgressBar value={patient.progress} colorClass="bg-emerald-500" /></div>
              <span className="text-sm font-bold text-emerald-600">{patient.progress}% progreso global</span>
            </div>
          </div>
          {patient.notes && <div className="hidden lg:block max-w-xs bg-slate-50 rounded-lg px-3 py-2"><p className="text-xs text-slate-400 font-medium mb-0.5">Notas</p><p className="text-xs text-slate-600">{patient.notes}</p></div>}
        </div>
      </Card>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {metrics.map(m => (
          <Card key={m.label} className="p-4 flex items-center gap-3">
            <div className={cx("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", m.bg)}><m.Icon size={17} className={m.color} /></div>
            <div><div className="text-lg font-black text-slate-800">{m.value}</div><div className="text-xs text-slate-400 font-medium leading-tight">{m.label}</div></div>
          </Card>
        ))}
      </div>
      {chartData.length > 0 && (
        <Card className="p-5 mb-6">
          <h2 className="text-sm font-bold text-slate-700 mb-5 flex items-center gap-2"><TrendingUp size={15} className="text-blue-500" /> Evolución de puntuación y precisión</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5FB" />
                <XAxis dataKey="s" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="score" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} width={50} />
                <YAxis yAxisId="prec" orientation="right" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} domain={[40, 100]} width={35} unit="%" />
                <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #E2E8F0", fontSize: "12px" }} labelStyle={{ fontWeight: "bold", color: "#1E293B" }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }} />
                <Line yAxisId="score" type="monotone" dataKey="score" stroke="#3B82F6" strokeWidth={2.5} dot={{ fill: "#3B82F6", r: 3 }} activeDot={{ r: 5 }} name="Puntuación" />
                <Line yAxisId="prec" type="monotone" dataKey="precision" stroke="#10B981" strokeWidth={2} strokeDasharray="5 3" dot={false} activeDot={{ r: 5 }} name="Precisión %" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
      <Card>
        <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2"><Calendar size={14} className="text-slate-400" /> Registro de sesiones ({filteredSessions.length})</h2>
          <div className="flex items-center gap-2">
            <Filter size={13} className="text-slate-400" />
            <select value={filterDate} onChange={e => setFilterDate(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer">
              <option value="all">Todas las fechas</option>
              <option value="week">Última semana</option>
              <option value="month">Último mes</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-50">
                {["Fecha", "Ejercicio", "Duración", "Lado", "Dificultad", "Puntuación", "Precisión"].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredSessions.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-xs text-slate-400">No hay sesiones registradas para este paciente</td></tr>
              )}
              {pagSessions.paged.map(row => (
                <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-xs text-slate-500">{row.date}</td>
                  <td className="px-4 py-3 text-xs font-medium text-slate-700">{row.game}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{row.duration} min</td>
                  <td className="px-4 py-3"><Badge color={row.side === "Izquierdo" ? "blue" : row.side === "Derecho" ? "purple" : "amber"}>{row.side}</Badge></td>
                  <td className="px-4 py-3"><Badge color={row.difficulty === "Fácil" ? "green" : row.difficulty === "Media" ? "amber" : "red"}>{row.difficulty}</Badge></td>
                  <td className="px-4 py-3 text-xs font-bold text-slate-700 font-mono">{row.score.toLocaleString()}</td>
                  <td className="px-4 py-3"><Badge color={row.accuracy >= 80 ? "green" : row.accuracy >= 65 ? "amber" : "red"}>{row.accuracy}%</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredSessions.length > 0 && <Paginacion {...pagSessions} />}
      </Card>
    </div>
  );
}

// ─── SCREEN: SETTINGS ─────────────────────────────────────────────────────────

function SettingsScreen({ user }: { user: FirebaseUser }) {
  const [notif, setNotif] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [autoSave, setAutoSave] = useState(true);
  const [vrDevice, setVrDevice] = useState("Meta Quest 3");
  const [therapistName, setTherapistName] = useState(user.displayName ?? "");
  const [clinic, setClinic] = useState("Hospital Universitario La Paz");
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
    <button onClick={() => onChange(!value)} className={cx("relative w-10 h-6 rounded-full transition-colors cursor-pointer flex-shrink-0", value ? "bg-blue-600" : "bg-slate-200")}>
      <span className={cx("absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all", value ? "left-5" : "left-1")} />
    </button>
  );

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Configuración</h1>
        <p className="text-slate-500 text-sm mt-1">Preferencias del sistema y del perfil clínico</p>
      </div>

      <div className="space-y-5">
        {/* Profile */}
        <Card className="p-5">
          <h2 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2"><User size={14} className="text-blue-500" /> Perfil del terapeuta</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Nombre completo</label>
              <input value={therapistName} onChange={e => setTherapistName(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Centro clínico</label>
              <input value={clinic} onChange={e => setClinic(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all" />
            </div>
          </div>
        </Card>

        {/* VR Device */}
        <Card className="p-5">
          <h2 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2"><Monitor size={14} className="text-violet-500" /> Dispositivo VR</h2>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Modelo del headset</label>
            <div className="relative">
              <select value={vrDevice} onChange={e => setVrDevice(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white cursor-pointer appearance-none transition-all pr-8">
                <option>Meta Quest 3</option>
                <option>Meta Quest 3S</option>
                <option>Meta Quest Pro</option>
                <option>Meta Quest 2</option>
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg">
            <CheckCircle size={12} /> Dispositivo configurado y listo para conectar
          </div>
        </Card>

        {/* Preferences */}
        <Card className="p-5">
          <h2 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2"><Bell size={14} className="text-amber-500" /> Preferencias</h2>
          <div className="space-y-4">
            {[
              { label: "Notificaciones de sesión", desc: "Alertas antes de cada sesión programada", value: notif, onChange: setNotif },
              { label: "Guardado automático", desc: "Guardar resultados al finalizar cada sesión", value: autoSave, onChange: setAutoSave },
              { label: "Modo oscuro", desc: "Interfaz con fondo oscuro (próximamente)", value: darkMode, onChange: setDarkMode },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-slate-700">{item.label}</div>
                  <div className="text-xs text-slate-400">{item.desc}</div>
                </div>
                <Toggle value={item.value} onChange={item.onChange} />
              </div>
            ))}
          </div>
        </Card>

        {/* Security */}
        <Card className="p-5">
          <h2 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2"><Lock size={14} className="text-slate-500" /> Seguridad</h2>
          <button className="w-full py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer transition-all">Cambiar contraseña</button>
        </Card>

        <div className="flex justify-end pt-2">
          <button onClick={handleSave} className={cx("flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer shadow-md", saved ? "bg-emerald-500 text-white shadow-emerald-200" : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200")}>
            {saved ? <><CheckCircle size={15} /> Guardado</> : <><Save size={15} /> Guardar cambios</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────

export default function App({ user }: { user: FirebaseUser }) {
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingPatient, setPendingPatient] = useState<Patient | null>(null);
  const [pendingGame, setPendingGame] = useState<string>("");
  const [lastConfig, setLastConfig] = useState<SessionConfig>(DEFAULT_CONFIG);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [profilePatient, setProfilePatient] = useState<Patient | null>(null);
  const [editFromProfile, setEditFromProfile] = useState(false);

  // ── Suscripción en tiempo real a Firestore ────────────────────────────────
  useEffect(() => {
    // Seed datos iniciales si Firestore está vacío
    seedIfEmpty(SEED_PATIENTS, SEED_SESSIONS).catch(console.error);

    const unsubP = subscribePatients(data => { setPatients(data); setLoading(false); });
    const unsubS = subscribeSessions(data => setSessions(data));
    return () => { unsubP(); unsubS(); };
  }, []);

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }

  const navigate = useCallback((s: Screen) => {
    if (s !== "new-session") { setPendingPatient(null); setPendingGame(""); }
    setScreen(s);
  }, []);

  // ── PATIENT CRUD ──────────────────────────────────────────────────────────

  async function handleAddPatient(data: Omit<Patient, "id" | "sessions" | "lastSession" | "progress">) {
    try {
      await addPatient({ ...data, sessions: 0, lastSession: "Sin sesiones", progress: 0 });
      showToast("Paciente añadido correctamente");
    } catch { showToast("Error al añadir el paciente", "error"); }
  }

  async function handleEditPatient(id: string, data: Omit<Patient, "id" | "sessions" | "lastSession" | "progress">) {
    try {
      await updatePatient(id, data);
      showToast("Paciente actualizado");
    } catch { showToast("Error al actualizar el paciente", "error"); }
  }

  async function handleDeletePatient(id: string) {
    try {
      await deletePatient(id);
      showToast("Paciente eliminado");
    } catch { showToast("Error al eliminar el paciente", "error"); }
  }

  // ── SESSION FLOW ──────────────────────────────────────────────────────────

  function handleSelectPatient(p: Patient) {
    setPendingPatient(p);
    setScreen("new-session");
  }

  function handleViewProfile(p: Patient) {
    setProfilePatient(p);
    setScreen("patient-profile");
  }

  function handleStartFromMinigames(gameId: string) {
    setPendingGame(gameId);
    setPendingPatient(null);
    setScreen("new-session");
  }

  async function handleLaunch(config: SessionConfig) {
    setLastConfig(config);
    // Va a la pantalla de vinculación de dispositivo
    setScreen("connect-device");
  }

  async function handleSaveSession() {
    const game = MINIGAMES.find(g => g.id === lastConfig.selectedGame);
    if (!game || !lastConfig.patientId) { showToast("Error al guardar la sesión", "error"); return; }

    const baseScore = lastConfig.difficulty === "Fácil" ? 3500 : lastConfig.difficulty === "Media" ? 6000 : 8500;
    const score = baseScore + Math.floor(lastConfig.duration * 120);
    const accuracy = lastConfig.difficulty === "Fácil" ? 75 : lastConfig.difficulty === "Media" ? 82 : 70;

    try {
      // Guardar sesión en Firestore
      await addSession({
        patientId: lastConfig.patientId,
        date: formatDate(new Date("2026-06-22")),
        game: game.name, gameId: game.id,
        duration: lastConfig.duration, score, accuracy,
        side: lastConfig.therapySide,
        difficulty: lastConfig.difficulty,
        sessionType: lastConfig.sessionType,
      });

      // Actualizar progreso del paciente
      const patientSessions = sessions.filter(s => s.patientId === lastConfig.patientId);
      const newCount = patientSessions.length + 1;
      const avgAcc = (patientSessions.reduce((a, s) => a + s.accuracy, 0) + accuracy) / newCount;
      const newProgress = Math.min(100, Math.round(avgAcc * 0.8 + newCount * 0.5));

      await updatePatient(lastConfig.patientId, {
        sessions: newCount,
        lastSession: formatDate(new Date("2026-06-22")),
        progress: newProgress,
      });

      showToast("Sesión guardada correctamente");
      navigate("history");
    } catch { showToast("Error al guardar la sesión", "error"); }
  }

  const activeCount = patients.filter(p => p.status === "activo").length;

  // ── Pantalla de carga ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#EEF2F7]">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center mx-auto mb-4">
            <Loader2 size={28} className="text-blue-600 animate-spin" />
          </div>
          <p className="text-sm font-semibold text-slate-600">Conectando con Firebase...</p>
          <p className="text-xs text-slate-400 mt-1">Cargando datos clínicos</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen font-[Plus_Jakarta_Sans,system-ui,sans-serif] bg-[#EEF2F7]">
      <Sidebar current={screen} onNavigate={navigate} activeCount={activeCount} user={user} onLogout={logout} />

      <main className="flex-1 overflow-y-auto min-h-screen relative">
        {/* Toast */}
        {toast && (
          <div className={cx("fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-lg flex items-center gap-2 transition-all", toast.type === "success" ? "bg-emerald-500 text-white" : "bg-rose-500 text-white")}>
            {toast.type === "success" ? <CheckCircle size={15} /> : <X size={15} />} {toast.msg}
          </div>
        )}

        {screen === "dashboard" && (
          <DashboardScreen patients={patients} sessions={sessions}
            onNewSession={() => navigate("new-session")} onViewHistory={() => navigate("history")}
            onPatients={() => navigate("patients")} onSelectPatient={handleSelectPatient} />
        )}
        {screen === "patients" && (
          <PatientsScreen patients={patients} onSelectPatient={handleSelectPatient}
            onAdd={handleAddPatient} onEdit={handleEditPatient} onDelete={handleDeletePatient}
            onViewProfile={handleViewProfile} />
        )}
        {screen === "new-session" && (
          <NewSessionScreen key={`${pendingPatient?.id ?? "fresh"}-${pendingGame}`}
            patients={patients} sessions={sessions} initialPatient={pendingPatient}
            initialGame={pendingGame} onLaunch={handleLaunch} />
        )}
        {screen === "minigames" && <MinigamesScreen onStartSession={handleStartFromMinigames} />}
        {screen === "connect-device" && (
          <ConnectDeviceScreen
            config={lastConfig}
            patients={patients}
            onBack={() => setScreen("new-session")}
            onSessionSent={(sessionId) => {
              setLastConfig(c => ({ ...c }));
              showToast("Sesión enviada a las gafas ✓");
              setTimeout(() => setScreen("results"), 1500);
            }}
          />
        )}
        {screen === "results" && (
          <ResultsScreen config={lastConfig} patients={patients}
            onNewSession={() => navigate("new-session")} onSave={handleSaveSession} />
        )}
        {screen === "history" && <HistoryScreen patients={patients} sessions={sessions} />}
        {screen === "patient-profile" && profilePatient && (
          <PatientProfileScreen
            patient={patients.find(p => p.id === profilePatient.id) ?? profilePatient}
            sessions={sessions}
            onBack={() => navigate("patients")}
            onStartSession={(p) => { handleSelectPatient(p); }}
            onEdit={() => { setEditFromProfile(true); navigate("patients"); }}
            onDelete={async () => {
              await handleDeletePatient(profilePatient.id);
              navigate("patients");
            }}
          />
        )}
        {screen === "settings" && <SettingsScreen user={user} />}
      </main>
    </div>
  );
}
