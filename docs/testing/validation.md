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

## Beta 0.3.0-beta.2 — 06/11/2026

| Verificación | Resultado ejecutado |
| --- | --- |
| `pnpm check` | Aprobado: lint, TypeScript, 90 pruebas unitarias/componentes y builds web/Functions |
| `pnpm test:emulators` | Aprobado, código 0: 18 integración + 114 reglas + 21 E2E |
| Total automatizado | **243 pruebas aprobadas**, sin omitir casos ni reintentos de Playwright |
| Perfiles | Comercio, servicios y mixto; selección explícita, vista previa, combinación de herramientas y dependencia Compras → Inventario |
| Integridad | Cambio atómico/idempotente de configuración, revisión esperada y conflicto entre sesiones; cantidades, costos e historial conservados |
| Seguridad | Rechazo de formas/campos/perfiles/versiones inválidos, acceso A/B y actualización directa de configuración; pruebas anteriores conservadas |
| Recuperación | Solicitud incierta accesible aunque su herramienta esté desactivada; caché y respuestas tardías aisladas por cuenta |
| Navegadores | Chromium escritorio/móvil y WebKit móvil: archivo de inventario ausente al iniciar servicios, carga al activar, error HTTP 503 y recuperación manual |
| Visual | Perfil revisado en escritorio y móvil; controles sin desbordamiento horizontal |
| Tamaño web | Entrada JS: 435,91 → 374,65 kB (−14,1 %); gzip: 131,86 → 117,47 kB (−10,9 %). No representa el total descargado ni el tamaño del instalador |

La ejecución usó exclusivamente `demo-khypupyme-tests`, puertos separados y `dist-test`; no se iniciaron, detuvieron ni limpiaron los servicios habituales del propietario.

### Incidencias resueltas

- Playwright 1.64.1/WebKit mantenía fallida una importación después de recargar durante la simulación de error. Se actualizó únicamente la herramienta de pruebas a 1.65.0 (WebKit 27.2 y Chromium 158), se instalaron sus navegadores y se repitió la suite completa con las mismas comprobaciones de recuperación. No se modificaron las dependencias de ejecución. No acredita comportamiento en Safari físico.
- La prueba que intercepta el archivo bloquea el service worker para no ocultar el error simulado; las pruebas base siguen comprobando la PWA en los tres navegadores. El fallo HTTP 503 usa `no-store`, y el reintento conserva la misma pestaña.
- Se corrigieron selectores de navegación móvil y la espera de reconexión de productos. La prueba de timestamp inmutable ahora envía una fecha inequívocamente diferente, en lugar de un timestamp de servidor que podía coincidir; no se debilitaron reglas.

### Alcance comprobado

Los perfiles son preferencias de interfaz y herramientas, no permisos adicionales. Los negocios existentes conservan todas las herramientas hasta elegir un perfil. No se transforman unidades, valores históricos ni datos al cambiar. Los módulos nativos continúan empaquetados; esta versión divide pantallas para carga al abrirlas, sin descargar paquetes remotos de rubro. Madera, variantes de ropa, números de serie y fabricación siguen pendientes de diseño propio. Continúa siendo una beta exclusivamente local, sin cloud, push ni publicación.

### Paquetes nativos beta 2

- `pnpm android:build`: aprobado, código 0; 154 tareas Gradle, APK debug de 4.466.467 bytes. No se ejecutó en Android físico ni se reintentó el AVD con memoria limitada.
- `pnpm windows:build`: aprobado, código 0; Rust release y NSIS x64, instalador de 1.583.337 bytes.
- Paquetes conservados en `artifacts/KhypuPyme-0.3.0-beta.2-android-debug.apk` y `artifacts/KhypuPyme-0.3.0-beta.2-windows-x64-setup.exe`, excluidos de Git junto con logs y datos de pruebas.
- Arranque nativo Windows beta 2: **no ejecutado**. La revisión automática rechazó la acción que preparaba un WebView aislado, abría el ejecutable para comprobar inicio/registro y cerraba únicamente su proceso. El mensaje solo indicó `blocked by policy`, sin motivo detallado; no se intentó eludirlo. El arranque acreditado de beta 1 no se atribuye a beta 2.
- Ambos paquetes siguen requiriendo los emuladores locales. No se instalaron sobre la aplicación del propietario, no se publicaron ni se añadieron accesos al escritorio.

## Beta 0.3.0-beta.3 — 06/11/2026

Ampliación explícita del propietario: investigar rubros y ofrecer su elección al crear el perfil. Catálogo de 21 rubros, seis fichas especializadas y una general, con límites visibles; no equivale a 21 ERP completos. Fuentes primarias y decisiones derivadas en README.

### Incidencias y correcciones durante la verificación

- Las primeras transacciones con fichas complejas superaron las 1.000 expresiones de reglas. Se eliminó validación de esquema duplicada en enlaces: el documento nuevo sigue obligado a superar su propia regla de creación (`validMovement`/`validPurchase`), y el vínculo sigue comprobando existencia nueva, identificadores, autor/esquema en la creación, cantidades, valores y copia exacta de ficha. Pasaron las pruebas de documentos aislados, pares incompletos, alteración coherente de importes y fichas, inmutabilidad y aislamiento A/B. No se amplió autorización ni se omitió validación del documento correspondiente.
- Un test anterior de InventoryPage no proporcionaba el nuevo contexto de negocio; se actualizó su composición, manteniendo sus aserciones de recuperación e ID original. Lint exigió separar la lectura del formulario del componente; quedó en `specification-form.ts`.
- El mensaje de éxito del perfil desaparecía al remontar el editor después de refrescar la revisión. Se añadió el rubro confirmado por servidor como indicador permanente y la prueba espera ese dato, no un mensaje transitorio.
- WebKit presentó errores de consulta de perfil tras recargar/reingresar. Se conservó el error y la recuperación manual de lectura. Se corrigió ToolGate para no abrir una herramienta cuando no se pudo consultar su configuración. Las pruebas ejercitan el botón de consulta cuando aparece y siguen exigiendo el mismo resultado final; no repiten escrituras, no omiten casos y no usan reintentos globales de Playwright.

### Evidencia cubierta

- Persistencia, idempotencia y copia histórica de las siete fichas en creación, compra y venta; modificar el rubro después conserva unidad, stock, costo, recibo e historial. Anulación devuelve cantidades/valor sin cambiar la ficha.
- Servidor rechaza venta de lote vencido, tanto de productos envasados como cemento, incluso usando fecha retroactiva. No crea ventas, operaciones confirmadas ni retiros de stock/valor.
- Reglas rechazan unidades incompatibles, campos extra/faltantes, dimensiones/pesos fraccionarios o fuera de límites, fechas inexistentes, ficha inicial discordante, cambio posterior de ficha y compra con unidad/lote falsificado u omitido. A/B permanece aislado.
- Equivalencias: 10 tablones de 3000×200×25 mm = 0,150000 m³; 10 bolsas de 50000 g = 500,000 kg; área de 10 m² con merma del 10 % y cajas de 1,44 m² requiere 8 cajas. Una venta de 8 desde stock 10 deja 2 cajas, 2,8800 m² y valor Bs 40 al costo unitario Bs 20.

La traza de WebKit en Windows precisó el error de transporte: el POST de `Listen/channel` devolvía estado −1 con `Send failed since rewinding of the data stream failed` al cambiar Auth. El ensayo con long-polling pasó la prueba aislada, pero no resolvió la suite completa, por lo que se retiró de la aplicación. Se mantienen el transporte SDK original, `getDocFromServer`, `getDocsFromServer`, memoria local y restricciones online. Se investiga evitar reutilización de conexión únicamente en el navegador de pruebas Windows/WebKit; no se sustituye ninguna respuesta o escritura financiera.


La prueba diagnóstica con `Connection: close` exclusivamente en Windows/WebKit pasó dos de tres repeticiones del reingreso; no resolvió la intermitencia y se retiró. También se retiró el ensayo long-polling. La aplicación y Playwright conservan su configuración de transporte original. La incidencia de lectura/reingreso queda abierta para WebKit: no se acredita una corrección completa ni uso físico en Safari. Las pruebas de nuevas fichas pasaron en los tres navegadores. El error crudo cURL observado se conserva en esta descripción; no se confundirá un fallo de transporte con una prueba aprobada.


### Resultado de la verificación definitiva

