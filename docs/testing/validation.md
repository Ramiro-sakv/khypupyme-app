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

## Actualización 05/11/2026: v0.2.0, compras y costos (local)

El propietario autorizó compras y valoración antes de ventas, sin nuevo servidor ni subida automática. No se habilitaron servicios cloud ni perfiles de otros rubros. Versión en package.json: 0.2.0; lockfile y dependencias conservados.

### Verificación final ejecutada

| Comprobación | Resultado |
| --- | --- |
| `pnpm check` | Aprobado: ESLint sin avisos, TypeScript estricto, 48 pruebas unitarias/componentes y build |
| `pnpm test:emulators` | Aprobado: 10 pruebas de integración, 95 de reglas y 15 E2E |
| Total | 168 pruebas aprobadas, sin retries nuevos ni relajación de validaciones |
| Navegadores | Chromium escritorio, Chromium móvil Pixel 7 y WebKit móvil iPhone 13 |
| Revisión visual | Capturas de Compras en escritorio Chromium y móvil WebKit revisadas; aserciones de ausencia de desbordamiento horizontal en los tres navegadores |
| Proyecto de pruebas | `demo-khypupyme-tests`, Firestore 18080, Auth 19099, websocket 19150, hub 14400, logging 14500 y preview 4173 |

Las pruebas ejecutaron emuladores efímeros con firebase.test.json, sin importación/exportación. Al comenzar se detectó la sesión interactiva en 8080/9099; no se reutilizó, limpió ni detuvo para probar. El lanzador comprueba los puertos de prueba antes de arrancar y el frontend de pruebas usa configuración fija del proyecto separado. Los emuladores de pruebas y el preview se apagaron automáticamente al terminar.

### Evidencia funcional e integridad

- 10 unidades a Bs 5 más compra de 10 a Bs 7: stock 20 y valor Bs 120; salida de 2 retira Bs 12 y deja stock 18/valor Bs 108. Se comprobaron redondeo de mitades, agotamiento y límites con cálculos BigInt y reglas int64.
- Compra/producto/movimiento atómicos. Las pruebas rechazaron cada documento aislado y cada par incompleto, costos falsos coherentes entre documentos, autores/fechas/referencias manipulados, exceso de stock/valor y compras de archivados.
- Compras concurrentes distintas se acumulan; solicitudes concurrentes con el mismo ID se aplican una vez. Si comparten ID pero cambian referencia, solo una solicitud se confirma. Cambiar fecha o referencia en reintentos también se rechaza.
- Anulación completa conserva compra y movimientos, restaura stock/valor y se admite solo sin movimientos posteriores; se rechazaron anulaciones manipuladas y repetidas. Reconsultar una compra ya anulada con su ID original no vuelve a ingresarla.
- Productos y movimientos v0.1 se leen sin inventar costo. Una valoración explícita preserva cantidades y crea evidencia, no compras históricas. Se impiden compras/salidas previas y una segunda valoración. El movimiento histórico conserva valoración desconocida.
- Compra con revisión de importe antes de guardar; filtros por producto y periodo, páginas de 25, historial, anulación, guardado bloqueado sin conexión y recuperación manual de solicitudes inciertas comprobados. La solicitud/ID se conserva al remontar la pantalla y no se reenvía automáticamente.
- Aislamiento A/B en ambas direcciones, denegación de anónimos/cuentas sin negocio, inmutabilidad y límites de consultas comprobados. Las colecciones de ventas/gastos/fiados continúan cerradas.

Se corrigió durante la implementación la cobertura del nuevo tipo de movimiento en el historial, la normalización UTF-8/LF de archivos editados y la validación de referencias de un solo carácter. La verificación final posterior pasó completa; no se desactivaron reglas, lint ni tests para lograrlo.

### Límites de esta entrega

No hay compras con varios productos, crédito a proveedores, impuestos desglosados, ventas, gastos, ganancias ni perfiles especializados. El costo promedio mostrado se aproxima; el valor persistido y los retiros son exactos en centavos. Compras no se convierten en gastos operativos. La migración de costo es explícita por producto y las solicitudes v0.1 incompletas se bloquean para revisión antes de reiniciar su pestaña. No se acredita cloud, índices productivos, teléfonos físicos, APK o instaladores. La nueva subida y cualquier despliegue requieren autorización posterior. Próximo punto de control: revisar v0.2 antes de diseñar ventas.


