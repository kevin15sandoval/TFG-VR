import { useState, useMemo } from "react";
import {
  LayoutDashboard, Users, PlayCircle, Gamepad2, History,
  Settings, Brain, Clock, TrendingUp, Search, Plus,
  Eye, Hand, Move, Shield, Sparkles, CheckCircle,
  Timer, Award, ChevronRight, ArrowRight, RotateCcw,
  Headset, Activity, Calendar, Download, Filter, Target,
  Trophy, User, BarChart3, Gem, ArrowLeft, Star,
  Zap, Layers, MonitorPlay, Crosshair, HeartPulse,
} from "lucide-react";
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

// ─── TYPES ────────────────────────────────────────────────────────────────────

type Screen = "dashboard" | "patients" | "new-session" | "minigames" | "results" | "history";

interface Patient {
  id: number;
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
}

interface SessionConfig {
  patientId: number | null;
  duration: number;
  therapySide: string;
  difficulty: string;
  heightMode: string;
  sessionType: string;
  selectedGame: string;
}

// ─── SAMPLE DATA ──────────────────────────────────────────────────────────────

const PATIENTS: Patient[] = [
  { id: 1, name: "Carmen Rodríguez López", initials: "CR", age: 67, affectedSide: "Izquierdo", lastSession: "20 jun 2026", progress: 72, diagnosis: "Ictus isquémico", sessions: 24, status: "activo", colorIdx: 0 },
  { id: 2, name: "José Manuel García Vega", initials: "JG", age: 58, affectedSide: "Derecho", lastSession: "19 jun 2026", progress: 45, diagnosis: "Ictus hemorrágico", sessions: 12, status: "activo", colorIdx: 1 },
  { id: 3, name: "María Antonia Pérez Ruiz", initials: "MP", age: 74, affectedSide: "Ambos", lastSession: "18 jun 2026", progress: 88, diagnosis: "Ictus isquémico", sessions: 38, status: "activo", colorIdx: 2 },
  { id: 4, name: "Antonio Fernández Sanz", initials: "AF", age: 62, affectedSide: "Derecho", lastSession: "17 jun 2026", progress: 31, diagnosis: "AIT recurrente", sessions: 8, status: "activo", colorIdx: 3 },
  { id: 5, name: "Isabel Martínez Torres", initials: "IM", age: 70, affectedSide: "Izquierdo", lastSession: "15 jun 2026", progress: 60, diagnosis: "Ictus isquémico", sessions: 19, status: "activo", colorIdx: 4 },
  { id: 6, name: "Francisco López Moreno", initials: "FL", age: 55, affectedSide: "Derecho", lastSession: "14 jun 2026", progress: 52, diagnosis: "Ictus lacunar", sessions: 15, status: "inactivo", colorIdx: 5 },
];

const RECENT_SESSIONS = [
  { id: 1, patient: "Carmen Rodríguez López", initials: "CR", colorIdx: 0, game: "Recolectar gemas", date: "20 jun 2026", duration: "5 min", score: 8450, side: "Izquierdo", accuracy: 84 },
  { id: 2, patient: "José M. García Vega", initials: "JG", colorIdx: 1, game: "Atrapar objetos", date: "19 jun 2026", duration: "3 min", score: 4210, side: "Derecho", accuracy: 71 },
  { id: 3, patient: "María A. Pérez Ruiz", initials: "MP", colorIdx: 2, game: "Seguir luces", date: "18 jun 2026", duration: "10 min", score: 12300, side: "Ambos", accuracy: 91 },
  { id: 4, patient: "Antonio Fernández Sanz", initials: "AF", colorIdx: 3, game: "Objetivos laterales", date: "17 jun 2026", duration: "5 min", score: 3120, side: "Derecho", accuracy: 58 },
  { id: 5, patient: "Isabel Martínez Torres", initials: "IM", colorIdx: 4, game: "Evitar obstáculos", date: "15 jun 2026", duration: "3 min", score: 5680, side: "Izquierdo", accuracy: 77 },
];

const HISTORY_CHART = [
  { s: "S1", score: 2100, precision: 61, tiempo: 8.2 },
  { s: "S2", score: 2850, precision: 65, tiempo: 7.8 },
  { s: "S3", score: 3400, precision: 68, tiempo: 7.1 },
  { s: "S4", score: 3200, precision: 71, tiempo: 6.9 },
  { s: "S5", score: 4100, precision: 74, tiempo: 6.5 },
  { s: "S6", score: 4800, precision: 76, tiempo: 6.2 },
  { s: "S7", score: 5200, precision: 79, tiempo: 5.9 },
  { s: "S8", score: 5800, precision: 81, tiempo: 5.7 },
  { s: "S9", score: 6100, precision: 83, tiempo: 5.4 },
  { s: "S10", score: 6700, precision: 85, tiempo: 5.2 },
  { s: "S11", score: 7200, precision: 87, tiempo: 4.9 },
  { s: "S12", score: 7800, precision: 88, tiempo: 4.7 },
];

