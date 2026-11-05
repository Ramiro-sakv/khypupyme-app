# Arquitectura y límites de la base

## Decisiones y origen

| Decisión | Clasificación | Fundamento / estado |
| --- | --- | --- |
| PWA + Firebase Auth/Firestore | Documentado | Dossier pp.10–12; implementados localmente |
| Storage para archivos/respaldos | Documentado, pendiente de aprobación | RNF-05/PB-08; no activado |
| React, TypeScript, Vite | Propuesto en prompt, confirmado por propietario | SPA sin SSR; apropiada para aplicación privada transaccional |
| Emuladores, proyecto demo y loopback | Derivado de autorización actual | Sin proyecto remoto ni facturación; no configurable a producción en esta versión |
| Funcionalidades + repositorios inyectables | Propuesto | UI depende de contratos; repositorio es adaptador Firestore |
| businessId igual UID del propietario | Propuesto | Una cuenta/un negocio en MVP; evita apropiación, consultas globales y bootstrap privilegiado |
| UID/ownerUid inmutables y reglas por esquema | Derivado | RNF-03; no confiar en un identificador enviado por cliente |
| Functions local para el núcleo comercial | Confirmado por propietario 05/11/2026 | Comandos transaccionales y consultas financieras; ejecución cloud bloqueada |
| Sesión de Auth por pestaña, Firestore en memoria | Propuesto | No caché persistente comercial en equipos compartidos; sesión se conserva al recargar y se cierra al cerrar la pestaña |
| CSS propio, sin Tailwind ni biblioteca UI | Propuesto | Base pequeña, menos dependencias; formularios semánticos, foco y controles táctiles |
| PWA sin caché de respuestas ni cola offline | Derivado | No prometer consistencia sin conexión; fallback de navegación explica la limitación |

Flujo actual: React → contrato AuthService/BusinessRepository → clase FirebaseAuthService/FirestoreBusinessRepository → SDK Firebase web → emuladores Auth/Firestore → Security Rules. Para auth/perfil/inventario/compras se conserva ese flujo. La beta añade Functions local para el núcleo comercial; Storage sigue diferido. El SDK nunca se importa desde los componentes.

Actualización 05/11/2026, a solicitud del propietario: las clases concretas encapsulan los adaptadores de autenticación y persistencia, con responsabilidad única y dependencias por constructor. Repository y Adapter separan Firebase de la interfaz; la composición en `src/infrastructure` inyecta los contratos y conserva la carga diferida de Firestore. Los datos sin comportamiento siguen siendo tipos y las validaciones puras siguen siendo funciones; React conserva componentes funcionales. La distribución descargable Android/Windows es un requisito posterior del propietario, con proyectos Capacitor Android y Tauri Windows incorporados en beta; se conserva React/TypeScript.

## Seguridad e integridad

Se autorizan get/create/update del propio negocio, con esquema exacto, propietario inmutable, BOB/La Paz y timestamps de servidor. Listar todos los negocios y borrar perfiles está denegado. Productos, movimientos y compras conservan las reglas detalladas abajo. Las colecciones financieras beta permiten lecturas limitadas del propietario y deniegan toda escritura directa del cliente. Borrar será un procedimiento explícito con política de conservación, no una escritura casual. Datos del usuario: Firebase Auth almacena correo/UID; no se duplica correo ni se pide documento o dirección. La agenda de clientes admite teléfono opcional.

Creación del negocio en una transacción sobre `businesses/{uid}`: reintentos consultan el documento existente y no lo reemplazan. Una lectura desde servidor posterior confirma el estado antes del mensaje de éxito. Si se pierde la respuesta tras escribir, se debe volver a consultar; no se afirma que una operación pendiente haya fallado definitivamente. Nombre editable, moneda y zona bloqueadas para proteger futuras operaciones históricas.

Futuro multiusuario requerirá membresías seguras y migración del criterio `uid == businessId`; no se confunde esta estructura con soporte Pro ya implementado. Modelo y reglas se revisarán antes de abrir acceso a colaboradores.

## Inventario autorizado: primera versión local

El propietario aprobó catálogo, unidades enteras y entradas/salidas con motivo. Orden de lectura: dominio → InventoryRepository → InventoryService → FirestoreInventoryRepository → reglas/pruebas → interfaz. El servicio normaliza entradas; el repositorio encapsula transacciones y consultas. La interfaz recibe servicios por composición, sin SDK Firebase.

Producto/apertura y stock/movimiento se escriben atómicamente. Las reglas validan el vínculo en ambas direcciones con getAfter, incluyendo stock previo/posterior, autor, fecha, ID nuevo y forma exacta. Los movimientos son inmutables y no hay borrado físico. Editar metadatos no cambia stock; los archivados no aceptan movimientos. Las escrituras directas de ventas/gastos/fiados siguen denegadas; solo Functions local puede realizarlas.

