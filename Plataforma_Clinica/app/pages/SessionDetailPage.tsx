import type { SessionRecord } from "../types";

interface SessionDetailPageProps {
  session: SessionRecord;
  onBack: () => void;
  onSaveNotes: (id: string, notes: string) => void;
}

export function SessionDetailPage({ session, onBack }: SessionDetailPageProps) {
  return (
    <div className="p-8 text-center">
      <h2 className="text-2xl font-bold text-slate-800 mb-4">Detalle de Sesión</h2>
      <p className="text-slate-500 mb-6">Esta función está en desarrollo. Usa la vista de Historial para ver los datos de las sesiones.</p>
      <button onClick={onBack} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
        Volver
      </button>
    </div>
  );
}
