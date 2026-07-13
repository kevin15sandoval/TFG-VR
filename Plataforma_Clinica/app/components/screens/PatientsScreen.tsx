import { useState, useMemo } from "react";
import { Plus, Search, Eye, Pencil, Trash2, TrendingUp } from "lucide-react";
import type { Patient } from "../../types";
import { Card, Badge, AvatarIcon } from "../shared";
import { cx, getInitials } from "../../utils/helpers";
import { AVATAR_COLORS } from "../../constants";
import { usePagination } from "../../hooks/usePagination";

interface PatientsScreenProps {
  patients: Patient[];
  onAddPatient: () => void;
  onEditPatient: (patient: Patient) => void;
  onDeletePatient: (patient: Patient) => void;
  onViewHistory: (patient: Patient) => void;
}

export function PatientsScreen({
  patients,
  onAddPatient,
  onEditPatient,
  onDeletePatient,
  onViewHistory,
}: PatientsScreenProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "activo" | "inactivo">("all");

  const filteredPatients = useMemo(() => {
    return patients.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "all" || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [patients, searchTerm, statusFilter]);

  const { currentItems: paginatedPatients, ...pagination } = usePagination(filteredPatients, 10);

  const stats = useMemo(() => ({
    total: patients.length,
    active: patients.filter(p => p.status === "activo").length,
    inactive: patients.filter(p => p.status === "inactivo").length,
  }), [patients]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pacientes</h1>
          <p className="text-slate-600 mt-1">Gestión de pacientes en rehabilitación</p>
        </div>
        <button
          onClick={onAddPatient}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 font-medium"
        >
          <Plus className="w-5 h-5" />
          Nuevo Paciente
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Total</p>
              <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <span className="text-xl">👥</span>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Activos</p>
              <p className="text-2xl font-bold text-emerald-600">{stats.active}</p>
            </div>
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
              <span className="text-xl">✅</span>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Inactivos</p>
              <p className="text-2xl font-bold text-slate-500">{stats.inactive}</p>
            </div>
            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
              <span className="text-xl">⏸️</span>
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
              placeholder="Buscar paciente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setStatusFilter("all")}
              className={cx(
                "px-4 py-2 rounded-lg font-medium transition-colors",
                statusFilter === "all"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              Todos
            </button>
            <button
              onClick={() => setStatusFilter("activo")}
              className={cx(
                "px-4 py-2 rounded-lg font-medium transition-colors",
                statusFilter === "activo"
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              Activos
            </button>
            <button
              onClick={() => setStatusFilter("inactivo")}
              className={cx(
                "px-4 py-2 rounded-lg font-medium transition-colors",
                statusFilter === "inactivo"
                  ? "bg-slate-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              Inactivos
            </button>
          </div>
        </div>
      </Card>

      {/* Patients Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Paciente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Edad
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Lado Afectado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Diagnóstico
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Sesiones
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Progreso
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {paginatedPatients.map((patient) => {
                const bgColor = AVATAR_COLORS[patient.colorIdx]?.bg || "bg-slate-100";
                const textColor = AVATAR_COLORS[patient.colorIdx]?.text || "text-slate-700";

                return (
                  <tr key={patient.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className={cx("w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm", bgColor, textColor)}>
                          {patient.initials}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{patient.name}</p>
                          <p className="text-sm text-slate-500">{patient.lastSession}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {patient.age} años
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {patient.affectedSide}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {patient.diagnosis}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {patient.sessions}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-100 rounded-full h-2 w-24">
                          <div
                            className={cx(
                              "h-2 rounded-full transition-all",
                              patient.progress >= 70 ? "bg-emerald-500" :
                              patient.progress >= 40 ? "bg-amber-500" :
                              "bg-red-500"
                            )}
                            style={{ width: `${patient.progress}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-slate-700 w-10 text-right">
                          {patient.progress}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant={patient.status === "activo" ? "success" : "secondary"}>
                        {patient.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onViewHistory(patient)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Ver historial"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onEditPatient(patient)}
                          className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDeletePatient(patient)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600">
                Mostrando {pagination.startIndex + 1} a {Math.min(pagination.endIndex, filteredPatients.length)} de {filteredPatients.length} pacientes
              </p>
              <div className="flex gap-2">
                <button
                  onClick={pagination.prevPage}
                  disabled={pagination.currentPage === 1}
                  className="px-3 py-1 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Anterior
                </button>
                <button
                  onClick={pagination.nextPage}
                  disabled={pagination.currentPage === pagination.totalPages}
                  className="px-3 py-1 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Siguiente
                </button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {filteredPatients.length === 0 && (
        <Card className="p-12 text-center">
          <p className="text-slate-600">No se encontraron pacientes</p>
        </Card>
      )}
    </div>
  );
}
