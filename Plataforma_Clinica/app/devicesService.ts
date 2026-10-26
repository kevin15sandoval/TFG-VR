// Instancia del servicio de dispositivos ligada a la app (Firebase real o emuladores según app/firebase.ts).
// Sin pantallas todavía: las usarán PR5c-2/PR5c-3.
import { db, auth } from "./firebase";
import { crearServicioDispositivos } from "./devices";

export const dispositivos = crearServicioDispositivos({ db, auth });
export {
  ErrorDispositivo, siguienteAliasPaciente, normalizarCodigo,
  type DispositivoVista, type SesionParaDispositivo,
} from "./devices";
