import { useState } from "react";
import { User, Monitor, Bell, CheckCircle, ChevronDown, Lock, LogOut } from "lucide-react";
import type { User as FirebaseUser } from "firebase/auth";
import { Card } from "../components/shared";
import { cx } from "../utils/helpers";

interface SettingsPageProps {
  user: FirebaseUser;
}

export function SettingsPage({ user }: SettingsPageProps) {
  const [notif, setNotif] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [autoSave, setAutoSave] = useState(true);
  const [vrDevice, setVrDevice] = useState("Meta Quest 3");
  const [therapistName, setTherapistName] = useState(user.displayName ?? "");
  const [clinic, setClinic] = useState("Hospital Universitario La Paz");
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
    <button onClick={() => onChange(!value)} className={cx("relative w-10 h-6 rounded-full transition-colors cursor-pointer flex-shrink-0", value ? "bg-blue-600" : "bg-slate-200")}>
      <span className={cx("absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all", value ? "left-5" : "left-1")} />
    </button>
  );

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Configuración</h1>
        <p className="text-slate-500 text-sm mt-1">Preferencias del sistema y del perfil clínico</p>
      </div>

      <div className="space-y-5">
        {/* Profile */}
        <Card className="p-5">
          <h2 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2"><User size={14} className="text-blue-500" /> Perfil del terapeuta</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Nombre completo</label>
              <input value={therapistName} onChange={e => setTherapistName(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Centro clínico</label>
              <input value={clinic} onChange={e => setClinic(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all" />
            </div>
          </div>
        </Card>

        {/* VR Device */}
        <Card className="p-5">
          <h2 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2"><Monitor size={14} className="text-violet-500" /> Dispositivo VR</h2>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Modelo del headset</label>
            <div className="relative">
              <select value={vrDevice} onChange={e => setVrDevice(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white cursor-pointer appearance-none transition-all pr-8">
                <option>Meta Quest 3</option>
                <option>Meta Quest 3S</option>
                <option>Meta Quest Pro</option>
                <option>Meta Quest 2</option>
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg">
            <CheckCircle size={12} /> Dispositivo configurado y listo para conectar
          </div>
        </Card>

        {/* Preferences */}
        <Card className="p-5">
          <h2 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2"><Bell size={14} className="text-amber-500" /> Preferencias</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex-1 pr-4">
                <p className="text-sm font-medium text-slate-700">Notificaciones</p>
                <p className="text-xs text-slate-400 mt-0.5">Recibir alertas de sesiones y actualizaciones</p>
              </div>
              <Toggle value={notif} onChange={setNotif} />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex-1 pr-4">
                <p className="text-sm font-medium text-slate-700">Modo oscuro</p>
                <p className="text-xs text-slate-400 mt-0.5">Tema visual para la interfaz</p>
              </div>
              <Toggle value={darkMode} onChange={setDarkMode} />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex-1 pr-4">
                <p className="text-sm font-medium text-slate-700">Guardado automático</p>
                <p className="text-xs text-slate-400 mt-0.5">Guardar cambios sin confirmación</p>
              </div>
              <Toggle value={autoSave} onChange={setAutoSave} />
            </div>
          </div>
        </Card>

        {/* Security */}
        <Card className="p-5">
          <h2 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2"><Lock size={14} className="text-rose-500" /> Seguridad</h2>
          <div className="space-y-3">
            <button className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all text-left flex items-center justify-between cursor-pointer">
              <span>Cambiar contraseña</span>
              <ChevronDown size={14} className="-rotate-90" />
            </button>
            <button className="w-full px-4 py-2.5 rounded-xl border border-rose-200 text-sm font-semibold text-rose-600 hover:bg-rose-50 transition-all text-left flex items-center justify-center gap-2 cursor-pointer">
              <LogOut size={14} /> Cerrar sesión
            </button>
          </div>
        </Card>

        {/* Save button */}
        <div className="flex gap-3">
          <button onClick={handleSave} disabled={saved} className={cx("flex-1 py-3 rounded-xl text-sm font-bold transition-all cursor-pointer shadow-md flex items-center justify-center gap-2", saved ? "bg-emerald-500 text-white" : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200")}>
            {saved ? <><CheckCircle size={16} /> Guardado</> : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}
