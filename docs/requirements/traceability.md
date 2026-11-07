# Matriz de trazabilidad

Documentado = dossier; derivado = necesario para realizar un requisito; propuesto = decisión técnica adicional. Estados expresan el alcance actual, no porcentajes. Evidencia ejecutada: `docs/testing/validation.md`.

| ID original / fuente | Descripción | Prioridad | Módulo / historia | Archivos | Pruebas | Estado y evidencia | Decisión pendiente |
| --- | --- | --- | --- | --- | --- | --- | --- |
| RF-01, p.7 | Administrador único y moneda obligatoria | Must | Auth/negocio, PB-01; no historia formal en §8.3 | `src/features/auth/`, `src/features/business/`, `src/infrastructure/firebase.ts`, `firestore.rules` | `tests/integration/account-business.test.ts`, `tests/rules/business.test.ts`, `tests/e2e/base.spec.ts` | Implementado localmente, BOB obligatorio; ver validación | Verificar correo y políticas antes de cloud |
| RF-02, p.7 | Crear/editar/eliminar ingresos, monto/fecha/descripción | Must | Ventas, PB-02 | `shared/commerce.ts`, `functions/src`, `src/features/commerce` | Integración transaccional y E2E beta | Implementado local: productos/servicios, descuentos y comprobante interno | Corrección mediante anulación y nuevo registro; decisión derivada para conservar auditoría |
| RF-03, p.7 | Crear/editar/eliminar gastos y categoría | Must | Gastos, PB-03 | `functions/src/CommerceService.ts`, `RecordsPage.tsx` | Integración, ataques y E2E beta | Registro, categorías y anulación local | Anulación con motivo sustituye borrado/edición histórica |
| RF-04, p.7 | Catálogo, stock actual y mínimo | Must | Inventario / historia stock, PB-04 | `src/features/inventory/`, `firestore.rules`, `firestore.indexes.json` | Dominio/componentes, integración, ataques y E2E de inventario | Implementado localmente; unidades enteras, movimientos con motivo, historial y archivo | Pruebas físicas; unidades fraccionarias fuera de esta entrega |
| RF-05, p.7 | Nombre, importe y estado pendiente/pagado | Must | Fiados, PB-05 | `functions/src/CommerceService.ts`, `RecordsPage.tsx` | Fiado, cobro concurrente, anulación y E2E | Implementado local: deuda manual/venta, cobro completo | Sin abonos parciales, decisión confirmada |
| RF-06, p.7 | Saldo diario, pendientes y stock crítico | Must | Tablero, PB-06 | `CommerceQueries.ts`, `DashboardPage.tsx`, `ReportChart.tsx` | Informes con fixtures y E2E | Tablero local con métricas reales, series y alertas | Flujo de ventas/cobros/gastos excluye compras; no saldo de caja/banco |
| RF-07, pp.7–8 | Reportes por rango y CSV o PDF | Should | Informes, PB-07 | `CommerceQueries.ts`, `export.ts`, `DashboardPage.tsx` | CSV contra fórmulas, periodos e informes E2E | CSV local, gráfico y tabla accesible | PDF/JSON posteriores; 366 días y 10.000 registros por sección |
| RNF-01, p.8 | Venta/gasto en menos de un minuto | Crítico documental | Flujos rápidos / venta, gasto | Pendiente de módulos | Usabilidad con personas, no ejecutada | No verificado | Seleccionar participantes y protocolo |
| RNF-02, p.8 | PWA en Chrome Android y Safari iOS | Crítico documental | Aplicación | `public/manifest.webmanifest`, `public/sw.js`, `src/main.tsx` | `tests/e2e/base.spec.ts` | Preparación local; emulación no acredita dispositivos reales | Instalación/HTTPS y pruebas físicas |
| RNF-03, p.8 | Privacidad y aislamiento entre negocios | Crítico documental | Todos; historia fiado | `firestore.rules`, configuración demo, repositorios | A/B CRUD y ataques de perfil, inventario y compras | Implementado localmente para perfil/inventario/compras; módulos futuros denegados | Ampliar pruebas por cada módulo |
| RNF-05, p.8 | Reportes/respaldos asíncronos en nube | Crítico documental; PB-08 Should | Respaldo; relación original con historia gasto | No implementado; `docs/deployment/readiness.md` | No ejecutadas | Diferido explícitamente | Storage, costos, retención, restauración y aprobación |
| RNF-06, p.8 | Responsive y operación táctil compacta | Crítico documental | UI; historia reporte | `src/styles.css`, formularios accesibles | Componentes y E2E escritorio/móvil | Base responsive; revisión integral pendiente | Pruebas físicas y evaluación WCAG 2.2 AA |

