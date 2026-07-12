import { useState, useMemo } from "react";
import { Download, Filter, Calendar, Trophy, Award, Activity, TrendingUp } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import type { Patient, SessionRecord } from "../types";
import { Card, Badge, ProgressBar, AvatarIcon } from "../components/shared";
import { cx } from "../utils/helpers";
import { Paginacion, usePagination } from "../App";

interface HistoryPageProps {
  patients: Patient[];
  sessions: SessionRecord[];
}

export function HistoryPage({ patients, sessions }: HistoryPageProps) {
  const [activePatientId, setActivePatientId] = useState(patients[0]?.id ?? 1);
  const [filterDate, setFilterDate] = useState("all");

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

  // Generar datos del gráfico dinámicamente desde las sesiones reales
  const chartData = useMemo(() => {
    return patientSessions
      .slice()
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((s, i) => ({
        s: `S${i + 1}`,
        score: s.score,
        precision: s.accuracy,
      }));
  }, [patientSessions]);

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
