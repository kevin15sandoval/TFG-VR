import { StrictMode, useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import type { User } from "firebase/auth";
import { onAuthChange } from "./auth";
import AuthScreen from "./AuthScreen";
import App from "./App";
import "../styles/index.css";

function Root() {
  const [user, setUser]       = useState<User | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const unsub = onAuthChange(u => {
      setUser(u);
      setChecking(false);
    });
    return unsub;
  }, []);

  // Pantalla de carga mientras Firebase comprueba la sesión
  if (checking) {
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

  return user ? (
    <BrowserRouter>
      <App user={user} />
    </BrowserRouter>
  ) : (
    <AuthScreen />
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
