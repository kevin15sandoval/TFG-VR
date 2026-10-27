// Siembra SINTÉTICA para los emuladores locales (Auth + Firestore). NO es seed.mjs (ese apunta a producción).
//
// Seguridad por construcción: aborta (código 1) salvo que
//   - FIRESTORE_EMULATOR_HOST y FIREBASE_AUTH_EMULATOR_HOST estén definidas y apunten a 127.0.0.1/localhost,
//   - todo projectId presente (SEED_PROJECT_ID, GCLOUD_PROJECT, GOOGLE_CLOUD_PROJECT) empiece por "demo-".
// No usa cert(), service account ni credenciales. Con firebase-admin y las variables de emulador, el SDK habla
// con el emulador sin credenciales. Se eligió firebase-admin (ya es devDependency) porque el rol y email_verified
// solo los escribe Admin SDK; la solicitud de la gafa va por REST con un ID token anónimo REAL, para pasar por
// las reglas exactamente igual que la Quest.
//
// Uso (emuladores arrancados con `pnpm emulators:dev`):
//   node --env-file=.env.emulator scripts/seed-emulator.mjs        (o `pnpm seed:emulator` con .env.emulator)
// Es idempotente: se puede ejecutar varias veces.
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

function abortar(msg) {
  console.error(`[seed-emulator] ABORTADO: ${msg}`);
  console.error('[seed-emulator] Este script solo puede ejecutarse contra emuladores locales con projectId "demo-*".');
  process.exit(1);
}

const LOCAL = new Set(['127.0.0.1', 'localhost']);
function comprobarHost(nombre) {
  const valor = process.env[nombre];
  if (!valor) abortar(`falta la variable ${nombre}.`);
  const m = /^([^:/\s]+):(\d{1,5})$/.exec(valor);
  if (!m || !LOCAL.has(m[1])) abortar(`${nombre}="${valor}" no es 127.0.0.1:<puerto> ni localhost:<puerto>.`);
  return valor;
}

const fsHost = comprobarHost('FIRESTORE_EMULATOR_HOST');
const authHost = comprobarHost('FIREBASE_AUTH_EMULATOR_HOST');

for (const v of ['SEED_PROJECT_ID', 'GCLOUD_PROJECT', 'GOOGLE_CLOUD_PROJECT']) {
  if (process.env[v] && !process.env[v].startsWith('demo-')) abortar(`${v}="${process.env[v]}" no empieza por "demo-".`);
}
const projectId = process.env.SEED_PROJECT_ID ?? process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT ?? 'demo-tfg-vr';
if (!projectId.startsWith('demo-')) abortar(`projectId "${projectId}" no empieza por "demo-".`);

// ---------------------------------------------------------------- datos sintéticos
const PASSWORD = 'PruebaSintetica-123';
const USUARIOS = [
  { uid: 'fisio-sintetico', email: 'fisio.sintetico@example.test', emailVerified: true, rol: 'fisioterapeuta' },
  { uid: 'admin-sintetico', email: 'admin.sintetico@example.test', emailVerified: true, rol: 'admin' },
  // Para PR5b (bloqueo): con doc de rol pero sin verificar, y verificado pero sin doc de rol.
  { uid: 'noverificado-sintetico', email: 'noverificado.sintetico@example.test', emailVerified: false, rol: 'fisioterapeuta' },
  { uid: 'sinrol-sintetico', email: 'sinrol.sintetico@example.test', emailVerified: true, rol: null },
];
const FECHA_FIJA = Timestamp.fromDate(new Date('2026-01-01T00:00:00Z'));
const PACIENTES = [1, 2, 3].map((n) => ({
  id: `paciente-sintetico-${n}`,
  name: `PACIENTE-SINTETICO-${n}`,
  initials: `PS${n}`,
  age: 60 + n,
  affectedSide: ['Derecho', 'Izquierdo', 'Ambos'][n - 1],
  lastSession: '2026-01-15',
  progress: 10 * n,
  diagnosis: 'Dato sintético de prueba',
  sessions: n,
  status: 'activo',
  colorIdx: n,
  notes: 'Paciente sintético. No es una persona real.',
  // Sin alias/pid: la identidad pseudónima (P-NNN + pid) la asigna app/patientIdentity.ts (PR5c-3a) de forma perezosa.
  createdAt: FECHA_FIJA,
}));
const CODIGO_GAFA = 'PRUEBAS2'; // 8 símbolos del alfabeto válido de las reglas

