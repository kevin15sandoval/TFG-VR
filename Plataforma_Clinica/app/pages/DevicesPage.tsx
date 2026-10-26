// ─── PANTALLA «DISPOSITIVOS VR» (PR5c-2) ──────────────────────────────────────
// Vincular una Quest con un código, ver las propias, renombrar y revocar. Toda la lógica de texto/validación está en
// ../devicesViewModel (pura y probada); los datos llegan del servicio de PR5c-1 (../devicesService), que se puede
// inyectar por la prop `servicio` (pruebas). La pantalla NO muestra presencia: «Vinculada» no es «en línea».
// Accesibilidad: etiquetas con htmlFor, regiones aria-live="polite" siempre montadas, diálogo de confirmación LOCAL
// (role=dialog, aria-modal, foco inicial en «Cancelar», trampa de foco, Escape, restauración del foco).
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import {
  Headset, CheckCircle2, Ban, Pencil, Loader2, AlertTriangle, ShieldAlert, RotateCcw, Info, Link2, Check, X, Clock,
} from "lucide-react";
import { Card, Badge } from "../components/shared";
import { cx } from "../utils/helpers";
import { dispositivos as servicioPorDefecto } from "../devicesService";
import type { ServicioDispositivos } from "../devices";
import {
  TEXTOS, NOTA_VINCULADA_NO_CONECTADA, MAX_ALIAS,
  limpiarEntradaCodigo, mostrarCodigo, validarCodigoEntrada, validarAliasEntrada,
  etiquetaEstado, nombreDispositivo, accionesPermitidas, textoFechaDispositivo, prepararLista,
  errorAVista, estadoDePantalla, esperarConLimite, coincideEsperado,
  LIMITE_ESPERA_MS, TEMPORIZADOR_REAL, TEXTOS_DESCONOCIDO,
  type DispositivoVista, type ErrorVista, type OperacionDispositivo, type Pendiente, type ResultadoOperacion, type Temporizador,
} from "../devicesViewModel";

// ── Clases comunes ────────────────────────────────────────────────────────────

const FOCO = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2";
const BTN = "inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-xl text-sm font-bold cursor-pointer transition-colors disabled:cursor-not-allowed";
const BTN_PRIMARIO = cx(BTN, FOCO, "bg-blue-600 hover:bg-blue-700 text-white disabled:bg-slate-200 disabled:text-slate-600");
const BTN_SECUNDARIO = cx(BTN, FOCO, "border border-slate-500 bg-white hover:bg-slate-50 text-slate-700 disabled:text-slate-600 disabled:bg-slate-100");
const BTN_PELIGRO = cx(BTN, FOCO, "border border-rose-600 bg-white hover:bg-rose-50 text-rose-700");
const BTN_PELIGRO_SOLIDO = cx(BTN, FOCO, "bg-rose-700 hover:bg-rose-800 text-white disabled:bg-slate-200 disabled:text-slate-600");
const CAMPO = "w-full min-h-[44px] px-3 py-2.5 rounded-xl border bg-white text-sm text-slate-800 placeholder:text-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:border-blue-600 disabled:bg-slate-100 disabled:text-slate-600";

interface Fallo { mensaje: string; reintentable: boolean }
interface Aviso { tipo: "ok" | "error" | "desconocido"; mensaje: string; reintentar?: () => void; comprobar?: () => void }

// ── Mensaje de resultado (zona aria-live siempre montada) ─────────────────────

