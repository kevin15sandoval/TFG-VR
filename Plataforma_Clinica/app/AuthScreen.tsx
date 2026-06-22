import { useState } from "react";
import { Brain, Mail, Lock, Eye, EyeOff, Loader2, User, ArrowRight, KeyRound } from "lucide-react";
import { login, register, resetPassword, authErrorMsg } from "./auth";

type AuthView = "login" | "register" | "reset";

function cx(...cls: (string | false | null | undefined)[]) {
  return cls.filter(Boolean).join(" ");
}

// ─── INPUT ────────────────────────────────────────────────────────────────────

function Input({
  label, type = "text", value, onChange, placeholder, error, icon: Icon, rightIcon, onRightClick, autoComplete,
}: {
  label: string; type?: string; value: string;
  onChange: (v: string) => void; placeholder?: string;
  error?: string; icon?: React.ElementType;
  rightIcon?: React.ElementType; onRightClick?: () => void;
  autoComplete?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1.5">{label}</label>
      <div className="relative">
        {Icon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            <Icon size={15} />
          </div>
        )}
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={cx(
            "w-full py-3 rounded-xl border text-sm text-slate-800 bg-white placeholder-slate-400",
            "focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all",
            Icon ? "pl-10" : "pl-4",
            rightIcon ? "pr-10" : "pr-4",
            error ? "border-rose-400 focus:border-rose-400" : "border-slate-200 focus:border-blue-400"
          )}
        />
        {rightIcon && (
          <button type="button" onClick={onRightClick}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer transition-colors">
            {<rightIcon size={15} />}
          </button>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-rose-500">{error}</p>}
    </div>
  );
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────

function LoginForm({ onSwitch }: { onSwitch: (v: AuthView) => void }) {
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) { setError("Rellena todos los campos"); return; }
    setLoading(true); setError("");
    try {
      await login(email, password);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      setError(authErrorMsg(code));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="Correo electrónico" type="email" value={email} onChange={setEmail}
        placeholder="terapeuta@hospital.es" icon={Mail} autoComplete="email" />
      <Input label="Contraseña" type={showPw ? "text" : "password"} value={password}
        onChange={setPassword} placeholder="••••••••" icon={Lock}
        rightIcon={showPw ? EyeOff : Eye} onRightClick={() => setShowPw(p => !p)}
        autoComplete="current-password" />

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-xs text-rose-600 font-medium">
          {error}
        </div>
      )}

      <button type="submit" disabled={loading}
        className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-bold flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md shadow-blue-200">
        {loading ? <><Loader2 size={16} className="animate-spin" /> Iniciando sesión...</> : <>Iniciar sesión <ArrowRight size={15} /></>}
      </button>

      <div className="flex items-center justify-between text-xs pt-1">
        <button type="button" onClick={() => onSwitch("reset")}
          className="text-slate-400 hover:text-blue-600 cursor-pointer transition-colors">
          ¿Olvidaste tu contraseña?
        </button>
        <button type="button" onClick={() => onSwitch("register")}
          className="text-blue-600 hover:text-blue-700 font-semibold cursor-pointer transition-colors">
          Crear cuenta
        </button>
      </div>
    </form>
  );
}

// ─── REGISTRO ─────────────────────────────────────────────────────────────────

function RegisterForm({ onSwitch }: { onSwitch: (v: AuthView) => void }) {
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [errors, setErrors]     = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState("");

  function validate() {
    const e: Record<string, string> = {};
    if (!name.trim())       e.name     = "El nombre es obligatorio";
    if (!email.trim())      e.email    = "El correo es obligatorio";
    if (password.length < 6) e.password = "Mínimo 6 caracteres";
    if (password !== confirm) e.confirm = "Las contraseñas no coinciden";
    return e;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true); setGlobalError(""); setErrors({});
    try {
      await register(email, password, name);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      setGlobalError(authErrorMsg(code));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="Nombre completo" value={name} onChange={v => { setName(v); setErrors(p => ({ ...p, name: "" })); }}
        placeholder="Dra. Sara Martínez" icon={User} error={errors.name} autoComplete="name" />
      <Input label="Correo electrónico" type="email" value={email}
        onChange={v => { setEmail(v); setErrors(p => ({ ...p, email: "" })); }}
        placeholder="terapeuta@hospital.es" icon={Mail} error={errors.email} autoComplete="email" />
      <Input label="Contraseña" type={showPw ? "text" : "password"} value={password}
        onChange={v => { setPassword(v); setErrors(p => ({ ...p, password: "" })); }}
        placeholder="Mínimo 6 caracteres" icon={Lock}
        rightIcon={showPw ? EyeOff : Eye} onRightClick={() => setShowPw(p => !p)}
        error={errors.password} autoComplete="new-password" />
      <Input label="Confirmar contraseña" type={showPw ? "text" : "password"} value={confirm}
        onChange={v => { setConfirm(v); setErrors(p => ({ ...p, confirm: "" })); }}
        placeholder="Repite la contraseña" icon={Lock} error={errors.confirm}
        autoComplete="new-password" />

      {globalError && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-xs text-rose-600 font-medium">
          {globalError}
        </div>
      )}

      <button type="submit" disabled={loading}
        className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-bold flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md shadow-blue-200">
        {loading ? <><Loader2 size={16} className="animate-spin" /> Creando cuenta...</> : <>Crear cuenta <ArrowRight size={15} /></>}
      </button>

      <p className="text-center text-xs text-slate-400 pt-1">
        ¿Ya tienes cuenta?{" "}
        <button type="button" onClick={() => onSwitch("login")}
          className="text-blue-600 hover:text-blue-700 font-semibold cursor-pointer">
          Inicia sesión
        </button>
      </p>
    </form>
  );
}