| Verificación | Resultado real |
| --- | --- |
| `pnpm check` | **Aprobado**, código 0: lint, TypeScript, 146 unitarias/componentes y builds web/Functions |
| Integración | **27 aprobadas** |
| Reglas y ataques | **157 aprobadas** |
| E2E | **23 aprobadas y 1 fallida** de 24, sin omisiones ni reintentos globales |
| `pnpm test:emulators` completo | **Fallido**, código 1, por reingreso en WebKit móvil |
| Total único de casos | **353 aprobados y 1 fallido**; las repeticiones diagnósticas no se suman |
| Rubros y fichas | Recorrido de seis rubros, creación, cambio conservando datos, cálculo/venta de cajas, recibo e informes aprobado en Chromium escritorio/móvil y WebKit móvil |
| Visual | Inventario revisado en escritorio y móvil; sin desbordamiento horizontal |

La incidencia restante no se considera resuelta ni se oculta: `base.spec.ts`, registro/negocio/edición/cierre/reingreso, espera el tablero tras iniciar nuevamente y recibe un error de consulta en Windows/WebKit. Se reprodujo de forma intermitente incluso en ejecuciones aisladas. Falta confirmar causa y corrección completa antes de acreditar ese navegador. Las dos configuraciones experimentales de transporte se retiraron porque no resolvieron la regresión; no se modificaron permisos, respuestas ni escrituras para obtener resultados verdes.

Las verificaciones usaron exclusivamente `demo-khypupyme-tests`, puertos aislados y `dist-test`, sin importación/exportación de la sesión del propietario. Sus servicios habituales no se iniciaron, detuvieron ni limpiaron. No se acredita Safari físico, uso comercial ni cloud.


### Paquetes nativos beta 3

- Android: `pnpm android:build` aprobado, código 0; 154 tareas Gradle, compilación de 1 min 4 s. APK debug: **4.473.613 bytes**. Gradle se ejecutó sin daemon persistente.
- Windows: `pnpm windows:build` aprobado, código 0; Rust release y NSIS x64, compilación Rust de 2 min 9 s. Instalador: **1.589.857 bytes**.
- Entregables excluidos de Git: `artifacts/KhypuPyme-0.3.0-beta.3-android-debug.apk`, `artifacts/KhypuPyme-0.3.0-beta.3-windows-x64-setup.exe` y `artifacts/SHA256SUMS-beta3.txt`. Se conservaron los paquetes anteriores.
- No se acredita arranque nativo beta 3 ni ejecución física. Android conserva el destino de emulador `10.0.2.2`; Windows usa loopback. Ambos necesitan Auth/Firestore/Functions locales encendidos. No se instaló sobre la sesión del propietario, no se crearon accesos y no se publicó ni hizo push.


## 0.4.0-beta.1 — 07/11/2026: compilación sin pruebas

Instrucción posterior del propietario: no ejecutar pruebas para esta entrega. No se ejecutaron pnpm check, test, test:emulators, integración, reglas, recorridos de navegador, validación de PDF ni pruebas nativas. No se tomaron capturas; configuración de screenshot/video/trace desactivada y llamadas a capturas retiradas. Los resultados de beta 3 son históricos y no acreditan 0.4. Los recorridos antiguos deberán adaptarse al nuevo flujo y ampliarse con cobertura 0.4 antes de volver a acreditar regresión.

Resultados reales sobre el código final:

