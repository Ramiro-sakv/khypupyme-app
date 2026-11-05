# Cambios

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
