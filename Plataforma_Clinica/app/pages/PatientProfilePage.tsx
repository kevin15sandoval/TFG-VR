import { useState, useMemo } from "react";
import {
  ArrowLeft, User, Calendar, Activity, TrendingUp, PlayCircle,
  Pencil, Trash2, Eye, Download, BarChart3, Award, Target,
  Clock, Zap, CheckCircle
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { Patient, SessionRecord } from "../types";
import { Card, AvatarIcon, Badge } from "../components/shared";
import { cx, formatDate } from "../utils/helpers";
import { AVATAR_COLORS } from "../constants";
import { MINIGAMES } from "../config/gameConfig";
import { generatePatientReport } from "../pdfReport";

interface PatientProfilePageProps {
  patient: Patient;
  sessions: SessionRecord[];
  onBack: () => void;
  onStartSession: (p: Patient) => void;
  onEdit: () => void;
  onDelete: () => void;
  onUpdateSessionNotes: (sessionId: string, notes: string) => void;
  onViewSessionDetail: (session: SessionRecord) => void;
}

export function PatientProfilePage({
  patient,
  sessions,
  onBack,
  onStartSession,
  onEdit,
  onDelete,
  onViewSessionDetail,
}: PatientProfilePageProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Filtrar sesiones del paciente
  const patientSessions = sessions.filter(s => s.patientId === patient.id);

  // Calcular estadísticas
  const stats = useMemo(() => {
    const total = patientSessions.length;
    if (total === 0) return { total: 0, avgScore: 0, avgAccuracy: 0, totalTime: 0, lastSession: null };

    const scores = patientSessions.map(s => s.score || 0);
    const accuracies = patientSessions.map(s => s.accuracy || 0);
    const durations = patientSessions.map(s => s.duration || 0);
    
    const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / total);
    const avgAccuracy = Math.round(accuracies.reduce((a, b) => a + b, 0) / total);
    const totalTime = durations.reduce((a, b) => a + b, 0);
    const lastSession = patientSessions.sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    )[0];

    return { total, avgScore, avgAccuracy, totalTime, lastSession };
  }, [patientSessions]);

  // Datos para gráfico de evolución
  const chartData = useMemo(() => {
    return patientSessions
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-10) // Últimas 10 sesiones
      .map((s, idx) => ({
        sesion: `S${idx + 1}`,
        puntuacion: s.score || 0,
        precision: s.accuracy || 0,
      }));
  }, [patientSessions]);

  // Distribución de juegos jugados
  const gameDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    patientSessions.forEach(s => {
      const gameId = s.game || "unknown";
      counts[gameId] = (counts[gameId] || 0) + 1;
    });
    return Object.entries(counts).map(([gameId, count]) => {
      const game = MINIGAMES.find(g => g.id === gameId);
      return { gameId, gameName: game?.name || gameId, count };
    });
  }, [patientSessions]);

  function handleDownloadReport() {
    generatePatientReport(patient, patientSessions);
  }

  function handleDelete() {
    onDelete();
    setShowDeleteConfirm(false);
  }

  const avatarColor = AVATAR_COLORS[patient.colorIdx % AVATAR_COLORS.length];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-7">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-xl border border-slate-200 hover:bg-slate-50 flex items-center justify-center cursor-pointer transition-colors text-slate-500"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-800">Perfil del Paciente</h1>
          <p className="text-slate-500 text-sm">Vista completa del historial y progreso</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Columna izquierda: Info del paciente */}
        <div className="space-y-6">
          {/* Datos básicos */}
          <Card className="p-6">
            <div className="flex items-start justify-between mb-4">
              <AvatarIcon initials={patient.initials} color={avatarColor} size="lg" />
              <Badge variant={patient.status === "activo" ? "success" : "default"}>
                {patient.status === "activo" ? "Activo" : "Inactivo"}
              </Badge>
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-1">{patient.name}</h2>
            <div className="space-y-2 mb-4 text-sm">
              <div className="flex items-center gap-2 text-slate-600">
                <User size={14} />
                <span>{patient.age} años</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Activity size={14} />
                <span>Lado afectado: {patient.affectedSide}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Target size={14} />
                <span>{patient.diagnosis}</span>
              </div>
              {stats.lastSession && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Calendar size={14} />
                  <span>Última sesión: {formatDate(stats.lastSession.date)}</span>
                </div>
              )}
            </div>
            {patient.notes && (
              <div className="bg-slate-50 rounded-lg p-3 mb-4">
                <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Notas clínicas</p>
                <p className="text-sm text-slate-600">{patient.notes}</p>
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={onEdit}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
              >
                <Pencil size={14} /> Editar
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-rose-200 text-sm font-medium text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
              >
                <Trash2 size={14} /> Eliminar
              </button>
            </div>
          </Card>

          {/* Estadísticas generales */}
          <Card className="p-5">
            <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
              <BarChart3 size={14} className="text-blue-500" /> Estadísticas Generales
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Total sesiones</span>
                <span className="text-lg font-bold text-slate-800 font-mono">{stats.total}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Puntuación promedio</span>
                <span className="text-lg font-bold text-blue-600 font-mono">{stats.avgScore}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Precisión promedio</span>
                <span className="text-lg font-bold text-emerald-600 font-mono">{stats.avgAccuracy}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Tiempo total</span>
                <span className="text-lg font-bold text-violet-600 font-mono">{stats.totalTime} min</span>
              </div>
            </div>
          </Card>

          {/* Distribución de juegos */}
          <Card className="p-5">
            <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
              <Award size={14} className="text-amber-500" /> Juegos Jugados
            </h3>
            <div className="space-y-2">
              {gameDistribution.map(({ gameId, gameName, count }) => {
                const game = MINIGAMES.find(g => g.id === gameId);
                return (
                  <div key={gameId} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {game && <game.Icon size={12} className={game.iconColor} />}
                      <span className="text-xs text-slate-600">{gameName}</span>
                    </div>
                    <span className="text-xs font-bold text-slate-700">{count} sesiones</span>
                  </div>
                );
              })}
              {gameDistribution.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-2">No hay sesiones registradas</p>
              )}
            </div>
          </Card>

          {/* Acciones rápidas */}
          <div className="space-y-2">
            <button
              onClick={() => onStartSession(patient)}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-blue-200 transition-all cursor-pointer"
            >
              <PlayCircle size={15} /> Nueva Sesión
            </button>
            <button
              onClick={handleDownloadReport}
              className="w-full flex items-center justify-center gap-2 border border-slate-200 hover:bg-slate-50 text-slate-600 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer"
            >
              <Download size={15} /> Descargar Informe PDF
            </button>
          </div>
        </div>

        {/* Columna derecha: Evolución y sesiones */}
        <div className="lg:col-span-2 space-y-6">
          {/* Gráfico de evolución */}
          {chartData.length > 0 && (
            <Card className="p-6">
              <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                <TrendingUp size={14} className="text-emerald-500" /> Evolución de Rendimiento
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5FB" />
                    <XAxis
                      dataKey="sesion"
                      tick={{ fontSize: 11, fill: "#94A3B8" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="left"
                      tick={{ fontSize: 11, fill: "#94A3B8" }}
                      axisLine={false}
                      tickLine={false}
                      width={50}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 11, fill: "#94A3B8" }}
                      axisLine={false}
                      tickLine={false}
                      width={50}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "8px",
                        border: "1px solid #E2E8F0",
                        fontSize: "12px",
                      }}
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="puntuacion"
                      stroke="#3B82F6"
                      strokeWidth={2.5}
                      dot={{ fill: "#3B82F6", r: 4 }}
                      name="Puntuación"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="precision"
                      stroke="#10B981"
                      strokeWidth={2.5}
                      dot={{ fill: "#10B981", r: 4 }}
                      name="Precisión %"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {/* Lista de sesiones */}
          <Card className="p-6">
            <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
              <Clock size={14} className="text-violet-500" /> Historial de Sesiones ({patientSessions.length})
            </h3>
            {patientSessions.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-slate-400 mb-4">Este paciente no tiene sesiones registradas aún</p>
                <button
                  onClick={() => onStartSession(patient)}
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer"
                >
                  <PlayCircle size={14} /> Iniciar Primera Sesión
                </button>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {patientSessions
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map(session => {
                    const game = MINIGAMES.find(g => g.id === session.game);
                    return (
                      <div
                        key={session.id}
                        className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        onClick={() => onViewSessionDetail(session)}
                      >
                        <div className={cx("w-10 h-10 rounded-lg flex items-center justify-center", game?.iconBg || "bg-slate-200")}>
                          {game ? <game.Icon size={18} className={game.iconColor} /> : <Activity size={18} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-semibold text-slate-700">{game?.name || session.game}</span>
                            {session.completed && (
                              <CheckCircle size={12} className="text-emerald-500" />
                            )}
                          </div>
                          <p className="text-xs text-slate-400">{formatDate(session.date)} · {session.duration} min</p>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-blue-600 font-mono">{session.score || 0}</div>
                          <div className="text-xs text-slate-400">{session.accuracy || 0}%</div>
                        </div>
                        <Eye size={14} className="text-slate-400" />
                      </div>
                    );
                  })}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Confirm Delete Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={20} className="text-rose-500" />
            </div>
            <h3 className="text-base font-bold text-slate-800 text-center mb-2">
              ¿Eliminar paciente?
            </h3>
            <p className="text-sm text-slate-500 text-center mb-6">
              Se eliminarán también todas sus {stats.total} sesiones. Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm font-bold cursor-pointer transition-all"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
