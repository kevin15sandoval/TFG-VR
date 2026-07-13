import { useState, useEffect } from "react";
import { ArrowLeft, Headset, Activity, X, Loader2, RotateCcw, ArrowRight } from "lucide-react";
import { collection, query, where, limit, onSnapshot } from "firebase/firestore";
import type { Patient, SessionConfig } from "../types";
import { Card, Badge, AvatarIcon } from "../components/shared";
import { cx } from "../utils/helpers";
import { MINIGAMES } from "../config/gameConfig";
import { publishActiveSession, db } from "../db";

interface ConnectDevicePageProps {
  config: SessionConfig;
  patients: Patient[];
  onSessionSent: (sessionId: string) => void;
  onBack: () => void;
}

export function ConnectDevicePage({ config, patients, onSessionSent, onBack }: ConnectDevicePageProps) {
  const [status, setStatus] = useState<"idle" | "sending" | "ready" | "playing" | "error">("idle");
  const [currentSessionId, setCurrentSessionId] = useState<string>("");
  const patient = patients.find(p => p.id === config.patientId);
  const game = MINIGAMES.find(g => g.id === config.selectedGame);

  // Escuchar cuando VR guarde los resultados en Firestore
  useEffect(() => {
    if (!currentSessionId) return;
    
    console.log("[Web] 👀 Escuchando resultados de sesión:", currentSessionId);
    
    const q = query(
      collection(db, "sesiones"),
      where("sessionId", "==", currentSessionId),
      limit(1)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const sessionData = snapshot.docs[0].data();
        console.log("[Web] ✅ Resultados detectados desde VR:", sessionData);
        setStatus("playing");
        setTimeout(() => {
          onSessionSent(currentSessionId);
        }, 1000);
      }
    });
    
    return () => {
      console.log("[Web] 🔌 Desconectando listener de resultados");
      unsubscribe();
    };
  }, [currentSessionId, onSessionSent]);

  async function handleSend() {
    if (!patient) return;
    setStatus("sending");
    const sessionId = `session_${Date.now()}`;
    setCurrentSessionId(sessionId);
    try {
      await publishActiveSession(config, patient, sessionId);
      setStatus("ready");
      console.log("[Web] 📤 Sesión enviada con ID:", sessionId);
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={onBack} className="w-9 h-9 rounded-xl border border-slate-200 hover:bg-slate-50 flex items-center justify-center cursor-pointer transition-colors text-slate-500">
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Iniciar sesión en Meta Quest 3</h1>
          <p className="text-slate-500 text-sm">Envía la sesión a las gafas para comenzar</p>
        </div>
      </div>

      {patient && game && (
        <Card className="p-5 mb-6">
          <div className="flex items-center gap-4 flex-wrap">
            <AvatarIcon initials={patient.initials} colorIdx={patient.colorIdx} />
            <div className="flex-1">
              <div className="font-bold text-slate-800 text-sm">{patient.name}</div>
              <div className="text-xs text-slate-400">{patient.diagnosis}</div>
            </div>
            <div className={cx("flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold", game.bg, game.border)}>
              <game.Icon size={13} className={game.iconColor} /> {game.name}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Badge color="blue">{config.duration} min</Badge>
              <Badge color="amber">{config.difficulty}</Badge>
              <Badge color={config.therapySide === "Izquierdo" ? "blue" : config.therapySide === "Derecho" ? "purple" : "amber"}>{config.therapySide}</Badge>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-8 text-center mb-6">
        {status === "idle" && (
          <div className="py-2">
            <div className="w-20 h-20 rounded-2xl bg-violet-100 flex items-center justify-center mx-auto mb-4">
              <Headset size={36} className="text-violet-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Listo para enviar</h3>
            <p className="text-sm text-slate-500 mb-1">Asegúrate de que las gafas están encendidas</p>
            <p className="text-xs text-slate-400">y la app NeuroVR Rehab está abierta</p>
          </div>
        )}
        {status === "sending" && (
          <div className="py-4">
            <Loader2 size={36} className="animate-spin text-blue-500 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-600">Enviando sesión a las gafas...</p>
          </div>
        )}
        {status === "ready" && (
          <div className="py-2">
            <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
              <Activity size={36} className="text-blue-600 animate-pulse" />
            </div>
            <h3 className="text-lg font-bold text-blue-700 mb-2">El paciente está jugando</h3>
            <p className="text-sm text-slate-500">Esperando resultados de la sesión...</p>
          </div>
        )}
        {status === "playing" && (
          <div className="py-2">
            <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
              <Loader2 size={36} className="text-blue-600 animate-spin" />
            </div>
            <h3 className="text-lg font-bold text-blue-700 mb-2">¡Sesión completada!</h3>
            <p className="text-sm text-slate-500">Cargando resultados...</p>
          </div>
        )}
        {status === "error" && (
          <div className="py-4">
            <X size={36} className="text-rose-500 mx-auto mb-3" />
            <p className="text-sm font-semibold text-rose-600">Error al enviar la sesión</p>
          </div>
        )}
      </Card>

      <Card className="p-5 mb-6">
        <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
          <Headset size={15} className="text-violet-500" /> Pasos para iniciar
        </h3>
        <div className="space-y-2">
          {[
            "1. Enciende las gafas Meta Quest 3",
            "2. Abre la app NeuroVR Rehab en las gafas",
            "3. Pulsa el botón de abajo para enviar la sesión",
            "4. El juego arrancará automáticamente en las gafas",
            "5. Los resultados aparecerán aquí cuando el paciente termine",
          ].map(step => (
            <div key={step} className="flex items-center gap-2 text-xs text-slate-600">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
              {step}
            </div>
          ))}
        </div>
      </Card>

      {status === "idle" && (
        <button onClick={handleSend}
          className="w-full py-4 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-300/40 transition-all">
          <Headset size={18} /> Enviar sesión a las gafas <ArrowRight size={16} />
        </button>
      )}
      {status === "sending" && (
        <div className="w-full py-4 rounded-xl bg-blue-100 text-blue-600 text-sm font-semibold flex items-center justify-center gap-2">
          <Loader2 size={16} className="animate-spin" /> Enviando...
        </div>
      )}
      {status === "error" && (
        <button onClick={() => setStatus("idle")}
          className="w-full py-4 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-all">
          <RotateCcw size={16} /> Reintentar
        </button>
      )}
      {status === "ready" && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-700 font-semibold flex items-center gap-2">
          <Activity size={16} className="animate-pulse" /> El paciente está jugando — Los resultados aparecerán automáticamente
        </div>
      )}
      {status === "playing" && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700 font-semibold flex items-center gap-2">
          <Loader2 size={16} className="animate-spin" /> Cargando resultados...
        </div>
      )}
    </div>
  );
}