initializeApp({ projectId });
const auth = getAuth();
const db = getFirestore();

async function sembrarUsuario(u) {
  const props = { email: u.email, password: PASSWORD, emailVerified: u.emailVerified, displayName: u.uid };
  try {
    await auth.getUser(u.uid);
    await auth.updateUser(u.uid, props);
  } catch (e) {
    if (e.code !== 'auth/user-not-found') throw e;
    await auth.createUser({ uid: u.uid, ...props });
  }
  const ref = db.doc(`usuarios/${u.uid}`);
  if (u.rol) await ref.set({ rol: u.rol, creadoEn: FECHA_FIJA });
  else await ref.delete();
}

async function post(url, body, token) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`HTTP ${r.status} en ${url}: ${JSON.stringify(j).slice(0, 300)}`);
  return j;
}

async function existeAnonimo(uid) {
  try { return (await auth.getUser(uid)).providerData.length === 0; } catch { return false; }
}

// Gafa simulada: usuario anónimo REAL + batch dispositivos/{uid} + vinculos/{codigo} (contrato de la Quest).
async function sembrarGafa() {
  const vincRef = db.doc(`vinculos/${CODIGO_GAFA}`);
  const previo = await vincRef.get();
  if (previo.exists) {
    const d = previo.data();
    const disp = await db.doc(`dispositivos/${d.deviceUid}`).get();
    if (d.estado === 'pendiente' && d.expira.toMillis() > Date.now() + 60_000
        && disp.exists && disp.data().estado === 'sin_vincular' && await existeAnonimo(d.deviceUid)) {
      return d.deviceUid; // ya está bien: idempotente
    }
    await db.doc(`dispositivos/${d.deviceUid}`).delete();
    await vincRef.delete();
    try { await auth.deleteUser(d.deviceUid); } catch { /* ya no existe */ }
  }
  const su = await post(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key`, { returnSecureToken: true });
  const uid = su.localId;
  const expira = new Date(Date.now() + 9 * 60_000).toISOString(); // las reglas exigen <= 10 min
  const base = `projects/${projectId}/databases/(default)/documents`;
  await post(`http://${fsHost}/v1/${base}:commit`, {
    writes: [
      {
        update: {
          name: `${base}/dispositivos/${uid}`,
          fields: { estado: { stringValue: 'sin_vincular' }, codigoActual: { stringValue: CODIGO_GAFA } },
        },
        updateTransforms: [{ fieldPath: 'creadoEn', setToServerValue: 'REQUEST_TIME' }],
        currentDocument: { exists: false },
      },
      {
        update: {
          name: `${base}/vinculos/${CODIGO_GAFA}`,
          fields: {
            deviceUid: { stringValue: uid }, estado: { stringValue: 'pendiente' }, usado: { booleanValue: false },
            expira: { timestampValue: expira },
          },
        },
        updateTransforms: [{ fieldPath: 'creadoEn', setToServerValue: 'REQUEST_TIME' }],
        currentDocument: { exists: false },
      },
    ],
  }, su.idToken);
  return uid;
}

for (const u of USUARIOS) await sembrarUsuario(u);
for (const { id, ...p } of PACIENTES) await db.doc(`pacientes/${id}`).set(p);
const gafaUid = await sembrarGafa();

console.log(`[seed-emulator] OK en proyecto ${projectId} (Auth ${authHost}, Firestore ${fsHost})`);
console.log(`[seed-emulator] usuarios: ${USUARIOS.map((u) => u.email).join(', ')}  (contraseña sintética: ${PASSWORD})`);
console.log(`[seed-emulator] pacientes: ${PACIENTES.length}; gafa anónima ${gafaUid} con código pendiente ${CODIGO_GAFA}`);
