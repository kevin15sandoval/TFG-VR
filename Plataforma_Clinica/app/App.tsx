import { useState } from "react";
import type { User as FirebaseUser } from "firebase/auth";
import {
  LayoutDashboard, Users, PlayCircle, Gamepad2, History, Settings
} from "lucide-react";
import type { Patient, Screen } from "./types";
import { useAppState } from "./hooks/useAppState";
import { deletePatient } from "./db";
import { cx } from "./utils/helpers";

// Screens
import {
  DashboardScreen,
  PatientsScreen,
  SessionsScreen,
  GamesScreen,
  HistoryScreen,
  SettingsScreen,
} from "./components/screens";

// Modals
import { PatientModal, GameDetailModal, ConfirmModal } from "./components/modals";

interface AppProps {
  user: FirebaseUser | null;
}

export default function App({ user }: AppProps) {
  const {
    patients,
    sessions,
    currentScreen,
    selectedPatient,
    loading,
    setPatients,
    navigateTo,
  } = useAppState();

  // Modal states
  const [patientModalOpen, setPatientModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [gameDetailModalOpen, setGameDetailModalOpen] = useState(false);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [patientToDelete, setPatientToDelete] = useState<Patient | null>(null);

  // Navigation
  const navItems = [
    { id: "dashboard" as Screen, label: "Dashboard", Icon: LayoutDashboard },
    { id: "patients" as Screen, label: "Pacientes", Icon: Users },
    { id: "sessions" as Screen, label: "Nueva Sesión", Icon: PlayCircle },
    { id: "games" as Screen, label: "Juegos", Icon: Gamepad2 },
    { id: "history" as Screen, label: "Historial", Icon: History },
    { id: "settings" as Screen, label: "Configuración", Icon: Settings },
  ];

  // Handlers
  const handleAddPatient = () => {
    setEditingPatient(null);
    setPatientModalOpen(true);
  };

  const handleEditPatient = (patient: Patient) => {
    setEditingPatient(patient);
    setPatientModalOpen(true);
  };

  const handleDeletePatient = (patient: Patient) => {
    setPatientToDelete(patient);
    setDeleteConfirmOpen(true);
  };

  const confirmDeletePatient = async () => {
    if (patientToDelete) {
      await deletePatient(patientToDelete.id);
      setPatientToDelete(null);
    }
  };

  const handleViewHistory = (patient: Patient) => {
    navigateTo("history", patient);
  };

  const handleViewGameDetails = (gameId: string) => {
    setSelectedGameId(gameId);
    setGameDetailModalOpen(true);
  };

  const handlePatientModalSuccess = () => {
    // Refresh will happen automatically via Firebase subscription
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Cargando plataforma...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6 border-b border-slate-200">
          <h1 className="text-xl font-bold text-slate-900">TFG VR Rehab</h1>
          <p className="text-sm text-slate-600 mt-1">Plataforma Clínica</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.Icon;
            return (
              <button
                key={item.id}
                onClick={() => navigateTo(item.id)}
                className={cx(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left",
                  currentScreen === item.id
                    ? "bg-blue-50 text-blue-600 font-medium"
                    : "text-slate-600 hover:bg-slate-50"
                )}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-sm font-semibold text-blue-600">
                {user?.email?.[0].toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">{user?.email}</p>
              <p className="text-xs text-slate-500">Administrador</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-8">
          {currentScreen === "dashboard" && (
            <DashboardScreen
              patients={patients}
              sessions={sessions}
              onNavigate={navigateTo}
            />
          )}

          {currentScreen === "patients" && (
            <PatientsScreen
              patients={patients}
              onAddPatient={handleAddPatient}
              onEditPatient={handleEditPatient}
              onDeletePatient={handleDeletePatient}
              onViewHistory={handleViewHistory}
            />
          )}

          {currentScreen === "sessions" && (
            <SessionsScreen patients={patients} />
          )}

          {currentScreen === "games" && (
            <GamesScreen onViewGameDetails={handleViewGameDetails} />
          )}

          {currentScreen === "history" && (
            <HistoryScreen
              patient={selectedPatient}
              sessions={sessions}
              onBack={() => navigateTo("patients")}
            />
          )}

          {currentScreen === "settings" && (
            <SettingsScreen user={user} />
          )}
        </div>
      </main>

      {/* Modals */}
      <PatientModal
        isOpen={patientModalOpen}
        onClose={() => setPatientModalOpen(false)}
        patient={editingPatient}
        onSuccess={handlePatientModalSuccess}
      />

      <GameDetailModal
        isOpen={gameDetailModalOpen}
        onClose={() => setGameDetailModalOpen(false)}
        gameId={selectedGameId}
      />

      <ConfirmModal
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={confirmDeletePatient}
        title="Eliminar Paciente"
        message={`¿Estás seguro de que deseas eliminar a ${patientToDelete?.name}? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        variant="danger"
      />
    </div>
  );
}