El salto RNF-03 → RNF-05 pertenece al original. No se crea RNF-04. Los identificadores de pruebas o archivos futuros no se atribuyen al dossier.

Seguridad del propietario, configuración demo, validación de tipos y recuperación local son medidas derivadas/propuestas; no constituyen nuevos RF/RNF oficiales. El respaldo cloud pendiente impide declarar cumplimiento completo del dossier o preparación comercial.

## Extensión confirmada por el propietario: v0.2 (05/11/2026)

Compras y costo promedio desde adquisiciones son una ampliación confirmada, no un nuevo RF numerado del dossier. Implementación: `src/features/purchases`, `src/features/inventory/costing.ts`, valoración inicial y reglas de compras/anulaciones. Cubre compra de un producto por operación, cantidad/costo/fecha/referencia, actualización atómica, consultas por producto/periodo, anulación condicionada, redondeo y conservación de datos anteriores. Evidencia en integración, reglas adversarias, componentes y E2E.

La selección futura de rubro, variantes, medidas, series y fabricación es visión confirmada para entregas posteriores, aún no implementada. También se confirmaron un negocio por cuenta, internet y futura distribución conjunta Android/Windows. RF-02/03/05/06/07 no se declaran cumplidos por incorporar compras. No hay métricas de ganancias ni gastos de operación en v0.2.

## Extensión confirmada: beta común, 05/11/2026

Autorizados Functions exclusivamente en emuladores y núcleo común completo; perfiles especializados después. Nuevos módulos usan servidor transaccional y Firestore deniega toda escritura financiera directa. Ganancia bruta = ventas netas vigentes − costo histórico vendido. Resultado operativo estimado = ganancia bruta − gastos vigentes − bajas manuales valoradas. Fiados no duplican ventas al cobrarse; deudas anteriores no inventan ingresos históricos. Las anulaciones conservan evidencia y devuelven cantidades/costo/dinero según corresponda.

Clientes y catálogo de servicios son extensiones derivadas de esa autorización. Android y Windows son paquetes de prueba con backend local, no distribución comercial. RNF-01 y pruebas físicas/privacidad/recuperación antes de un piloto permanecen pendientes. No se declara cumplimiento del respaldo cloud RNF-05.

## Perfiles y modularización, ampliación autorizada 06/11/2026

Beta 2 permite perfiles retail/services/mixed con capacidades comunes existentes y vista previa, no rubros especializados terminados. La configuración tiene versión y revisión; cambios explícitos sin borrar documentos, alterar stock/valor ni convertir unidades. Los negocios previos preservan acceso y no se migran automáticamente. Amplía RF-01/RNF-06 y mantiene RNF-03 con validación de configuración en reglas/servidor y aislamiento de contexto por UID. Pantallas y formularios separados se cargan bajo demanda, con reintento y recuperación prioritaria de operaciones inciertas. Los instaladores aún empaquetan todos los archivos; no acredita descarga remota de perfiles, nube o módulos industriales. No se crean nuevos RF/RNF numerados del dossier.


## Rubros, ampliación explícita 06/11/2026

Beta 3 implementa catálogo investigado de 21 rubros en el alta del negocio, agrupados por familia comercio/servicios/mixto. Extiende RF-01 y RNF-06 con selección, vista previa y datos por rubro; conserva RNF-03 mediante validación de fichas inmutables en reglas, aislamiento A/B y copia histórica en compras/ventas. Fichas de madera, moda, equipos, lotes, cerámica y cemento operan con cantidades enteras y unidades fijas. Los detalles, fuentes y límites son decisiones derivadas de la solicitud del propietario, documentadas en README; no se atribuyen al dossier ni se crean nuevos identificadores RF/RNF. No acredita fabricación, FEFO, series, mesas o agenda.


## Ampliación autorizada 0.4 — 07/11/2026

