import { StrictMode, useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import type { User } from "firebase/auth";
import { onAuthChange, logout } from "./auth";
import AuthScreen from "./AuthScreen";
import App from "./App";
import AccessGuard, { AnonimoBloqueado } from "./AccessGuard";
import { decidirPantalla } from "./accessState";
import "../styles/index.css";

function Root() {
  const [user, setUser]       = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [aviso, setAviso]     = useState<string | undefined>(undefined);

  useEffect(() => {
    const unsub = onAuthChange(u => {
      setUser(u);
      if (u) setAviso(undefined);
      setChecking(false);
    });
    return unsub;
  }, []);

  // VITE_ACCESS_GUARD: solo 'strict' activa el guard. Apagado (por defecto) = comportamiento anterior, salvo el
  // bloqueo de usuarios anónimos, que está siempre activo (no depende de las reglas de Firestore).
  const pantalla = decidirPantalla({ flag: import.meta.env.VITE_ACCESS_GUARD, checking, user });

  // Pantalla de carga mientras Firebase comprueba la sesión
  if (pantalla === "cargando") {
    return (
      <div className="min-h-screen bg-[#EEF2F7] flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-slate-600">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  if (!user || pantalla === "login") return <AuthScreen aviso={aviso} />;
  if (pantalla === "anonimo_bloqueado") return <AnonimoBloqueado />;

  const app = (
    <BrowserRouter>
      <App user={user} />
    </BrowserRouter>
  );
  if (pantalla === "guard") {
    return (
      <AccessGuard
        user={user}
        onVolverALogin={() => { setAviso("Tu sesión ha caducado. Inicia sesión de nuevo."); void logout(); }}
      >
        {app}
      </AccessGuard>
    );
  }
  return app;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