const HISTORY_TABLE = [
  { id: 1, date: "20 jun 2026", game: "Recolectar gemas", duration: "5 min", score: 8450, accuracy: 84, side: "Izquierdo" },
  { id: 2, date: "18 jun 2026", game: "Atrapar objetos", duration: "3 min", score: 5200, accuracy: 79, side: "Izquierdo" },
  { id: 3, date: "15 jun 2026", game: "Seguir luces", duration: "5 min", score: 7100, accuracy: 81, side: "Izquierdo" },
  { id: 4, date: "12 jun 2026", game: "Objetivos laterales", duration: "10 min", score: 9800, accuracy: 76, side: "Ambos" },
  { id: 5, date: "10 jun 2026", game: "Evitar obstáculos", duration: "3 min", score: 4300, accuracy: 72, side: "Izquierdo" },
  { id: 6, date: "8 jun 2026", game: "Recolectar gemas", duration: "5 min", score: 6700, accuracy: 78, side: "Izquierdo" },
  { id: 7, date: "5 jun 2026", game: "Seguir luces", duration: "3 min", score: 5800, accuracy: 74, side: "Izquierdo" },
  { id: 8, date: "3 jun 2026", game: "Atrapar objetos", duration: "5 min", score: 5200, accuracy: 70, side: "Izquierdo" },
];

const MINIGAMES = [
  {
    id: "gems",
    name: "Recolectar gemas",
    description: "Ejercicio de alcance funcional y coordinación ojo-mano",
    Icon: Sparkles,
    difficulty: "Media",
    diffColor: "amber",
    area: "Alcance · Coordinación ojo-mano",
    bg: "bg-blue-50",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
    border: "border-blue-200",
  },
  {
    id: "lateral",
    name: "Objetivos laterales",
    description: "Trabajo de rotación de tronco y movilidad lateral",
    Icon: Move,
    difficulty: "Difícil",
    diffColor: "red",
    area: "Rotación de tronco · Movilidad lateral",
    bg: "bg-violet-50",
    iconBg: "bg-violet-100",
    iconColor: "text-violet-600",
    border: "border-violet-200",
  },
  {
    id: "catch",
    name: "Atrapar objetos",
    description: "Ejercicio de reacción y precisión",
    Icon: Hand,
    difficulty: "Fácil",
    diffColor: "green",
    area: "Reacción · Precisión motora",
    bg: "bg-emerald-50",
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-600",
    border: "border-emerald-200",
  },
  {
    id: "lights",
    name: "Seguir luces",
    description: "Trabajo de atención visual y control motor",
    Icon: Eye,
    difficulty: "Media",
    diffColor: "amber",
    area: "Atención visual · Control motor",
    bg: "bg-amber-50",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
    border: "border-amber-200",
  },
  {
    id: "avoid",
    name: "Evitar obstáculos",
    description: "Control inhibitorio y precisión del movimiento",
    Icon: Shield,
    difficulty: "Difícil",
    diffColor: "red",
    area: "Control inhibitorio · Precisión",
    bg: "bg-rose-50",
    iconBg: "bg-rose-100",
    iconColor: "text-rose-600",
    border: "border-rose-200",
  },
];

// ─── UTILITIES ────────────────────────────────────────────────────────────────

function cx(...cls: (string | false | null | undefined)[]) {
  return cls.filter(Boolean).join(" ");
}

const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-violet-100 text-violet-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-pink-100 text-pink-700",
  "bg-teal-100 text-teal-700",
];

// ─── SHARED UI ────────────────────────────────────────────────────────────────

function Avatar({ initials, colorIdx = 0, size = "md" }: { initials: string; colorIdx?: number; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "w-8 h-8 text-xs", md: "w-10 h-10 text-sm", lg: "w-12 h-12 text-base" };
  return (
    <div className={cx("rounded-full flex items-center justify-center font-bold flex-shrink-0", sizes[size], AVATAR_COLORS[colorIdx % AVATAR_COLORS.length])}>
      {initials}
    </div>
  );
}

function Badge({ children, color = "blue" }: { children: React.ReactNode; color?: string }) {
  const map: Record<string, string> = {
    blue: "bg-blue-100 text-blue-700",
    green: "bg-emerald-100 text-emerald-700",
    purple: "bg-violet-100 text-violet-700",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-rose-100 text-rose-700",
    gray: "bg-slate-100 text-slate-600",
  };
  return (
    <span className={cx("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold", map[color] ?? map.blue)}>
      {children}
    </span>
  );
}

function ProgressBar({ value, colorClass = "bg-emerald-500" }: { value: number; colorClass?: string }) {
  return (
    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
      <div className={cx("h-full rounded-full transition-all duration-700", colorClass)} style={{ width: `${Math.min(value, 100)}%` }} />
    </div>
  );
}

function OptionPill({
  label,
  selected,
  onClick,
}: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "px-4 py-2 rounded-lg border text-sm font-medium transition-all duration-150 cursor-pointer",
        selected
          ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-200"
          : "bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600"
      )}
    >
      {label}
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{children}</p>;
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cx("bg-white rounded-xl border border-slate-100 shadow-sm", className)}>
      {children}
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

