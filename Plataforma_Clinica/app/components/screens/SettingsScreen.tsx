import { useState } from "react";
import { LogOut, Bell, Monitor, User, Shield } from "lucide-react";
import type { User as FirebaseUser } from "firebase/auth";
import { Card, Badge } from "../shared";
import { logout } from "../../auth";

interface SettingsScreenProps {
  user: FirebaseUser | null;
}

export function SettingsScreen({ user }: SettingsScreenProps) {
  const [notifications, setNotifications] = useState(true);
  const [autoSave, setAutoSave] = useState(true);

  const handleLogout = async () => {
    if (confirm("¿Seguro que deseas cerrar sesión?")) {
      await logout();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Configuración</h1>
        <p className="text-slate-600 mt-1">Administra tu cuenta y preferencias</p>
      </div>

      {/* User Info */}
      <Card className="p-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
            <User className="w-8 h-8 text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-slate-900">{user?.email}</h3>
            <p className="text-sm text-slate-600">Administrador del sistema</p>
          </div>
          <Badge variant="success">Activo</Badge>
        </div>
      </Card>

      {/* Settings Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Notifications */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Bell className="w-5 h-5 text-amber-600" />
            </div>
            <h3 className="font-semibold text-slate-900">Notificaciones</h3>
          </div>
          <div className="space-y-3">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm text-slate-700">Notificaciones de sesiones</span>
              <input
                type="checkbox"
                checked={notifications}
                onChange={(e) => setNotifications(e.target.checked)}
                className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm text-slate-700">Autoguardado</span>
              <input
                type="checkbox"
                checked={autoSave}
                onChange={(e) => setAutoSave(e.target.checked)}
                className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
            </label>
          </div>
        </Card>

        {/* Display */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center">
              <Monitor className="w-5 h-5 text-violet-600" />
            </div>
            <h3 className="font-semibold text-slate-900">Visualización</h3>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-slate-700 mb-2">Tema</label>
              <select className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option>Claro</option>
                <option>Oscuro</option>
                <option>Automático</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-700 mb-2">Idioma</label>
              <select className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option>Español</option>
                <option>English</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Privacy */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-emerald-600" />
            </div>
            <h3 className="font-semibold text-slate-900">Privacidad y Seguridad</h3>
          </div>
          <div className="space-y-3">
            <button className="w-full px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium">
              Cambiar Contraseña
            </button>
            <button className="w-full px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium">
              Historial de Actividad
            </button>
          </div>
        </Card>

        {/* System Info */}
        <Card className="p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Información del Sistema</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Versión</span>
              <span className="font-medium text-slate-900">1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Base de Datos</span>
              <Badge variant="success">Conectada</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Último Backup</span>
              <span className="font-medium text-slate-900">Hace 2 horas</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Danger Zone */}
      <Card className="p-6 border-red-200">
        <h3 className="font-semibold text-red-600 mb-4">Zona de Peligro</h3>
        <div className="space-y-3">
          <button
            onClick={handleLogout}
            className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2 font-medium"
          >
            <LogOut className="w-5 h-5" />
            Cerrar Sesión
          </button>
        </div>
      </Card>
    </div>
  );
}
