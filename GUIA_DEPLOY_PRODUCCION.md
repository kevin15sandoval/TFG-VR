# 🚀 GUÍA DE DEPLOY A PRODUCCIÓN

**Fecha**: 6 de Julio, 2026  
**Estado**: ✅ DEPLOY COMPLETADO EXITOSAMENTE

---

## 🌐 URL DE PRODUCCIÓN

**Plataforma Clínica Web**:
```
https://tfg-vr.web.app
```

**Firebase Console**:
```
https://console.firebase.google.com/project/tfg-vr/overview
```

---

## ✅ DEPLOY COMPLETADO

### Archivos desplegados:
- ✅ `index.html`
- ✅ `assets/index-*.js` (1.8 MB)
- ✅ `assets/index-*.css` (114 KB)
- ✅ Librerías: html2canvas, purify

### Configuración aplicada:
- ✅ Rewrites para SPA (Single Page Application)
- ✅ Headers CORS para WASM/PCK
- ✅ Content-Type correcto para todos los recursos

---

## 🔧 CONFIGURACIÓN DE LAS GAFAS VR

### ⚠️ IMPORTANTE: Actualizar URL en Firebase Manager

Las gafas VR necesitan apuntar a la nueva URL de producción en lugar de localhost.

**Archivo a modificar**: `scripts/firebase_manager.gd`

**Cambiar**:
```gdscript
# ANTES (desarrollo)
const API_URL = "http://localhost:5000/sesion_activa/current"

# DESPUÉS (producción)
const API_URL = "https://firestore.googleapis.com/v1/projects/tfg-vr/databases/(default)/documents/sesion_activa/current"
```

**Nota**: Las gafas VR no acceden a la web en sí, acceden directamente a Firestore REST API, así que la URL ya está correcta en el código actual.

---

## 🎮 CÓMO USAR EL SISTEMA EN PRODUCCIÓN

### 1. Fisioterapeuta accede a la web

**URL**: https://tfg-vr.web.app

1. Abre el navegador en cualquier dispositivo
2. Ve a: https://tfg-vr.web.app
3. Gestiona pacientes
4. Inicia sesiones VR

### 2. Paciente con Meta Quest

1. Se pone las gafas Meta Quest
2. Inicia app **NeuroVR Rehab**
3. Ve sala de espera
4. Espera a que fisioterapeuta inicie sesión

### 3. Conexión automática

- ✅ Las gafas hacen polling a Firestore cada 3 segundos
- ✅ Firestore está en la nube (accesible desde cualquier lugar)
- ✅ Cuando fisioterapeuta crea sesión en web, gafas la detectan
- ✅ Juego inicia automáticamente

---

## 📱 ACCESO DESDE DIFERENTES DISPOSITIVOS

### PC/Laptop
```
https://tfg-vr.web.app
```

### Tablet
```
https://tfg-vr.web.app
```

### Smartphone
```
https://tfg-vr.web.app
```

**Diseño responsive**: La plataforma se adapta a todos los tamaños de pantalla.

---

## 🔐 SEGURIDAD

### Reglas de Firestore

Las reglas actuales permiten:
- ✅ **Lectura pública** de `sesion_activa` (para que las gafas puedan leer)
- ✅ **Escritura pública** de `sesiones` (para que las gafas puedan guardar métricas)
- ✅ **Lectura/Escritura pública** de `pacientes` (para gestión desde web)

**⚠️ Para producción real con pacientes, considera:**
- Añadir autenticación (Firebase Auth)
- Restringir reglas de Firestore con autenticación
- Implementar roles (fisioterapeuta vs admin)

### Archivo de reglas actual:
```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Sesión activa (lectura para gafas)
    match /sesion_activa/{document=**} {
      allow read: if true;
      allow write: if true;
    }
    
    // Sesiones guardadas (escritura desde gafas)
    match /sesiones/{document=**} {
      allow read: if true;
      allow write: if true;
    }
    
    // Pacientes (lectura/escritura desde web)
    match /pacientes/{document=**} {
      allow read: if true;
      allow write: if true;
    }
  }
}
```

---

## 🔄 CÓMO ACTUALIZAR LA PLATAFORMA WEB

Cuando hagas cambios en la plataforma clínica:

```powershell
# 1. Ir a carpeta
cd C:\Users\USUARIO\Documents\tfg\Plataforma_Clinica

# 2. Hacer cambios en el código (App.tsx, etc.)

# 3. Construir nueva versión
npm run build

# 4. Desplegar a Firebase
npx firebase-tools deploy --only hosting

# 5. Verificar
# Abrir https://tfg-vr.web.app en navegador
```

**Tiempo de deploy**: ~30 segundos

---

## 📊 MONITOREO Y ANALYTICS

### Firebase Console

```
https://console.firebase.google.com/project/tfg-vr
```