- pnpm lint: aprobado, salida 0.
- TypeScript: aprobado mediante pnpm typecheck y pnpm build (tsc --noEmit), salida 0.
- pnpm build: aprobado, salida 0; módulos de rubro separados y PDF/fuentes cargados por demanda. Aviso de tamaño para pdfmake (~1,33 MB) y fuentes (~830 kB); siguen empaquetados para generación local, sin cargar al ingresar.
- pnpm build:functions: aprobado, salida 0. No acredita invariantes financieras ni reglas en ejecución.
- pnpm android:build: aprobado, salida 0; compilación final Gradle de 31 s, 154 tareas (27 ejecutadas / 127 actualizadas). APK debug, sin instalación ni arranque.
- pnpm windows:build: aprobado, salida 0; Rust release y NSIS x64. Sin instalación ni arranque.
- pnpm audit --prod --audit-level high: salida 0; dos avisos moderados: [glob](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4) y [minimatch](https://github.com/advisories/GHSA-g3hv-75wg-m249). No se forzaron actualizaciones incompatibles. Esto no es una auditoría completa de seguridad.
- git diff --check: aprobado. Revisión básica de patrones de claves en cambios preparados: cero coincidencias; artefactos, datos de emuladores y .env.local fuera del commit.

Paquetes locales excluidos de Git, con copias anteriores conservadas:

- KhypuPyme-0.4.0-beta.1-android-debug.apk: **5557491 bytes**, SHA-256 809265bf86dd64213aa372aa8b186433b7d060aaa0b0e1710746203db85a698d.
- KhypuPyme-0.4.0-beta.1-windows-x64-setup.exe: **2431562 bytes**, SHA-256 4ac1bef28ef463e31b0b713b5ac92d2af586421ef07892628b3919409683573f.

Huella conjunta: artifacts/SHA256SUMS-beta4.txt. Requieren los emuladores locales; Android apunta a 10.0.2.2 y Windows a loopback. No se inició/detuvo la sesión habitual del propietario, no se limpiaron datos, no se crearon accesos y no hubo push ni despliegue.

La incidencia previa de reingreso Windows/WebKit sigue **pendiente, sin corrección acreditada**. No se acredita funcionamiento comercial, aislamiento/concurrencia, contenido/paginación de PDF, dispositivos físicos ni servicio alojado.


## 0.4.0-beta.2 — 07/11/2026: rediseño visual

Interfaz profesional, estructura adaptable, navegación por vista, Inicio/Informes y Ventas/Cotizaciones separados, paneles con dialog nativo, tablas/tarjetas, estado textual, fechas bolivianas y advertencias por borradores. El negocio activo se identifica también en encabezado y paneles. Las consultas de resumen/caja utilizan contratos existentes; no cambiaron reglas, índices, servidor comercial, infraestructura ni cálculos compartidos.

Verificaciones realmente ejecutadas:

- pnpm lint: aprobado, salida 0.
- pnpm typecheck: aprobado; el código final también pasó tsc --noEmit dentro de pnpm build.
- pnpm build: aprobado, salida 0. CSS final ~28,85 kB (7,11 kB gzip), aplicación principal ~405,32 kB (127,51 kB gzip). SVG, tipografía del sistema y carga diferida sin nuevas dependencias visuales.
- pnpm build:functions: aprobado, salida 0; solo cambia metadato de versión del paquete, sin cambios del servidor.
- pnpm android:build: aprobado, salida 0; 154 tareas, 33 ejecutadas y 121 actualizadas, 1 min 9 s.
- pnpm windows:build: aprobado, salida 0; Rust release y NSIS x64.
- git diff --check: aprobado. Revisión básica de patrones de secretos en staging sin coincidencias. Datos, logs, credenciales locales y artefactos fuera del commit.

No ejecutados por instrucción del propietario: pnpm check, pruebas unitarias/integración/reglas/E2E, capturas, vídeos, recorridos automáticos, revisión visual del diseño, PDF ni instalación/arranque en dispositivos. Los puntos 360/768/1100/1440 px son decisiones de CSS, no tamaños comprobados mediante navegador. No se acredita corrección del reingreso Windows/WebKit ni se sustituyen resultados pendientes de la beta anterior.

Vite mantiene el aviso de tamaño de pdfmake y fuentes, que se cargan únicamente al generar un documento. Gradle conserva avisos de flatDir y versiones de herramientas/XML del SDK; no impidieron compilar. No se cambiaron herramientas del propietario.

Paquetes nuevos excluidos de Git, conservando anteriores:

- KhypuPyme-0.4.0-beta.2-android-debug.apk: **5427877 bytes**, SHA-256 0aacad9d34ecd0fb8e3b4449a27f033ee4e24910f2303be7c7fb90fa8c7192cc.
- KhypuPyme-0.4.0-beta.2-windows-x64-setup.exe: **2442649 bytes**, SHA-256 823a344d8b2e9e52c8e2478c54587aa289a74e1ecb32b4288c30791543480344.

Huellas: artifacts/SHA256SUMS-beta4b2.txt. Paquetes locales de prueba que necesitan emuladores encendidos. No se instalaron, publicaron ni generaron accesos; no se inició/detuvo la sesión habitual ni se tocaron datos del propietario.


## 0.4.0-beta.3 — 07/11/2026: continuidad y responsabilidades

Verificación limitada por indicación expresa del propietario: **sin pruebas, capturas, vídeos, recorridos automáticos, revisión visual ni instalación/arranque de los paquetes**. No se acredita funcionamiento comercial a partir de estas compilaciones.

Aprobados con salida 0:

- `pnpm lint`: sin errores ni advertencias de ESLint.
- `pnpm build`: TypeScript estricto (`tsc --noEmit`) y compilación Vite, 182 módulos. `pnpm build:functions`: TypeScript del servidor existente.
- `pnpm android:build`: sincronización Capacitor y `assembleDebug`, BUILD SUCCESSFUL en 1m 7s; APK de prueba, versionCode 40003.
- `pnpm windows:build`: compilación Tauri release en 2m 54s y generación NSIS x64. Versión 0.4.0-beta.3 en ambos paquetes.
- `git diff --check`: sin errores. Revisión estática de archivos preparados: sin cambios en reglas/índices, shared, funciones financieras, adaptadores Firebase ni WorkspaceRepository. Comparación de AST de delivered/saleInputs/receiptInputs antes/después de extraer Cart: contenido conservado. No se ejecutaron sus cálculos como pruebas.
- Revisión de patrones de credenciales en archivos preparados: sin coincidencias; sin incluir artefactos, datos locales, logs, secretos ni dependencias.

Advertencias de construcción: pdfmake/fuentes superan 500 kB y permanecen en carga por demanda; Gradle conserva avisos flatDir y herramientas Android con XML SDK 3/4. No impidieron generar los paquetes; no se modificaron herramientas del propietario para ocultarlos.

Artefactos locales, excluidos de Git; hashes también en `artifacts/SHA256SUMS-beta4b3.txt`:

- `KhypuPyme-0.4.0-beta.3-android-debug.apk`: **5444445 bytes**, SHA-256 `5c00626e5d0e32c47fe35b50664f148b15a4bcf04ac9ab108d7e695bd9746591`.
- `KhypuPyme-0.4.0-beta.3-windows-x64-setup.exe`: **2456769 bytes**, SHA-256 `e30aa99310268b2cbff8f4483f885cedc864394688fd8b0199aeb9137dbec789`.

Revisión funcional diferida, **no ejecutada**:

- Dos cuentas con varios negocios: aislamiento de borradores y solicitudes, cambio de espacio con operación iniciada y autorización del catálogo al restaurar.
- Restauración con precios cambiados, nueva cotización cuando cambia la oferta, producto archivado/no disponible, reselección de series de salida y referencias originales de compra.
- Dos pestañas: comparación atómica de ID/revisión, conservación de la pantalla en conflicto, carga/reemplazo expreso y borrador nuevo que no se borra/adopta al confirmar otro anterior.
- Respuestas inciertas: contenido/ID originales, consulta antes del reintento manual, sin reenvío automático; rechazo definitivo conserva un borrador corregible y una confirmación limpia solo su vínculo. La ausencia de solicitud local no se interpreta como rechazo.
- Persistencia ante recarga, desconexión, almacenamiento no disponible/cuota, y conservación de formularios al fallar la exportación. Comprobar PDF y su separación del registro comercial.
- Historial de compras con fechas/producto/paginación y su detalle, primeros pasos con consultas fallidas, accesibilidad y dispositivos Android/Windows.

Código fuente respecto de a49e087: **40 archivos, +4.023 / -1.859 líneas físicas**, incluyendo traslados y reorganización; no equivale a líneas nuevas de funcionalidad. El registro de solicitudes conserva su base/esquema anterior y el almacén de borradores es independiente.

La incidencia previa de **reingreso Windows/WebKit continúa pendiente, sin corrección acreditada**. No se ejecutó `pnpm check` porque incluye pruebas. No se modificaron los servicios interactivos ni los datos del propietario; sin push, despliegue o publicación.


## 0.5.0-beta.1 — 07/11/2026: rubros y ejemplos

Por instrucción del propietario **no se ejecutaron tests unitarios, integración, reglas, E2E, capturas, vídeos, recorridos automáticos, revisión visual ni instalación/arranque de paquetes**. La carga solicitada y la consulta de sus registros son evidencia de población de ejemplos, no una certificación funcional o de seguridad comercial.

### Compilaciones y revisión estática

- pnpm lint: aprobado, salida 0 en el cierre final. Un ajuste intermedio de carga diferida del historial dejó una variable sin usar; se corrigió antes de las compilaciones finales.
- pnpm build: TypeScript estricto y Vite aprobados, 193 módulos. pnpm build:functions: aprobado tras corregir la persistencia de tablas de documentos.
- Android final: assembleDebug aprobado, BUILD SUCCESSFUL en 37 s, versionCode 50001, versionName 0.5.0-beta.1.
- Windows final: Tauri release y NSIS x64 aprobados. No se instaló ni se abrió el ejecutable.
- Revisión de diff: reglas Firestore, cálculo exacto y CashService sin cambios; nuevas operaciones reutilizan UnitOfWork y TradeService. Este último solo añade copias descriptivas y su presentación. Índices de consulta y contratos v2 se amplían de manera compatible.
- No se ejecutó pnpm check porque incluye tests. Advertencias de construcción: bloques de pdfmake/fuentes mayores de 500 kB (carga por demanda), flatDir y XML SDK de herramientas Android; no bloquearon los paquetes.

### Incidencias encontradas durante la carga real solicitada

1. Firestore rechazó la primera compra porque las tablas de documentos se guardaban como arrays directamente anidados. La transacción se rechazó sin confirmar esa compra. Se corrigió el almacenamiento a filas con propiedad cells; las consultas reconstruyen las matrices públicas anteriores. No cambia el cálculo ni se reescriben documentos anteriores.
2. Windows devolvió EPERM al reemplazar brevemente el manifiesto local. Se añadieron reintentos acotados para bloqueos transitorios. La reanudación conserva la solicitud previa al envío y recupera resultados por el mismo ID, incluso si el guardado del resultado se interrumpió.
3. La carga se reanudó sin volver a borrar negocios ni sustituir solicitudes financieras. Terminó con salida 0 y exportación local actualizada. No se realizaron nuevas instalaciones ni se reiniciaron los emuladores.

### Inspección de los datos cargados

Misma cuenta Auth, con el mismo UID; los cuatro identificadores autorizados anteriores ya no existen. Hay exactamente 21 negocios, todos del propietario y marcados permanentemente como ejemplo. La herramienta no ejecuta cambios de Auth ni de contraseña. UID, identificadores locales, autorización, manifiesto y resumen se mantienen fuera de Git.

| Registro | Cantidad |
|---|---:|
| items | 126 |
| customersV2 | 63 |
| purchasesV2 | 54 |
| salesV2 | 153 |
| quotes | 42 |
| expensesV2 | 42 |
| debts | 42 |
| cashSessions | 42 |
| documentsV2 | 393 |
| appointments | 2 |
| workOrders | 10 |
| deliveries | 12 |
| containerTypes | 1 |

Inspección adicional: 21 cajas abiertas y 21 cerradas; 21 fiados pendientes y 21 pagados. Lectura mediante WorkspaceQueries de los 393 documentos conservados, con 3.285 celdas de tabla recuperadas como matrices públicas; no se generaron ni inspeccionaron archivos PDF. La exportación habitual .emulator-data se actualizó sin detener los servicios. Los informes y precios son ficticios y se identifican como tales.

Resumen por rubro y manifiesto: artifacts/industry-demo-v05-summary.local.json y artifacts/industry-demo-v05.local.json (ignorados por Git). Exportación completada: 2026-11-07T18:13:18.676Z.

### Paquetes locales

Hashes también en artifacts/SHA256SUMS-beta5.txt; instaladores excluidos de Git:

- KhypuPyme-0.5.0-beta.1-android-debug.apk: **5615611 bytes**, SHA-256 918c95868d98b23b6307673f946cc848d4f403a723721bb5c064eace7c6b61a2.
- KhypuPyme-0.5.0-beta.1-windows-x64-setup.exe: **2472450 bytes**, SHA-256 1f28db3a92da268df6f9fd2e410ef562de3d16f77a153f744afd038015e62692.

### Revisión funcional diferida

- Dos cuentas/varios negocios: autorización de nuevos recursos, búsquedas y referencias cruzadas, borradores y recuperación de solicitudes.
- Reservas concurrentes, cambio de día, cancelaciones y rechazo de cruces en agenda vacía o existente; venta concurrente única desde una cita/orden.
- Revisiones de órdenes y entregas, envases prestados/devueltos simultáneamente, límites y estados terminales.
- Compatibilidad de contratos v2 anteriores, respuestas inciertas, limpieza local limitada a negocios eliminados y manifiesto tras interrupciones.
- Lectura/búsqueda paginada, vencimientos, simuladores, matriz de variantes, móvil, accesibilidad y generación/guardado/paginación de PDF.

La incidencia previa de **reingreso Windows/WebKit sigue pendiente, sin corrección acreditada**. No se acredita uso comercial, funcionamiento en dispositivos físicos ni operación cloud. Sin push, despliegue, publicación o accesos nuevos de escritorio.

Código fuente respecto de d2fce15 (0.4 beta 3): **44 archivos, +3886 / -243 líneas físicas**, incluidas definiciones de guías y datos ficticios. No equivale a funciones nuevas por línea. Revisión final de archivos preparados: sin patrones de credenciales/IDs personales conocidos ni artefactos/datos locales incluidos.


## Tutorial práctico de maderas 0.5.0-beta.2 — 07/11/2026

### Alcance y verificación permitida

- Lint final: pnpm lint aprobado, salida 0. TypeScript estricto y Vite: pnpm build aprobado, salida 0. Functions: pnpm build:functions aprobado, salida 0. Un ajuste final del registro local se volvió a verificar con lint, tipos y compilación web.
- Siete capítulos y 32 pasos declarados en el código. Revisión estática del contexto inmutable, validaciones del ejercicio, checkpoint en la misma transacción y recuperación manual. No se ejecutó ninguna sesión de tutorial para verificar estos comportamientos.
- Consulta de solo lectura a Firestore local demo-khypupyme: los 21 identificadores de ejemplo originales siguen presentes; 126 artículos y 153 ventas; cero espacios de práctica. No se alteraron cuenta, contraseña, datos del usuario ni exportación persistente.
- firestore.rules, shared/workspace/exact.ts y CashService no cambian. Las operaciones financieras reutilizan los servicios existentes; únicamente se añade autorización/checkpoint del tutorial y presentación documental. La precisión dimensional y validación del mínimo interno por volumen se amplían de forma explícita, sin migrar documentos ni cantidades.
- No se ejecutaron pnpm check, tests unitarios/integración/emuladores, capturas, vídeos ni recorridos automáticos. No se instalaron ni abrieron los paquetes. No se reiniciaron los servicios del propietario. No se acredita funcionamiento en dispositivos físicos o producción.
- Advertencia de Vite: bloques diferidos de pdfmake y sus fuentes superiores a 500 kB; sin nuevas dependencias ni cambios en ese generador.

### Revisión funcional posterior

- Dos cuentas y múltiples negocios: canales normal/práctica, referencias cruzadas y espacio oculto; rechazo de operaciones ajenas al paso y solicitudes manipuladas.
- Avance con operación confirmada, idempotencia y respuesta incierta; concurrencia entre pestañas, revisión de sesión y recuperación del borrador original.
- Pausa/reanudación y cotización vencida; expiración tras siete días sin actividad; limpieza interrumpida, reanudada y completa de raíz, subcolecciones, claves y datos locales, conservando los 21 negocios.
- Captura decimal/fraccionaria en pulgadas/pies, métrico, límites dimensionales, conversiones exactas, dimensiones antiguas aproximadas y conservación de precios/documentos históricos.
- Los 32 pasos, estados vacíos/errores, paneles, teclado/táctil y accesibilidad; guardar/cancelar/compartir PDF de práctica y su marca, sin repetir registros ni eliminar archivos externos.

La incidencia de **reingreso Windows/WebKit permanece abierta, sin corrección acreditada**. Sin push, despliegue, publicación ni accesos nuevos de escritorio.

Código fuente respecto de 4be1d81: **58 archivos, +3333 / -155 líneas físicas**, excluyendo documentación, metadatos, paquetes y archivos generados. No equivale a funcionalidad verificada por línea.

### Instaladores finales

Android final: assembleDebug aprobado (BUILD SUCCESSFUL, 30 s, versionCode 50002). Windows final: compilación Tauri release y generación NSIS x64 aprobadas; versión 0.5.0-beta.2. Ambos paquetes se regeneraron después del último ajuste del control local. Instaladores de prueba exclusivamente local, sin publicación ni firma comercial.

Hashes conservados también en artifacts/SHA256SUMS-beta5b2.txt, fuera de Git:

- KhypuPyme-0.5.0-beta.2-android-debug.apk: **5637105 bytes**, SHA-256 e4823f6903a34a74a4c42b0bc9d2eaac275bfbed56be3cc8e269ecf48ce2421b.
- KhypuPyme-0.5.0-beta.2-windows-x64-setup.exe: **2486432 bytes**, SHA-256 f2ef6ccabce926c01b9d587259abb8d5f0072ed38d543f115cbcf213fc1a176d.


## Maderas rápidas y tutorial 0.5.0-beta.3 — 07/11/2026

### Verificación realizada

- pnpm lint: aprobado, salida 0, sin relajar reglas. Se corrigieron durante la implementación un campo opcional estricto, imports sin usar y una asignación local redundante detectados por TypeScript/lint.
- pnpm typecheck: aprobado en la revisión intermedia; la versión final volvió a pasar TypeScript estricto dentro de pnpm build. pnpm build y pnpm build:functions: aprobados, salida 0.
- Revisión estática: entradas/consumos/devoluciones agrupados reutilizan UnitOfWork, autorización, idempotencia, dinero entero y costo promedio exacto. El servidor deriva volumen y piezas, conserva la tarifa del catálogo y aplicada, y comprueba las medidas originales en devoluciones. El índice privado impide duplicar nuevas familias de especie/espesor. No cambian firestore.rules ni shared/workspace/exact.ts.
- Los modelos anteriores conservan rutas, cantidades, conversiones y tarifas. El contrato v2 acepta líneas antiguas y añade timber opcional; crédito nuevo exige cliente registrado. Las sesiones y solicitudes del tutorial v1 conservan manifiesto/política anteriores; el tutorial v2 elimina valores sugeridos obligatorios y permite recorridos elegibles.
- Consulta de solo lectura a demo-khypupyme: 21 negocios de ejemplo originales presentes, 126 artículos, 153 ventas y un espacio de práctica existente conservado. El agente no creó movimientos, sesiones ni datos de ejemplo, no limpió la práctica del usuario y no cambió su cuenta, exportación o servicios.
- No se ejecutaron pnpm check, tests, capturas, vídeos ni recorridos automáticos. No se instalaron ni abrieron los paquetes. Las compilaciones no acreditan seguridad ni funcionamiento financiero, visual o en dispositivos físicos.
- Advertencia de Vite: pdfmake y fuentes diferidas superan 500 kB. No se añadieron dependencias.

### Revisión funcional diferida

- Pino 2 pulgadas, largo 10 pies, anchos 6;8;10 a Bs 10/pie: tres piezas, 40 pies tablares, Bs 400; mezclar más largos, especies y otros productos en un comprobante.
- Anchos repetidos, pegado, coma decimal/fracciones, corrección, métrico, redondeos al centavo, límites 20 líneas/100 grupos y tarifas independientes del catálogo.
- Entradas con costo, disponibilidad por largo/ancho, ventas simultáneas, ajustes de pérdidas, inexistencia de stock negativo o piezas inventadas; peticiones manipuladas y aislamiento cuenta/negocio/práctica.
- Devolución parcial por medidas, repetición, agotamiento de lo vendido, descuentos y costo histórico; cambio atómico con nueva madera.
- Cliente ocasional, alta/búsqueda/selección sin perder carrito, crédito con cliente registrado y borrador con medidas/tarifa cambiadas.
- Tutorial con valores distintos de las sugerencias, recorridos y requisitos, acciones auxiliares, teclado/móvil, paneles, pausa, finalización y limpieza, sesión v1 y recuperación de solicitudes inciertas con la máscara activa.

La incidencia previa de reingreso Windows/WebKit **sigue abierta, sin corrección acreditada**. Sin push, publicación, servicios cloud ni accesos nuevos de escritorio.

### Paquetes finales y líneas

Código fuente respecto de 14c7a3c: **39 archivos, +2942 / -734 líneas físicas**, sin contar documentación, metadatos ni archivos generados. Incluye código reorganizado y no representa funcionalidad verificada por línea.

La revisión final también conservó los modelos anteriores del formulario de conversión y añadió alias de medidas en pulgadas/pies a la búsqueda derivada del catálogo. Lint/tipos/web se repitieron después del ajuste de compatibilidad; lint/Functions se repitieron después del ajuste de búsqueda.

Android final: assembleDebug aprobado (BUILD SUCCESSFUL, 32 s, versionCode 50003). Windows final: Tauri release y NSIS x64 aprobados. Ambos paquetes regenerados con el último ajuste de compatibilidad; los cambios finales adicionales fueron exclusivamente de Functions, compilados aparte. Versión 0.5.0-beta.3, paquetes de prueba local sin publicar ni instalar.

Hashes también en artifacts/SHA256SUMS-beta5b3.txt, fuera de Git:

- KhypuPyme-0.5.0-beta.3-android-debug.apk: **5644549 bytes**, SHA-256 5057c1a9781255ee0ad06c454dca38dffcc86c9aa0adbd831614472c8304efda.
- KhypuPyme-0.5.0-beta.3-windows-x64-setup.exe: **2493127 bytes**, SHA-256 08126edfcb6374c1090bc7e11b7117ec2eac5d8ee197dacd7a3e11665706fdf5.


## Captura, cobro y errores 0.5.0-beta.4 — 08/11/2026

### Resultados reales

- Lint final aprobado (pnpm lint, salida 0). TypeScript estricto y compilación web aprobados en pnpm build, salida 0; Functions aprobadas en pnpm build:functions, salida 0. Se corrigió una duplicación de propiedades detectada por el typecheck inicial antes de la verificación final.
- Revisión estática de parser y compatibilidad: ancho comercial entero por división BigInt hacia abajo solo en captura imperial; listas y multiplicadores positivos; conteos/límites; metadatos v2 con unidad original y origen texto/selección. Cart revalida texto antes de generar una solicitud. El texto pendiente beta 3 no cambia de gramática automáticamente.
- Revisión estática de presentación: la función exacta showQuantity y exactDecimal siguen sirviendo a conversiones/campos y reconstrucción de cotizaciones; displayQuantity se usa solo al presentar. Dinero se calcula desde fracciones originales, no desde pies redondeados. Los documentos anteriores no se reescriben.
- Se corrigió el rechazo de active en customersV2 y timberGroups y se añadió el índice de clientes activos. Autorización y reglas sin cambios. Los mensajes se formatean en el punto de presentación; la excepción original del SDK sigue llegando a la clasificación de confirmación/reintento. WorkspaceCommandService y definitiveFailure no cambian.
- Inspección de solo lectura a demo-khypupyme: presentes los 21 negocios originales, con 126 artículos y 153 ventas; 24 negocios ordinarios en total y dos espacios de práctica. El agente no ejecutó escrituras comerciales, limpieza ni normalización de registros del usuario; no modificó cuenta, exportación ni servicios habituales.
- No se ejecutaron pnpm check, tests unitarios/integración/emuladores, capturas, vídeos ni recorridos automáticos. Los instaladores no se instalaron ni se abrieron. La compilación no acredita funcionamiento visual, financiero ni en dispositivos físicos.
- Advertencia de Vite: los bloques diferidos de pdfmake y fuentes superan 500 kB; no se añadieron dependencias.

### Escenarios pendientes de revisión funcional

- 2 pulgadas × 10 pies, tarifa Bs 22; anchos 6, 10, 5, 3, 1, 3, 3: siete piezas, 51,67 pies tablares y Bs 1.136,67. Es un resultado esperado documentado, no una prueba ejecutada.
- Mismos espesor/largo/tarifa; 5x10, 4x7, 7x3: 16 piezas, 165 pies tablares, Bs 3.630,00. X y ×, espacios, duplicados, saltos de línea y punto y coma.
- Ancho 5.5 → 5 con aviso; una pieza de ancho 5, espesor 2 y largo 10 a Bs 22: mostrar 8,33 pies y Bs 183,33 sin recalcular desde 8,33. Rechazo de ancho menor de una pulgada, cero/negativos, multiplicadores fraccionarios y límites de piezas/grupos/líneas.
- Expresiones incompletas (5x, separadores vacíos), corrección, vaciado y duplicación sin cantidades; no enviar ni reutilizar selección anterior. Métrico con punto decimal; espesor fraccionario intacto.
- Medidas guardadas no enteras, borrador anterior con coma decimal pendiente, restauración con distinta preferencia de unidad y consulta/reintento de solicitud original sin reinterpretación.
- Minimizar/expandir mediante teclado, conservar pago/cliente/revisión, ocultar con carrito vacío, revisión al cambiar importe y expansión/enfoque ante campos pendientes sin registrar nada.
- Listar clientes activos y medidas, búsqueda paginada, filtro inválido por recurso, stock insuficiente con producto/medidas/cantidades y códigos 400/401/403/409/429/500/503/504 sin convertir todos a 400.
- Aislamiento entre cuentas/negocios/prácticas, stock concurrente, conflictos de borradores y solicitudes inciertas; formato de documentos nuevos y conservación de documentos históricos.

La incidencia anterior de reingreso Windows/WebKit **permanece abierta, sin corrección acreditada**. Sin push, publicación, despliegue, servicios externos ni accesos de escritorio.

### Paquetes finales y recuento

Código fuente respecto de 1a46ed7: **43 archivos, +1172 / -446 líneas físicas**, excluyendo documentación, metadatos y archivos generados. Incluye reorganización de presentación; no es una medida de funcionalidad verificada.

Android final: assembleDebug aprobado (BUILD SUCCESSFUL, 31 s, versionCode 50004). Windows final: Tauri release y NSIS x64 aprobados, versión 0.5.0-beta.4. Ambos paquetes regenerados tras el último ajuste del resumen minimizado y validación del importe; no se instalaron ni se abrieron. Hashes también en artifacts/SHA256SUMS-beta5b4.txt, fuera de Git:

- KhypuPyme-0.5.0-beta.4-android-debug.apk: **5648906 bytes**, SHA-256 1f75e29340c6b343517f588d7b6c7e906f05c6ac5583dfe8c2afae614249ad3e.
- KhypuPyme-0.5.0-beta.4-windows-x64-setup.exe: **2498459 bytes**, SHA-256 d350aca7817f101f582e76eecaa7a7c41b10bcdd8bd1f7e1b642e27c4fc206a5.


## Tutorial desbloqueado y tonos crema 0.5.0-beta.5 — 08/11/2026

### Implementación y revisión estática

- Caja comparte una única consulta autorizada de sesión abierta entre pantalla e instructor. Carga/error/estado abierto o cerrado determinan la ayuda y el botón para continuar. El objetivo abarca el formulario real; el cierre incluye el desplegable. La consulta se actualiza tras operaciones confirmadas y mediante actualización manual; recuperar el foco de la ventana no desmonta formularios sin guardar.
- El servidor conserva la comprobación transaccional de caja abierta antes del avance manual. Registrar apertura sigue confirmando operación y progreso atómicamente mediante checkpointPractice, sin segundo envío desde la guía. Solo se precisó el mensaje del requisito pendiente; no se modificaron contratos financieros, reglas ni cálculos.
- Auditoría de objetivos: Nuevo cliente y formularios dentro de details habilitan también sus campos y resumen; encabezados encontrados usan la región de página. Completar desde un desplegable cerrado enfoca su summary, sin rellenar ni enviar nada. Si no hay objetivo disponible, se conserva acceso a la página para recuperar requisitos.
- Guía con Pointer Events/captura y flechas del teclado, posición de interfaz compartida por sesión entre guía principal y panel, ResizeObserver/límites de pantalla y diálogo, restauración y cabecera separada del contenido desplazable. Posición solo en memoria; no modifica operaciones ni la región resaltada.
- Fondo #F6F3EC, tarjetas #FFFAF1, resúmenes #F3EAD9 y bordes cálidos; campos blancos, verde principal, acentos y estados semánticos conservados. Sin nuevas dependencias ni cambios de datos.

### Revisión funcional diferida (no ejecutada)

- Caja sin abrir con fondo cero o positivo; apertura confirmada y paso automático; revisión de una caja previamente abierta; cierre desde details; consulta fallida y recuperación.
- Caja/sesión modificadas en otra pestaña, revisión obsoleta y solicitudes inciertas. Mantener identificador/contenido original y consultar antes del reintento manual.
- Objetivos/formularios de clientes, gastos, cotizaciones, informes y documentos; foco, navegación y controles accesibles sin bloqueo del campo necesario.
- Arrastre con ratón/dedo, flechas, captura/cancelación del puntero, restauración, cambio de paso/panel, pausa/reanudación, minimización, scroll, rotación y cambios de tamaño. Anchos previstos 360/768/1100/1440, sin comprobación visual declarada.
- Tonos crema, legibilidad y contraste en todos los rubros, alertas, formularios y estados de carga. No se acredita verificación visual o en dispositivos.

No se ejecutaron pruebas, capturas, vídeos ni recorridos automáticos. No se instalaron/abrieron los paquetes, ni se cambiaron registros, cuenta o servicios habituales. La incidencia de reingreso Windows/WebKit permanece abierta, sin corrección acreditada. Sin push ni publicación.


### Resultados reales del análisis y compilación beta 5

- Lint final aprobado: pnpm lint, salida 0. TypeScript estricto y web aprobados: pnpm build, salida 0. Functions aprobadas: pnpm build:functions, salida 0. El primer typecheck detectó un acceso potencialmente undefined en el mapa de flechas; se corrigió antes de las compilaciones finales.
- Android final aprobado: assembleDebug, BUILD SUCCESSFUL en 33 s, versionCode 50005. Paquete regenerado tras retirar la actualización automática por foco para conservar formularios sin guardar.
- Advertencias existentes: bloques diferidos de pdfmake/fuentes mayores de 500 kB, flatDir de Android y diferencia entre versiones del XML de SDK. No impidieron compilar; no se añadieron dependencias.
- git diff --check aprobado y revisión estática sin cambios en reglas, índices, contratos financieros, WorkspaceCommandService, TutorialAccess ni TutorialPolicy. No se ejecutó pnpm check porque incluye pruebas prohibidas para esta entrega.
- Código fuente respecto de b603efc: 12 archivos, **+578 / -406 líneas físicas**, incluidos contenedores/sangría, excluyendo documentación/metadatos. No equivale a líneas de funcionalidad nueva ni acredita funcionamiento en dispositivos.


### Paquetes finales beta 5

Windows final aprobado: Tauri release optimizado en 2 min 29 s y NSIS x64, salida 0. Ambos paquetes finales corresponden al código posterior al ajuste de conservación del formulario al recuperar el foco. No se instalaron ni se abrieron.

- KhypuPyme-0.5.0-beta.5-android-debug.apk: **5652588 bytes**, SHA-256 8104ffc0603367ee5adcf3b73a44a703472c30fe04699cff3a61bf049d368e38.
- KhypuPyme-0.5.0-beta.5-windows-x64-setup.exe: **2498134 bytes**, SHA-256 d6d2e0d2f1b9c0a4f60557f4ea073048c2f1109dddb5126736d027abd0bee2f3.

Hashes también en artifacts/SHA256SUMS-beta5b5.txt (fuera de Git). Archivos principales: CashPage, CashState, cash-context y Workspace; tutorial/TutorialCoach, useMovableGuide, context y TimberTutorialHost; TimberTutorialService en Functions; estilos compartidos y versiones. Sin push, despliegue, publicación, servicios externos ni accesos de escritorio.


## Maderas por especie 0.5.0-beta.6 — 08/11/2026

### Implementación y revisión estática

- Ficha timberSpecies con tres tarifas enteras BOB, revisión, estado e índice de nombre normalizado. Alta sin dimensiones ni stock; espesores positivos libres en entradas/ventas. Clasificación exacta BigInt: 1–2, 3–6, 7–20 pies; no se admiten huecos, fracciones de pie ni redondeo para clasificar. Métrico exige equivalencia exacta.
- TimberSpeciesService resuelve variante estable por especie/espesor y la crea únicamente dentro de la entrada. Inventario real por medidas, promedio ponderado por espesor, devolución con costo histórico y agregados de especie se confirman en UnitOfWork. Dinero y volumen exactos existentes se conservan; informes no suman el agregado de especie además de sus variantes.
- Listado/picker paginados por especie; hijos internos fuera del listado comercial normal. Resumen por categoría/espesor filtra antes de paginar; conserva medidas exactas, lectura acotada a 10.000 grupos y error explícito por exceso. Nuevos índices compuestos timberSpecies; reglas sin cambios.
- Venta toma tarifa por categoría desde servidor y valida la esperada, con conservación de tarifa aplicada. Cambio de categoría revisa una tarifa manual; confirmación del importe cambia con la selección. Cotización sin stock no crea variantes; convertir exige stock y catálogo vigente. Campos opcionales speciesId/thicknessMm mantienen contratos anteriores.
- Borradores guardan captura/referencias, no el inventario consultado; restauración y conversión reconsultan especies y precios autorizados. Solicitudes ya enviadas no se reinterpretan. Tutorial v2 admite alta nueva conservando acciones anteriores; v1 no cambia. Productos/negocios anteriores sin migración o borrado.

### Escenarios pendientes de revisión funcional — no ejecutados

- Alta de especie vacía con tres tarifas distintas; nombres repetidos normalizados, revisión conflictiva, archivo/reactivación y rechazo de escrituras/accesos cruzados entre negocios o cuentas.
- Límites 1, 2, 3, 6, 7 y 20 pies; rechazo de 0, negativos, 2,5, 6,5 y 21 pies. Modo métrico con 304,8 mm por pie exacto. Espesores 1, 1½, 2, 1¼ y otros admitidos.
- Una misma especie con diferentes espesores/largos/anchos en una compra y venta; agregados de piezas/volumen/valor, costo por espesor, límite de 20 líneas/100 grupos y dos entradas/salidas concurrentes.
- Precio por categoría igual en distintos espesores; volumen e importe distintos por espesor. Tarifa manual al cambiar largo, revisión del importe, catálogo modificado entre captura/confirmación, respuesta incierta y reintento original.
- Venta sin existencias, selección de medidas inexistentes y devolución parcial con costo histórico. Cotización antes de comprar sin creación de stock, conversión, tarifa manual original y nueva cotización cuando cambia el catálogo.
- Restauración de borrador incompleto, cambio de precio, conflicto entre pestañas, perfiles anteriores de madera fija/volumen/agrupada, documentos históricos y tutorial reanudado en versiones anteriores.
- Paginación y filtros globales del resumen, archivo con existencias, historial de compras filtrado por especie, presentación móvil/métrica y documentos nuevos con categoría/medidas.

No se ejecutaron pruebas, capturas, vídeos ni recorridos automáticos. No se modificaron datos, exportaciones ni servicios del propietario. La incidencia de reingreso Windows/WebKit sigue abierta, sin corrección acreditada. Sin push/publicación.


### Resultados reales de compilación beta 6

- pnpm lint final aprobado, salida 0. TypeScript estricto y web aprobados mediante pnpm build, salida 0. pnpm build:functions aprobado, salida 0. Las verificaciones iniciales detectaron un import de exactDecimal y una propiedad opcional en la conversión de cotizaciones; se corrigieron antes de la compilación final.
- Android aprobado: assembleDebug, BUILD SUCCESSFUL en 52 s, versionCode 50006. No se instaló ni se abrió el paquete.
- Advertencias no bloqueantes: bloques diferidos de pdfmake/fuentes superiores a 500 kB, flatDir y versión XML del SDK Android. pnpm notificó recreación de algunos accesos binarios al verificar el entorno; las herramientas completaron su compilación. Sin nuevas dependencias ni cambios del lockfile de pnpm.
- git diff --check aprobado. Revisión estática: reglas, UnitOfWork, WorkspaceCommandService y aritmética exacta sin cambios; las extensiones de comandos/consultas se validan y conservan el canal de práctica/propietario existente. No se ejecutó pnpm check porque contiene pruebas excluidas por el propietario.
- Código fuente respecto de e1a7dc2: **28 archivos, +493 / -81 líneas físicas**, excluyendo documentación, metadatos e índices. Incluye organización de componentes; no acredita comportamiento funcional o en dispositivos.


### Paquetes finales beta 6

Windows aprobado: Tauri release optimizado en 2 min 56 s y NSIS x64, salida 0. Los paquetes corresponden a la fuente verificada, no se instalaron ni abrieron. Hashes también en artifacts/SHA256SUMS-beta5b6.txt (fuera de Git):

- KhypuPyme-0.5.0-beta.6-android-debug.apk: **5496814 bytes**, SHA-256 5e0b102921ab357d8f5225d1b17ffac15e9fdc4d553ee98e318c331b53a9f0a6.
- KhypuPyme-0.5.0-beta.6-windows-x64-setup.exe: **2502625 bytes**, SHA-256 2ec333e8c4475b848bc75c22fbd90f33f0c406105d8ccd1a0a15be038cc01113.

Archivos principales: shared/workspace/timber-species.ts y model/validation; Functions TimberSpeciesService, InventoryService, TimberStockService, TradeService y WorkspaceQueries; interfaz TimberSpeciesCatalog, TimberSpeciesPicker, TimberLineEditor, Cart, carga de catálogo/borradores/cotizaciones y tutorial. Reglas y datos del propietario conservados, sin push, despliegue, publicación o accesos nuevos.


## Inventario detallado y correcciones protegidas 0.5.0-beta.7 — 08/11/2026

### Implementación y revisión estática

- Nombre de producto, especie y código separados de referencia. Contrato anterior opcional compatible: fichas antiguas se presentan con especie por completar, sin inferencia ni migración. Código único en barcodeIndex dentro del negocio, generación con contador, revisión y conservación de snapshots históricos. Variantes existentes y sus IDs/costos no se consolidan ni reinterpretan; las operaciones nuevas copian la identidad vigente.
- TimberStockQueries valida contexto y filtros, usa fracciones para ordenar largo/espesor/ancho/ID, devuelve 100 filas y cursor por tupla; calcula totales filtrados y falla explícitamente sobre 10.000 grupos. Carga acumulada por negocio/filtros/revisión, medidas visibles sin filtro previo y resumen secundario. Índices de combinaciones de filtros y auditoría incorporados; sin pruebas de consultas ejecutadas.
- ReportChart usa barras y escala con cero/negativos, etiquetas de centavos/importes grandes, tamaño por ResizeObserver, agrupación diaria/semanal/mensual, valores seleccionables y tabla diaria. La cuenta mostrada es de días con netos distintos de cero, no número de operaciones ni actividad inventada.
- SensitiveApprovalService recibe auth_time del contexto autenticado de Functions, nunca del comando. Preparación de cinco minutos, reautenticación posterior obligatoria, aprobación para UID/negocio/ID/digest por dos minutos, autenticación consumida para una sola aprobación y consumo con corrección/auditoría en la transacción. Se comprueba operación confirmada antes de consumir el permiso para conservar idempotencia. La contraseña solo pasa al SDK Firebase Auth; no se persiste ni se incluye en los endpoints comerciales.
- Protecciones en WorkspaceService y CommerceService compatible; prácticas verificadas mantienen su aislamiento. legacyWrite=false cierra el acceso directo comercial antiguo; recuperación se realiza por Functions. No se añadieron rutas públicas de eliminación masiva ni empleados. Las herramientas locales con Admin SDK siguen fuera del instalador y no equivalen a permisos de usuario de la aplicación.
- UnitOfWork conserva snapshots antes/después de campos relevantes para auditoría. Eventos vinculados a operación, motivo y autor, con lecturas del propietario. Los datos financieros existentes se corrigen mediante archivo/anulación/devolución, no borrado.
- WorkspaceCommandService distingue CommandNotSentError de una solicitud financiera incierta. Al reintentar, primero consulta la operación; errores o cancelación del preflight de autorización no borran el diario de la solicitud original. No se altera el contenido/ID ni se reenvía automáticamente.

### Revisión funcional y de seguridad diferida — no ejecutada

- Fichas antiguas con especie ausente; productos distintos con igual especie/nombre y códigos diferentes; duplicados y asignación concurrente, edición de identidad con stock, búsqueda/lector y documentos históricos.
- Orden 2/7/10/20 pies, espesores 1/1½/2, anchuras distintas y repetidas, filtros exactos, tablas móviles, 100/101/200 filas, carga acumulada y cambio de negocio/filtros. Cursores inválidos y medida agotada entre páginas; límites y totales.
- Gráfica sin netos, un día, negativos, importes pequeños con centavos y grandes; 31/32/180/181 días, cambios de mes/año y conservación de sumas, teclado/ratón/dedo y tabla accesible. No se acredita verificación visual.
- Contraseña errónea, cancelación, cambio de cuenta/negocio, reto caducado, permiso vencido/reutilizado, una autenticación reutilizada para aprobar otro comando, auth_time anterior o falsificado en el cuerpo, otra operación con el mismo ID, contenido cambiado y acceso cruzado.
- Atomicidad de consumo/auditoría/corrección; reintento después de confirmación, timeout de ejecución, consulta previa y cancelación/fallo de autorización en un reintento incierto sin pérdida del diario. Borradores vinculados y recuperación compatible.
- Rechazo de escritura/borrado directo en reglas, operaciones antiguas y todos los tipos de corrección. Motivos, historial antes/después, anulaciones sin duplicados, ajuste con fondos/stock insuficientes y corrección de caja con diferencia.

No se ejecutaron tests unitarios, integración, reglas, emuladores, capturas, vídeos ni recorridos automáticos. No se instalaron ni abrieron los paquetes. No se ejecutaron limpiezas, migraciones, cargas de ejemplo ni solicitudes financieras sobre los datos del propietario; no se reiniciaron sus servicios habituales. La compilación no acredita seguridad funcional ni comportamiento en dispositivos. Incidencia Windows/WebKit abierta, sin corrección atribuida a esta entrega. Sin push/publicación/cloud.

Referencias técnicas: Firebase Auth documenta reauthenticateWithCredential y el significado de auth_time en sus páginas de gestión de usuarios y validación de tokens. La duración del reto y del permiso es una política de esta aplicación, no un valor impuesto por Firebase.


### Resultados reales de compilación beta 7

- Lint final y compilación web con TypeScript estricto aprobados, salida 0; Functions aprobadas con su TypeScript propio. No se ejecutó pnpm check porque contiene pruebas excluidas por el propietario.
- Las verificaciones iniciales detectaron findLastIndex fuera del nivel de biblioteca configurado, inferencia recursiva de tipos, condiciones JSX con unknown y conservación de la causa de un error. Se corrigieron antes de las compilaciones finales; no se debilitaron reglas ni pruebas.
- Android final: assembleDebug aprobado (BUILD SUCCESSFUL en 48 s), versionCode 50007. Windows: Tauri release optimizado en 3 min 50 s y NSIS x64, salida 0. Ambos paquetes contienen la interfaz final con ajustes de ejes/centavos. No se instalaron ni se abrieron.
- Advertencias no bloqueantes: bloques diferidos de pdfmake/fuentes mayores de 500 kB y avisos existentes de flatDir/XML del SDK Android. Durante la comprobación del entorno pnpm notificó recreación de algunos accesos binarios; las herramientas completaron las compilaciones. Lockfile de pnpm y dependencias conservados.
- git diff --check aprobado; aritmética exacta y scripts de emuladores sin cambios. Los índices y las reglas nuevas quedan pendientes de revisión funcional, de ataques y de compatibilidad; no se presentan como pruebas de seguridad aprobadas.

### Instaladores beta 7

- KhypuPyme-0.5.0-beta.7-android-debug.apk: **5668494 bytes**, SHA-256 2b71e22acc655b95837e8f6fbb383c3a7193d9293ea2a844dc06eaee26775795.
- KhypuPyme-0.5.0-beta.7-windows-x64-setup.exe: **2507554 bytes**, SHA-256 dfbb152feda06f0e1ce88b030f5448b203f5609be9deb0e14a9a819bfeddf378.

Hashes en artifacts/SHA256SUMS-beta5b7.txt, fuera de Git. Archivos principales: modelo/validación/protection; TimberSpeciesService, TimberStockQueries y SensitiveApprovalService; UnitOfWork y adaptadores de comandos; TimberStockTable, ficha de madera, ReportChart, reautenticación y AuditHistory. Commit local, sin push ni publicación.

Recuento respecto de 955b22d: **32 archivos de código, +785 / -212 líneas físicas**, incluidas reglas y estilos; excluye documentación, índices, versiones y generados. No representa funcionalidad probada.

## Arranque y operación diaria 0.5.0-beta.8 — 11/11/2026

- Lint y TypeScript aprobados. Compilación web aprobada con los avisos previos de tamaño de PDF y fuentes. Functions compiló en una carpeta temporal para conservar la sesión local activa.
- Android compiló en 41 s con versionCode 50008. Se restauró el SDK 36 y las herramientas faltantes en la ubicación de Android del usuario. Windows compiló y generó el instalador NSIS x64. Los paquetes de prueba se guardaron en artifacts/ y quedaron fuera de Git.
- APK debug **5.674.496 bytes**, SHA-256 `ab2d835802db14a0963053b32a3415bd342489e807fd94c5f8d6ebaf9cdd5ea5`.
- Instalador Windows **2.511.935 bytes**, SHA-256 `ed1f70f168ba17b59f6a1c6a27996a013992d041977c6082f41b13e2ab160697`.
- Dos exportaciones de Auth y Firestore confirmadas desde la sesión activa el 11/11 a las 11:25 y a las 12:03, hora de Bolivia. Se conservó la copia original del 08/11 y se confirmó que los procesos habituales seguían activos. El primer intento de la segunda exportación agotó el tiempo de consulta al hub bajo carga de compilación; el reintento con margen de diez segundos terminó correctamente.
- Pendientes de revisión funcional. Arranque completo desde VS Code, restauración y cierres interrumpidos, desaparición de la guía al finalizar, caja que cruza medianoche y recorridos completos de tienda 24/7, ropa y electrodomésticos. La consulta de serie requiere el número exacto y el historial tiene un límite de lectura explícito. La matriz obtiene las variantes del modelo elegido en el servidor.
- Sin pruebas automatizadas, capturas ni recorridos. El 500 observado originalmente queda pendiente de confirmar con una referencia de diagnóstico. La incidencia previa de reingreso Windows/WebKit sigue abierta.

## Cobro y temas por rubro 0.5.0-beta.9 — 11/11/2026

- Lint, TypeScript, web y Functions aprobados. Functions se compiló fuera del directorio activo del emulador. Android y Windows se compilaron correctamente.
- APK Android debug **5.511.488 bytes**, versionCode 50009, SHA-256 `0400628976cbb4fef1d266bba49550f3942803e245c77df61f0bdd117819575c`.
- Instalador Windows x64 **2.512.870 bytes**, SHA-256 `ebfd9b4cd5f6ba9175d8dae5e355bd7f444399eb3ce2274c0d948e29042c7cc9`.
- En la sesión local autorizada se validó una exportación previa separada, se eliminaron los 28 negocios inventariados y se verificaron cero entradas en el selector y el mismo UID en Authentication. Se generó y validó una exportación posterior. Auth, Firestore y Functions siguieron activos.
- La revisión visual y funcional del cobro, los temas, la gráfica y el ingreso queda pendiente. No se ejecutaron pruebas automáticas ni se tomaron capturas. La incidencia previa de reingreso Windows/WebKit sigue abierta.

## Unidades, cobro y resultados 0.5.0-beta.10 — 11/11/2026

- Lint, TypeScript y compilaciones web y Functions aprobados. Functions se compiló fuera del directorio activo del emulador.
- Android debug **5.679.890 bytes**, versionCode 50010, SHA-256 `a5a0c706a1ee65e5143bfe58b3ec306a04a6df69549699394552a9b6c32a9b52`. Instalador Windows x64 **2.515.408 bytes**, SHA-256 `6f1a790908bf19d2c04d2079a9c3bffcf1625790cdd08899f1635c656f9c77f6`.
- Los emuladores habituales conservaron sus procesos. El siguiente arranque con el lanzador compilará y cargará la versión de Functions que admite las unidades y el informe ampliado.
- Pendientes de revisión manual. Compra en kg y venta en lb, compra en L y venta en mL, devoluciones con sus conversiones originales, reapertura del cobro con carrito largo y conciliación entre cifras diarias y el resultado del periodo.
- No se ejecutaron pruebas automáticas ni se tomaron capturas. La incidencia previa de reingreso Windows/WebKit sigue abierta.

## Disponibilidad y borrado 0.5.0-beta.11 — 12/11/2026

- Lint, TypeScript y compilaciones web y de Functions aprobados. Vite mantiene el aviso de tamaño de los paquetes de PDF y fuentes.
- Android debug 5.520.522 bytes, versionCode 50011. Windows NSIS x64 2.522.083 bytes. Ambos paquetes identifican la versión 0.5.0-beta.11.
- Revisión manual en demo-khypupyme-tests. Madera por medida exacta y suma de grupos repetidos, exclusión de lotes vencidos en tienda con compra por caja, stock de variante en ropa y serie inválida en electrodomésticos. Una venta directa de 100 piezas con siete disponibles fue rechazada y el saldo siguió en siete.
- En el navegador a 360 px, 15 filas en el carrito, barra fuera de su área desplazable, confirmación bloqueada por faltantes y devolución de foco a Revisar con Escape. La gráfica mostró el resultado negativo sin separar el signo del importe.
- Informe histórico ficticio de 96 días generado en cinco páginas. La lectura del PDF confirmó encabezado, numeración y aviso no fiscal en todas las páginas, con número de documento e importe negativo conservados.
- Borrado ficticio. Se comprobó nombre incorrecto, reautenticación obligatoria, caja abierta, cuenta ajena, código incorrecto, vencido, reemplazado y reutilizado, acceso directo denegado y bloqueo entre confirmación y limpieza. La limpieza reanudada retiró la ficha y su producto, conservando el acceso de la cuenta y tres negocios restantes.
- La primera compilación recargó Functions por el observador del emulador habitual. La compilación final de Functions y las comprobaciones de datos usaron un entorno separado. Los procesos habituales de Auth y Firestore siguieron activos.
- No se ejecutaron pruebas automáticas ni se tomaron capturas. La incidencia previa de reingreso Windows/WebKit sigue abierta.

## Adaptación de 17 rubros 0.5.0-beta.12 — 12/11/2026

- Lint, TypeScript y compilaciones web y Functions aprobados. Vite mantiene el aviso de tamaño en los paquetes de PDF y fuentes. Functions se compiló fuera del directorio activo del emulador habitual.
- Revisión manual con datos ficticios y llamadas directas al servidor en demo-khypupyme-tests. En abarrotes, dos cajas de 24 menos cinco unidades dejaron 43. En cosméticos, apartar el lote conservó sus tres piezas físicas y las excluyó de venta; se confirmó su liberación. En mascotas, la venta fraccionada conservó el lote de origen. En bebidas, se verificó el intercambio atómico de envases y el rechazo de una devolución superior al saldo.
- En calzado, un cambio desde la venta original exigió stock de la talla nueva. En electrónica, la compra y venta aparecieron en el historial de la serie y se rechazó reutilizarla. En ferretería, un rollo de 50 m menos 2,5 m dejó 47,5 m y se rechazó una compra por medio rollo. En repuestos, se verificaron la búsqueda por referencia equivalente y la inclusión/exclusión por año. En papelería, se aceptaron artículos e impresión en el mismo comprobante y se rechazó una cantidad de caras inconsistente.
- En muebles, la venta permitió preparar un retiro con constancia y rechazó duplicarlo. En cerámicas, 12 m² con 10 % de merma requirieron diez cajas de 1,44 m²; se permitió cotizar, pero se bloqueó la venta con nueve cajas disponibles. En cemento, dos bolsas de 50 kg transfirieron 100 kg y Bs 100 del lote original; se rechazó confirmar una valoración desactualizada.
- En peluquería, se rechazaron una cita superpuesta y un segundo cobro de la misma atención. En limpieza, servicios profesionales, taller y artesanía, se consultaron las órdenes con sus datos propios, se completaron, se cobró una vez y se permitió entregarlas conservando el vínculo de venta. Taller permitió registrar la espera de repuesto y emitir la constancia de recepción. Se comprobaron el acceso denegado desde otra cuenta y el rechazo de referencias a un producto de otro negocio de la misma cuenta.
- Revisión en navegador a 360 px en abarrotes. La pestaña de cobro quedó fuera del carrito y antes de la navegación móvil; una solicitud de 49 unidades mostró 43 disponibles y seis faltantes, bloqueó la confirmación y conservó cantidad y foco al minimizar con Escape.
- Se verificaron los registros originales de las constancias de recepción y despacho. Quedan pendientes los recorridos completos de interfaz por rubro y la apertura de los instaladores en dispositivos. Sin pruebas automatizadas ni capturas. La incidencia previa de reingreso Windows/WebKit sigue abierta.
- Android debug **5.694.891 bytes**, versionCode 50012, SHA-256 `6b2a4ec14b8d7b95f2358a9e35b078cde0af547801db9d5090e6e72411282b18`. Instalador Windows NSIS x64 **2.529.705 bytes**, SHA-256 `eb7eaa63e342aba4a097a7aba560314ee5732d9c75e972c02c24f94463a6cf18`. Ambos se identifican como 0.5.0-beta.12.

## Rediseño por rubro 0.5.0-beta.13 — 12/11/2026

- Lint, TypeScript, compilación web y compilación de Functions aprobados. Functions se compiló en un directorio temporal. Vite conserva los avisos de tamaño en pdfmake y fuentes.
- Revisión manual con negocios ficticios en el emulador separado. El asistente mostró los 21 rubros, cambió la vista previa al elegir Taller y conservó nombre y rubro al volver atrás. El selector destacó el último negocio utilizado.
- Se comprobaron los controles de espesor, largo y anchos en Maderas; el foco inicial en el lector de Tienda 24/7; la talla M azul con tres piezas disponibles en Ropa; y la consulta por serie con compra vinculada en Electrodomésticos. En Peluquería se consultó una cita desde Inicio y se mostró el intervalo 16:00–16:30, su duración y estado en Agenda. La agenda quedó dentro de la ventana a 768, 1100 y 1440 px.
- A 360 px, el carrito de cinco líneas permitió llegar al último botón antes de la pestaña de cobro. Se confirmó por separado que 49 piezas pedidas con 48 disponibles bloquean la venta. Escape minimizó el panel y devolvió el foco a Revisar conservando la cantidad.
- Sin pruebas automáticas ni capturas. Quedan pendientes los recorridos completos en dispositivos y la incidencia previa de reingreso Windows/WebKit.
- Android debug 5706708 bytes, versionCode 50013, SHA-256 13d8be67a884fcf56bda9b576631472eca253a982ac1c6819a6d89343bffc967. Windows NSIS x64 2535221 bytes, SHA-256 a3e69b3339c20e3b0078b9c1bbc6afaaa4b67265b809f4fd69f53c33a8ba8097. Ambos identifican la versión 0.5.0-beta.13.
