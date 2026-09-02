# React SGPI

Frontend React independiente para la API Laravel de SGPI.

## Inicio local

```bash
cd React_Swgpi
copy .env.example .env
npm install
npm run dev
```

Por defecto, el frontend utiliza la API en línea:
`https://apiswgpi-production-0e59.up.railway.app/api`. Para usar otra URL en un
entorno controlado, modifica `VITE_API_URL` en `.env`.

## APK Android distribuible

La compilación móvil utiliza `.env.production`, por lo que nunca debe apuntar a
`127.0.0.1` o `localhost`: esas direcciones representan al propio teléfono. Para
preparar y firmar una APK release:

```bash
npm run android:release:linux
```

En Windows utiliza:

```powershell
npm run android:release:windows
```

El artefacto queda en `android/app/build/outputs/apk/release/app-release.apk` y
se firma con la configuración local de `android/app/keystore.properties`.
Conserva siempre el mismo keystore para futuras actualizaciones e incrementa
`versionCode`. Si un dispositivo tiene una compilación debug o una APK firmada
con otra llave usando `mx.edu.itssmt.sgpi`, debe desinstalarla antes de instalar
la release oficial.

## Verificación

```bash
npm run lint
npm test
npm run build
```

## Módulos incluidos

- Autenticación JWT, persistencia opcional y recuperación de contraseña.
- Navegación protegida para administrador, docente y estudiante.
- Dashboards conectados a los endpoints reales de Laravel.
- Usuarios, proyectos, entregables, evaluaciones y gestión académica.
- Upload, descarga y calificación de entregables.
- Repositorio público y autenticado.
- Perfil, tema claro/oscuro y diseño adaptable.
