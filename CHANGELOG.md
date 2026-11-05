# Cambios

## 0.2.0 - 2026-11-05 (local, pendiente de autorización de subida)

- Compras de un producto, cantidad/costo/fecha/referencia, revisión antes de guardar y filtros paginados.
- Valor total y costo promedio del inventario; centavos enteros, cálculo exacto y redondeo protegido por reglas.
- Valoración inicial explícita de productos anteriores, sin inventar costos ni compras históricas.
- Anulación completa con evidencia únicamente sin movimientos posteriores; solicitudes idempotentes y recuperación manual compartida.
- Pruebas en otro proyecto demo y puertos, conservando la sesión interactiva del propietario.
- Mantiene fuera ventas, gastos, ganancias, fiados, rubros especializados, instaladores y Firebase real.

## 0.1.0 - 2026-11-05

- Auditoría del repositorio vacío y análisis completo del dossier Final V2.
- Base React/TypeScript/Vite, navegación y diseño responsive.
- Authentication Emulator, perfil persistente por propietario y reglas restrictivas.
- Manifest, iconos y service worker sin almacenamiento comercial offline.
- Scripts de calidad, pruebas unitarias/integración/reglas/E2E y workflow sin despliegue.
- Documentación de requisitos, arquitectura, modelo y decisiones pendientes.
- Adaptadores de autenticación y negocio organizados en clases con contratos e inyección de dependencias.
- Inventario por clases: productos, precio en BOB, existencias enteras, mínimo, entradas/salidas con motivo e historial inmutable.
- Archivo/reactivación y paginación de productos/movimientos; reglas que vinculan stock e historial atómicamente.
- Reintentos idempotentes y conservación de una solicitud incierta por cuenta/pestaña, sin reenvío automático.
- 109 pruebas locales aprobadas, además de lint, tipos, build y revisión visual de inventario en escritorio/móvil.

No incluye ventas, gastos, fiados, reportes, instaladores ni conexión a Firebase real. La base se preparó inicialmente el 30/10/2026; esta primera versión de prueba incorpora inventario autorizado el 05/11/2026. Resultados verificados y límites en `docs/testing/validation.md`.
