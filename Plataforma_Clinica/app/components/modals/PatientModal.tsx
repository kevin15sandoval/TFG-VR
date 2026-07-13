import { useState, useEffect } from "react";
import { X, Save } from "lucide-react";
import type { Patient } from "../../types";
import { Modal, Badge } from "../shared";
import { SIDES, AVATAR_COLORS } from "../../constants";
import { addPatient, updatePatient } from "../../db";
import { cx, getInitials } from "../../utils/helpers";

interface PatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient?: Patient | null;
  onSuccess: () => void;
}

export function PatientModal({ isOpen, onClose, patient, onSuccess }: PatientModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    age: "",
    affectedSide: "Derecho",
    diagnosis: "",
    notes: "",
    status: "activo" as "activo" | "inactivo",
  });
  const [selectedColorIdx, setSelectedColorIdx] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (patient) {
      setFormData({
        name: patient.name,
        age: patient.age.toString(),
        affectedSide: patient.affectedSide,
        diagnosis: patient.diagnosis,
        notes: patient.notes || "",
        status: patient.status,
      });
      setSelectedColorIdx(patient.colorIdx);
    } else {
      setFormData({
        name: "",
        age: "",
        affectedSide: "Derecho",
        diagnosis: "",
        notes: "",
        status: "activo",
      });
      setSelectedColorIdx(0);
    }
  }, [patient, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const patientData = {
        name: formData.name,
        age: parseInt(formData.age),
        affectedSide: formData.affectedSide,
        diagnosis: formData.diagnosis,
        notes: formData.notes,
        status: formData.status,
        colorIdx: selectedColorIdx,
        initials: getInitials(formData.name),
        lastSession: patient?.lastSession || new Date().toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }),
        progress: patient?.progress || 0,
        sessions: patient?.sessions || 0,
      };

      if (patient) {
        await updatePatient(patient.id, patientData);
      } else {
        await addPatient(patientData);
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error guardando paciente:", error);
      alert("Error al guardar el paciente");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={patient ? "Editar Paciente" : "Nuevo Paciente"}>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Nombre completo *
          </label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Ej: María García López"
          />
        </div>

        {/* Age & Side */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Edad *
            </label>
            <input
              type="number"
              required
              min="18"
              max="120"
              value={formData.age}
              onChange={(e) => setFormData({ ...formData, age: e.target.value })}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="65"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Lado afectado *
            </label>
            <select
              value={formData.affectedSide}
              onChange={(e) => setFormData({ ...formData, affectedSide: e.target.value })}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {SIDES.map(side => (
                <option key={side} value={side}>{side}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Diagnosis */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Diagnóstico *
          </label>
          <input
            type="text"
            required
            value={formData.diagnosis}
            onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Ej: Ictus isquémico"
          />
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Estado
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, status: "activo" })}
              className={cx(
                "flex-1 px-4 py-2 rounded-lg font-medium transition-colors",
                formData.status === "activo"
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              Activo
            </button>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, status: "inactivo" })}
              className={cx(
                "flex-1 px-4 py-2 rounded-lg font-medium transition-colors",
                formData.status === "inactivo"
                  ? "bg-slate-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              Inactivo
            </button>
          </div>
        </div>

        {/* Color Picker */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Color del avatar
          </label>
          <div className="flex gap-2 flex-wrap">
            {AVATAR_COLORS.map((color, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setSelectedColorIdx(idx)}
                className={cx(
                  "w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all",
                  color.bg,
                  color.text,
                  selectedColorIdx === idx && "ring-4 ring-blue-300 scale-110"
                )}
              >
                {getInitials(formData.name || "XX")}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Notas clínicas
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={3}
            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Observaciones, contraindicaciones, etc..."
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
