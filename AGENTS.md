# KhypuPyme: instrucciones de continuidad

## Producto y alcance actual

Cuaderno digital para micro y pequeños negocios de Bolivia; español, BOB, America/La_Paz. Fuente: dossier Final V2 de 21 páginas del 30/06/2026, analizado en `docs/requirements`. Solo están autorizadas Fase 0 y base Fase 1. **Detenerse para revisión del propietario antes de implementar masivamente ventas, inventario, gastos y fiados.** No presentar esta base como MVP comercial completo.

## Arquitectura

React + TypeScript estricto + Vite + React Router, por funcionalidades. `src/features` contiene dominio, interfaz y repositorios; `src/infrastructure` adapta Firebase; `src/shared` contiene piezas comunes. Mantener componentes sin acceso directo a Firestore. No añadir backend, Admin SDK en navegador, dependencias o abstracciones sin necesidad. No inventar datos para el tablero.

## Seguridad

Solo proyectos `demo-` y emuladores locales; no conectar cloud automáticamente. `businessId = uid` y `ownerUid` inmutable para un administrador por negocio; no es una plataforma multiusuario todavía. Autorización en `firestore.rules`, listas y borrados de negocios denegados, subcolecciones comerciales cerradas por defecto. Validar formas, campos y timestamps también en reglas. Ampliar reglas únicamente con pruebas de ataque y aislamiento A/B. Dinero futuro en unidades menores enteras; ventas/stock y cobros deben ser atómicos e idempotentes y demostrar invariantes contra clientes maliciosos. La transacción del frontend por sí sola no acredita seguridad.

## Git y protección

Reutilizar exclusivamente `Ramiro-sakv/khypupyme-app`. Inspeccionar status/diff antes de cambios, conservar el trabajo ajeno. Ramas `chore/`, `feat/`, `fix/`; commits lógicos Conventional Commits después de verificar. Nunca force push, reset hard, clean destructivo, borrar ramas o reescribir historial. No hacer push, publicar, desplegar ni modificar permisos sin autorización. No crear otro repositorio. El remoto inicial estaba vacío, sin historial anterior recuperable.

## Privacidad, costos y operación

Nunca guardar secretos, cuentas de servicio, `.env.local`, datos de emuladores ni registros personales en Git. Los únicos valores Firebase actuales son identificadores demo sin credenciales reales. No activar facturación, Functions, Storage, recursos cloud ni integraciones sensibles sin autorización. Storage/RNF-05 está diferido. No bancos, facturación tributaria, suscripciones cobradas, IA predictiva ni abonos parciales. No datos reales en tests. No prometer offline comercial. Cambios monetarios, de propietario, zona/moneda históricas y baja de datos requieren diseño explícito.

## Validación y documentación

Node 24 LTS >=24.12 y pnpm 11.25.0. Conservar el lockfile. Ejecutar `pnpm check`; para cambios de autenticación/persistencia/reglas ejecutar `pnpm test:emulators` (requiere Java y navegadores Playwright). Los tests de reglas son destructivos solo para el proyecto demo efímero: no importar la sesión local persistente. Revisar visualmente escritorio y móvil. No ocultar fallos ni debilitar lint/tests. Clasificar pruebas como aprobadas, fallidas, no ejecutadas o bloqueadas con evidencia real. Actualizar trazabilidad y decisiones relevantes; conservar el salto RNF-03 a RNF-05 sin inventar RNF-04. No afirmar funcionalidades inexistentes. Detallar si una decisión es documentada, derivada, propuesta o pendiente de aprobación.
