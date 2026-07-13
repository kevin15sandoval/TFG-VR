import { useState, useMemo } from "react";
import {
  Search, ArrowRight, ArrowLeft, CheckCircle, Calendar, Timer, Hand,
  Zap, Layers, Target, User, Headset
} from "lucide-react";
import type { Patient, SessionRecord, SessionConfig } from "../types";
import { Card, Badge, AvatarIcon } from "../components/shared";
import { cx } from "../utils/helpers";
import {
  MINIGAMES, GAME_CONFIG_FIELDS
} from "../config/gameConfig";
import {
  SIDES, DIFFICULTIES, HEIGHTS, SESSION_TYPES, DURATIONS
} from "../constants";
import {
  DEFAULT_CONFIG,
  StepIndicator,
  SectionLabel,
  OptionPill,
  Paginacion,
  usePagination
} from "../App";

interface NewSessionPageProps {
  patients: Patient[];
  sessions: SessionRecord[];
  initialPatient?: Patient | null;
  initialGame?: string;
  onLaunch: (config: SessionConfig) => void;
}

export function NewSessionPage({
  patients,
  sessions,
  initialPatient,
  initialGame,
  onLaunch,
}: NewSessionPageProps) {
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
            {(() => {
              // Obtener configuración del juego seleccionado
              const gameConfig = GAME_CONFIG_FIELDS[config.selectedGame] || GAME_CONFIG_FIELDS.default;
              
              // Construir array de fields según configuración del juego
              const fields = [];
              
              // Duración (siempre presente)
              if (gameConfig.duration) {
                fields.push({
                  key: "duration" as const,
                  label: "Duración",
                  Icon: Timer,
                  iconBg: "bg-blue-100",
                  iconColor: "text-blue-600",
                  options: DURATIONS.map(d => ({ val: d, label: `${d} min` })),
                });
              }
              
              // Lado a trabajar (solo si el juego lo requiere)
              if (gameConfig.therapySide) {
                fields.push({
                  key: "therapySide" as const,
                  label: "Lado a trabajar",
                  Icon: Hand,
                  iconBg: "bg-violet-100",
                  iconColor: "text-violet-600",
                  options: SIDES.map(s => ({ val: s, label: s })),
                });
              }
              
              // Dificultad (casi siempre presente)
              if (gameConfig.difficulty) {
                fields.push({
                  key: "difficulty" as const,
                  label: "Dificultad",
                  Icon: Zap,
                  iconBg: "bg-amber-100",
                  iconColor: "text-amber-600",
                  options: DIFFICULTIES.map(d => ({ val: d, label: d })),
                });
              }
              
              // Altura de objetivos (solo para juegos de alcance)
              if (gameConfig.heightMode) {
                fields.push({
                  key: "heightMode" as const,
                  label: "Altura de objetivos",
                  Icon: Layers,
                  iconBg: "bg-emerald-100",
                  iconColor: "text-emerald-600",
                  options: HEIGHTS.map(h => ({ val: h, label: h })),
                });
              }
              
              // Tipo de sesión (solo para juegos genéricos)
              if (gameConfig.sessionType) {
                fields.push({
                  key: "sessionType" as const,
                  label: "Tipo de sesión",
                  Icon: Target,
                  iconBg: "bg-rose-100",
                  iconColor: "text-rose-600",
                  options: SESSION_TYPES.map(t => ({ val: t, label: t })),
                });
              }
              
              return fields.map(({ key, label, Icon, iconBg, iconColor, options }) => (
                <Card key={key} className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className={cx("w-7 h-7 rounded-lg flex items-center justify-center", iconBg)}>
                      <Icon size={14} className={iconColor} />
                    </div>
                    <SectionLabel>{label}</SectionLabel>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {options.map(o => (
                      <OptionPill 
                        key={String(o.val)} 
                        label={o.label} 
                        selected={config[key] === o.val} 
                        onClick={() => set(key, o.val)} 
                      />
                    ))}
                  </div>
                </Card>
              ));
            })()}
            
            {/* Campos personalizados específicos del juego */}
            {(() => {
              const gameConfig = GAME_CONFIG_FIELDS[config.selectedGame];
              if (!gameConfig || !gameConfig.customFields) return null;
              
              return gameConfig.customFields.map(({ key, label, Icon, iconBg, iconColor, options }) => (
                <Card key={key} className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className={cx("w-7 h-7 rounded-lg flex items-center justify-center", iconBg)}>
                      <Icon size={14} className={iconColor} />
                    </div>
                    <SectionLabel>{label}</SectionLabel>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {options.map(o => (
                      <OptionPill 
                        key={o.val} 
                        label={o.label} 
                        selected={config[key] === o.val} 
                        onClick={() => set(key as any, o.val)} 
                      />
                    ))}
                  </div>
                </Card>
              ));
            })()}
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
                  {(() => {
                    const gameConfig = GAME_CONFIG_FIELDS[config.selectedGame] || GAME_CONFIG_FIELDS.default;
                    const summaryItems = [];
                    
                    // Agregar solo los campos relevantes al resumen
                    summaryItems.push(["Duración", `${config.duration} min`]);
                    if (gameConfig.therapySide) summaryItems.push(["Lado", config.therapySide]);
                    summaryItems.push(["Dificultad", config.difficulty]);
                    if (gameConfig.heightMode) summaryItems.push(["Altura", config.heightMode]);
                    if (gameConfig.sessionType) summaryItems.push(["Tipo", config.sessionType]);
                    
                    return summaryItems.map(([l, v]) => (
                      <div key={l} className="flex justify-between py-1.5 border-b border-slate-50 last:border-0">
                        <span className="text-slate-400">{l}</span><span className="font-bold text-slate-700">{v}</span>
                      </div>
                    ));
                  })()}
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