// ─── RECUPERAR CONTRASEÑA ─────────────────────────────────────────────────────

function ResetForm({ onSwitch }: { onSwitch: (v: AuthView) => void }) {
  const [email, setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent]     = useState(false);
  const [error, setError]   = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) { setError("Introduce tu correo electrónico"); return; }
    setLoading(true); setError("");
    try {
      await resetPassword(email);
      setSent(true);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      setError(authErrorMsg(code));
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="text-center py-4">
        <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
          <Mail size={24} className="text-emerald-600" />
        </div>
        <h3 className="text-base font-bold text-slate-800 mb-2">Correo enviado</h3>
        <p className="text-sm text-slate-500 mb-6">
          Hemos enviado un enlace de recuperación a <strong>{email}</strong>.
          Revisa también la carpeta de spam.
        </p>
        <button onClick={() => onSwitch("login")}
          className="text-sm text-blue-600 hover:text-blue-700 font-semibold cursor-pointer">
          Volver al inicio de sesión
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-slate-500">
        Introduce tu correo y te enviaremos un enlace para restablecer tu contraseña.
      </p>
      <Input label="Correo electrónico" type="email" value={email} onChange={setEmail}
        placeholder="terapeuta@hospital.es" icon={Mail} autoComplete="email" />
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-xs text-rose-600 font-medium">
          {error}
        </div>
      )}
      <button type="submit" disabled={loading}
        className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-bold flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md shadow-blue-200">
        {loading ? <><Loader2 size={16} className="animate-spin" /> Enviando...</> : <><KeyRound size={15} /> Enviar enlace</>}
      </button>
      <p className="text-center text-xs text-slate-400">
        <button type="button" onClick={() => onSwitch("login")}
          className="text-blue-600 hover:text-blue-700 font-semibold cursor-pointer">
          Volver al inicio de sesión
        </button>
      </p>
    </form>
  );
}

// ─── PANTALLA PRINCIPAL DE AUTH ───────────────────────────────────────────────

export default function AuthScreen() {
  const [view, setView] = useState<AuthView>("login");

  const titles: Record<AuthView, string> = {
    login:    "Bienvenido de nuevo",
    register: "Crear cuenta",
    reset:    "Recuperar contraseña",
  };
  const subtitles: Record<AuthView, string> = {
    login:    "Accede a la plataforma clínica NeuroVR Rehab",
    register: "Regístrate para acceder a la plataforma",
    reset:    "Te enviaremos un enlace de recuperación",
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-slate-100 flex items-center justify-center p-4">
      {/* Fondo decorativo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-blue-100/50 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-violet-100/50 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 shadow-xl shadow-blue-300/40 mb-4">
            <Brain size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-black text-slate-800">NeuroVR Rehab</h1>
          <p className="text-sm text-slate-500 mt-0.5">Plataforma clínica de rehabilitación VR</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100 p-8">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-800">{titles[view]}</h2>
            <p className="text-sm text-slate-400 mt-0.5">{subtitles[view]}</p>
          </div>

          {view === "login"    && <LoginForm    onSwitch={setView} />}
          {view === "register" && <RegisterForm onSwitch={setView} />}
          {view === "reset"    && <ResetForm    onSwitch={setView} />}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 mt-6">
          TFG · Rehabilitación de ictus con tecnología VR · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