Puedes ver:
- ✅ **Hosting**: Tráfico, ancho de banda usado
- ✅ **Firestore**: Documentos, lecturas/escrituras
- ✅ **Analytics**: Visitas, usuarios activos (si está configurado)

### Logs de Hosting

En Firebase Console → Hosting → Usage:
- Requests totales
- Ancho de banda
- Países de origen

---

## 🧪 TESTING EN PRODUCCIÓN

### Probar desde web:

1. Abre https://tfg-vr.web.app
2. Crea un paciente de prueba
3. Inicia una sesión
4. Verifica en Firestore que se creó el documento en `sesion_activa/current`

### Probar con gafas VR:

1. Asegúrate de que Meta Quest tiene WiFi
2. Inicia app NeuroVR Rehab
3. Debería ver "Sala de espera"
4. Desde web, inicia sesión
5. En gafas debería detectar en ~3 segundos

---

## ⚡ RESOLUCIÓN DE PROBLEMAS

### Problema: Gafas no detectan sesión

**Verificar**:
1. ✅ Meta Quest tiene conexión a Internet
2. ✅ URL de Firestore correcta en `firebase_manager.gd`
3. ✅ Documento existe en Firestore: `sesion_activa/current`

**Solución**:
```powershell
# Capturar logs de las gafas
adb logcat | findstr "Firebase\|HTTP\|Polling"
```

### Problema: Web no carga

**Verificar**:
1. ✅ URL correcta: https://tfg-vr.web.app
2. ✅ Deploy completado: `npx firebase-tools deploy --only hosting`
3. ✅ Archivos en `dist/` folder

### Problema: Cambios no se ven

**Solución**:
```powershell
# Limpiar caché del navegador
Ctrl + Shift + R (Chrome/Edge)
Cmd + Shift + R (Mac)

# O hacer hard refresh en la web
```

---

## 💰 COSTOS DE FIREBASE (Plan Spark - Gratis)

### Límites del plan gratuito:

| Servicio | Límite Gratis | Suficiente para |
|----------|---------------|-----------------|
| **Firestore** | 50K lecturas/día | ~16K sesiones/día |
| **Firestore** | 20K escrituras/día | ~20K sesiones/día |
| **Hosting** | 10 GB almacenamiento | Muchas apps SPA |
| **Hosting** | 360 MB/día transferencia | ~3600 visitas/día |

**Para tu TFG**: El plan gratuito es más que suficiente.

**Si necesitas más**: Actualizar a plan Blaze (pay-as-you-go).

---

## 📋 CHECKLIST DE PRODUCCIÓN

### ✅ Deploy completado:
- ✅ Web desplegada en https://tfg-vr.web.app
- ✅ Firestore configurado y accesible
- ✅ APK de gafas VR funcionando con Firestore

### ✅ Testing:
- ✅ Web accesible desde navegador
- ✅ Gestión de pacientes funciona
- ✅ Creación de sesiones funciona
- ✅ Gafas detectan sesiones (~3 seg)
- ✅ Juegos cargan correctamente
- ✅ Métricas se guardan en Firestore

### ⚠️ Pendientes (opcional):
- ⏸️ Autenticación de usuarios (Firebase Auth)
- ⏸️ Roles y permisos
- ⏸️ Backup automático de datos
- ⏸️ Analytics avanzado
- ⏸️ Custom domain (ej: neurovr-rehab.com)

---

## 🎯 PRÓXIMOS PASOS RECOMENDADOS

### Para Demo/Presentación TFG:

1. ✅ Usa https://tfg-vr.web.app
2. ✅ Prepara un paciente de prueba
3. ✅ Ten las gafas Meta Quest cargadas y conectadas a WiFi
4. ✅ Practica el flujo completo varias veces

### Para Producción Real (Clínica):

1. ⚠️ Implementar autenticación
2. ⚠️ Configurar reglas de seguridad Firestore
3. ⚠️ Añadir SSL/Custom Domain (opcional)
4. ⚠️ Configurar backups automáticos
5. ⚠️ Monitoreo de errores (Sentry, etc.)

---

## 🏆 SISTEMA DESPLEGADO

| Componente | URL/Ubicación | Estado |
|------------|---------------|--------|
| **Web Clínica** | https://tfg-vr.web.app | ✅ ONLINE |
| **Firestore** | tfg-vr (default) database | ✅ ACTIVO |
| **APK Gafas** | Meta Quest (instalación manual) | ✅ FUNCIONAL |
| **Firebase Console** | https://console.firebase.google.com/project/tfg-vr | ✅ ACCESIBLE |

---

## 📞 SOPORTE

Si tienes problemas con el deploy:

1. Verifica Firebase Console: https://console.firebase.google.com/project/tfg-vr
2. Revisa logs de hosting
3. Prueba `npx firebase-tools deploy --only hosting` de nuevo

---

**Deploy completado**: 6 de Julio, 2026  
**URL de producción**: https://tfg-vr.web.app  
**Estado**: ✅ SISTEMA EN PRODUCCIÓN