| Requisito | Código principal | Evidencia disponible |
|---|---|---|
| Varios negocios / rubro fijo | AccountService, WorkspaceService, BusinessWizard, WorkspaceApp | Implementado; compilación. Sin prueba de aislamiento |
| Rubros, fracciones, compras múltiples | shared/workspace, InventoryServiceV2, TradeService, módulos | Implementado; compilación. Sin prueba de concurrencia |
| Devoluciones, cambios, series/lotes, caja | TradeService, InventoryServiceV2, CashService, Trade/Operations | Implementado; compilación. Sin prueba financiera/reglas |
| Historial y compatibilidad | LegacyInventory, CommerceService, Legacy, OperationJournal | Implementado; sin conversión automática ni prueba sobre datos del propietario |
| PDF no fiscal | Documents, workspace/pdf, diálogo Tauri, Filesystem/Share Android | Implementado; compilación. Contenido/guardado no probados |
| Gráficos e informes | WorkspaceQueries, Reports, ReportChart | Implementado; compilación. Sin validación funcional |
| Paquetes y perfil alojado | Android/Windows, perfil explícito | Solo paquetes locales; cloud/publicación fuera de autorización |

Pruebas omitidas por la instrucción más reciente del propietario: no trasladar resultados de beta 3 a 0.4. No se cambia ni inventa RNF-04.


## Presentación 0.4.0-beta.2 — 07/11/2026

- Diseño profesional común, detalles por rubro, navegación adaptable y negocio activo: WorkspaceHome, WorkspaceApp, estilos e iconos locales.
- Inicio/Informes y Ventas/Cotizaciones separados: Dashboard, useReport, Reports y Trade; importes y comandos originales conservados.
- Usabilidad: paneles, tablas/tarjetas, asistente, fechas/estados en español y avisos de borradores. Sin nuevos permisos, reglas, contratos ni datos comerciales.
- Evidencia: lint/TypeScript/build e instaladores; no ejecutadas pruebas ni revisión visual de 360/768/1100/1440, dispositivos, PDF o recorridos. Incidencia Windows/WebKit sin revalidar.


## Continuidad 0.4.0-beta.3 — 07/11/2026

- Borradores: DraftRepository, IndexedDbDraftRepository, TradeDraftService, useTradeDraft y DraftStatus. Separación uid/businessId/tipo, revisión local atómica, autorización al restaurar, revisión de precios y series, vínculo con solicitud original y limpieza tras confirmación. Implementado; sin pruebas funcionales.
- Responsabilidades: WorkspaceCommandService, AccountCreationService y pantallas separadas de cuenta/espacio/ventas/compras/cotizaciones/devoluciones/clientes/caja/garantías. Contratos Firebase y servidor financiero conservados.
- Ayuda/detalles: GettingStarted deriva pasos de registros existentes; IndustryHelp aporta indicaciones del modelo actual; PurchaseHistory usa una consulta filtrada/paginada; DocumentsPage conserva detalle histórico y exportación separada.
- No se incorporan módulos comerciales ni nuevos identificadores RF/RNF. Verificación limitada a análisis estático y construcción de paquetes; aislamiento entre cuentas/negocios, conflictos entre pestañas, precios, respuestas inciertas y PDF quedan para revisión funcional posterior. Windows/WebKit sigue sin corrección acreditada.

## Rubros y ejemplos 0.5.0-beta.1 — 07/11/2026

Ampliación expresa del propietario, derivada de su solicitud de 21 rubros con procesos propios y sustitución de los cuatro negocios locales por ejemplos en la misma cuenta. No se inventan identificadores RF/RNF ni se atribuye este alcance al dossier.

| Necesidad | Implementación | Verificación prevista en esta entrega |
|---|---|---|
| Guía propia y apoyo visual | industry-workflows, IndustryGuidePage, VisualExplainer, IndustryHelp | Compilación; revisión visual diferida |
| Agenda única | OperationalService, appointments/calendarDays, AppointmentPage | Análisis estático; concurrencia diferida |
| Órdenes y venta única | workOrders/workflowEvents, operational-sale, WorkOrderPage/OperationalSalePage | Tipos/compilación; aislamiento y concurrencia diferidos |
| Entregas y envases | deliveries, containerTypes/Balances/Movements y pantallas propias | Compilación; recorridos y límites diferidos |
| Búsqueda y descripción por rubro | searchPrefixes, consultas paginadas, ItemDetails opcional, modelos existentes habilitados | Tipos/índices; contratos anteriores conservados |
| Sustitución y ejemplos | herramienta local, autorización por cuatro IDs, manifiesto reanudable y exportación | Inspección de carga solicitada; sin tests automáticos |
| Paquetes | Android/Windows locales 0.5 beta | Compilación sin instalar/arrancar |