## Beta 0.3.0-beta.1 — 05/11/2026

Verificación local del núcleo común, sin push ni despliegue. Node 24.22.2, pnpm 11.25.0, Java 21.0.13. Servidor Functions autorizado solo en emuladores.

| Verificación | Resultado ejecutado |
| --- | --- |
| `pnpm check` | Aprobado: ESLint, TypeScript estricto, 71 unitarias/componentes y builds web/Functions |
| `pnpm test:emulators` | Aprobado, código 0: 16 integración + 103 reglas + 18 E2E |
| Total automatizado | **208 pruebas aprobadas** |
| Concurrencia e idempotencia | Dos ventas no sobrevendan; una solicitud repetida no duplica stock/venta/cobro; mismo ID con otros datos se rechaza |
| Históricos y correcciones | Precios/costos originales, devolución de stock/costo, fiado cobrado/anulado y reembolsos comprobados |
| Seguridad | Auth obligatorio, negocio propio, autor/total/costo calculados en servidor; escritura directa y acceso A/B denegados |
| Interfaz | Venta fiada, cobro QR, gasto, resultado Bs 70, CSV, anulación y bloqueo sin conexión en Chromium escritorio/móvil y WebKit móvil |
| Visual | Informes de escritorio y móvil revisados; gráfico con tabla accesible y sin desbordamiento horizontal |
| Auditoría npm de producción | Sin avisos altos/críticos; 2 moderados transitivos (glob/minimatch), no equivale a auditoría completa |
| Native Windows | NSIS x64 generado; ejecutable abre inicio/registro en WebView2 y navega por rutas empaquetadas; no se crearon cuentas |
| Native Android | APK debug compilado; arranque de AVD no completado por presión de memoria del equipo; no se acredita ejecución ni exportación en dispositivo real |

### Incidencias y correcciones reales

- Primera revisión de navegador: el nombre accesible del botón incluía un símbolo decorativo y el test no lo encontraba. Se añadió nombre accesible explícito.
- Una compilación local simultánea reemplazó el build servido por el navegador de pruebas. Tres cuentas ficticias `@example.invalid` de WebKit llegaron a la sesión local. Se identificaron por el prefijo y la fecha exacta de esa ejecución, se verificaron sus nombres de negocio y se eliminaron solo esas tres cuentas y sus 13 documentos. No se borró ni modificó el negocio del propietario. Se corrigió Vite para usar `dist-test` y se añadió un bloqueo de puertos 8080/9099/5001 en las pruebas del navegador. La ejecución final pasó con ambas protecciones.
- Arrancar AVD junto con compilaciones y navegadores agotó memoria (8 GB de RAM): hubo cierre del navegador y un error de asignación en el compilador. Los paquetes y pruebas se ejecutaron después por separado, con dos trabajadores y Java de pruebas limitado a 512 MB.
- La preparación de 26 clientes en paralelo abría demasiados procesos locales de Functions; Windows llegó a fallar al leer una dependencia (`UNKNOWN`, `graceful-fs`). Esa preparación de paginación se hizo secuencial; se conservaron las pruebas de concurrencia e idempotencia con operaciones simultáneas. La ejecución final pasó sin reintentos de Playwright ni desactivar aserciones.
- El primer script nativo intentaba resolver un subpath no exportado de Vite. Se sustituyó por su API pública `build`. ESLint excluye ahora los artefactos generados, conservando la revisión de todos los archivos fuente.

### Límites

Solo emuladores, datos ficticios y un propietario por negocio. Sin cloud, publicación, firma comercial, rubros especializados, abonos parciales, impuestos o respaldos comerciales. La anulación sustituye edición/borrado financiero. El flujo registrado excluye compras y no representa saldo bancario/caja; resultados estimados excluyen costos no declarados. Informes de hasta 366 días, 10.000 registros por sección y acumulados de hasta 10^12 centavos, con error explícito si se exceden. Fiados e inventario actuales se distinguen de las métricas del periodo. No se acredita evaluación de usabilidad con personas, Android real, restauración ni seguridad de un despliegue público.
