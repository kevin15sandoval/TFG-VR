import { useState, useMemo } from "react";
import { Headset, Loader2, CheckCircle, X } from "lucide-react";
import type { Patient, SessionConfig } from "../../types";
import { Card, Badge } from "../shared";
import { SIDES, DIFFICULTIES, DURATIONS, SESSION_TYPES } from "../../constants";
import { MINIGAMES } from "../../config/gameConfig";
import { publishActiveSession } from "../../db";
import { cx } from "../../utils/helpers";

interface SessionsScreenProps {
  patients: Patient[];
}

export function SessionsScreen({ patients }: SessionsScreenProps) {
  const [selectedPatient, setSelectedPatient] = useState<string>("");
  const [selectedGame, setSelectedGame] = useState<string>("");
  const [side, setSide] = useState<string>("Ambos");
  const [difficulty, setDifficulty] = useState<string>("Media");
  const [duration, setDuration] = useState<number>(5);
  const [sessionType, setSessionType] = useState<string>("Alcance");
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);

  const selectedPatientData = useMemo(
    () => patients.find(p => p.id.toString() === selectedPatient),
    [patients, selectedPatient]
  );

  const selectedGameData = useMemo(
    () => MINIGAMES.find(g => g.id === selectedGame),
    [selectedGame]
  );

  const handlePublish = async () => {
    if (!selectedPatient || !selectedGame) return;

    const patient = patients.find(p => p.id.toString() === selectedPatient);
    if (!patient) return;

    const config: SessionConfig = {
      patient_id: selectedPatient,
      patient_name: patient.name,
      game_id: selectedGame,
      duration: duration * 60, // Convert to seconds
      difficulty,
      therapy_side: side,
      session_type: sessionType,
      timestamp: Date.now(),
    };

    setIsPublishing(true);
    try {
      await publishActiveSession(config);
      setPublishSuccess(true);
      setTimeout(() => {
        setPublishSuccess(false);
        // Reset form
        setSelectedPatient("");
        setSelectedGame("");
        setSide("Ambos");
        setDifficulty("Media");
        setDuration(5);
        setSessionType("Alcance");
      }, 2000);
    } catch (error) {
      console.error("Error publicando sesión:", error);
    } finally {
      setIsPublishing(false);
    }
  };

  const isFormValid = selectedPatient && selectedGame;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Nueva Sesión VR</h1>
        <p className="text-slate-600 mt-1">Configura y envía una sesión al dispositivo VR</p>
      </div>

      {publishSuccess && (
        <Card className="p-4 bg-emerald-50 border-emerald-200">
          <div className="flex items-center gap-3 text-emerald-700">
            <CheckCircle className="w-5 h-5" />
            <p className="font-medium">¡Sesión publicada! El dispositivo VR la detectará automáticamente.</p>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Patient Selection */}
          <Card className="p-6">
            <h3 className="font-semibold text-slate-900 mb-4">1. Seleccionar Paciente</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {patients.filter(p => p.status === "activo").map((patient) => (
                <button
                  key={patient.id}
                  onClick={() => setSelectedPatient(patient.id.toString())}
                  className={cx(
                    "p-4 rounded-lg border-2 transition-all text-left",
                    selectedPatient === patient.id.toString()
                      ? "border-blue-600 bg-blue-50"
                      : "border-slate-200 hover:border-slate-300"
                  )}
                >
                  <p className="font-medium text-slate-900">{patient.name}</p>
                  <p className="text-sm text-slate-600 mt-1">{patient.diagnosis}</p>
                  <p className="text-xs text-slate-500 mt-1">Lado: {patient.affectedSide}</p>
                </button>
              ))}
            </div>
          </Card>

          {/* Game Selection */}
          <Card className="p-6">
            <h3 className="font-semibold text-slate-900 mb-4">2. Seleccionar Juego</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {MINIGAMES.map((game) => {
                const Icon = game.Icon;
                return (
                  <button
                    key={game.id}
                    onClick={() => setSelectedGame(game.id)}
                    className={cx(
                      "p-4 rounded-lg border-2 transition-all text-left",
                      selectedGame === game.id
                        ? "border-blue-600 bg-blue-50"
                        : "border-slate-200 hover:border-slate-300"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cx("w-10 h-10 rounded-lg flex items-center justify-center", game.iconBg)}>
                        <Icon className={cx("w-5 h-5", game.iconColor)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900">{game.name}</p>
                        <p className="text-xs text-slate-600 mt-1">{game.area}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Parameters */}
          <Card className="p-6">
            <h3 className="font-semibold text-slate-900 mb-4">3. Parámetros de Sesión</h3>
            <div className="space-y-4">
              {/* Side */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Lado de trabajo
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {SIDES.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSide(s)}
                      className={cx(
                        "px-4 py-2 rounded-lg font-medium transition-colors",
                        side === s
                          ? "bg-blue-600 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Difficulty */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Dificultad
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {DIFFICULTIES.map((d) => (
                    <button
                      key={d}
                      onClick={() => setDifficulty(d)}
                      className={cx(
                        "px-4 py-2 rounded-lg font-medium transition-colors",
                        difficulty === d
                          ? "bg-blue-600 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      )}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Duración (minutos)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {DURATIONS.map((d) => (
                    <button
                      key={d}
                      onClick={() => setDuration(d)}
                      className={cx(
                        "px-4 py-2 rounded-lg font-medium transition-colors",
                        duration === d
                          ? "bg-blue-600 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      )}
                    >
                      {d}m
                    </button>
                  ))}
                </div>
              </div>

              {/* Session Type */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Tipo de sesión
                </label>
                <select
                  value={sessionType}
                  onChange={(e) => setSessionType(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {SESSION_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Card>
        </div>

        {/* Summary Panel */}
        <div className="space-y-6">
          <Card className="p-6 sticky top-6">
            <h3 className="font-semibold text-slate-900 mb-4">Resumen</h3>
            
            {selectedPatientData ? (
              <div className="space-y-3 mb-6">
                <div>
                  <p className="text-xs text-slate-600">Paciente</p>
                  <p className="font-medium text-slate-900">{selectedPatientData.name}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-600">Diagnóstico</p>
                  <p className="text-sm text-slate-700">{selectedPatientData.diagnosis}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500 mb-6">Selecciona un paciente</p>
            )}

            {selectedGameData ? (
              <div className="space-y-3 mb-6 pb-6 border-b border-slate-200">
                <div>
                  <p className="text-xs text-slate-600">Juego</p>
                  <p className="font-medium text-slate-900">{selectedGameData.name}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-600">Área terapéutica</p>
                  <p className="text-sm text-slate-700">{selectedGameData.area}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500 mb-6 pb-6 border-b border-slate-200">
                Selecciona un juego
              </p>
            )}

            <div className="space-y-2 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Lado</span>
                <span className="font-medium text-slate-900">{side}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Dificultad</span>
                <Badge variant={
                  difficulty === "Fácil" ? "success" :
                  difficulty === "Media" ? "warning" : "danger"
                }>
                  {difficulty}
                </Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Duración</span>
                <span className="font-medium text-slate-900">{duration} minutos</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Tipo</span>
                <span className="font-medium text-slate-900">{sessionType}</span>
              </div>
            </div>

            <button
              onClick={handlePublish}
              disabled={!isFormValid || isPublishing}
              className={cx(
                "w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors",
                isFormValid && !isPublishing
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
              )}
            >
              {isPublishing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Publicando...
                </>
              ) : (
                <>
                  <Headset className="w-5 h-5" />
                  Enviar a VR
                </>
              )}
            </button>

            <p className="text-xs text-slate-500 mt-3 text-center">
              La sesión aparecerá automáticamente en el dispositivo VR
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