El estudio de capacidades anteriores, mejoras, límites y fuentes está en industry-study.md. Los datos de autorización/manifiesto/resumen, datos del emulador e instaladores están excluidos de Git. No se acredita corrección de reingreso Windows/WebKit.


## Tutorial práctico 0.5.0-beta.2 — 07/11/2026

Alcance autorizado por el plan del propietario; no se atribuye al dossier ni se crean identificadores RF/RNF.

| Necesidad | Archivos principales | Evidencia y límites |
|---|---|---|
| Instructor dentro de pantallas y paneles | shared/workspace/timber-tutorial.ts, tutorial/TutorialCoach, TimberTutorialHost, Panel | Lint/tipos/compilación; recorrido manual pendiente |
| Espacio vacío separado y avance confirmado | TimberTutorialService, TutorialAccess, TutorialPolicy, WorkspaceService, TutorialWorkspaceRepository | Revisión estática; concurrencia y ataques pendientes |
| Pausa, recuperación y limpieza delimitada | TutorialControlStore, sesión privada, IndexedDbDraftRepository y OperationJournal existentes | Sin escribir ni borrar datos del usuario durante esta entrega; aislamiento y fallos de limpieza pendientes |
| Pulgadas/pies y métrico | timber-measures, catalog, ItemForm, PreferencesPage, TimberVisual, Documents/TradeService | Tipos/compilación; conversiones, presentación histórica y PDF pendientes de revisión funcional |
| Conservación de ejemplos | Consulta de solo lectura a demo-khypupyme | 21 IDs originales presentes, 126 artículos y 153 ventas; cero espacios de práctica creados por el agente |

No cambian firestore.rules, CashService ni algoritmos monetarios exactos. El contrato v2 se amplía con una preferencia opcional y un canal de tutorial separado. Reingreso Windows/WebKit continúa abierto; no se acredita seguridad ni funcionamiento completo mediante compilación.


## Maderas rápidas y tutorial 0.5.0-beta.3 — 07/11/2026

Plan explícito del propietario posterior al tutorial beta 2. No se atribuye al dossier ni se crean nuevos códigos RF/RNF.

| Necesidad | Implementación | Evidencia / límite |
|---|---|---|
| Especie/espesor con medidas internas | timber-grouped, timberGroups y TimberStockService | Análisis estático, tipos y compilación; sin migrar productos anteriores |
| Piezas y volumen exactos | timber-groups/timber-measures, cantidades enteras de piezas y fracciones de volumen | Cálculo compartido; casos numéricos y concurrencia pendientes de revisión funcional |
| Compra/venta mixta y tarifa por grupo | líneas timber opcionales, snapshots y asignaciones, Trade/TimberLineEditor | Contratos anteriores conservados; transacción y redondeo en servidor; sin pruebas ejecutadas |
| Devolver medidas originales | TimberReturnFields y restitución de asignaciones en TimberStockService | Validación física y costo histórico en código; ataques y repetición pendientes |
| Cobro y clientes rápidos | barra visible, búsqueda paginada, alta de cliente en panel separado | Cliente ocasional al contado; crédito nuevo requiere cliente registrado |
| Tutorial sencillo | manifiestos v1/v2, siete recorridos, máscara/foco y controles reales | Datos sugeridos libres; confirmación del servidor y reintento manual; accesibilidad/recorridos pendientes |
| Compatibilidad y aislamiento | contexto original, sesiones v1, diarios y limpieza existentes | Sin modificar reglas, negocios, registros históricos ni servicios habituales |

La búsqueda de clientes admite hasta 10.000 registros y falla expresamente si se supera; no modifica documentos anteriores. La entrega no incorpora facturación fiscal ni despiece automático. Los instaladores siguen siendo locales y la incidencia Windows/WebKit permanece abierta.
