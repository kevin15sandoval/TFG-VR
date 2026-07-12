import { useState } from "react";
import { Plus, Eye, CheckCircle, Headset } from "lucide-react";
import { Card, Badge } from "../components/shared";
import { cx } from "../utils/helpers";
import { MINIGAMES } from "../config/gameConfig";
import { GAME_SPECIFICATIONS } from "../App";

interface MinigamesPageProps {
  onStartSession: (gameId: string) => void;
  onViewSpec: (gameId: string) => void;
}

export function MinigamesPage({ onStartSession, onViewSpec }: MinigamesPageProps) {
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
        {MINIGAMES.map(g => {
          const hasSpec = GAME_SPECIFICATIONS[g.id];
          return (
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
                <div className="flex gap-2">
                  <button onClick={() => setSelected(g.id === selected ? null : g.id)}
                    className={cx("flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer", 
                      selected === g.id ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600")}>
                    {selected === g.id ? "✓ Seleccionado" : "Seleccionar"}
                  </button>
                  {hasSpec && (
                    <button 
                      onClick={() => onViewSpec(g.id)}
                      className="px-3 py-2.5 rounded-lg text-sm font-semibold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer transition-all"
                      title="Ver especificaciones clínicas"
                    >
                      <Eye size={16} />
                    </button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
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
