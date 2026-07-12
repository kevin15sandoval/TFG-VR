import { useMemo, useState } from "react";
import { ArrowLeft, Download, Filter, Calendar, Trophy, Target, TrendingUp } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { Patient, SessionRecord } from "../../types";
import { Card, Badge } from "../shared";
import { formatDate, cx } from "../../utils/helpers";
import { usePagination } from "../../hooks/usePagination";
import { generatePatientReport } from "../../pdfReport";

interface HistoryScreenProps {
  patient: Patient | null;
  sessions: SessionRecord[];
  onBack: () => void;
}

export function HistoryScreen({ patient, sessions, onBack }: HistoryScreenProps) {
  const [dateFilter, setDateFilter] = useState<"all" | "week" | "month">("all");

  const patientSessions = useMemo(() => {
    if (!patient) return [];
    
    let filtered = sessions.filter(s => s.patientId === patient.id);
    
    if (dateFilter !== "all") {
      const now = new Date();
      const daysAgo = dateFilter === "week" ? 7 : 30;
      filtered = filtered.filter(s => {
        const sessionDate = new Date(s.date);
        const diff = (now.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24);
        return diff <= daysAgo;
      });
    }
    
    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [patient, sessions, dateFilter]);

  const { currentItems: paginatedSessions, ...pagination } = usePagination(patientSessions, 10);

  const stats = useMemo(() => {
    if (!patientSessions.length) return null;
    
    return {
      totalSessions: patientSessions.length,
      avgScore: Math.round(patientSessions.reduce((sum, s) => sum + s.score, 0) / patientSessions.length),
      avgAccuracy: Math.round(patientSessions.reduce((sum, s) => sum + s.accuracy, 0) / patientSessions.length),
      totalDuration: patientSessions.reduce((sum, s) => sum + s.duration, 0),
      bestScore: Math.max(...patientSessions.map(s => s.score)),
      improvement: patientSessions.length >= 2
        ? ((patientSessions[0].score - patientSessions[patientSessions.length - 1].score) / patientSessions[patientSessions.length - 1].score * 100)
        : 0,
    };
  }, [patientSessions]);

  const chartData = useMemo(() => {
    return [...patientSessions]
      .reverse()
      .slice(-12)
      .map((s, idx) => ({
        session: `S${idx + 1}`,
        score: s.score,
        accuracy: s.accuracy,
      }));
  }, [patientSessions]);

  const handleDownloadReport = () => {
    if (patient && patientSessions.length > 0) {
      generatePatientReport(patient, patientSessions);
    }
  };

  if (!patient) {
    return (
      <Card className="p-12 text-center">
        <p className="text-slate-600">Selecciona un paciente para ver su historial</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{patient.name}</h1>
            <p className="text-slate-600 mt-1">{patient.diagnosis} · Lado {patient.affectedSide}</p>
          </div>
        </div>
        <button
          onClick={handleDownloadReport}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 font-medium"
        >
          <Download className="w-5 h-5" />
          Descargar Informe
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Total Sesiones</p>
                <p className="text-2xl font-bold text-slate-900 mt-2">{stats.totalSessions}</p>
                <p className="text-xs text-slate-500 mt-1">{stats.totalDuration} min total</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Puntuación Media</p>
                <p className="text-2xl font-bold text-slate-900 mt-2">{stats.avgScore}</p>
                <p className="text-xs text-slate-500 mt-1">Mejor: {stats.bestScore}</p>
              </div>
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                <Trophy className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Precisión Media</p>
                <p className="text-2xl font-bold text-slate-900 mt-2">{stats.avgAccuracy}%</p>
                <p className="text-xs text-slate-500 mt-1">en todas las sesiones</p>
              </div>
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                <Target className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Mejora</p>
                <p className={cx(
                  "text-2xl font-bold mt-2",
                  stats.improvement >= 0 ? "text-emerald-600" : "text-red-600"
                )}>
                  {stats.improvement >= 0 ? "+" : ""}{stats.improvement.toFixed(1)}%
                </p>
                <p className="text-xs text-slate-500 mt-1">respecto al inicio</p>
              </div>
              <div className="w-12 h-12 bg-violet-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-violet-600" />
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Chart */}
      {chartData.length > 0 && (
        <Card className="p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Evolución</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="session" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: "#3b82f6", r: 4 }}
                name="Puntuación"
              />
              <Line
                type="monotone"
                dataKey="accuracy"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ fill: "#10b981", r: 4 }}
                name="Precisión (%)"
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Filters */}
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <Filter className="w-5 h-5 text-slate-400" />
          <div className="flex gap-2">
            <button
              onClick={() => setDateFilter("all")}
              className={cx(
                "px-4 py-2 rounded-lg font-medium transition-colors",
                dateFilter === "all"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              Todas
            </button>
            <button
              onClick={() => setDateFilter("week")}
              className={cx(
                "px-4 py-2 rounded-lg font-medium transition-colors",
                dateFilter === "week"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              Última semana
            </button>
            <button
              onClick={() => setDateFilter("month")}
              className={cx(
                "px-4 py-2 rounded-lg font-medium transition-colors",
                dateFilter === "month"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              Último mes
            </button>
          </div>
        </div>
      </Card>

      {/* Sessions Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Fecha</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Juego</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Duración</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Puntuación</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Precisión</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Lado</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Dificultad</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {paginatedSessions.map((session) => (
                <tr key={session.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                    {formatDate(session.date)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 font-medium">
                    {session.game}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                    {session.duration} min
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-900">
                    {session.score}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                    {session.accuracy}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                    {session.side}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge variant={
                      session.difficulty === "Fácil" ? "success" :
                      session.difficulty === "Media" ? "warning" : "danger"
                    }>
                      {session.difficulty}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600">
                Mostrando {pagination.startIndex + 1} a {Math.min(pagination.endIndex, patientSessions.length)} de {patientSessions.length} sesiones
              </p>
              <div className="flex gap-2">
                <button
                  onClick={pagination.prevPage}
                  disabled={pagination.currentPage === 1}
                  className="px-3 py-1 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Anterior
                </button>
                <button
                  onClick={pagination.nextPage}
                  disabled={pagination.currentPage === pagination.totalPages}
                  className="px-3 py-1 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Siguiente
                </button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {patientSessions.length === 0 && (
        <Card className="p-12 text-center">
          <p className="text-slate-600">No hay sesiones registradas para este paciente</p>
        </Card>
      )}
    </div>
  );
}