Cada solicitud usa un ID estable. Antes de confirmar un error de red o una carrera por el mismo ID, el repositorio consulta el movimiento del servidor y compara la solicitud original. Una operación distinta con el mismo ID se rechaza. Si no existe el movimiento y el servidor rechazó una vista antigua por permisos/conflicto, se vuelve a calcular en una transacción nueva, con un máximo de tres intentos externos a los reintentos del SDK. Esto no amplía permisos ni sustituye las reglas.

Una única solicitud incierta se conserva por cuenta en sessionStorage (ID y formulario, sin credenciales) para sobrevivir a recargas de esa pestaña. No se reenvía automáticamente ni permite iniciar otra modificación hasta resolverla. Esta intención pendiente no es una caché comercial ni una cola offline; al cerrar la pestaña se pierde y debe consultarse el historial antes de repetir manualmente. Dinero en centavos enteros y cantidades de unidades enteras; sin pesos ni costos de compra en esta entrega.

## Compras y costos: v0.2 local

Actualización v0.2, confirmada 05/11/2026: compras y costos se implementan como extensión del núcleo común, sin Functions ni otro servidor. `PurchaseService` valida; `FirestorePurchaseRepository` coordina transacciones compra/producto/movimiento y anulación/producto/movimiento. Las funciones de registro y confirmación reutilizadas por ambos repositorios están en `inventory/firestore-records.ts`. No se exponen SDKs a componentes. Los movimientos de stock actuales incluyen valoración protegida por reglas; los productos antiguos requieren inicialización explícita.

El identificador original también protege referencia y fecha de compra: el documento confirmado se compara con toda la solicitud, incluso después de carreras concurrentes con el mismo ID. Una única solicitud pendiente por cuenta/pestaña se comparte entre Inventario y Compras para creación, movimiento, valoración, compra y anulación; la recuperación sigue siendo manual. El promedio mostrado no sustituye el valor entero almacenado. Ver el algoritmo y los límites en el modelo documental.

Paginación de compras: hasta 26 documentos para mostrar 25, una lectura de negocio y como máximo 25 consultas puntuales de anulación. No se descarga el historial completo para calcular indicadores. No hay indicadores de ganancias en esta versión. Tests separados en `demo-khypupyme-tests` y puertos dedicados; el frontend de pruebas exige ese proyecto y no admite destinos remotos.

## Operaciones futuras: todavía sin autorización de implementación

- Venta con productos: ID de operación estable, transacción con lectura de stock, venta inmutable con precios históricos, movimientos e inventario atómicos; doble clic, reintento, cancelación y concurrencia probados.
- **Una transacción del cliente no impide que un cliente malicioso escriba directamente.** Hay que demostrar en reglas la vinculación entre venta, importes, movimientos y stock con `getAfter`, límites acotados y pruebas adversarias. Si las reglas no pueden comprobar suma/arreglos/invariantes de forma mantenible, proponer operación confiable de servidor. Functions/otra infraestructura y sus costos requieren aprobación previa. Hasta resolverlo, las escrituras comerciales siguen denegadas.
- Gastos y ventas corregidas: se propone anulación lógica más operación compensatoria, sujeta a revisión de equivalencia con RF-02/03. No editar stock sin trazabilidad.
- Fiado de venta: la venta cuenta como venta, no como dinero recibido. Cobro total posterior crea un evento único y marca la deuda pagada atómicamente. Fiado manual no crea retroactivamente una venta; su cobro se identifica separado. Sin abonos parciales.

## Definiciones financieras propuestas

Importes BOB enteros en centavos, con límites seguros; cantidades enteras positivas inicialmente. Productos por peso requieren decisión antes de desarrollarse. La fecha comercial se obtiene en America/La_Paz; timestamps de auditoría vienen del servidor y no se sustituyen por fecha operativa editable.

- Ventas del día: ventas vigentes por fecha operativa, incluidas fiadas; no equivalen a cobros.
- Entradas cobradas: ventas pagadas al momento + eventos de cobro de fiados, cada uno una vez.
- Saldo operativo estimado: entradas cobradas − gastos confirmados del periodo. No es utilidad/ganancia neta ni saldo bancario; no incorpora caja inicial, impuestos, costos devengados u otros movimientos no registrados.
- Pendiente: deuda vigente no cobrada. Stock crítico: menor que el mínimo, como p.10; agotado es cero aunque el mínimo sea cero.

Dashboard y reportes compartirán una sola lógica. No hay implementación de métricas en esta fase.

## Consultas, costos y evolución

Actual: una lectura directa del perfil, una creación transaccional o actualización y confirmación; no listeners sobre historiales ni enumeración de negocios. El modo Strict de desarrollo puede repetir efectos; no se toma como medición de producción.

Futuro: paginar historiales (propuesta inicial 25 filas), rangos por fecha, índices compuestos según consultas reales, evitar descargas completas para totales. Evaluar agregaciones de Firestore o resúmenes diarios mantenidos en operación confiable; no confiar totales editables libremente por cliente. Medir lecturas/escrituras y carga por negocio antes de elegir. Las cuotas no son garantías de costos ilimitados.

## Versiones y fuentes oficiales revisadas el 30/10/2026

