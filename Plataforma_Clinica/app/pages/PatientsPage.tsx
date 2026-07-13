import { useState, useMemo, useEffect } from "react";
import { Search, Users, Plus, Pencil, Trash2, PlayCircle, User } from "lucide-react";
import type { Patient } from "../types";
import { Card, Badge, ProgressBar, AvatarIcon } from "../components/shared";
import {
  Modal,
  PatientForm,
  ConfirmDialog,
  Paginacion,
  usePagination
} from "../App";

interface PatientsPageProps {
  patients: Patient[];
  onSelectPatient: (p: Patient) => void;
  onAdd: (p: Omit<Patient, "id" | "sessions" | "lastSession" | "progress">) => void;
  onEdit: (id: string, p: Omit<Patient, "id" | "sessions" | "lastSession" | "progress">) => void;
  onDelete: (id: string) => void;
  onViewProfile: (p: Patient) => void;
  initialEditTarget?: Patient | null;
  onEditComplete?: () => void;
}

export function PatientsPage({
  patients,
  onSelectPatient,
  onAdd,
  onEdit,
  onDelete,
  onViewProfile,
  initialEditTarget,
  onEditComplete,
}: PatientsPageProps) {
  const [query, setQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<Patient | null>(initialEditTarget || null);
  const [deleteTarget, setDeleteTarget] = useState<Patient | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "activo" | "inactivo">("all");

  // Si viene initialEditTarget, abrir el modal automáticamente
  useEffect(() => {
    if (initialEditTarget) {
      setEditTarget(initialEditTarget);
    }
  }, [initialEditTarget]);

  const usedColors = patients.map(p => p.colorIdx);

  const filtered = useMemo(() => patients.filter(p => {
    const matchQ = p.name.toLowerCase().includes(query.toLowerCase()) || p.diagnosis.toLowerCase().includes(query.toLowerCase());
    const matchS = filterStatus === "all" || p.status === filterStatus;
    return matchQ && matchS;
  }), [patients, query, filterStatus]);

  const pag = usePagination(filtered, 10);

  // Reset a página 1 cuando cambia el filtro
  useMemo(() => { pag.changePage(1); }, [query, filterStatus]); // eslint-disable-line

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Pacientes</h1>
          <p className="text-slate-500 text-sm mt-0.5">{patients.filter(p => p.status === "activo").length} activos · {patients.length} total</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-blue-200 transition-all cursor-pointer">
          <Plus size={15} /> Añadir paciente
        </button>
      </div>
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por nombre o diagnóstico..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as typeof filterStatus)}
          className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30 cursor-pointer">
          <option value="all">Todos</option><option value="activo">Activos</option><option value="inactivo">Inactivos</option>
        </select>
      </div>
      {filtered.length === 0 && (
        <div className="text-center py-16 text-slate-400"><Users size={36} className="mx-auto mb-3 opacity-30" /><p className="text-sm">No se encontraron pacientes</p></div>
      )}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {pag.paged.map(p => (
          <Card key={p.id} className="p-5 hover:shadow-md transition-shadow duration-200">
            <div className="flex items-start gap-3 mb-4 cursor-pointer" onClick={() => onViewProfile(p)}>
              <AvatarIcon initials={p.initials} colorIdx={p.colorIdx} size="lg" />
              <div className="flex-1 min-w-0">
                <div className="font-bold text-slate-800 text-sm leading-tight">{p.name}</div>
                <div className="text-xs text-slate-400 mt-0.5">{p.diagnosis}</div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <Badge color="gray">{p.age} años</Badge>
                  <Badge color={p.affectedSide === "Izquierdo" ? "blue" : p.affectedSide === "Derecho" ? "purple" : "amber"}>{p.affectedSide}</Badge>
                  <Badge color={p.status === "activo" ? "green" : "gray"}>{p.status}</Badge>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => setEditTarget(p)} className="w-7 h-7 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 flex items-center justify-center cursor-pointer transition-colors"><Pencil size={13} /></button>
                <button onClick={() => setDeleteTarget(p)} className="w-7 h-7 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-500 flex items-center justify-center cursor-pointer transition-colors"><Trash2 size={13} /></button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs mb-4">
              <div className="bg-slate-50 rounded-lg px-3 py-2"><div className="text-slate-400 mb-0.5">Última sesión</div><div className="font-semibold text-slate-700">{p.lastSession}</div></div>
              <div className="bg-slate-50 rounded-lg px-3 py-2"><div className="text-slate-400 mb-0.5">Sesiones totales</div><div className="font-semibold text-slate-700">{p.sessions}</div></div>
            </div>
            <div className="mb-4">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs text-slate-500 font-medium">Progreso rehabilitación</span>
                <span className="text-xs font-bold text-emerald-600">{p.progress}%</span>
              </div>
              <ProgressBar value={p.progress} colorClass={p.progress >= 70 ? "bg-emerald-500" : p.progress >= 40 ? "bg-amber-400" : "bg-rose-400"} />
            </div>
            <button onClick={() => onSelectPatient(p)} className="w-full py-2 bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white rounded-lg text-xs font-semibold transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer border border-blue-100 hover:border-blue-600">
              <PlayCircle size={13} /> Iniciar sesión
            </button>
            <button onClick={() => onViewProfile(p)} className="mt-2 w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer border border-slate-200">
              <User size={13} /> Ver perfil completo
            </button>
          </Card>
        ))}
      </div>

      {filtered.length > 0 && (
        <div className="mt-4 bg-white rounded-xl border border-slate-100 shadow-sm">
          <Paginacion {...pag} />
        </div>
      )}

      {showAdd && (
        <Modal title="Añadir nuevo paciente" onClose={() => setShowAdd(false)}>
          <PatientForm usedColorIdxs={usedColors} onSave={onAdd} onClose={() => setShowAdd(false)} />
        </Modal>
      )}
      {editTarget && (
        <Modal title="Editar paciente" onClose={() => { setEditTarget(null); onEditComplete?.(); }}>
          <PatientForm initial={editTarget} usedColorIdxs={usedColors} onSave={(data) => { onEdit(editTarget.id, data); setEditTarget(null); onEditComplete?.(); }} onClose={() => { setEditTarget(null); onEditComplete?.(); }} />
        </Modal>
      )}
      {deleteTarget && (
        <ConfirmDialog
          message={`¿Eliminar a ${deleteTarget.name}? Se eliminarán también todas sus sesiones.`}
          onConfirm={() => { onDelete(deleteTarget.id); setDeleteTarget(null); }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
