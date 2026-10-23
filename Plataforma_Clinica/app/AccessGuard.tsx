// ─── GUARD DE ACCESO (PR5b) ───────────────────────────────────────────────────
// Solo se usa con VITE_ACCESS_GUARD=strict. Monta `children` (la App clínica) ÚNICAMENTE en el estado rol_ok,
// de modo que subscribePatients/subscribeSessions no se disparan antes de autorizar. El único acceso a Firestore
// de este componente es getDoc(usuarios/{uid}) (vía leerRolUsuario). Fallo cerrado: cualquier fallo deniega.
import { useCallback, useEffect, useRef, useState } from "react";
import { onIdTokenChanged, type User } from "firebase/auth";
import { Loader2, LogOut, MailCheck, RefreshCw, ShieldAlert, WifiOff, Clock, UserX } from "lucide-react";
import { auth, db } from "./firebase";
import { logout, reenviarVerificacion, authErrorMsg } from "./auth";
import { AuthLayout } from "./AuthScreen";
import { obtenerEstadoAcceso, reevaluarTrasVerificar, type DepsAcceso, type ResultadoAcceso } from "./accessState";
import { leerRolUsuario } from "./accessData";

const ESPERA_REENVIO_S = 60;
const btnPrimario =
  "w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white text-sm font-bold flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md shadow-blue-200";
const btnSecundario =
  "w-full py-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all";

const deps: DepsAcceso = { leerRol: uid => leerRolUsuario(db, uid) };

