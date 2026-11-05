# Informe Fases 0 y 1 - 30/10/2026

## 1. Resumen

Repositorio oficial clonado desde remoto vacío, dossier Final V2 de 21 páginas leído completamente y base local implementada. No se implementaron módulos comerciales ni se creó infraestructura remota.

## 2. Cambios implementados

Registro, inicio/cierre de sesión, solicitud de recuperación local, rutas protegidas y creación/consulta/cambio de nombre del negocio con persistencia real en Auth/Firestore Emulator. Una cuenta propietaria por negocio, moneda BOB y zona America/La_Paz. Interfaz móvil/escritorio con etiquetas, foco, avisos accesibles y deshabilitación de guardado sin conexión.

Manifest, iconos 192/512 y service worker preparado en build: no almacena datos ni confirma operaciones offline; navegación offline devuelve una explicación. La instalación en dispositivos reales todavía no está certificada.

## 3. Archivos afectados

Todos son nuevos; no se sobrescribió código previo.

- Raíz: `README.md`, `AGENTS.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `.gitattributes`, `.gitignore`, `.env.example`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `eslint.config.js`, `index.html`.
- Firebase: `.firebaserc`, `firebase.json`, `firestore.rules`, `firestore.indexes.json`.
- Aplicación: `src/main.tsx`, `src/styles.css`, `src/app/App.tsx`, `src/config/environment.ts`, `src/infrastructure/{firebase,business-services}.ts`, `src/features/auth/{types,validation,auth-context}.ts`, `src/features/auth/{AuthProvider,AuthPage}.tsx`, `src/features/business/{domain,repository}.ts`, `src/features/business/BusinessPage.tsx`, `src/shared/errors.ts`, `src/shared/components/Feedback.tsx`, `src/shared/hooks/useOnline.ts`.
- PWA: `public/icon.svg`, `public/manifest.webmanifest`, `public/sw.js`, `public/icons/icon-{192,512}.png`.
- Operación/CI: `scripts/local.ps1`, `scripts/emulators.mjs`, `.github/workflows/quality.yml`.
- Tests: `src/config/environment.test.ts`, `src/features/auth/{validation.test.ts,AuthPage.test.tsx}`, `src/features/business/domain.test.ts`, `tests/setup.ts`, `tests/integration/account-business.test.ts`, `tests/rules/business.test.ts`, `tests/e2e/base.spec.ts`.
- Documentación: `docs/architecture/{audit,overview,data-model}.md`, `docs/requirements/{source-analysis,traceability}.md`, `docs/decisions/0001-foundation.md`, `docs/deployment/readiness.md`, este informe.

Los datos de emuladores, dependencias, build, trazas, reportes HTML y capturas generados se excluyen de Git. El PDF original no se copió al repositorio público.

## 4. Arquitectura

React/TypeScript estricto/Vite y Firebase, sin backend adicional. UI → contratos inyectables → adaptadores Firebase; Firestore se descarga al solicitar el perfil. `businessId = uid` y propietario inmutable bajo reglas; esquemas exactos, timestamps de servidor y denegación del resto. Clasificación y modelo: `docs/architecture/overview.md` y `data-model.md`.

## 5. Pruebas y evidencia

| Comprobación | Estado | Resultado y alcance |
| --- | --- | --- |
| `pnpm install --frozen-lockfile --offline` | Aprobada | Reinstalación sin cambios de resolución, con caché local |
| Arranque interactivo desde cero | Aprobada | Lanzador sin carpeta de importación: Auth/Firestore/UI listos; Vite devuelve HTTP 200 en 127.0.0.1:5173 |
| `pnpm lint` | Aprobada | Cero errores/advertencias; incluye scripts nuevos |
| `pnpm typecheck` | Aprobada | TypeScript estricto sin errores |
| `pnpm test` | Aprobada | 16 pruebas, 4 archivos: configuración demo, validación de nombre/credenciales y errores/recuperación en componentes |
| `pnpm build` | Aprobada | Build compilado; entrada ~360 kB (~113 kB gzip), Firestore bajo demanda ~462 kB (~140 kB gzip); sin advertencia de chunk grande |
| Integración con emuladores | Aprobada | 1 recorrido real: Auth, perfil persistente, idempotencia de creación, edición, cierre/reingreso y generación del enlace de recuperación; repetido tras actualizar gRPC |
| Security Rules con emulador | Aprobada | 15 pruebas: A/B propios, CRUD cruzado denegado en ambos sentidos, acceso anónimo, campos/tipos inválidos, privilegios, timestamps, propiedad y módulos cerrados |
| E2E final Chromium/WebKit | Aprobada | 9 recorridos, sin retries: 3 en escritorio Chromium, 3 en móvil Chromium y 3 en móvil WebKit; última ejecución 9/9, código 0 |
| Revisión visual | Aprobada, alcance base | Capturas de escritorio y móvil inspeccionadas; se sustituyó el cartel flotante del SDK por aviso local permanente para no tapar contenido |
| `pnpm audit --prod` | Aprobada | Sin vulnerabilidades conocidas tras fijar gRPC 1.14.7 |
| `pnpm audit --audit-level high` | Aprobada con observaciones | Sin avisos altos/críticos; dos moderados en herramientas de desarrollo de Firebase CLI, documentados |
| Patrones de claves/tokens en archivos del proyecto | Aprobada, alcance estático | No coincidencias de claves privadas, cuentas de servicio ni tokens GitHub/Google; no sustituye revisión de seguridad completa |
| GitHub Actions | No ejecutada | Workflow preparado; no se hizo push ni hay ejecución remota comprobada |
| Firebase real/staging y carga/concurrencia comercial | No ejecutadas | No hay proyecto remoto ni módulos comerciales |
| Usabilidad <60 s, hardware real y WCAG completa | No ejecutadas | Requieren flujos comerciales y participantes/dispositivos; no se afirma conformidad |
| RNF-05 y restauración cloud | Bloqueadas por autorización futura | Sin Storage ni servicios facturables activados |

E2E cubre registro, protección de ruta, negocio, recarga con sesión, edición, salida/ingreso, solicitud de recuperación, ausencia de desborde horizontal, manifest, service worker, formulario bloqueado offline y fallback de navegación. Cada flujo se ejecuta en Chromium escritorio, Chromium móvil y WebKit con perfil iPhone; eso no equivale a Safari en hardware real.

Resultado agregado de la base: **41 pruebas aprobadas** (16 unitarias/componentes + 1 integración + 15 reglas + 9 E2E). Los tests de módulos comerciales permanecen pendientes, no se cuentan como aprobados.

Evidencia local: salida de comandos de esta sesión, `playwright-report/index.html` y `test-results/profile-*.png`. Capturas/trazas contienen únicamente cuentas ficticias y permanecen fuera de Git. Java 26 arrancó Firestore Emulator 1.22.0; en CI se configura JDK 21 LTS, todavía sin ejecución remota.

Incidencias encontradas y atendidas:

- npm realmente ausente tras revisar comandos y rutas: se utilizó pnpm incluido en Codex y se documentó reparación de Node/npm; no se instalaron herramientas globales.
- pnpm bloqueó postinstall no aprobados: se inspeccionaron y se estableció una política explícita para los tres paquetes, permitiendo el binario re2. No se rebajaron tests.
- El build inicial de ~822 kB se dividió cargando Firestore bajo demanda; no se elevó artificialmente el umbral de advertencia.
- La auditoría encontró gRPC transitivo vulnerable de Firebase: se fijó 1.14.7 y se repitieron integración/reglas/navegadores.
- Una repetición E2E falló en WebKit: la traza mostró correo vacío y ninguna solicitud de registro porque el test rellenaba el formulario anterior durante la transición a `/registro`. Se espera explícitamente el encabezado de registro antes de escribir. No se añadieron retries ni se amplió el timeout.
- La importación de datos locales en el primer arranque no puede apuntar a una carpeta inexistente: el lanzador importa únicamente cuando existe metadata de una exportación previa.

## 6. Riesgos

Base local, sin preparación comercial completa. RNF-05 pendiente; no existe respaldo remoto del código hasta autorizar push. Restan dos avisos moderados de Firebase CLI (uuid/OpenTelemetry), sin distribución al navegador, y pruebas físicas/legales/recuperación. Ventas/stock/cobros requieren demostrar invariantes frente a clientes maliciosos; reglas de perfil no acreditan seguridad de esos módulos futuros.

## 7. Requisitos

RF-01 implementado en entorno local. RNF-03 verificado solo para perfil y cierre de colecciones futuras. RNF-02/06 preparados y evaluados parcialmente por navegador emulado. RF-02 a RF-07, RNF-01 y RNF-05 no se declaran implementados. Se conserva la numeración original sin RNF-04. Ver matriz completa en `docs/requirements/traceability.md`.

## 8. Git

Rama de trabajo `chore/project-setup`; origin apunta al repositorio confirmado. La base se conserva en un primer commit local después de las verificaciones. El hash definitivo y el estado pueden consultarse con `git log -1 --oneline` y `git status --short --branch`. Sin push, cambios de permisos, despliegues ni reescritura de historial.

## 9. Siguiente etapa

Revisión conjunta de arquitectura/modelo/seguridad y estado de Firebase antes del núcleo comercial. Validar definiciones de saldo/cobros, unidades de inventario, anulación y necesidad de operación confiable de servidor. No se inicia Fase 2 hasta esa revisión, según el punto de control del propietario. Firebase real, Storage, presupuesto y publicación requieren autorización posterior.

## Actualización 05/11/2026: organización en clases

Se extrajeron `FirebaseAuthService` y `FirestoreBusinessRepository`, que implementan los contratos existentes y reciben sus dependencias por constructor. El repositorio antes estaba en `src/features/business/repository.ts`; ahora está en `FirestoreBusinessRepository.ts`. La composición sigue en infraestructura y mantiene la carga diferida de Firestore. La prueba de integración utiliza ambas clases reales. No se modificaron reglas, esquema de datos ni dependencias.

Verificación posterior: `pnpm check` aprobado (lint, TypeScript, 16 pruebas y build); `pnpm test:emulators` aprobado (1 integración, 15 reglas y 9 E2E). Total: 41 pruebas aprobadas. Entorno: Node 24.22.2 y Java 21.0.13. Sin pruebas remotas, push ni despliegue.

## Actualización 05/11/2026: inventario y primera versión de prueba 0.1.0

Autorización posterior del propietario: implementar inventario con cantidades enteras y movimientos con motivo; subir esta primera versión al repositorio oficial. No se autorizaron ventas, gastos, fiados, instaladores, servicios cloud ni despliegues públicos.

### Resultado final ejecutado

| Verificación | Resultado |
| --- | --- |
| `pnpm check` | Aprobado: ESLint sin avisos, TypeScript estricto, 35 pruebas unitarias/componentes y build |
| `pnpm test:emulators` | Aprobado: 4 pruebas de integración, 58 de reglas, 12 E2E |
| Total | 109 pruebas aprobadas; sin retries adicionales en Playwright |
| Navegadores | Chromium escritorio, Chromium Pixel 7 emulado y WebKit iPhone 13 emulado |
| Revisión visual | Capturas de inventario e historial revisadas en escritorio y móvil Chromium; sin desbordamiento horizontal en los tres navegadores por aserción E2E |
| Integridad | Apertura atómica, cambios con historial, archivo/reactivación, paginación de productos/historial, IDs repetidos y solicitudes distintas con el mismo ID |
| Concurrencia | Dos salidas sobre una unidad: solo una aceptada; dos entradas distintas: ambas aplicadas; dos entradas con el mismo ID: un solo movimiento |
| Ataques | Acceso cruzado/anónimo/sin negocio, cambios aislados de stock, aperturas y movimientos falsificados, pares coherentes con importes/cantidades inválidos, archivo, inmutabilidad y colecciones futuras cerradas |
| Respuesta incierta | Componente verifica conservación de solicitud/ID al remontar, ausencia de reenvío automático y confirmación manual con la misma solicitud |

Entorno: Node 24.22.2, pnpm 11.25.0 y Java 21.0.13. Emuladores demo efímeros apagados al terminar; no se importó la sesión local persistente. No se añadieron dependencias.

### Fallos encontrados y corregidos

- Una carrera por el mismo ID podía devolver permiso denegado al segundo cliente: las reglas evaluaban su vista antigua. Ahora se consulta el movimiento inmutable; solo una solicitud coincidente acredita éxito. Si no existe y hay conflicto/permisos, una transacción nueva recalcula stock con un máximo de tres intentos. No se relajaron las reglas. La prueba incluye también entradas concurrentes con IDs distintos.
- El helper inicial de tests de reglas perdía el contexto `this` al desestructurar `firestore`; se conserva el contexto. Los archivos de reglas se ejecutan secuencialmente porque limpian el mismo proyecto demo.
- El primer E2E de inventario encontraba dos elementos `status` durante la recarga del listado. El test identifica el mensaje de confirmación concreto, conservando ambos estados accesibles. No se añadieron esperas fijas ni se ocultó el error.

### Límites y siguiente revisión

RF-04 queda implementado localmente; la parte de inventario de RNF-03 tiene reglas y pruebas adversarias. No se declara preparación comercial completa. RNF-02/06 siguen pendientes de dispositivos físicos y RNF-05 de respaldo real. El emulador no acredita índices, cuotas ni comportamiento cloud; los índices declarados requieren validación futura en staging autorizado. No hay APK ni instalador Windows. La solicitud pendiente en sessionStorage se pierde al cerrar la pestaña: consultar productos/historial antes de repetir en ese caso. Revisar esta entrega antes de comenzar ventas.