function ZonaResultado({ aviso, id }: { aviso: Aviso | null; id?: string }) {
  const est = aviso?.tipo === "ok" ? "bg-emerald-50 border-emerald-300 text-emerald-900"
    : aviso?.tipo === "desconocido" ? "bg-amber-50 border-amber-400 text-amber-950" : "bg-rose-50 border-rose-300 text-rose-900";
  return (
    <div id={id} aria-live="polite" aria-atomic="true" data-testid="resultado" data-tipo={aviso?.tipo}>
      {aviso && (
        <div className={cx("flex items-start gap-3 rounded-xl border px-4 py-3 text-sm", est)}>
          {aviso.tipo === "ok"
            ? <CheckCircle2 size={18} className="mt-0.5 flex-shrink-0 text-emerald-700" aria-hidden="true" />
            : aviso.tipo === "desconocido"
              ? <Clock size={18} className="mt-0.5 flex-shrink-0 text-amber-800" aria-hidden="true" />
              : <AlertTriangle size={18} className="mt-0.5 flex-shrink-0 text-rose-700" aria-hidden="true" />}
          <div className="flex-1 min-w-0">
            <p className="font-semibold">{aviso.tipo === "ok" ? "Hecho" : aviso.tipo === "desconocido" ? "Resultado sin confirmar" : "No se pudo completar"}</p>
            <p>{aviso.mensaje}</p>
            {(aviso.comprobar || aviso.reintentar) && (
              <div className="mt-2 flex flex-wrap gap-2">
                {aviso.comprobar && (
                  <button type="button" onClick={aviso.comprobar} className={BTN_SECUNDARIO}>
                    <RotateCcw size={14} aria-hidden="true" /> Comprobar estado
                  </button>
                )}
                {aviso.reintentar && (
                  <button type="button" onClick={aviso.reintentar} className={BTN_SECUNDARIO}>
                    <RotateCcw size={14} aria-hidden="true" /> Reintentar
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Diálogo de confirmación local (accesible) ─────────────────────────────────

const FOCALIZABLES = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function DialogoConfirmacion({
  titulo, descripcion, etiquetaConfirmar, ocupado, error, onConfirmar, onCancelar,
}: {
  titulo: string; descripcion: ReactNode; etiquetaConfirmar: string; ocupado: boolean;
  error: Fallo | null; onConfirmar: () => void; onCancelar: () => void;
}) {
  const idTitulo = useId();
  const idDesc = useId();
  const contenedor = useRef<HTMLDivElement>(null);
  const cancelar = useRef<HTMLButtonElement>(null);
  // Elemento que abrió el diálogo: se captura al montar (antes de mover el foco).
  const [apertura] = useState<Element | null>(() => (typeof document !== "undefined" ? document.activeElement : null));
  const ocupadoRef = useRef(ocupado);
  ocupadoRef.current = ocupado;
  const cancelarRef = useRef(onCancelar);
  cancelarRef.current = onCancelar;

  useEffect(() => {
    cancelar.current?.focus();
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function alPulsar(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        if (!ocupadoRef.current) cancelarRef.current();
        return;
      }
      if (e.key !== "Tab" || !contenedor.current) return;
      const items = Array.from(contenedor.current.querySelectorAll<HTMLElement>(FOCALIZABLES));
      if (items.length === 0) { e.preventDefault(); return; }
      const primero = items[0], ultimo = items[items.length - 1];
      const activo = document.activeElement;
      if (!contenedor.current.contains(activo)) { e.preventDefault(); (e.shiftKey ? ultimo : primero).focus(); }
      else if (e.shiftKey && activo === primero) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && activo === ultimo) { e.preventDefault(); primero.focus(); }
    }
    document.addEventListener("keydown", alPulsar, true);
    return () => {
      document.removeEventListener("keydown", alPulsar, true);
      document.body.style.overflow = overflowPrevio;
      // Restaura el foco al elemento que abrió (si sigue en pantalla; si no, la página lo recoloca).
      if (apertura instanceof HTMLElement && apertura.isConnected) apertura.focus();
    };
  }, [apertura]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="dialogo-fondo">
      <div className="absolute inset-0 bg-slate-900/50" aria-hidden="true" onClick={() => { if (!ocupado) onCancelar(); }} />
      <div ref={contenedor} role="dialog" aria-modal="true" aria-labelledby={idTitulo} aria-describedby={idDesc}
        className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 p-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center flex-shrink-0" aria-hidden="true">
            <AlertTriangle size={20} className="text-rose-700" aria-hidden="true" />
          </div>
          <h2 id={idTitulo} className="text-lg font-bold text-slate-900 pt-1.5">{titulo}</h2>
        </div>
        <div id={idDesc} className="mt-4 text-sm text-slate-700 space-y-2">{descripcion}</div>
        <div aria-live="polite" aria-atomic="true">
          {error && (
            <p className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
              <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-rose-700" aria-hidden="true" />
              <span>{error.mensaje}</span>
            </p>
          )}
        </div>
        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button ref={cancelar} type="button" onClick={onCancelar} disabled={ocupado} className={BTN_SECUNDARIO}>Cancelar</button>
          <button type="button" onClick={onConfirmar} disabled={ocupado} aria-busy={ocupado} className={BTN_PELIGRO_SOLIDO}>
            {ocupado ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Ban size={16} aria-hidden="true" />}
            {ocupado ? "Revocando…" : error?.reintentable ? "Reintentar" : etiquetaConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tarjeta de una Quest ──────────────────────────────────────────────────────

function FilaDispositivo({
  d, editando, onEditar, onCancelarEdicion, onGuardar, onRevocar,
}: {
  d: DispositivoVista;
  editando: { valor: string; error: string | null; guardando: boolean } | null;
  onEditar: () => void;
  onCancelarEdicion: () => void;
  onGuardar: (valor: string) => void;
  onRevocar: () => void;
}) {
  const etiqueta = etiquetaEstado(d.estado);
  const acciones = accionesPermitidas(d.estado);
  const fecha = textoFechaDispositivo(d);
  const nombre = nombreDispositivo(d);
  const idNombre = `disp-nombre-${d.uid}`;
  const idCampo = `disp-alias-${d.uid}`;
  const idError = `disp-alias-error-${d.uid}`;
  const [valor, setValor] = useState(editando?.valor ?? d.alias ?? "");
  const campo = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editando) { setValor(editando.valor); campo.current?.focus(); campo.current?.select(); } }, [editando === null]); // eslint-disable-line react-hooks/exhaustive-deps

  function alTeclear(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onCancelarEdicion(); }
  }

  return (
    <li id={`disp-${d.uid}`} tabIndex={-1} aria-labelledby={idNombre} data-estado={d.estado} data-testid="dispositivo"
      className={cx("rounded-xl border p-4 outline-none focus-visible:ring-2 focus-visible:ring-blue-600",
        d.estado === "revocado" ? "bg-slate-50 border-slate-200" : "bg-white border-slate-200")}>
      <div className="flex flex-wrap items-start gap-3">
        <div className={cx("w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0",
          d.estado === "revocado" ? "bg-slate-200 text-slate-600" : "bg-blue-100 text-blue-700")} aria-hidden="true">
          <Headset size={22} aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-[12rem]">
          <div className="flex flex-wrap items-center gap-2">
            <p id={idNombre} className={cx("text-[15px] font-bold break-words", d.alias ? "text-slate-900" : "text-slate-600 italic")}>{nombre}</p>
            <Badge color={etiqueta.color}>
              {etiqueta.icono === "check" ? <Check size={12} className="mr-1" aria-hidden="true" /> : <Ban size={12} className="mr-1" aria-hidden="true" />}
              {etiqueta.texto}
            </Badge>
          </div>
          <p className="text-sm text-slate-600 mt-0.5">{fecha ?? etiqueta.descripcion}</p>
          {fecha && <p className="text-xs text-slate-600 mt-0.5">{etiqueta.descripcion}</p>}
        </div>
        {!editando && (acciones.renombrar || acciones.revocar) && (
          <div className="flex flex-wrap gap-2">
            {acciones.renombrar && (
              <button type="button" id={`renombrar-${d.uid}`} onClick={onEditar} className={BTN_SECUNDARIO}
                aria-label={`Cambiar el nombre de ${nombre}`}>
                <Pencil size={14} aria-hidden="true" /> Cambiar nombre
              </button>
            )}
            {acciones.revocar && (
              <button type="button" id={`revocar-${d.uid}`} onClick={onRevocar} className={BTN_PELIGRO}
                aria-label={`Revocar ${nombre}`}>
                <Ban size={14} aria-hidden="true" /> Revocar
              </button>
            )}
          </div>
        )}
      </div>

      {editando && (
        <form className="mt-4 border-t border-slate-100 pt-4" noValidate
          onSubmit={(e: FormEvent) => { e.preventDefault(); onGuardar(valor); }}>
          <label htmlFor={idCampo} className="block text-sm font-semibold text-slate-700 mb-1">Nombre de la Quest</label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input id={idCampo} ref={campo} value={valor} maxLength={MAX_ALIAS + 10} autoComplete="off" spellCheck={false}
              onChange={(e) => setValor(e.target.value)} onKeyDown={alTeclear} disabled={editando.guardando}
              aria-invalid={editando.error ? true : undefined} aria-describedby={`${idCampo}-ayuda ${idError}`}
              className={cx(CAMPO, editando.error ? "border-rose-600" : "border-slate-500")} />
            <div className="flex gap-2">
              <button type="submit" disabled={editando.guardando} aria-busy={editando.guardando} className={BTN_PRIMARIO}>
                {editando.guardando ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
                {editando.guardando ? "Guardando…" : "Guardar"}
              </button>
              <button type="button" onClick={onCancelarEdicion} disabled={editando.guardando} className={BTN_SECUNDARIO}>
                <X size={16} aria-hidden="true" /> Cancelar
              </button>
            </div>
          </div>
          <p id={`${idCampo}-ayuda`} className="text-xs text-slate-600 mt-1.5">De 1 a {MAX_ALIAS} caracteres: letras, números, espacios, punto, guion o guion bajo.</p>
          <p id={idError} aria-live="polite" className="text-sm font-medium text-rose-800 mt-1 empty:hidden">
            {editando.error ?? ""}
          </p>
        </form>
      )}
    </li>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

export function DevicesPage({ servicio = servicioPorDefecto, limiteMs = LIMITE_ESPERA_MS, temporizador = TEMPORIZADOR_REAL }: {
  servicio?: ServicioDispositivos; limiteMs?: number; temporizador?: Temporizador;
}) {
  // Carga en tiempo real
  const [lista, setLista] = useState<DispositivoVista[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<ErrorVista | null>(null);
  const [intentoCarga, setIntentoCarga] = useState(0);

  useEffect(() => {
    setCargando(true);
    setErrorCarga(null);
    let baja: (() => void) | null = null;
    try {
      baja = servicio.listarMisDispositivos(
        (d) => { setLista(d); setErrorCarga(null); setCargando(false); },
        (e) => { setErrorCarga(errorAVista(e, "cargar")); setCargando(false); },
      );
    } catch (e) {
      setErrorCarga(errorAVista(e, "cargar"));
      setCargando(false);
    }
    return () => { if (baja) baja(); };
  }, [servicio, intentoCarga]);

  const visibles = prepararLista(lista);
  const estado = estadoDePantalla({ cargando, error: errorCarga, dispositivos: lista });

  // ── Operaciones con límite de espera y resultado desconocido ──
  // `montado` evita tocar el estado tras desmontar; la operación del SDK puede acabar después (no se cancela).
  const montado = useRef(true);
  useEffect(() => { montado.current = true; return () => { montado.current = false; }; }, []);
  const listaRef = useRef(lista);
  listaRef.current = lista;

  /** Ejecuta `hacer` esperando como máximo `limiteMs`. Si vence el plazo y la operación sigue viva, avisa al terminar. */
  async function correr<T>(
    op: OperacionDispositivo, hacer: () => Promise<T>,
    tarde: { ok: (v: T) => void; error: (e: ErrorVista) => void },
  ): Promise<ResultadoOperacion<T>> {
    const p = (async () => hacer())();
    let liquidada = false;
    p.then(() => { liquidada = true; }, () => { liquidada = true; });
    const r = await esperarConLimite(p, op, limiteMs, temporizador);
    if (r.tipo === "desconocido" && !liquidada) {
      p.then(
        (v) => { if (montado.current) tarde.ok(v); },
        (e) => { if (montado.current) tarde.error(errorAVista(e, op)); },
      );
    }
    return r;
  }

  /** «Comprobar estado»: relee la lista (no repite ninguna escritura) y la compara con lo esperado. */
  async function comprobar(pend: Pendiente, poner: (a: Aviso) => void, reintentar?: () => void) {
    const r = await esperarConLimite((async () => servicio.listarMisDispositivosUnaVez())(), "cargar", limiteMs, temporizador);
    if (!montado.current) return;
    const nuevo = (mensaje: string): Aviso => ({ tipo: "desconocido", mensaje, comprobar: () => { void comprobar(pend, poner, reintentar); }, reintentar });
    if (r.tipo !== "ok") { poner(nuevo(TEXTOS_DESCONOCIDO.noSePudoComprobar)); return; }
    poner(nuevo(coincideEsperado(pend, r.valor) ? TEXTOS_DESCONOCIDO.reflejado : TEXTOS_DESCONOCIDO.noConsta));
  }

  function avisoDesconocido(pend: Pendiente, poner: (a: Aviso) => void, reintentar?: () => void): Aviso {
    return { tipo: "desconocido", mensaje: TEXTOS_DESCONOCIDO.mensaje, comprobar: () => { void comprobar(pend, poner, reintentar); }, reintentar };
  }

  // Formulario de vinculación
  const idCodigo = useId();
  const idAliasNuevo = useId();
  const [codigo, setCodigo] = useState("");
  const [aliasNuevo, setAliasNuevo] = useState("");
  const [errCodigo, setErrCodigo] = useState<string | null>(null);
  const [errAlias, setErrAlias] = useState<string | null>(null);
  const [vinculando, setVinculando] = useState(false);
  const [avisoVincular, setAvisoVincular] = useState<Aviso | null>(null);
  const campoCodigo = useRef<HTMLInputElement>(null);
  const campoAlias = useRef<HTMLInputElement>(null);

  const vincular = async () => {
    if (vinculando) return;
    const rc = validarCodigoEntrada(codigo);
    const ra = validarAliasEntrada(aliasNuevo, false);
    setErrCodigo(rc.ok ? null : rc.mensaje);
    setErrAlias(ra.ok ? null : ra.mensaje);
    setAvisoVincular(null);
    if (!rc.ok) { campoCodigo.current?.focus(); return; }
    if (!ra.ok) { campoAlias.current?.focus(); return; }
    setVinculando(true);
    const pend: Pendiente = { tipo: "vincular", uidsAntes: listaRef.current.map((d) => d.uid), alias: ra.alias };
    const r = await correr("vincular", () => servicio.confirmarVinculo(rc.codigo, ra.alias ?? undefined), {
      ok: (v) => { setCodigo(""); setAliasNuevo(""); setAvisoVincular({ tipo: "ok", mensaje: TEXTOS.vinculadaOk(v.alias) }); },
      error: (e) => setAvisoVincular({ tipo: "error", mensaje: e.mensaje }),
    });
    if (!montado.current) return;
    setVinculando(false);
    if (r.tipo === "ok") { setCodigo(""); setAliasNuevo(""); setAvisoVincular({ tipo: "ok", mensaje: TEXTOS.vinculadaOk(r.valor.alias) }); }
    else if (r.tipo === "rechazada") setAvisoVincular({ tipo: "error", mensaje: r.error.mensaje, reintentar: r.error.reintentable ? () => { void vincular(); } : undefined });
    else setAvisoVincular(avisoDesconocido(pend, setAvisoVincular)); // vincular NO se ofrece como reintento: solo «Comprobar estado»
  };

  // Renombrar (edición en línea, una a la vez)
  const [edicion, setEdicion] = useState<{ uid: string; valor: string; error: string | null; guardando: boolean } | null>(null);
  const [avisoLista, setAvisoLista] = useState<Aviso | null>(null);

  async function guardarNombre(uid: string, valor: string) {
    if (edicion?.guardando) return;
    const r = validarAliasEntrada(valor, true);
    if (!r.ok || r.alias === null) {
      setEdicion({ uid, valor, error: r.ok ? "Escribe un nombre." : r.mensaje, guardando: false });
      return;
    }
    const alias = r.alias;
    setEdicion({ uid, valor, error: null, guardando: true });
    setAvisoLista(null);
    const res = await correr("renombrar", () => servicio.renombrarDispositivo(uid, alias), {
      ok: () => setAvisoLista({ tipo: "ok", mensaje: TEXTOS.renombradaOk(alias) }),
      error: (e) => setAvisoLista({ tipo: "error", mensaje: e.mensaje }),
    });
    if (!montado.current) return;
    if (res.tipo === "ok") {
      setEdicion(null);
      setAvisoLista({ tipo: "ok", mensaje: TEXTOS.renombradaOk(alias) });
      setFoco(`renombrar-${uid}`);
    } else if (res.tipo === "rechazada") {
      setEdicion({ uid, valor, error: null, guardando: false });
      setAvisoLista({ tipo: "error", mensaje: res.error.mensaje, reintentar: res.error.reintentable ? () => { void guardarNombre(uid, valor); } : undefined });
    } else {
      // Renombrar es idempotente: reintento MANUAL permitido (nunca automático).
      setEdicion(null);
      setAvisoLista(avisoDesconocido({ tipo: "renombrar", uid, alias }, setAvisoLista, () => { void guardarNombre(uid, valor); }));
      setFoco(`renombrar-${uid}`);
    }
  }

  // Revocar (diálogo de confirmación)
  const [revocando, setRevocando] = useState<{ uid: string; nombre: string; ocupado: boolean; error: Fallo | null } | null>(null);

  async function confirmarRevocar() {
    if (!revocando || revocando.ocupado) return;
    const { uid, nombre } = revocando;
    setRevocando({ uid, nombre, ocupado: true, error: null });
    const res = await correr("revocar", () => servicio.revocarDispositivo(uid), {
      ok: () => setAvisoLista({ tipo: "ok", mensaje: TEXTOS.revocadaOk(nombre) }),
      error: (e) => setAvisoLista({ tipo: "error", mensaje: e.mensaje }),
    });
    if (!montado.current) return;
    if (res.tipo === "ok") {
      setRevocando(null);
      setAvisoLista({ tipo: "ok", mensaje: TEXTOS.revocadaOk(nombre) });
      setFocoRevocada(uid);
    } else if (res.tipo === "rechazada") {
      setRevocando({ uid, nombre, ocupado: false, error: { mensaje: res.error.mensaje, reintentable: res.error.reintentable } });
    } else {
      // Revocar es irreversible: nunca se repite solo ni se ofrece «Reintentar»; solo «Comprobar estado».
      setRevocando(null);
      setAvisoLista(avisoDesconocido({ tipo: "revocar", uid, nombre }, setAvisoLista));
      setFoco(`disp-${uid}`);
    }
  }

  // Foco tras acciones (el botón que abrió puede haber desaparecido)
  const [foco, setFoco] = useState<string | null>(null);
  const [focoRevocada, setFocoRevocada] = useState<string | null>(null);
  useEffect(() => {
    if (!foco) return;
    const el = document.getElementById(foco);
    if (el) { el.focus(); setFoco(null); }
  }, [foco, lista]);
  useEffect(() => {
    if (!focoRevocada) return;
    const d = lista.find((x) => x.uid === focoRevocada);
    const el = document.getElementById(`disp-${focoRevocada}`);
    if (d?.estado === "revocado" && el) { el.focus(); setFocoRevocada(null); }
  }, [focoRevocada, lista]);

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto" data-testid="pagina-dispositivos" data-estado-pantalla={estado}>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">{TEXTOS.titulo}</h1>
        <p className="text-slate-600 text-sm mt-1">{TEXTOS.subtitulo}</p>
      </header>

      <div role="note" className="mb-6 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
        <Info size={18} className="mt-0.5 flex-shrink-0 text-blue-700" aria-hidden="true" />
        <p>{NOTA_VINCULADA_NO_CONECTADA}</p>
      </div>

      {estado === "sin_permisos" ? (
        <Card className="p-8 text-center" >
          <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-4" aria-hidden="true">
            <ShieldAlert size={26} aria-hidden="true" />
          </div>
          <h2 className="text-base font-bold text-slate-900 mb-2" data-testid="sin-permisos">No tienes acceso a esta sección</h2>
          <p className="text-sm text-slate-700 max-w-md mx-auto">
            Tu cuenta no tiene permiso para gestionar Quest, o esta función todavía no está activada.
            Si crees que es un error, consulta con el administrador del centro.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* ── Vincular una Quest ── */}
          <Card className="p-5 md:p-6">
            <section aria-labelledby="titulo-vincular">
            <h2 id="titulo-vincular" className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Link2 size={18} className="text-blue-700" aria-hidden="true" /> Vincular una Quest
            </h2>
            <ol className="mt-4 space-y-3" aria-label="Pasos para vincular una Quest">
              {TEXTOS.pasos.map((p, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-slate-700">
                  <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-800 font-bold text-sm flex items-center justify-center flex-shrink-0" aria-hidden="true">{i + 1}</span>
                  <span><span className="sr-only">Paso {i + 1}: </span>{p}</span>
                </li>
              ))}
            </ol>

            <form className="mt-5 grid gap-4 sm:grid-cols-2" noValidate onSubmit={(e) => { e.preventDefault(); void vincular(); }}>
              <div>
                <label htmlFor={idCodigo} className="block text-sm font-semibold text-slate-700 mb-1">Código de la Quest</label>
                <input id={idCodigo} ref={campoCodigo} value={mostrarCodigo(codigo)} placeholder="ABCD-EFGH" inputMode="text"
                  autoComplete="off" autoCapitalize="characters" spellCheck={false} disabled={vinculando}
                  onChange={(e) => { setCodigo(limpiarEntradaCodigo(e.target.value)); if (errCodigo) setErrCodigo(null); }}
                  aria-invalid={errCodigo ? true : undefined} aria-describedby={`${idCodigo}-ayuda ${idCodigo}-error`}
                  className={cx(CAMPO, "font-mono tracking-widest text-base uppercase", errCodigo ? "border-rose-600" : "border-slate-500")} />
                <p id={`${idCodigo}-ayuda`} className="text-xs text-slate-600 mt-1.5">8 letras y números. No lleva 0, 1, O, I ni L.</p>
                <p id={`${idCodigo}-error`} aria-live="polite" className="text-sm font-medium text-rose-800 mt-1 empty:hidden">{errCodigo ?? ""}</p>
              </div>
              <div>
                <label htmlFor={idAliasNuevo} className="block text-sm font-semibold text-slate-700 mb-1">
                  Nombre de la Quest <span className="font-normal text-slate-600">(opcional)</span>
                </label>
                <input id={idAliasNuevo} ref={campoAlias} value={aliasNuevo} placeholder="Quest consulta 1" maxLength={MAX_ALIAS + 10}
                  autoComplete="off" spellCheck={false} disabled={vinculando}
                  onChange={(e) => { setAliasNuevo(e.target.value); if (errAlias) setErrAlias(null); }}
                  aria-invalid={errAlias ? true : undefined} aria-describedby={`${idAliasNuevo}-ayuda ${idAliasNuevo}-error`}
                  className={cx(CAMPO, errAlias ? "border-rose-600" : "border-slate-500")} />
                <p id={`${idAliasNuevo}-ayuda`} className="text-xs text-slate-600 mt-1.5">Para reconocerla en la lista. Hasta {MAX_ALIAS} caracteres.</p>
                <p id={`${idAliasNuevo}-error`} aria-live="polite" className="text-sm font-medium text-rose-800 mt-1 empty:hidden">{errAlias ?? ""}</p>
              </div>
              <div className="sm:col-span-2">
                <button type="submit" disabled={vinculando} aria-busy={vinculando} className={cx(BTN_PRIMARIO, "w-full sm:w-auto")}>
                  {vinculando ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Link2 size={16} aria-hidden="true" />}
                  {vinculando ? "Vinculando…" : "Vincular"}
                </button>
              </div>
            </form>
            <div className="mt-4"><ZonaResultado aviso={avisoVincular} id="resultado-vincular" /></div>
            </section>
          </Card>

          {/* ── Mis Quest ── */}
          <Card className="p-5 md:p-6">
            <section aria-labelledby="titulo-lista">
            <h2 id="titulo-lista" className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Headset size={18} className="text-blue-700" aria-hidden="true" /> Mis Quest
              {estado === "lista" && <span className="text-sm font-semibold text-slate-600">({visibles.length})</span>}
            </h2>
            <div className="mt-3"><ZonaResultado aviso={avisoLista} id="resultado-lista" /></div>

            {estado === "cargando" && (
              <div role="status" className="mt-4" data-testid="cargando">
                <p className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Loader2 size={16} className="animate-spin text-blue-700" aria-hidden="true" /> Cargando tus Quest…
                </p>
                <div className="mt-3 space-y-3" aria-hidden="true">
                  <div className="h-[72px] rounded-xl bg-slate-100 animate-pulse" />
                  <div className="h-[72px] rounded-xl bg-slate-100 animate-pulse" />
                </div>
              </div>
            )}

            {estado === "error" && errorCarga && (
              <div role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4" data-testid="error-carga">
                <p className="flex items-start gap-2 text-sm text-rose-900">
                  <AlertTriangle size={18} className="mt-0.5 flex-shrink-0 text-rose-700" aria-hidden="true" />
                  <span><strong className="font-semibold">No se pudieron cargar tus Quest.</strong> {errorCarga.mensaje}</span>
                </p>
                <button type="button" onClick={() => setIntentoCarga((n) => n + 1)} className={cx(BTN_SECUNDARIO, "mt-3")}>
                  <RotateCcw size={14} aria-hidden="true" /> Reintentar
                </button>
              </div>
            )}

            {estado === "vacio" && (
              <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-8 text-center" data-testid="vacio">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center mx-auto mb-3" aria-hidden="true">
                  <Headset size={22} aria-hidden="true" />
                </div>
                <p className="text-sm font-bold text-slate-900">Todavía no has vinculado ninguna Quest</p>
                <p className="text-sm text-slate-600 mt-1">Sigue los pasos de arriba para vincular la primera.</p>
              </div>
            )}

            {estado === "lista" && (
              <ul className="mt-4 space-y-3" aria-label="Quest vinculadas a tu cuenta">
                {visibles.map((d) => (
                  <FilaDispositivo key={d.uid} d={d}
                    editando={edicion && edicion.uid === d.uid ? edicion : null}
                    onEditar={() => { setAvisoLista(null); setEdicion({ uid: d.uid, valor: d.alias ?? "", error: null, guardando: false }); }}
                    onCancelarEdicion={() => { setEdicion(null); setFoco(`renombrar-${d.uid}`); }}
                    onGuardar={(v) => { void guardarNombre(d.uid, v); }}
                    onRevocar={() => { setAvisoLista(null); setRevocando({ uid: d.uid, nombre: nombreDispositivo(d), ocupado: false, error: null }); }} />
                ))}
              </ul>
            )}
            </section>
          </Card>
        </div>
      )}

      {revocando && (
        <DialogoConfirmacion
          titulo={TEXTOS.revocarTitulo(revocando.nombre)}
          descripcion={TEXTOS.revocarCuerpo.map((t, i) => <p key={i}>{t}</p>)}
          etiquetaConfirmar="Sí, revocar"
          ocupado={revocando.ocupado}
          error={revocando.error}
          onConfirmar={() => { void confirmarRevocar(); }}
          onCancelar={() => setRevocando(null)} />
      )}
    </div>
  );
}
