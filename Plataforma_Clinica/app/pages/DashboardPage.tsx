import {
  Users, Activity, Timer, TrendingUp, Plus, Calendar, ChevronRight
} from "lucide-react";
import type { Patient, SessionRecord } from "../types";
import { Card, Badge, ProgressBar, AvatarIcon } from "../components/shared";
import { cx } from "../utils/helpers";

interface DashboardPageProps {
  patients: Patient[];
  sessions: SessionRecord[];
  onNewSession: () => void;
  onViewHistory: () => void;
  onPatients: () => void;
  onSelectPatient: (p: Patient) => void;
}

export function DashboardPage({
  patients,
  sessions,
  onNewSession,
  onViewHistory,
  onPatients,
  onSelectPatient,
}: DashboardPageProps) {
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
