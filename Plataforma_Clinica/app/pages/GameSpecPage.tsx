import {
  ArrowLeft, Activity, Layers, Move, CheckCircle, ChevronRight,
  Award, TrendingUp, Shield, X, Pencil,
} from "lucide-react";
import { Card } from "../components/shared";
import { cx } from "../utils/helpers";
import { MINIGAMES } from "../config/gameConfig";
import { GAME_SPECIFICATIONS } from "../App";

interface GameSpecPageProps {
  gameId: string;
  onBack: () => void;
}

export function GameSpecPage({ gameId, onBack }: GameSpecPageProps) {
  const spec = GAME_SPECIFICATIONS[gameId];
  const game = MINIGAMES.find(g => g.id === gameId);
  
  if (!spec || !game) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold text-slate-800 mb-4">Juego no encontrado</h2>
        <p className="text-slate-500 mb-6">No se encontraron especificaciones para este juego.</p>
        <button onClick={onBack} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          Volver
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-7">
        <button onClick={onBack} className="w-9 h-9 rounded-xl border border-slate-200 hover:bg-slate-50 flex items-center justify-center cursor-pointer transition-colors text-slate-500">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-800">Especificaciones Clínicas</h1>
          <p className="text-slate-500 text-sm">{spec.name} · {spec.description}</p>
        </div>
        <div className={cx("flex items-center gap-2 px-4 py-2 rounded-xl border-2", game.bg, game.border)}>
          <game.Icon size={18} className={game.iconColor} />
          <span className="text-sm font-bold text-slate-700">{game.name}</span>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Columna izquierda */}
        <div className="space-y-6">
          {/* Músculos trabajados */}
          <Card className="p-5">
            <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
              <Activity size={14} className="text-rose-500" /> Músculos Trabajados
            </h3>
            <div className="space-y-3">
              {spec.targetMuscles.map((muscle: any, idx: number) => (
                <div key={idx} className="bg-slate-50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-700">{muscle.name}</span>
                    <span className={cx("text-xs font-bold px-2 py-0.5 rounded-full", 
                      muscle.activation >= 80 ? "bg-emerald-100 text-emerald-700" :
                      muscle.activation >= 60 ? "bg-amber-100 text-amber-700" : "bg-slate-200 text-slate-600"
                    )}>
                      {muscle.activation}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden mb-1.5">
                    <div 
                      className={cx("h-full rounded-full",
                        muscle.activation >= 80 ? "bg-emerald-500" :
                        muscle.activation >= 60 ? "bg-amber-500" : "bg-slate-400"
                      )} 
                      style={{ width: `${muscle.activation}%` }} 
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight">{muscle.description}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Distribución de zonas */}
          <Card className="p-5">
            <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
              <Layers size={14} className="text-cyan-500" /> Distribución Típica de Zonas
            </h3>
            <div className="space-y-3">
              {spec.workZones.map((zone: any, idx: number) => {
                const colors: Record<string, string> = {
                  "Alto": "text-sky-600",
                  "Medio": "text-emerald-600",
                  "Lateral": "text-purple-600",
                  "Bajo": "text-amber-600",
                };
                return (
                  <div key={idx} className="bg-slate-50 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-700">{zone.zone}</span>
                      <span className={cx("text-lg font-black", colors[zone.zone])}>{zone.percentage}%</span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-relaxed">{zone.description}</p>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Columna central y derecha */}
        <div className="lg:col-span-2 space-y-6">
          {/* Movimientos */}
          <Card className="p-6">
            <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
              <Move size={14} className="text-blue-500" /> Movimientos Trabajados
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-semibold text-blue-600 mb-2 uppercase tracking-wide">Movimientos Primarios</h4>
                <ul className="space-y-1.5">
                  {spec.primaryMovements.map((mov: string, idx: number) => (
                    <li key={idx} className="text-sm text-slate-700 flex items-start gap-2">
                      <CheckCircle size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
                      <span>{mov}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-violet-600 mb-2 uppercase tracking-wide">Movimientos Secundarios</h4>
                <ul className="space-y-1.5">
                  {spec.secondaryMovements.map((mov: string, idx: number) => (
                    <li key={idx} className="text-sm text-slate-700 flex items-start gap-2">
                      <ChevronRight size={14} className="text-violet-500 mt-0.5 flex-shrink-0" />
                      <span>{mov}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>

          {/* Beneficios terapéuticos */}
          <Card className="p-6 bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-100">
            <h3 className="text-sm font-bold text-emerald-800 mb-3 flex items-center gap-2">
              <Award size={14} className="text-emerald-600" /> Beneficios Terapéuticos
            </h3>
            <ul className="grid md:grid-cols-2 gap-2">
              {spec.therapeuticBenefits.map((benefit: string, idx: number) => (
                <li key={idx} className="text-sm text-emerald-700 flex items-start gap-2">
                  <CheckCircle size={14} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </Card>

          {/* Criterios de progresión */}
          <Card className="p-6">
            <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
              <TrendingUp size={14} className="text-violet-500" /> Criterios de Progresión
            </h3>
            <div className="grid md:grid-cols-3 gap-4">
              {[
                { level: "Principiante", criteria: spec.progressionCriteria.beginner, color: "bg-green-50 border-green-200 text-green-700" },
                { level: "Intermedio", criteria: spec.progressionCriteria.intermediate, color: "bg-amber-50 border-amber-200 text-amber-700" },
                { level: "Avanzado", criteria: spec.progressionCriteria.advanced, color: "bg-rose-50 border-rose-200 text-rose-700" },
              ].map(({ level, criteria, color }, idx) => (
                <div key={idx} className={cx("rounded-xl p-4 border-2", color)}>
                  <h4 className="text-xs font-bold mb-2 uppercase tracking-wide">{level}</h4>
                  <p className="text-xs leading-relaxed">{criteria}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Contraindicaciones */}
          <Card className="p-6 bg-rose-50 border-rose-100">
            <h3 className="text-sm font-bold text-rose-800 mb-3 flex items-center gap-2">
              <Shield size={14} className="text-rose-600" /> Contraindicaciones y Precauciones
            </h3>
            <ul className="space-y-2">
              {spec.contraindications.map((contra: string, idx: number) => (
                <li key={idx} className="text-sm text-rose-700 flex items-start gap-2">
                  <X size={14} className="text-rose-600 mt-0.5 flex-shrink-0" />
                  <span>{contra}</span>
                </li>
              ))}
            </ul>
          </Card>

          {/* Notas clínicas */}
          <Card className="p-6">
            <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
              <Pencil size={14} className="text-blue-500" /> Notas Clínicas y Recomendaciones
            </h3>
            <div 
              className="clinical-notes text-sm text-slate-600 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: spec.clinicalNotes }}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
