# KhypuPyme

Cuaderno digital para micro y pequeños comercios de Bolivia. Base local de las fases 0 y 1; **no es una versión comercial ni registra ventas todavía**.

Funciona con React, TypeScript estricto, Vite, React Router y Firebase Emulator. Registro, ingreso, cierre de sesión, solicitud de recuperación y creación/consulta/edición del negocio usan persistencia real en los emuladores. Moneda BOB y zona America/La_Paz. Los datos de desarrollo son ficticios.

El propietario requiere una aplicación descargable e instalable. Android y Windows están en preparación; esta base todavía no incluye APK ni instalador de escritorio.

## Ejecutar en Windows

Requisitos: Node.js **24 LTS >=24.12**, pnpm **11.25.0**, JDK **21 LTS o superior** para Firestore. Las versiones están fijadas en `package.json` y `pnpm-lock.yaml`. No se requiere Firebase Console, login de Firebase, facturación ni credenciales privadas.

```powershell
Set-Location 'C:\Users\ramir\OneDrive\Documentos\ChatGPT\Proyecto de Grado'
pnpm install --frozen-lockfile
# Terminal 1: Auth + Firestore + panel local
.\scripts\local.ps1 emulators
# Terminal 2
.\scripts\local.ps1 dev
```

Abrir http://127.0.0.1:5173. Panel de emuladores: http://127.0.0.1:4000. Los puertos 5173, 8080, 9099 y 4000 deben estar libres. El script local puede usar Node/pnpm incluidos en Codex y el JDK encontrado en `.jdks`, sin cambiar el PATH del sistema. Si PowerShell bloquea scripts, ejecutar los comandos `pnpm dev` y `pnpm emulators` con Node, pnpm y Java disponibles en la terminal; no es necesario reducir la política global de ejecución.

La configuración funciona sin `.env.local`. `.env.example` muestra las dos opciones admitidas; esta versión rechaza proyectos sin prefijo `demo-` y no permite desactivar emuladores. Firebase CLI está instalado **dentro del proyecto**, sin instalación global. El primer arranque descarga los componentes de Emulator Suite. Se escucha exclusivamente en loopback; para probar en un teléfono físico hará falta preparar acceso y HTTPS por separado.

Los datos locales se importan desde `.emulator-data` si existe y se exportan allí al apagar normalmente los emuladores. Esa carpeta está excluida de Git y **no constituye un respaldo comercial**. Los tests usan emuladores efímeros y pueden borrar sus datos: detener primero la sesión interactiva y no importar datos al ejecutar tests.

## Si npm no aparece

La auditoría comprobó `npm.cmd --version`, `Get-Command npm*`, Program Files, AppData/Roaming/npm y el runtime de Codex: este último proporciona Node y pnpm, pero no npm. No es un impedimento para trabajar aquí.

Para disponer de npm fuera de Codex: descargar el instalador oficial **Node.js 24 LTS** desde https://nodejs.org/, mantener activadas las opciones de npm y PATH, cerrar y abrir PowerShell y comprobar `node --version`, `npm.cmd --version` y `Get-Command npm*`. Si Node ya está instalado por el instalador oficial, usar su opción Repair/Modify para reponer npm. Después instalar el gestor fijado con `npm.cmd install --global pnpm@11.25.0`. No se hizo ninguna instalación global durante esta preparación; no generar un segundo lockfile con npm.

## Verificaciones

```powershell
.\scripts\local.ps1 check
pnpm exec playwright install chromium webkit
# Apagar antes cualquier emulador interactivo en estos puertos:
.\scripts\local.ps1 test:emulators
```

`check` ejecuta lint, typecheck, unitarias/componentes y build. `test:emulators` inicia y apaga Auth/Firestore, ejecuta integración, Security Rules y E2E sobre el build. También existen scripts separados `test:integration`, `test:rules`, `test:e2e` para emuladores ya iniciados con las variables correspondientes. Playwright cubre Chromium de escritorio/móvil y WebKit móvil; no reemplaza pruebas en teléfonos físicos. Evidencias, resultados y límites: [docs/testing/validation.md](docs/testing/validation.md).

## Estructura y alcance

- `src/features/auth`: contrato `AuthService`, clase adaptadora `FirebaseAuthService` e interfaz de sesión; Firebase no está acoplado al formulario.
- `src/features/business`: dominio, contrato `BusinessRepository`, clase `FirestoreBusinessRepository` e interfaz del negocio.
- `src/config`, `src/infrastructure`, `src/shared`, `src/app`: configuración, adaptadores, componentes y navegación.
- `firestore.rules`, `tests/`: autorización, integración, componentes y recorridos de navegador.
- `public/`: manifest, iconos y service worker sin caché de información comercial. Producción del build se puede revisar localmente con `pnpm build` y `pnpm preview`.
- `docs/`: auditoría, requisitos, decisiones, modelo, validación y preparación del lanzamiento.

No se implementaron ventas, inventario, gastos, fiados, indicadores ni exportaciones. La pantalla inicial indica esta limitación; no muestra cifras inventadas. Sin conexión se deshabilita el guardado, no hay cola comercial offline ni confirmaciones optimistas. La recuperación genera un enlace en la terminal de Auth Emulator; no envía correos reales.

## Continuidad

Repositorio único: https://github.com/Ramiro-sakv/khypupyme-app. El remoto estaba vacío; no había código ni historial recuperable en él. Rama de preparación: `chore/project-setup`. No se ha hecho push ni despliegue. Antes de los módulos comerciales se requiere revisar [arquitectura](docs/architecture/overview.md), [trazabilidad](docs/requirements/traceability.md) y [decisiones pendientes](docs/decisions/0001-foundation.md).

El dossier original de 21 páginas, Final V2 del 30/06/2026, es la fuente de requisitos; no se incorpora el PDF a este repositorio público. Su huella y la extracción documentada están en los requisitos. Los respaldos y la restauración real, el entorno Firebase de pruebas, la privacidad, los términos y la validación con usuarios siguen pendientes antes del piloto.