Se consultaron documentación oficial y metadatos npm (`version`, `engines`, `peerDependencies`) antes de instalar. Node 24.22.1 satisface la cadena; Rules Unit Testing 6 requiere Node >=24.12. TypeScript 5.9.3 se seleccionó por compatibilidad de typescript-eslint (su rango no incluye TypeScript 7). Vite 8.3.5 y plugin-react 6.1.2 tienen peers compatibles; React 19.3.1 y React Router 8.5.1 coinciden con sus rangos. Versiones exactas y transitivas en package/lockfile.

pnpm 11.25.0 ya estaba disponible en Codex. Se revisaron los scripts de instalación: `re2` descarga un binario nativo requerido por herramientas; se permite explícitamente. `@firebase/util` autoconfigura entornos cloud y `protobufjs` comprueba versiones: sus postinstall se omiten explícitamente al no ser necesarios para este entorno, sin omitir pruebas ni compilación de la aplicación. pnpm añadió una excepción de antigüedad para ESLint 10.14.0; se conserva tras revisar versión y compatibilidad. Firestore se carga mediante importación dinámica al consultar el perfil; las pantallas públicas no descargan ese módulo de base de datos.

- [React: aplicación desde cero](https://react.dev/learn/build-a-react-app-from-scratch)
- [Vite: requisitos y preparación](https://vite.dev/guide/)
- [Firebase: Emulator Suite](https://firebase.google.com/docs/emulator-suite/install_and_configure)
- [Conexión Firestore y proyectos demo](https://firebase.google.com/docs/emulator-suite/connect_firestore)
- [Authentication Emulator](https://firebase.google.com/docs/emulator-suite/connect_auth)
- [Pruebas de Security Rules](https://firebase.google.com/docs/firestore/security/test-rules-emulator)
- [Transacciones y límites de validación](https://firebase.google.com/docs/firestore/manage-data/transactions)

## Dependencias: revisión de seguridad

La auditoría inicial detectó `@grpc/grpc-js` 1.9.16 transitivo de Firestore con avisos alto/bajo. `pnpm-workspace.yaml` fija 1.14.7 (misma versión mayor, corregida según [GHSA-m9gg-hp2v-232j](https://github.com/advisories/GHSA-m9gg-hp2v-232j)); se repiten integración y reglas después del cambio. En la base v0.2 la auditoría de producción quedó sin avisos conocidos. En la beta v0.3 hay dos avisos moderados transitivos, detallados a continuación.

La cadena de **desarrollo** de Firebase CLI mantiene dos avisos moderados: [uuid 9.0.1](https://github.com/advisories/GHSA-w5hq-g745-h8pq) y [OpenTelemetry Core 1.30.1](https://github.com/advisories/GHSA-8988-4f7v-96qf). No se distribuyen en el navegador. No se fuerzan versiones mayores incompatibles: quedan registrados para actualizar Firebase CLI y comprobar APIs antes de usarlo con recursos cloud. El resultado no equivale a una auditoría de seguridad completa. CI bloquea avisos altos de producción y no despliega.

## Beta común 0.3: servidor autorizado y paquetes locales

React → contrato `CommerceRepository` / `CommerceService` → adaptador callable → Functions Auth → validaciones estrictas → transacción Admin en Firestore Emulator. El ID del negocio se deriva del token autenticado. No se acepta autor/UID, costo histórico, total o estado de pago calculados por el cliente. Operaciones con firma canónica inmutable e ID estable. Las colecciones financieras deniegan todas las escrituras del navegador, incluso las del propietario.

Los servicios de dominio reciben dependencias por constructor. No hay acceso Firestore desde componentes ni Admin SDK en el bundle. Clientes/servicios admiten archivo y cambios de catálogo; documentos históricos conservan sus nombres/precios/costos. Las correcciones financieras se anulan y se registran de nuevo; no se sobrescriben ni eliminan. Cobros completos atómicos y pagos únicos por deuda. Reglas heredadas siguen validando compras/inventario; Admin valida las nuevas ventas y sus movimientos.

Gráficos SVG propios con tabla de cifras accesible; no se agregan bibliotecas de gráficos. Informes acotados y sin datos de demostración implícitos. Native: Capacitor 8 para Android y Tauri 2 para Windows, rutas hash y recursos empaquetados. La exportación Android usa Filesystem en caché privada y Share con selección del usuario. El destino Windows conserva CSP local y no incorpora plugins de shell. No se añaden permisos de almacenamiento general. Los servicios siguen en emuladores; no hay costos cloud, despliegues ni publicación.

Auditoría de producción beta: `glob` ([GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4)) y `minimatch` ([GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249)), ambos moderados. Las versiones corregidas indicadas por el registro requieren saltos mayores (glob >=14.0.2 y minimatch >=11.0.1); no se fuerzan reemplazos incompatibles en el SDK. Los comandos comerciales no aceptan patrones glob ni rutas del usuario. Revisar/actualizar la cadena antes de habilitar servidor cloud. `pnpm audit --prod --audit-level high` termina con código 0, manteniendo visibles esos avisos.
