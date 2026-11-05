# Matriz de trazabilidad

Documentado = dossier; derivado = necesario para realizar un requisito; propuesto = decisión técnica adicional. Estados expresan el alcance actual, no porcentajes. Evidencia ejecutada: `docs/testing/validation.md`.

| ID original / fuente | Descripción | Prioridad | Módulo / historia | Archivos | Pruebas | Estado y evidencia | Decisión pendiente |
| --- | --- | --- | --- | --- | --- | --- | --- |
| RF-01, p.7 | Administrador único y moneda obligatoria | Must | Auth/negocio, PB-01; no historia formal en §8.3 | `src/features/auth/`, `src/features/business/`, `src/infrastructure/firebase.ts`, `firestore.rules` | `tests/integration/account-business.test.ts`, `tests/rules/business.test.ts`, `tests/e2e/base.spec.ts` | Implementado localmente, BOB obligatorio; ver validación | Verificar correo y políticas antes de cloud |
| RF-02, p.7 | Crear/editar/eliminar ingresos, monto/fecha/descripción | Must | Ventas / historia venta, PB-02 | Sin implementación; modelo en `docs/architecture/data-model.md` | Pendientes | No implementado | Anulación, monto libre, invariantes venta-stock |
| RF-03, p.7 | Crear/editar/eliminar gastos y categoría | Must | Gastos / historia gasto, PB-03 | Sin implementación | Pendientes | No implementado | Política de correcciones |
| RF-04, p.7 | Catálogo, stock actual y mínimo | Must | Inventario / historia stock, PB-04 | `src/features/inventory/`, `firestore.rules`, `firestore.indexes.json` | Dominio/componentes, integración, ataques y E2E de inventario | Implementado localmente; unidades enteras, movimientos con motivo, historial y archivo | Pruebas físicas; unidades fraccionarias fuera de esta entrega |
| RF-05, p.7 | Nombre, importe y estado pendiente/pagado | Must | Fiados / historia deuda, PB-05 | Sin implementación | Pendientes | No implementado | Diferenciar origen manual/venta; sin abonos |
| RF-06, p.7 | Saldo diario, pendientes y stock crítico | Must | Tablero / historias venta, gasto y stock, PB-06 | Sin implementación; pantalla inicial es preparación, sin métricas | Pendientes | No implementado | Validar definiciones operativas propuestas |
| RF-07, pp.7–8 | Reportes por rango y CSV o PDF | Should | Reportes / historia reporte, PB-07 | Sin implementación | Pendientes | No implementado | CSV primero; PDF/JSON posteriores |
| RNF-01, p.8 | Venta/gasto en menos de un minuto | Crítico documental | Flujos rápidos / venta, gasto | Pendiente de módulos | Usabilidad con personas, no ejecutada | No verificado | Seleccionar participantes y protocolo |
| RNF-02, p.8 | PWA en Chrome Android y Safari iOS | Crítico documental | Aplicación | `public/manifest.webmanifest`, `public/sw.js`, `src/main.tsx` | `tests/e2e/base.spec.ts` | Preparación local; emulación no acredita dispositivos reales | Instalación/HTTPS y pruebas físicas |
| RNF-03, p.8 | Privacidad y aislamiento entre negocios | Crítico documental | Todos; historia fiado | `firestore.rules`, configuración demo, repositorio | A/B CRUD y ataques en `tests/rules/business.test.ts` | Implementado para perfil; módulos futuros denegados | Ampliar pruebas por cada módulo |
| RNF-05, p.8 | Reportes/respaldos asíncronos en nube | Crítico documental; PB-08 Should | Respaldo; relación original con historia gasto | No implementado; `docs/deployment/readiness.md` | No ejecutadas | Diferido explícitamente | Storage, costos, retención, restauración y aprobación |
| RNF-06, p.8 | Responsive y operación táctil compacta | Crítico documental | UI; historia reporte | `src/styles.css`, formularios accesibles | Componentes y E2E escritorio/móvil | Base responsive; revisión integral pendiente | Pruebas físicas y evaluación WCAG 2.2 AA |

El salto RNF-03 → RNF-05 pertenece al original. No se crea RNF-04. Los identificadores de pruebas o archivos futuros no se atribuyen al dossier.

Seguridad del propietario, configuración demo, validación de tipos y recuperación local son medidas derivadas/propuestas; no constituyen nuevos RF/RNF oficiales. El respaldo cloud pendiente impide declarar cumplimiento completo del dossier o preparación comercial.
