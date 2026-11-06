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
