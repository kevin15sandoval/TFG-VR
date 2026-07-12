import { AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { CheckCircle, Gem, BarChart3, Timer, Crosshair, Hand, Zap, Target, Award, TrendingUp, RotateCcw, Download } from "lucide-react";
import type { Patient, SessionConfig } from "../types";
import { Card } from "../components/shared";
import { cx } from "../utils/helpers";
import { MINIGAMES } from "../config/gameConfig";

const HISTORY_DATA: Record<number, Array<{ s: string; score: number }>> = {
  1: [{ s: "S1", score: 6200 }, { s: "S2", score: 6800 }, { s: "S3", score: 7400 }, { s: "S4", score: 7900 }],
};

interface ResultsPageProps {
  config: SessionConfig;
  patients: Patient[];
  onNewSession: () => void;
  onSave: () => void;
}

export function ResultsPage({ config, patients, onNewSession, onSave }: ResultsPageProps) {
  const patient = patients.find(p => p.id === config.patientId) ?? patients[0];
  const game = MINIGAMES.find(g => g.id === config.selectedGame) ?? MINIGAMES[0];
  const historyData = HISTORY_DATA[Number(patient?.id) ?? 1] ?? [];
  
  const baseScore = config.difficulty === "Fácil" ? 3500 : 6000;
  const score = baseScore + Math.floor(config.duration * 120);
  const accuracy = config.difficulty === "Fácil" ? 75 : 82;
  const chartData = [...historyData.slice(-4), { s: "Hoy", score }];

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <div className="mb-7 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle size={18} className="text-emerald-500" />
            <span className="text-sm font-semibold text-emerald-600 uppercase tracking-wide">Sesión completada</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Resultados de sesión</h1>
          <p className="text-slate-500 text-sm mt-0.5">{patient?.name ?? "—"} · {game?.name ?? "—"} · {config.duration} min</p>
        </div>
        <div className="text-right">
          <div className="text-4xl font-black text-slate-800 font-mono">{score.toLocaleString()}</div>
          <div className="text-xs text-slate-400 font-medium uppercase tracking-wide">Puntuación final</div>
        </div>
      </div>
      <Card className="p-5 mb-6">
        <h2 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
          <TrendingUp size={15} className="text-emerald-500" /> Evolución
        </h2>
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
              <Tooltip />
              <Area type="monotone" dataKey="score" stroke="#3B82F6" strokeWidth={2.5} fill="url(#sg)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <div className="flex items-center gap-3 justify-end">
        <button onClick={onNewSession} className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer">
          <RotateCcw size={14} /> Nueva sesión
        </button>
        <button onClick={onSave} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-emerald-200 transition-all cursor-pointer">
          <Download size={15} /> Guardar sesión
        </button>
      </div>
    </div>
  );
}