function Icono({ children, tono }: { children: React.ReactNode; tono: "azul" | "ambar" | "rojo" }) {
  const c = { azul: "bg-blue-100 text-blue-600", ambar: "bg-amber-100 text-amber-600", rojo: "bg-rose-100 text-rose-600" }[tono];
  return <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${c}`}>{children}</div>;
}

function Panel({ icono, tono, titulo, texto, children }: {
  icono: React.ReactNode; tono: "azul" | "ambar" | "rojo"; titulo: string; texto: string; children?: React.ReactNode;
}) {
  return (
    <div className="text-center py-2">
      <Icono tono={tono}>{icono}</Icono>
      <h3 className="text-base font-bold text-slate-800 mb-2">{titulo}</h3>
      <p className="text-sm text-slate-500 mb-6">{texto}</p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function BotonSalir({ onClick }: { onClick: () => void }) {
  return <button type="button" onClick={onClick} className={btnSecundario}><LogOut size={15} /> Cerrar sesión</button>;
}

/** Pantalla para usuarios anónimos (la gafa) que abren la web. También la usa main.tsx con el guard apagado. */
export function AnonimoBloqueado() {
  return (
    <AuthLayout title="Acceso no permitido" subtitle="Esta sesión no puede usar la plataforma clínica">
      <Panel icono={<ShieldAlert size={24} />} tono="rojo" titulo="Sesión no autorizada"
        texto="Las sesiones anónimas (como la de las gafas VR) no tienen acceso a la plataforma clínica. Cierra la sesión e inicia sesión con tu cuenta profesional.">
        <BotonSalir onClick={() => { void logout(); }} />
      </Panel>
    </AuthLayout>
  );
}

function VerificarCorreo({ user, onYaVerifique, comprobando, mensaje }: {
  user: User; onYaVerifique: () => void; comprobando: boolean; mensaje: string;
}) {
  const clave = `tfg_verif_${user.uid}`;
  const leerFin = () => { try { return Number(sessionStorage.getItem(clave)) || 0; } catch { return 0; } };
  const [fin, setFin] = useState(leerFin);
  const [ahora, setAhora] = useState(Date.now());
  const [enviando, setEnviando] = useState(false);
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (fin <= Date.now()) return;
    const t = setInterval(() => setAhora(Date.now()), 500);
    return () => clearInterval(t);
  }, [fin]);

  const restante = Math.max(0, Math.ceil((fin - ahora) / 1000));
  const iniciarEspera = () => {
    const f = Date.now() + ESPERA_REENVIO_S * 1000;
    try { sessionStorage.setItem(clave, String(f)); } catch { /* sin almacenamiento: solo espera en memoria */ }
    setFin(f); setAhora(Date.now());
  };

  async function reenviar() {
    if (restante > 0 || enviando) return;
    setEnviando(true); setError(""); setInfo("");
    try {
      await reenviarVerificacion(user);
      setInfo("Te hemos enviado un correo de verificación. Revisa también la carpeta de spam.");
    } catch (err: unknown) {
      setError(authErrorMsg((err as { code?: string }).code ?? ""));
    } finally {
      iniciarEspera(); // también tras error (p. ej. too-many-requests): sin reintentos inmediatos
      setEnviando(false);
    }
  }

  return (
    <Panel icono={<MailCheck size={24} />} tono="azul" titulo="Verifica tu correo"
      texto="Tu correo electrónico aún no está verificado. Abre el enlace del correo de verificación y después pulsa «Ya verifiqué».">
      {mensaje && <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700 font-medium">{mensaje}</div>}
      {info && <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-xs text-emerald-700 font-medium">{info}</div>}
      {error && <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-xs text-rose-600 font-medium">{error}</div>}
      <button type="button" onClick={onYaVerifique} disabled={comprobando} className={btnPrimario}>
        {comprobando ? <><Loader2 size={16} className="animate-spin" /> Comprobando...</> : <>Ya verifiqué</>}
      </button>
      <button type="button" onClick={reenviar} disabled={restante > 0 || enviando} className={btnSecundario + " disabled:opacity-60 disabled:cursor-not-allowed"}>
        {enviando ? <><Loader2 size={15} className="animate-spin" /> Enviando...</>
          : restante > 0 ? <>Reenviar correo ({restante} s)</> : <>Reenviar correo de verificación</>}
      </button>
      <BotonSalir onClick={() => { void logout(); }} />
    </Panel>
  );
}

export default function AccessGuard({ user, children, onVolverALogin }: {
  user: User;
  children: React.ReactNode;
  /** Se llama desde la pantalla de sesión caducada: main.tsx cierra sesión y muestra el aviso en el login. */
  onVolverALogin: () => void;
}) {
  const [res, setRes] = useState<ResultadoAcceso>({ estado: "cargando" });
  const [intento, setIntento] = useState(0);
  const [comprobando, setComprobando] = useState(false);
  const [mensajeVerif, setMensajeVerif] = useState("");
  const seq = useRef(0);
  const estadoRef = useRef(res.estado);
  estadoRef.current = res.estado;

  // Verificación inicial (y al pulsar «Reintentar»). Bandera cancelled + secuencia: StrictMode ejecuta los efectos 2 veces.
  useEffect(() => {
    let cancelled = false;
    const mi = ++seq.current;
    setRes({ estado: "cargando" });
    obtenerEstadoAcceso(user, deps).then(r => { if (!cancelled && mi === seq.current) setRes(r); });
    return () => { cancelled = true; };
  }, [user, intento]);

  // Revalidación silenciosa (cambio de token y vuelta a la pestaña): detecta revocación de rol y caducidad.
  // Un error de red transitorio no expulsa a quien ya está dentro; cualquier otro resultado no válido sí.
  const revalidar = useCallback(() => {
    if (estadoRef.current !== "rol_ok") return;
    const mi = ++seq.current;
    obtenerEstadoAcceso(user, deps).then(r => {
      if (mi !== seq.current || r.estado === "error_red") return;
      setRes(r);
    });
  }, [user]);

  useEffect(() => {
    let primera = true;
    const unsub = onIdTokenChanged(auth, () => {
      if (primera) { primera = false; return; } // la primera llamada es la suscripción, ya cubierta arriba
      revalidar();
    });
    const alVolver = () => { if (document.visibilityState === "visible") revalidar(); };
    document.addEventListener("visibilitychange", alVolver);
    return () => { unsub(); document.removeEventListener("visibilitychange", alVolver); };
  }, [revalidar]);

  async function yaVerifique() {
    setComprobando(true); setMensajeVerif("");
    const mi = ++seq.current;
    const r = await reevaluarTrasVerificar(user, deps);
    if (mi !== seq.current) return;
    setComprobando(false);
    if (r.estado === "sin_verificar_email") setMensajeVerif("Todavía no consta como verificado. Abre el enlace del correo y vuelve a intentarlo.");
    setRes(r);
  }

  const salir = () => { void logout(); };

  switch (res.estado) {
    case "rol_ok":
      return <>{children}</>;
    case "cargando":
      return (
        <div className="min-h-screen bg-[#EEF2F7] flex items-center justify-center">
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center mx-auto mb-4">
              <Loader2 className="w-7 h-7 text-blue-600 animate-spin" />
            </div>
            <p className="text-sm font-semibold text-slate-600">Comprobando permisos...</p>
          </div>
        </div>
      );
    case "sin_verificar_email":
      return (
        <AuthLayout title="Verificación necesaria" subtitle="Confirma tu correo para continuar">
          <VerificarCorreo user={user} onYaVerifique={yaVerifique} comprobando={comprobando} mensaje={mensajeVerif} />
        </AuthLayout>
      );
    case "sin_rol":
      return (
        <AuthLayout title="Acceso pendiente" subtitle="Tu cuenta aún no tiene permisos">
          <Panel icono={<UserX size={24} />} tono="ambar" titulo="Cuenta sin rol asignado"
            texto="Tu cuenta no tiene un rol clínico asignado. Solicita el alta al administrador de la plataforma.">
            <button type="button" onClick={() => setIntento(n => n + 1)} className={btnSecundario}><RefreshCw size={15} /> Comprobar de nuevo</button>
            <BotonSalir onClick={salir} />
          </Panel>
        </AuthLayout>
      );
    case "error_red":
      return (
        <AuthLayout title="Sin conexión" subtitle="No se pudo comprobar tu acceso">
          <Panel icono={<WifiOff size={24} />} tono="ambar" titulo="No se pudo verificar el acceso"
            texto="Hay un problema de conexión. Por seguridad no se permite el acceso hasta poder comprobar tus permisos.">
            <button type="button" onClick={() => setIntento(n => n + 1)} className={btnPrimario}><RefreshCw size={15} /> Reintentar</button>
            <BotonSalir onClick={salir} />
          </Panel>
        </AuthLayout>
      );
    case "sesion_caducada":
      return (
        <AuthLayout title="Sesión caducada" subtitle="Tu sesión ya no es válida">
          <Panel icono={<Clock size={24} />} tono="ambar" titulo="Tu sesión ha caducado"
            texto="Por seguridad debes volver a iniciar sesión.">
            <button type="button" onClick={onVolverALogin} className={btnPrimario}>Volver a iniciar sesión</button>
          </Panel>
        </AuthLayout>
      );
    case "denegado":
    default:
      return (
        <AuthLayout title="Acceso denegado" subtitle="No tienes permiso para usar esta plataforma">
          <Panel icono={<ShieldAlert size={24} />} tono="rojo" titulo="Acceso denegado"
            texto="Tu cuenta no está autorizada para acceder a la plataforma clínica. Si crees que es un error, contacta con el administrador.">
            <BotonSalir onClick={salir} />
          </Panel>
        </AuthLayout>
      );
  }
}
