import { useState } from "react";
import { Search, Eye } from "lucide-react";
import { MINIGAMES } from "../../config/gameConfig";
import { Card, Badge } from "../shared";
import { cx } from "../../utils/helpers";

interface GamesScreenProps {
  onViewGameDetails: (gameId: string) => void;
}

export function GamesScreen({ onViewGameDetails }: GamesScreenProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all");

  const filteredGames = MINIGAMES.filter(game => {
    const matchesSearch = game.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         game.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDifficulty = difficultyFilter === "all" || game.difficulty === difficultyFilter;
    return matchesSearch && matchesDifficulty;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Catálogo de Juegos</h1>
        <p className="text-slate-600 mt-1">Explora los minijuegos terapéuticos disponibles</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Total Juegos</p>
              <p className="text-2xl font-bold text-slate-900">{MINIGAMES.length}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <span className="text-xl">🎮</span>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Fáciles</p>
              <p className="text-2xl font-bold text-emerald-600">
                {MINIGAMES.filter(g => g.difficulty === "Fácil").length}
              </p>
            </div>
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
              <span className="text-xl">😊</span>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Medios</p>
              <p className="text-2xl font-bold text-amber-600">
                {MINIGAMES.filter(g => g.difficulty === "Media").length}
              </p>
            </div>
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
              <span className="text-xl">🎯</span>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Difíciles</p>
              <p className="text-2xl font-bold text-red-600">
                {MINIGAMES.filter(g => g.difficulty === "Difícil").length}
              </p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
              <span className="text-xl">🔥</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar juego..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setDifficultyFilter("all")}
              className={cx(
                "px-4 py-2 rounded-lg font-medium transition-colors",
                difficultyFilter === "all"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              Todos
            </button>
            <button
              onClick={() => setDifficultyFilter("Fácil")}
              className={cx(
                "px-4 py-2 rounded-lg font-medium transition-colors",
                difficultyFilter === "Fácil"
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              Fácil
            </button>
            <button
              onClick={() => setDifficultyFilter("Media")}
              className={cx(
                "px-4 py-2 rounded-lg font-medium transition-colors",
                difficultyFilter === "Media"
                  ? "bg-amber-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              Media
            </button>
            <button
              onClick={() => setDifficultyFilter("Difícil")}
              className={cx(
                "px-4 py-2 rounded-lg font-medium transition-colors",
                difficultyFilter === "Difícil"
                  ? "bg-red-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              Difícil
            </button>
          </div>
        </div>
      </Card>

      {/* Games Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredGames.map((game) => {
          const Icon = game.Icon;
          return (
            <Card key={game.id} className={cx("overflow-hidden hover:shadow-lg transition-shadow", game.border)}>
              <div className={cx("p-6", game.bg)}>
                <div className="flex items-start justify-between mb-4">
                  <div className={cx("w-14 h-14 rounded-xl flex items-center justify-center", game.iconBg)}>
                    <Icon className={cx("w-7 h-7", game.iconColor)} />
                  </div>
                  <Badge variant={
                    game.difficulty === "Fácil" ? "success" :
                    game.difficulty === "Media" ? "warning" : "danger"
                  }>
                    {game.difficulty}
                  </Badge>
                </div>
                <h3 className="font-bold text-slate-900 text-lg mb-2">{game.name}</h3>
                <p className="text-sm text-slate-600 mb-4">{game.description}</p>
                <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
                  <span className="px-2 py-1 bg-white rounded-md">
                    {game.area}
                  </span>
                </div>
              </div>
              <div className="p-4 bg-white border-t border-slate-100">
                <button
                  onClick={() => onViewGameDetails(game.id)}
                  className="w-full py-2 px-4 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 font-medium"
                >
                  <Eye className="w-4 h-4" />
                  Ver Detalles
                </button>
              </div>
            </Card>
          );
        })}
      </div>

      {filteredGames.length === 0 && (
        <Card className="p-12 text-center">
          <p className="text-slate-600">No se encontraron juegos</p>
        </Card>
      )}
    </div>
  );
}
