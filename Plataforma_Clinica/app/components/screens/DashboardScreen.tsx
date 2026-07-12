import { useMemo } from "react";
import { 
  Users, Activity, TrendingUp, Trophy, 
  ChevronRight, Calendar, Target, BarChart3 
} from "lucide-react";
import type { Patient, SessionRecord } from "../../types";
import { Card, Badge } from "../shared";
import { cx, formatDate, toDate } from "../../utils/helpers";
import { AVATAR_COLORS } from "../../constants";

interface DashboardScreenProps {
  patients: Patient[];
  sessions: SessionRecord[];
  onNavigate: (screen: "patients" | "history", patient?: Patient) => void;
}

export function DashboardScreen({ patients, sessions, onNavigate }: DashboardScreenProps) {
  const stats = useMemo(() => {
    const activePatients = patients.filter(p => p.status === "activo").length;
    const totalSessions = sessions.length;
    const avgProgress = patients.length > 0
      ? Math.round(patients.reduce((sum, p) => sum + p.progress, 0) / patients.length)
      : 0;
    
    const last7Days = sessions.filter(s => {
      const sessionDate = toDate(s.date);
      const today = new Date();
      const diff = (today.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24);
      return diff <= 7;
    });
    
    const sessionsThisWeek = last7Days.length;
    
    return { activePatients, totalSessions, avgProgress, sessionsThisWeek };
  }, [patients, sessions]);

  const recentSessions = useMemo(() => 
    [...sessions]
      .sort((a, b) => toDate(b.date).getTime() - toDate(a.date).getTime())
      .slice(0, 5)
  , [sessions]);

  const topPatients = useMemo(() => 
    [...patients]
      .filter(p => p.status === "activo")
      .sort((a, b) => b.progress - a.progress)
      .slice(0, 3)
  , [patients]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Panel de Control</h1>
        <p className="text-slate-600 mt-1">Resumen general de la actividad clínica</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Pacientes Activos</p>
              <p className="text-2xl font-bold text-slate-900 mt-2">{stats.activePatients}</p>
              <p className="text-xs text-slate-500 mt-1">de {patients.length} total</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Sesiones Totales</p>
              <p className="text-2xl font-bold text-slate-900 mt-2">{stats.totalSessions}</p>
              <p className="text-xs text-slate-500 mt-1">{stats.sessionsThisWeek} esta semana</p>
            </div>
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
              <Activity className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Progreso Promedio</p>
              <p className="text-2xl font-bold text-slate-900 mt-2">{stats.avgProgress}%</p>
              <p className="text-xs text-slate-500 mt-1">global</p>
            </div>
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-amber-600" />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Tasa de Éxito</p>
              <p className="text-2xl font-bold text-slate-900 mt-2">87%</p>
              <p className="text-xs text-slate-500 mt-1">últimos 30 días</p>
            </div>
            <div className="w-12 h-12 bg-violet-100 rounded-xl flex items-center justify-center">
              <Trophy className="w-6 h-6 text-violet-600" />
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Patients */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-slate-900">Pacientes Destacados</h3>
            <button
              onClick={() => onNavigate("patients")}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              Ver todos
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            {topPatients.map((patient, idx) => {
              const bgColor = AVATAR_COLORS[patient.colorIdx]?.bg || "bg-slate-100";
              const textColor = AVATAR_COLORS[patient.colorIdx]?.text || "text-slate-700";
              
              return (
                <div
                  key={patient.id}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => onNavigate("history", patient)}
                >
                  <div className={cx("w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm", bgColor, textColor)}>
                    {patient.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 text-sm truncate">{patient.name}</p>
                    <p className="text-xs text-slate-500">{patient.sessions} sesiones</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-100 rounded-full h-1.5 w-16">
                        <div
                          className="bg-emerald-500 h-1.5 rounded-full transition-all"
                          style={{ width: `${patient.progress}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-slate-700 w-10 text-right">{patient.progress}%</span>
                    </div>
                  </div>
                  {idx === 0 && <Trophy className="w-4 h-4 text-amber-500" />}
                </div>
              );
            })}
          </div>
        </Card>

        {/* Recent Sessions */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-slate-900">Actividad Reciente</h3>
            <button
              onClick={() => onNavigate("history")}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              Ver todo
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            {recentSessions.map((session) => {
              const patient = patients.find(p => p.id === session.patientId);
              if (!patient) return null;
              
              const bgColor = AVATAR_COLORS[patient.colorIdx]?.bg || "bg-slate-100";
              const textColor = AVATAR_COLORS[patient.colorIdx]?.text || "text-slate-700";
              
              return (
                <div key={session.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className={cx("w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm", bgColor, textColor)}>
                    {patient.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 text-sm truncate">{patient.name}</p>
                    <p className="text-xs text-slate-500">{session.game}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-700">{session.score} pts</p>
                    <p className="text-xs text-slate-500">{formatDate(session.date)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5 hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Próximas Sesiones</p>
              <p className="text-xl font-bold text-slate-900">12</p>
            </div>
          </div>
        </Card>

        <Card className="p-5 hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <Target className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Objetivos Cumplidos</p>
              <p className="text-xl font-bold text-slate-900">34/40</p>
            </div>
          </div>
        </Card>

        <Card className="p-5 hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Mejora Promedio</p>
              <p className="text-xl font-bold text-slate-900">+23%</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