function Sidebar({ current, onNavigate }: { current: Screen; onNavigate: (s: Screen) => void }) {
  return (
    <aside className="w-64 flex-shrink-0 bg-[#0C1B3A] flex flex-col min-h-screen">
      {/* Logo */}
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

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map(({ id, label, Icon }) => {
          const active = current === id;
          return (
            <button
              key={id}
              onClick={() => onNavigate(id as Screen)}
              className={cx(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 text-left cursor-pointer",
                active
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-900/40"
                  : "text-slate-400 hover:text-white hover:bg-white/10"
              )}
            >
              <Icon size={17} className="flex-shrink-0" />
              {label}
              {id === "new-session" && !active && (
                <span className="ml-auto w-2 h-2 rounded-full bg-emerald-400"></span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Profile */}
      <div className="px-4 py-4 border-t border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-400/25 flex items-center justify-center">
            <span className="text-[11px] font-bold text-blue-300">DM</span>
          </div>
          <div className="min-w-0">
            <div className="text-white text-xs font-semibold leading-tight truncate">Dra. Sara Martínez</div>
            <div className="text-slate-500 text-[11px] leading-tight">Fisioterapeuta</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

// ─── SCREEN: DASHBOARD ────────────────────────────────────────────────────────

function DashboardScreen({ onNewSession, onViewHistory, onPatients }: {
  onNewSession: () => void;
  onViewHistory: () => void;
  onPatients: () => void;
}) {
  const stats = [
    { label: "Pacientes activos", value: "23", icon: Users, iconBg: "bg-blue-100", iconColor: "text-blue-600", trend: "+2 este mes" },
    { label: "Sesiones realizadas", value: "248", icon: Activity, iconBg: "bg-emerald-100", iconColor: "text-emerald-600", trend: "+18 esta semana" },
    { label: "Tiempo de rehabilitación", value: "124h", icon: Timer, iconBg: "bg-violet-100", iconColor: "text-violet-600", trend: "Total acumulado" },
    { label: "Progreso medio", value: "64%", icon: TrendingUp, iconBg: "bg-amber-100", iconColor: "text-amber-600", trend: "+4% vs mes anterior" },
  ];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-sm text-slate-500 font-medium mb-1 flex items-center gap-1.5">
            <Calendar size={13} /> Lunes, 22 de junio de 2026
          </p>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard clínico</h1>
          <p className="text-slate-500 text-sm mt-1">Bienvenida, Dra. Martínez. Aquí tienes el resumen de hoy.</p>
        </div>
        <button
          onClick={onNewSession}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-blue-200 transition-all duration-150 cursor-pointer"
        >
          <Plus size={16} /> Nueva sesión
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((s) => (
          <Card key={s.label} className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className={cx("w-9 h-9 rounded-lg flex items-center justify-center", s.iconBg)}>
                <s.icon size={18} className={s.iconColor} />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-800 mb-0.5">{s.value}</div>
            <div className="text-sm font-medium text-slate-600 mb-1">{s.label}</div>
            <div className="text-xs text-slate-400">{s.trend}</div>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Last patients */}
        <div className="lg:col-span-2">
          <Card>
            <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-700">Últimos pacientes</h2>
              <button onClick={onPatients} className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 cursor-pointer">
                Ver todos <ChevronRight size={12} />
              </button>
            </div>
            <div className="divide-y divide-slate-50">
              {PATIENTS.slice(0, 5).map((p) => (
                <div key={p.id} className="px-5 py-3.5 flex items-center gap-3 hover:bg-slate-50 transition-colors">
                  <Avatar initials={p.initials} colorIdx={p.colorIdx} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-700 truncate">{p.name}</div>
                    <div className="text-xs text-slate-400">{p.lastSession}</div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className="text-xs font-bold text-emerald-600">{p.progress}%</div>
                    <div className="w-14 mt-1">
                      <ProgressBar value={p.progress} colorClass={p.progress >= 70 ? "bg-emerald-500" : p.progress >= 40 ? "bg-amber-400" : "bg-rose-400"} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Last sessions */}
        <div className="lg:col-span-3">
          <Card>
            <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-700">Últimas sesiones</h2>
              <button onClick={onViewHistory} className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 cursor-pointer">
                Ver historial <ChevronRight size={12} />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-50">
                    <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">Paciente</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">Ejercicio</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">Fecha</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-400 uppercase tracking-wide">Puntuación</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-400 uppercase tracking-wide">Precisión</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {RECENT_SESSIONS.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar initials={s.initials} colorIdx={s.colorIdx} size="sm" />
                          <span className="font-medium text-slate-700 text-xs truncate max-w-[110px]">{s.patient}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-500">{s.game}</td>
                      <td className="px-3 py-3 text-xs text-slate-400">{s.date}</td>
                      <td className="px-3 py-3 text-right">
                        <span className="text-xs font-bold text-slate-700 font-mono">{s.score.toLocaleString()}</span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Badge color={s.accuracy >= 80 ? "green" : s.accuracy >= 65 ? "amber" : "red"}>{s.accuracy}%</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── SCREEN: PATIENTS ─────────────────────────────────────────────────────────

function PatientsScreen({ onSelectPatient }: { onSelectPatient: (p: Patient) => void }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () => PATIENTS.filter((p) => p.name.toLowerCase().includes(query.toLowerCase())),
    [query]
  );

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Pacientes</h1>
          <p className="text-slate-500 text-sm mt-0.5">{PATIENTS.filter((p) => p.status === "activo").length} pacientes activos en seguimiento</p>
        </div>
        <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-blue-200 transition-all cursor-pointer">
          <Plus size={15} /> Añadir paciente
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar paciente por nombre o diagnóstico..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
        />
      </div>

      {/* Grid */}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((p) => (
          <Card key={p.id} className="p-5 hover:shadow-md transition-shadow duration-200 cursor-pointer group" >
            <div className="flex items-start gap-3 mb-4">
              <Avatar initials={p.initials} colorIdx={p.colorIdx} size="lg" />
              <div className="flex-1 min-w-0">
                <div className="font-bold text-slate-800 text-sm leading-tight">{p.name}</div>
                <div className="text-xs text-slate-400 mt-0.5">{p.diagnosis}</div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <Badge color="gray">{p.age} años</Badge>
                  <Badge color={p.affectedSide === "Izquierdo" ? "blue" : p.affectedSide === "Derecho" ? "purple" : "amber"}>
                    {p.affectedSide}
                  </Badge>
                  <Badge color={p.status === "activo" ? "green" : "gray"}>{p.status}</Badge>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs mb-4">
              <div className="bg-slate-50 rounded-lg px-3 py-2">
                <div className="text-slate-400 mb-0.5">Última sesión</div>
                <div className="font-semibold text-slate-700">{p.lastSession}</div>
              </div>
              <div className="bg-slate-50 rounded-lg px-3 py-2">
                <div className="text-slate-400 mb-0.5">Sesiones totales</div>
                <div className="font-semibold text-slate-700">{p.sessions}</div>
              </div>
            </div>

            <div className="mb-4">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs text-slate-500 font-medium">Progreso de rehabilitación</span>
                <span className="text-xs font-bold text-emerald-600">{p.progress}%</span>
              </div>
              <ProgressBar
                value={p.progress}
                colorClass={p.progress >= 70 ? "bg-emerald-500" : p.progress >= 40 ? "bg-amber-400" : "bg-rose-400"}
              />
            </div>

            <button
              onClick={() => onSelectPatient(p)}
              className="w-full py-2 bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white rounded-lg text-xs font-semibold transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer border border-blue-100 hover:border-blue-600"
            >
              <PlayCircle size={13} /> Iniciar sesión
            </button>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── SCREEN: NEW SESSION (3 steps) ────────────────────────────────────────────

const DEFAULT_CONFIG: SessionConfig = {
  patientId: null,
  duration: 5,
  therapySide: "Izquierdo",
  difficulty: "Media",
  heightMode: "Media",
  sessionType: "Alcance",
  selectedGame: "",
};

function StepIndicator({ step }: { step: number }) {
  const steps = ["Paciente", "Configuración", "Minijuego"];
  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((label, i) => {
        const n = i + 1;
        const done = step > n;
        const active = step === n;
        return (
          <div key={label} className="flex items-center">
            <div className="flex items-center gap-2">
              <div className={cx(
                "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                done ? "bg-emerald-500 text-white" : active ? "bg-blue-600 text-white shadow-md shadow-blue-200" : "bg-slate-100 text-slate-400"
              )}>
                {done ? <CheckCircle size={14} /> : n}
              </div>
              <span className={cx("text-sm font-medium", active ? "text-slate-800" : done ? "text-emerald-600" : "text-slate-400")}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={cx("mx-3 flex-1 h-px w-12", done ? "bg-emerald-400" : "bg-slate-200")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function NewSessionScreen({ initialPatient, onLaunch }: {
  initialPatient?: Patient | null;
  onLaunch: (config: SessionConfig) => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(initialPatient ? 2 : 1);
  const [config, setConfig] = useState<SessionConfig>({
    ...DEFAULT_CONFIG,
    patientId: initialPatient?.id ?? null,
  });
  const [query, setQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(initialPatient ?? null);

  const filtered = useMemo(
    () => PATIENTS.filter((p) => p.name.toLowerCase().includes(query.toLowerCase())),
    [query]
  );

  const set = (key: keyof SessionConfig, val: string | number) =>
    setConfig((c) => ({ ...c, [key]: val }));

  const DURATIONS = [1, 3, 5, 10];
  const SIDES = ["Izquierdo", "Derecho", "Ambos"];
  const DIFFICULTIES = ["Fácil", "Media", "Difícil"];
  const HEIGHTS = ["Baja", "Media", "Alta", "Mixta"];
  const TYPES = ["Alcance", "Coordinación", "Precisión", "Equilibrio", "Movilidad de tronco"];

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-slate-800">Nueva sesión VR</h1>
        <p className="text-slate-500 text-sm mt-1">Configura la sesión antes de conectar con el dispositivo Meta Quest 3</p>
      </div>

      <StepIndicator step={step} />

      {/* STEP 1: Select patient */}
      {step === 1 && (
        <div>
          <div className="relative mb-5">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar paciente..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-3 mb-6">
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => { setSelectedPatient(p); set("patientId", p.id); }}
                className={cx(
                  "flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all duration-150 cursor-pointer",
                  selectedPatient?.id === p.id
                    ? "border-blue-500 bg-blue-50 shadow-md shadow-blue-100"
                    : "border-slate-100 bg-white hover:border-blue-200 hover:bg-blue-50/50"
                )}
              >
                <Avatar initials={p.initials} colorIdx={p.colorIdx} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-slate-800 truncate">{p.name}</div>
                  <div className="text-xs text-slate-400">{p.diagnosis} · {p.age} años</div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge color={p.affectedSide === "Izquierdo" ? "blue" : p.affectedSide === "Derecho" ? "purple" : "amber"}>
                      {p.affectedSide}
                    </Badge>
                    <span className="text-xs text-slate-400">{p.sessions} sesiones</span>
                  </div>
                </div>
                {selectedPatient?.id === p.id && <CheckCircle size={18} className="text-blue-600 flex-shrink-0" />}
              </button>
            ))}
          </div>

          <div className="flex justify-end">
            <button
              disabled={!selectedPatient}
              onClick={() => setStep(2)}
              className={cx(
                "flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all cursor-pointer",
                selectedPatient
                  ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed"
              )}
            >
              Siguiente <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Configure */}
      {step === 2 && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Options */}
          <div className="lg:col-span-2 space-y-6">
            {/* Duration */}
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Timer size={14} className="text-blue-600" />
                </div>
                <SectionLabel>Duración de la sesión</SectionLabel>
              </div>
              <div className="flex flex-wrap gap-2">
                {DURATIONS.map((d) => (
                  <OptionPill key={d} label={`${d} min`} selected={config.duration === d} onClick={() => set("duration", d)} />
                ))}
              </div>
            </Card>

            {/* Side */}
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center">
                  <Hand size={14} className="text-violet-600" />
                </div>
                <SectionLabel>Lado a trabajar</SectionLabel>
              </div>
              <div className="flex flex-wrap gap-2">
                {SIDES.map((s) => (
                  <OptionPill key={s} label={s} selected={config.therapySide === s} onClick={() => set("therapySide", s)} />
                ))}
              </div>
            </Card>

            {/* Difficulty */}
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Zap size={14} className="text-amber-600" />
                </div>
                <SectionLabel>Nivel de dificultad</SectionLabel>
              </div>
              <div className="flex flex-wrap gap-2">
                {DIFFICULTIES.map((d) => (
                  <OptionPill key={d} label={d} selected={config.difficulty === d} onClick={() => set("difficulty", d)} />
                ))}
              </div>
            </Card>

            {/* Height */}
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <Layers size={14} className="text-emerald-600" />
                </div>
                <SectionLabel>Altura de objetivos</SectionLabel>
              </div>
              <div className="flex flex-wrap gap-2">
                {HEIGHTS.map((h) => (
                  <OptionPill key={h} label={h} selected={config.heightMode === h} onClick={() => set("heightMode", h)} />
                ))}
              </div>
            </Card>

            {/* Session type */}
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-rose-100 flex items-center justify-center">
                  <Target size={14} className="text-rose-600" />
                </div>
                <SectionLabel>Tipo de sesión terapéutica</SectionLabel>
              </div>
              <div className="flex flex-wrap gap-2">
                {TYPES.map((t) => (
                  <OptionPill key={t} label={t} selected={config.sessionType === t} onClick={() => set("sessionType", t)} />
                ))}
              </div>
            </Card>
          </div>

          {/* Summary card */}
          <div className="lg:col-span-1">
            <div className="sticky top-6">
              <Card className="p-5 mb-4">
                <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                  <User size={14} className="text-blue-500" /> Paciente seleccionado
                </h3>
                {selectedPatient && (
                  <div className="flex items-center gap-3 mb-4 p-3 bg-blue-50 rounded-lg">
                    <Avatar initials={selectedPatient.initials} colorIdx={selectedPatient.colorIdx} size="sm" />
                    <div>
                      <div className="text-xs font-bold text-slate-800">{selectedPatient.name}</div>
                      <div className="text-xs text-slate-400">{selectedPatient.diagnosis}</div>
                    </div>
                  </div>
                )}
                <div className="space-y-2 text-xs">
                  {[
                    { label: "Duración", value: `${config.duration} min` },
                    { label: "Lado", value: config.therapySide },
                    { label: "Dificultad", value: config.difficulty },
                    { label: "Altura", value: config.heightMode },
                    { label: "Tipo", value: config.sessionType },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between items-center py-1.5 border-b border-slate-50 last:border-0">
                      <span className="text-slate-400 font-medium">{label}</span>
                      <span className="font-bold text-slate-700">{value}</span>
                    </div>
                  ))}
                </div>
              </Card>

              <div className="flex gap-2">
                <button
                  onClick={() => setStep(1)}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
                >
                  <ArrowLeft size={14} /> Atrás
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-blue-200 transition-all cursor-pointer"
                >
                  Siguiente <ArrowRight size={15} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: Select minigame */}
      {step === 3 && (
        <div>
          <p className="text-sm text-slate-500 mb-5">Selecciona el minijuego que mejor se adapte a los objetivos terapéuticos de la sesión.</p>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
            {MINIGAMES.map((g) => (
              <button
                key={g.id}
                onClick={() => set("selectedGame", g.id)}
                className={cx(
                  "text-left p-5 rounded-xl border-2 transition-all duration-150 cursor-pointer",
                  config.selectedGame === g.id
                    ? "border-blue-500 bg-blue-50 shadow-md shadow-blue-100"
                    : `${g.bg} ${g.border} hover:shadow-sm`
                )}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={cx("w-11 h-11 rounded-xl flex items-center justify-center", g.iconBg)}>
                    <g.Icon size={22} className={g.iconColor} />
                  </div>
                  <Badge color={g.diffColor as "amber" | "red" | "green"}>{g.difficulty}</Badge>
                </div>
                <h3 className="font-bold text-sm text-slate-800 mb-1">{g.name}</h3>
                <p className="text-xs text-slate-500 leading-relaxed mb-2">{g.description}</p>
                <div className="text-xs text-slate-400 font-medium">{g.area}</div>
                {config.selectedGame === g.id && (
                  <div className="mt-3 flex items-center gap-1.5 text-blue-600 text-xs font-semibold">
                    <CheckCircle size={13} /> Seleccionado
                  </div>
                )}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 justify-between">
            <button
              onClick={() => setStep(2)}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
            >
              <ArrowLeft size={14} /> Atrás
            </button>

            <button
              disabled={!config.selectedGame}
              onClick={() => onLaunch(config)}
              className={cx(
                "flex items-center gap-2.5 px-8 py-3.5 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer",
                config.selectedGame
                  ? "bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white shadow-lg shadow-blue-300/40"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed"
              )}
            >
              <Headset size={18} />
              Iniciar sesión VR
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SCREEN: MINIGAMES CATALOG ────────────────────────────────────────────────

function MinigamesScreen({ onStartSession }: { onStartSession: () => void }) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Catálogo de minijuegos</h1>
          <p className="text-slate-500 text-sm mt-1">Ejercicios terapéuticos diseñados para rehabilitación de ictus en entorno VR</p>
        </div>
        <button
          onClick={onStartSession}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-blue-200 transition-all cursor-pointer"
        >
          <Plus size={15} /> Nueva sesión
        </button>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
        {MINIGAMES.map((g) => (
          <Card key={g.id} className={cx("overflow-hidden hover:shadow-md transition-shadow duration-200", selected === g.id ? "ring-2 ring-blue-500" : "")}>
            <div className={cx("h-2 w-full", g.iconBg)} />
            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className={cx("w-12 h-12 rounded-xl flex items-center justify-center", g.iconBg)}>
                  <g.Icon size={24} className={g.iconColor} />
                </div>
                <Badge color={g.diffColor as "amber" | "red" | "green"}>Dificultad {g.difficulty}</Badge>
              </div>

              <h3 className="font-bold text-slate-800 mb-1.5">{g.name}</h3>
              <p className="text-sm text-slate-500 leading-relaxed mb-4">{g.description}</p>

              <div className="bg-slate-50 rounded-lg px-3 py-2 mb-4">
                <p className="text-xs text-slate-400 font-medium mb-0.5">Área terapéutica</p>
                <p className="text-xs font-semibold text-slate-700">{g.area}</p>
              </div>

              <button
                onClick={() => setSelected(g.id === selected ? null : g.id)}
                className={cx(
                  "w-full py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer",
                  selected === g.id
                    ? "bg-blue-600 text-white"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600"
                )}
              >
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
              <p className="text-sm font-bold text-slate-800">
                {MINIGAMES.find((g) => g.id === selected)?.name} seleccionado
              </p>
              <p className="text-xs text-slate-500">Ahora configura la sesión para iniciar el juego</p>
            </div>
          </div>
          <button
            onClick={onStartSession}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-blue-200 transition-all cursor-pointer"
          >
            <Headset size={16} /> Configurar sesión
          </button>
        </div>
      )}
    </div>
  );
}

// ─── SCREEN: RESULTS ──────────────────────────────────────────────────────────

const RESULTS_CHART = [
  { s: "S9", score: 6100 }, { s: "S10", score: 6700 }, { s: "S11", score: 7200 },
  { s: "S12", score: 7800 }, { s: "Hoy", score: 8450 },
];

function ResultsScreen({ config, onNewSession, onSave }: {
  config: SessionConfig;
  onNewSession: () => void;
  onSave: () => void;
}) {
  const patient = PATIENTS.find((p) => p.id === config.patientId) ?? PATIENTS[0];
  const game = MINIGAMES.find((g) => g.id === config.selectedGame) ?? MINIGAMES[0];

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
      {/* Header */}
      <div className="mb-7 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle size={18} className="text-emerald-500" />
            <span className="text-sm font-semibold text-emerald-600 uppercase tracking-wide">Sesión completada</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Resultados de sesión</h1>
          <p className="text-slate-500 text-sm mt-0.5">{patient.name} · {game.name} · {config.duration} min</p>
        </div>
        <div className="text-right">
          <div className="text-4xl font-black text-slate-800 font-mono">8,450</div>
          <div className="text-xs text-slate-400 font-medium uppercase tracking-wide">Puntuación final</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5 mb-6">
        {/* Gems breakdown */}
        <Card className="lg:col-span-2 p-5">
          <h2 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
            <Gem size={15} className="text-blue-500" /> Desglose de gemas
          </h2>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {gemTypes.map((g) => (
              <div key={g.label} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <div className={cx("w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm", g.color)}>
                  {g.value}
                </div>
                <span className={cx("text-xs font-semibold", g.textColor)}>{g.label}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
            <span className="text-sm text-slate-500 font-medium">Total recolectadas</span>
            <span className="text-lg font-black text-slate-800 font-mono">{totalCollected}</span>
          </div>
        </Card>

        {/* Session meta */}
        <Card className="p-5">
          <h2 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
            <BarChart3 size={15} className="text-violet-500" /> Métricas de sesión
          </h2>
          <div className="space-y-3">
            {[
              { label: "Tiempo total", value: `${config.duration}:00`, icon: Timer },
              { label: "Tiempo/objetivo", value: "6.4 s", icon: Crosshair },
              { label: "Lado trabajado", value: config.therapySide, icon: Hand },
              { label: "Dificultad", value: config.difficulty, icon: Zap },
              { label: "Tipo", value: config.sessionType, icon: Target },
              { label: "Precisión", value: "84%", icon: Award },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Icon size={12} /> {label}
                </div>
                <span className="text-xs font-bold text-slate-700">{value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Evolution chart */}
      <Card className="p-5 mb-6">
        <h2 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
          <TrendingUp size={15} className="text-emerald-500" /> Evolución reciente del paciente
        </h2>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={RESULTS_CHART}>
              <defs>
                <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5FB" />
              <XAxis dataKey="s" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} width={45} />
              <Tooltip
                contentStyle={{ borderRadius: "8px", border: "1px solid #E2E8F0", fontSize: "12px" }}
                labelStyle={{ fontWeight: "bold", color: "#1E293B" }}
              />
              <Area type="monotone" dataKey="score" stroke="#3B82F6" strokeWidth={2.5} fill="url(#scoreGrad)" dot={{ fill: "#3B82F6", r: 4 }} activeDot={{ r: 6 }} name="Puntuación" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Actions */}
      <div className="flex items-center gap-3 justify-end">
        <button
          onClick={onNewSession}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
        >
          <RotateCcw size={14} /> Nueva sesión
        </button>
        <button
          onClick={onSave}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-emerald-200 transition-all cursor-pointer"
        >
          <Download size={15} /> Guardar sesión
        </button>
      </div>
    </div>
  );
}

// ─── SCREEN: HISTORY ──────────────────────────────────────────────────────────

function HistoryScreen() {
  const [activePatientId, setActivePatientId] = useState(1);
  const [filterDate, setFilterDate] = useState("all");
  const patient = PATIENTS.find((p) => p.id === activePatientId)!;

  const metrics = [
    { label: "Mejor puntuación", value: "9,800", icon: Trophy, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Tiempo medio", value: "5.2 s", icon: Timer, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Total sesiones", value: String(HISTORY_TABLE.length), icon: Activity, color: "text-violet-600", bg: "bg-violet-50" },
    { label: "Progreso lado afectado", value: `${patient.progress}%`, icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50" },
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

      {/* Patient selector */}
      <Card className="p-4 mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          {PATIENTS.map((p) => (
            <button
              key={p.id}
              onClick={() => setActivePatientId(p.id)}
              className={cx(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer",
                activePatientId === p.id
                  ? "bg-blue-600 border-blue-600 text-white"
                  : "bg-white border-slate-200 text-slate-600 hover:border-blue-200"
              )}
            >
              <Avatar initials={p.initials} colorIdx={p.colorIdx} size="sm" />
              {p.name.split(" ")[0]} {p.name.split(" ")[1]}
            </button>
          ))}
        </div>
      </Card>

      {/* Patient header */}
      <Card className="p-5 mb-6">
        <div className="flex items-center gap-4">
          <Avatar initials={patient.initials} colorIdx={patient.colorIdx} size="lg" />
          <div className="flex-1">
            <div className="font-bold text-slate-800 text-base">{patient.name}</div>
            <div className="text-sm text-slate-400 mb-2">{patient.diagnosis} · {patient.age} años · Lado afectado: <strong>{patient.affectedSide}</strong></div>
            <div className="flex items-center gap-3">
              <div className="flex-1 max-w-xs">
                <ProgressBar value={patient.progress} colorClass="bg-emerald-500" />
              </div>
              <span className="text-sm font-bold text-emerald-600">{patient.progress}% progreso global</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Metrics row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {metrics.map((m) => (
          <Card key={m.label} className="p-4 flex items-center gap-3">
            <div className={cx("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", m.bg)}>
              <m.icon size={17} className={m.color} />
            </div>
            <div>
              <div className="text-lg font-black text-slate-800">{m.value}</div>
              <div className="text-xs text-slate-400 font-medium leading-tight">{m.label}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* Chart */}
      <Card className="p-5 mb-6">
        <h2 className="text-sm font-bold text-slate-700 mb-5 flex items-center gap-2">
          <TrendingUp size={15} className="text-blue-500" /> Evolución de puntuación y precisión
        </h2>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={HISTORY_CHART}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5FB" />
              <XAxis dataKey="s" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="score" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} width={50} />
              <YAxis yAxisId="prec" orientation="right" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} domain={[50, 100]} width={35} unit="%" />
              <Tooltip
                contentStyle={{ borderRadius: "8px", border: "1px solid #E2E8F0", fontSize: "12px" }}
                labelStyle={{ fontWeight: "bold", color: "#1E293B" }}
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }} />
              <Line yAxisId="score" type="monotone" dataKey="score" stroke="#3B82F6" strokeWidth={2.5} dot={{ fill: "#3B82F6", r: 3 }} activeDot={{ r: 5 }} name="Puntuación" />
              <Line yAxisId="prec" type="monotone" dataKey="precision" stroke="#10B981" strokeWidth={2} strokeDasharray="5 3" dot={false} activeDot={{ r: 5 }} name="Precisión %" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Sessions table */}
      <Card>
        <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <Calendar size={14} className="text-slate-400" /> Registro de sesiones
          </h2>
          <div className="flex items-center gap-2">
            <Filter size={13} className="text-slate-400" />
            <select
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer"
            >
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
                {["Fecha", "Ejercicio", "Duración", "Lado", "Puntuación", "Precisión"].map((h) => (
                  <th key={h} className="px-5 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {HISTORY_TABLE.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3 text-xs text-slate-500">{row.date}</td>
                  <td className="px-5 py-3 text-xs font-medium text-slate-700">{row.game}</td>
                  <td className="px-5 py-3 text-xs text-slate-500">{row.duration}</td>
                  <td className="px-5 py-3">
                    <Badge color={row.side === "Izquierdo" ? "blue" : row.side === "Derecho" ? "purple" : "amber"}>{row.side}</Badge>
                  </td>
                  <td className="px-5 py-3 text-xs font-bold text-slate-800 font-mono">{row.score.toLocaleString()}</td>
                  <td className="px-5 py-3">
                    <Badge color={row.accuracy >= 80 ? "green" : row.accuracy >= 65 ? "amber" : "red"}>{row.accuracy}%</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [pendingPatient, setPendingPatient] = useState<Patient | null>(null);
  const [lastConfig, setLastConfig] = useState<SessionConfig>(DEFAULT_CONFIG);
  const [saved, setSaved] = useState(false);

  const navigate = (s: Screen) => {
    if (s !== "new-session") setPendingPatient(null);
    setScreen(s);
  };

  const handleSelectPatient = (p: Patient) => {
    setPendingPatient(p);
    setScreen("new-session");
  };

  const handleLaunch = (config: SessionConfig) => {
    setLastConfig(config);
    setScreen("results");
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => { setSaved(false); navigate("dashboard"); }, 1500);
  };

  return (
    <div className="flex min-h-screen font-[Plus_Jakarta_Sans,system-ui,sans-serif] bg-background">
      <Sidebar current={screen} onNavigate={navigate} />

      <main className="flex-1 overflow-y-auto min-h-screen relative">
        {saved && (
          <div className="absolute top-4 right-4 z-50 bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-lg flex items-center gap-2">
            <CheckCircle size={15} /> Sesión guardada correctamente
          </div>
        )}

        {screen === "dashboard" && (
          <DashboardScreen
            onNewSession={() => navigate("new-session")}
            onViewHistory={() => navigate("history")}
            onPatients={() => navigate("patients")}
          />
        )}
        {screen === "patients" && (
          <PatientsScreen onSelectPatient={handleSelectPatient} />
        )}
        {screen === "new-session" && (
          <NewSessionScreen
            key={pendingPatient?.id ?? "fresh"}
            initialPatient={pendingPatient}
            onLaunch={handleLaunch}
          />
        )}
        {screen === "minigames" && (
          <MinigamesScreen onStartSession={() => navigate("new-session")} />
        )}
        {screen === "results" && (
          <ResultsScreen
            config={lastConfig}
            onNewSession={() => navigate("new-session")}
            onSave={handleSave}
          />
        )}
        {screen === "history" && <HistoryScreen />}
        {screen === "settings" && (
          <div className="p-8 flex items-center justify-center min-h-screen">
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <Settings size={24} className="text-slate-400" />
              </div>
              <h2 className="text-lg font-bold text-slate-600 mb-2">Configuración del sistema</h2>
              <p className="text-slate-400 text-sm">Próximamente disponible</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
