# KhypuPyme: instrucciones de continuidad

## Producto y alcance actual

Cuaderno digital para micro y pequeños negocios de Bolivia; español, BOB, America/La_Paz. Fuente: dossier Final V2 de 21 páginas del 30/06/2026, analizado en `docs/requirements`. Fase 0 y base Fase 1 completadas. El propietario autorizó después inventario con unidades enteras y movimientos con motivo, y la subida de la primera versión de prueba al repositorio oficial. **Detenerse para revisión antes de continuar con ventas, gastos y fiados.** No presentar esta versión como MVP comercial completo.

El propietario añadió el requisito de aplicación descargable e instalable; se están preparando Android y Windows. Los instaladores del producto todavía no están implementados. La autorización de subir esta primera versión no autoriza despliegues, cambios de visibilidad ni publicaciones posteriores sin autorización.

## Arquitectura

React + TypeScript estricto + Vite + React Router, por funcionalidades. `src/features` contiene dominio, interfaz y repositorios; `src/infrastructure` adapta Firebase; `src/shared` contiene piezas comunes. Mantener componentes sin acceso directo a Firestore. No añadir backend, Admin SDK en navegador, dependencias o abstracciones sin necesidad. No inventar datos para el tablero.

Organizar los adaptadores con clases de responsabilidad única: `FirebaseAuthService` implementa `AuthService` y `FirestoreBusinessRepository` implementa `BusinessRepository`. Usar interfaces e inyección de dependencias por constructor/composición; los componentes reciben contratos. Conservar componentes funcionales de React y funciones puras donde no existe estado que encapsular. Aplicar Repository/Adapter sin agregar patrones ni clases vacías por formalidad.

## Seguridad

Solo proyectos `demo-` y emuladores locales; no conectar cloud automáticamente. `businessId = uid` y `ownerUid` inmutable para un administrador por negocio; no es una plataforma multiusuario todavía. Autorización en `firestore.rules`, listas y borrados de negocios denegados, subcolecciones comerciales cerradas por defecto. Validar formas, campos y timestamps también en reglas. Ampliar reglas únicamente con pruebas de ataque y aislamiento A/B. Dinero futuro en unidades menores enteras; ventas/stock y cobros deben ser atómicos e idempotentes y demostrar invariantes contra clientes maliciosos. La transacción del frontend por sí sola no acredita seguridad.

Inventario abre únicamente `products` e `inventoryMovements` del negocio propio existente. Crear producto exige movimiento inicial; cambiar stock exige movimiento inmutable nuevo, con vínculo validado en ambas direcciones por `getAfter`. No borrar productos/movimientos, editar stock como metadato ni mover productos archivados. Precio en centavos enteros; cantidades enteras de 0 a 1.000.000. Paginación con cursor de segundos/nanosegundos e ID para no perder precisión. Una solicitud incierta se conserva por cuenta en sessionStorage y solo se reintenta manualmente con su ID original; no hay cola offline ni reenvío automático.

## Git y protección

Reutilizar exclusivamente `Ramiro-sakv/khypupyme-app`. Inspeccionar status/diff antes de cambios, conservar el trabajo ajeno. Ramas `chore/`, `feat/`, `fix/`; commits lógicos Conventional Commits después de verificar. Nunca force push, reset hard, clean destructivo, borrar ramas o reescribir historial. No hacer push, publicar, desplegar ni modificar permisos sin autorización. No crear otro repositorio. El remoto inicial estaba vacío, sin historial anterior recuperable.

## Privacidad, costos y operación

Nunca guardar secretos, cuentas de servicio, `.env.local`, datos de emuladores ni registros personales en Git. Los únicos valores Firebase actuales son identificadores demo sin credenciales reales. No activar facturación, Functions, Storage, recursos cloud ni integraciones sensibles sin autorización. Storage/RNF-05 está diferido. No bancos, facturación tributaria, suscripciones cobradas, IA predictiva ni abonos parciales. No datos reales en tests. No prometer offline comercial. Cambios monetarios, de propietario, zona/moneda históricas y baja de datos requieren diseño explícito.

Las herramientas de desarrollo son de uso general para todos los proyectos del propietario. Los accesos del escritorio deben corresponder a aplicaciones; no crear accesos a carpetas, scripts, URLs ni recursos de KhypuPyme salvo solicitud específica. No restaurar accesos que el propietario haya borrado.

## Validación y documentación

Node 24 LTS >=24.12 y pnpm 11.25.0. Conservar el lockfile. Ejecutar `pnpm check`; para cambios de autenticación/persistencia/reglas ejecutar `pnpm test:emulators` (requiere Java y navegadores Playwright). Los tests de reglas son destructivos solo para el proyecto demo efímero: no importar la sesión local persistente. Revisar visualmente escritorio y móvil. No ocultar fallos ni debilitar lint/tests. Clasificar pruebas como aprobadas, fallidas, no ejecutadas o bloqueadas con evidencia real. Actualizar trazabilidad y decisiones relevantes; conservar el salto RNF-03 a RNF-05 sin inventar RNF-04. No afirmar funcionalidades inexistentes. Detallar si una decisión es documentada, derivada, propuesta o pendiente de aprobación.
