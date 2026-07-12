import { X } from "lucide-react";
import { Modal } from "../shared";
import { getGameInfo } from "../../config/gameConfig";

interface GameDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameId: string | null;
}

export function GameDetailModal({ isOpen, onClose, gameId }: GameDetailModalProps) {
  if (!gameId) return null;

  const game = getGameInfo(gameId);
  if (!game) return null;

  const Icon = game.Icon;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={game.name} size="large">
      <div className="space-y-6">
        {/* Header */}
        <div className={`p-6 rounded-lg ${game.bg}`}>
          <div className="flex items-center gap-4 mb-4">
            <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${game.iconBg}`}>
              <Icon className={`w-8 h-8 ${game.iconColor}`} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-xl">{game.name}</h3>
              <p className="text-sm text-slate-600">{game.area}</p>
            </div>
          </div>
          <p className="text-slate-700">{game.description}</p>
        </div>

        {/* Description from config if available */}
        {game.fullDescription && (
          <div>
            <h4 className="font-semibold text-slate-900 mb-2">Descripción Clínica</h4>
            <p className="text-slate-700 leading-relaxed">{game.fullDescription}</p>
          </div>
        )}

        {/* Therapeutic Benefits */}
        {game.benefits && game.benefits.length > 0 && (
          <div>
            <h4 className="font-semibold text-slate-900 mb-3">Beneficios Terapéuticos</h4>
            <ul className="space-y-2">
              {game.benefits.map((benefit, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-emerald-600 mt-1">✓</span>
                  <span className="text-slate-700">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Target Muscles */}
        {game.muscles && game.muscles.length > 0 && (
          <div>
            <h4 className="font-semibold text-slate-900 mb-3">Musculatura Implicada</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {game.muscles.map((muscle, idx) => (
                <div key={idx} className="p-3 bg-slate-50 rounded-lg">
                  <p className="font-medium text-slate-900 text-sm">{muscle.name}</p>
                  <p className="text-xs text-slate-600 mt-1">{muscle.description}</p>
                  {muscle.activation && (
                    <div className="mt-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-200 rounded-full h-1.5">
                          <div
                            className="bg-blue-600 h-1.5 rounded-full"
                            style={{ width: `${muscle.activation}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-slate-700">{muscle.activation}%</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Primary Movements */}
        {game.movements && game.movements.length > 0 && (
          <div>
            <h4 className="font-semibold text-slate-900 mb-3">Movimientos Principales</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {game.movements.map((movement, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg">
                  <span className="text-blue-600">→</span>
                  <span className="text-sm text-slate-700">{movement}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Contraindications */}
        {game.contraindications && game.contraindications.length > 0 && (
          <div className="p-4 bg-red-50 rounded-lg border border-red-100">
            <h4 className="font-semibold text-red-900 mb-3">⚠️ Contraindicaciones</h4>
            <ul className="space-y-2">
              {game.contraindications.map((contra, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-red-600 mt-1">•</span>
                  <span className="text-red-800 text-sm">{contra}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Clinical Notes */}
        {game.clinicalNotes && (
          <div className="p-4 bg-amber-50 rounded-lg border border-amber-100">
            <h4 className="font-semibold text-amber-900 mb-2">📋 Notas Clínicas</h4>
            <p className="text-sm text-amber-900 leading-relaxed whitespace-pre-line">{game.clinicalNotes}</p>
          </div>
        )}

        {/* Close Button */}
        <div className="pt-4 border-t border-slate-200">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors font-medium"
          >
            Cerrar
          </button>
        </div>
      </div>
    </Modal>
  );
}
