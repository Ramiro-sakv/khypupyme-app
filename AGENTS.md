# KhypuPyme: instrucciones de continuidad

## Producto y alcance actual

Cuaderno digital para micro y pequeños negocios de Bolivia; español, BOB, America/La_Paz. Fuente: dossier Final V2 de 21 páginas del 30/06/2026, analizado en `docs/requirements`. Fase 0 y base Fase 1 completadas. El propietario autorizó después inventario con unidades enteras y movimientos con motivo, y la subida de la primera versión de prueba al repositorio oficial. Autorización posterior: completar la beta del núcleo común (ventas, gastos, fiados, cobros, clientes, servicios, tablero e informes), con rubros especializados después. No presentar esta versión como MVP comercial completo.

Autorización posterior 05/11/2026: v0.2 compras y costos, sin nuevo servidor, servicios cloud ni push. Se acordó avanzar por versiones, completar el núcleo común y adaptar después perfiles por rubro (madera, tiendas, ropa/calzado, electrodomésticos, fabricación y servicios). Un negocio por cuenta, operación con internet y futura entrega conjunta Android/Windows. No habilitar perfiles incompletos ni interpretar esta visión como autorización para implementar todos los módulos a la vez.

El propietario añadió el requisito de aplicación descargable e instalable; se están preparando Android y Windows. Los proyectos Android (Capacitor) y Windows (Tauri) se incorporan para pruebas locales. Los paquetes no autorizan publicación en tiendas ni conexión cloud. La autorización de subir esta primera versión no autoriza despliegues, cambios de visibilidad ni publicaciones posteriores sin autorización.

## Arquitectura

React + TypeScript estricto + Vite + React Router, por funcionalidades. `src/features` contiene dominio, interfaz y repositorios; `src/infrastructure` adapta Firebase; `src/shared` contiene piezas comunes. Mantener componentes sin acceso directo a Firestore. No añadir backend, Admin SDK en navegador, dependencias o abstracciones sin necesidad. No inventar datos para el tablero.

Organizar los adaptadores con clases de responsabilidad única: `FirebaseAuthService` implementa `AuthService` y `FirestoreBusinessRepository` implementa `BusinessRepository`. Usar interfaces e inyección de dependencias por constructor/composición; los componentes reciben contratos. Conservar componentes funcionales de React y funciones puras donde no existe estado que encapsular. Aplicar Repository/Adapter sin agregar patrones ni clases vacías por formalidad.

## Seguridad

Solo proyectos `demo-` y emuladores locales; no conectar cloud automáticamente. `businessId = uid` y `ownerUid` inmutable para un administrador por negocio; no es una plataforma multiusuario todavía. Autorización en `firestore.rules`, listas y borrados de negocios denegados, subcolecciones comerciales cerradas por defecto. Validar formas, campos y timestamps también en reglas. Ampliar reglas únicamente con pruebas de ataque y aislamiento A/B. Dinero futuro en unidades menores enteras; ventas/stock y cobros deben ser atómicos e idempotentes y demostrar invariantes contra clientes maliciosos. La transacción del frontend por sí sola no acredita seguridad.

Inventario abre únicamente `products` e `inventoryMovements` del negocio propio existente. Crear producto exige movimiento inicial; cambiar stock exige movimiento inmutable nuevo, con vínculo validado en ambas direcciones por `getAfter`. No borrar productos/movimientos, editar stock como metadato ni mover productos archivados. Precio en centavos enteros; cantidades enteras de 0 a 1.000.000. Paginación con cursor de segundos/nanosegundos e ID para no perder precisión. Una solicitud incierta se conserva por cuenta en sessionStorage y solo se reintenta manualmente con su ID original; no hay cola offline ni reenvío automático.

En v0.2 se añaden `purchases` inmutables y `purchaseReversals` inmutables. Compra/producto/movimiento y anulación/producto/movimiento son atómicos. Anular exige que la compra sea el último movimiento de ese producto. `inventoryValueMinor` es entero entre 0 y 10^12; ausencia en datos v0.1 significa costo pendiente, nunca cero implícito. Valorar requiere movimiento explícito y no cambia existencias ni crea compras históricas. Redondear salidas proporcionalmente con BigInt, mitades hacia arriba; verificar en reglas con desigualdades int64 acotadas. La solicitud pendiente es compartida por inventario/compras. Las compras no son gastos operativos ni ganancias.

## Git y protección

Reutilizar exclusivamente `Ramiro-sakv/khypupyme-app`. Inspeccionar status/diff antes de cambios, conservar el trabajo ajeno. Ramas `chore/`, `feat/`, `fix/`; commits lógicos Conventional Commits después de verificar. Nunca force push, reset hard, clean destructivo, borrar ramas o reescribir historial. No hacer push, publicar, desplegar ni modificar permisos sin autorización. No crear otro repositorio. El remoto inicial estaba vacío, sin historial anterior recuperable.

## Privacidad, costos y operación

Nunca guardar secretos, cuentas de servicio, `.env.local`, datos de emuladores ni registros personales en Git. Los únicos valores Firebase actuales son identificadores demo sin credenciales reales. Functions está autorizado exclusivamente en emuladores locales para esta beta. No activar facturación, Functions cloud, Storage, recursos cloud ni integraciones sensibles sin nueva autorización. Storage/RNF-05 está diferido. No bancos, facturación tributaria, suscripciones cobradas, IA predictiva ni abonos parciales. No datos reales en tests. No prometer offline comercial. Cambios monetarios, de propietario, zona/moneda históricas y baja de datos requieren diseño explícito.

Las herramientas de desarrollo son de uso general para todos los proyectos del propietario. Los accesos del escritorio deben corresponder a aplicaciones; no crear accesos a carpetas, scripts, URLs ni recursos de KhypuPyme salvo solicitud específica. No restaurar accesos que el propietario haya borrado.

## Validación y documentación

Node 24 LTS >=24.12 y pnpm 11.25.0. Conservar el lockfile. Ejecutar `pnpm check`; para cambios de autenticación/persistencia/reglas ejecutar `pnpm test:emulators` (requiere Java y navegadores Playwright). Los tests de reglas son destructivos solo para el proyecto demo efímero: no importar la sesión local persistente. Revisar visualmente escritorio y móvil. No ocultar fallos ni debilitar lint/tests. Clasificar pruebas como aprobadas, fallidas, no ejecutadas o bloqueadas con evidencia real. Actualizar trazabilidad y decisiones relevantes; conservar el salto RNF-03 a RNF-05 sin inventar RNF-04. No afirmar funcionalidades inexistentes. Detallar si una decisión es documentada, derivada, propuesta o pendiente de aprobación.

`pnpm test:emulators` inicia `firebase.test.json` con `demo-khypupyme-tests`, Firestore 18080 y Auth 19099. Nunca probar ni limpiar en 8080/9099 ni detener los procesos interactivos del propietario. El perfil de pruebas del frontend es fijo, demo y separado; no acepta hosts remotos. No arrancar ni detener la aplicación habitual del usuario sin que lo pida.

## Beta del núcleo común, autorización 05/11/2026

El propietario autorizó explícitamente Firebase Functions solo local y completar el núcleo común. `shared/commerce.ts` define comandos y dinero; `functions/src/validation.ts` valida campos; `CommerceService` ejecuta transacciones Admin; `CommerceQueries` consulta; `src/features/commerce` contiene contrato, adaptador e interfaz. Admin SDK solo en functions. El servidor rechaza ejecución fuera de emuladores demo/loopback. Esas colecciones solo admiten lectura del propietario: todas las escrituras financieras de clientes están denegadas. Autor desde el token, no desde la solicitud. Catálogo de servicios y clientes con archivo; ventas/gastos/fiados se corrigen mediante anulación con motivo, nunca borrado o reescritura histórica. Cobros completos, sin abonos parciales.

Functions 5001 en local y 15001 en tests; no iniciar ni reiniciar la sesión interactiva del propietario sin que lo pida. Operaciones inciertas conservan ID y solicitud original; consultar antes de reintentar manualmente. No hay reenvío automático. Informes no fiscales, hasta 366 días y 10.000 registros por sección; fallar explícitamente si se supera el límite. El flujo de ventas/cobros/gastos excluye compras y no es saldo bancario.

## Perfiles, beta 2 (autorización del propietario 06/11/2026)

Se autorizaron selección de rubro, vista previa, combinación de herramientas, modularización y conservación de datos. Implementados retail/services/mixed con herramientas existentes. Rubros especializados siguen futuros, sin habilitar perfiles incompletos. `shared/business-configuration.ts` define configuración versión 1 y dependencias. Negocios sin configuración conservan todas las herramientas; no hay migración automática.

`configure-business` modifica solo configuración, actividad derivada, revisión y fecha mediante Functions local. Compara `expectedRevision` y usa el registro idempotente existente. Creación del negocio/perfil es atómica; las reglas validan esquema, versión, herramientas y revisión inicial. No actualizar configuración directamente desde clientes. Las preferencias no sustituyen autorización ni cambian unidades/dinero históricos.

Navegación y formularios se adaptan a herramientas; recuperación de solicitudes inciertas tiene prioridad sobre ocultarlas. `BusinessProvider` comparte el perfil sin reutilizar datos al cambiar UID. Pantallas/formularios se cargan por demanda con React lazy/Suspense y recuperación de errores. Native conserva módulos empaquetados, sin descargas remotas ni nuevas conexiones cloud.


## Rubros, beta 3 (ampliación explícita del propietario 06/11/2026)

Se autorizó investigar y añadir rubros durante la creación del perfil. `shared/business-industries.ts` separa 21 rubros de las tres familias de trabajo; `industryId` opcional conserva configuraciones beta 2. Las seis fichas especializadas y la ficha general se definen en `shared/product-specification.ts`. No presentar estos perfiles como ERP industriales completos: el alcance y los límites se muestran antes de elegir.

Las fichas de producto son inmutables y quedan ligadas al movimiento inicial; compras y ventas conservan copia. Nueva variante, medida o lote implica producto nuevo. Stock entero por unidad/pieza/par/caja/bolsa, sin reinterpretar datos anteriores. Dimensiones, superficie y peso usan enteros escalados; cálculos derivados con BigInt, sin cambiar dinero. Las ventas de lotes vencidos se rechazan en Functions usando fecha actual de Bolivia y fecha de venta, sin permitir eludirlo con ventas retroactivas. Series, FEFO automático, fraccionamiento, recetas, mesas, citas y producción siguen fuera de alcance. No descargar código de rubros ni conectar cloud.


## v0.4: autorización vigente del propietario, 06–07/11/2026

Esta sección sustituye las restricciones históricas de un negocio por cuenta, businessId=uid, stock exclusivamente entero y perfiles editables. El contrato anterior se conserva solo para lectura, corrección y recuperación compatible.

- Cuenta con varios espacios independientes, businessId aleatorio y ownerUid real; índice privado users/{uid}/businesses. Rubro confirmado una vez y fijo. Legacy conserva businessId=uid e historiales.
- Nuevas escrituras de catálogo/inventario/comercio únicamente en Functions. Rules permiten lecturas del propietario y deniegan escrituras v2 de clientes. Tras confirmar también cierran escrituras directas antiguas. Sin miembros ni datos compartidos.
- shared/workspace: modelos, fracciones BigInt JSON {n,d}, validaciones y conversiones. functions/src/workspace: AccountService, UnitOfWork, inventario, comercio, caja, documentos y compatibilidad. src/features/workspace: contratos, formularios y módulos; FirebaseWorkspaceRepository adapta Functions sin Firestore en componentes.
- Toda operación captura businessId/operationId/contenido; índice global por cuenta impide reutilizar IDs en otro negocio. UnitOfWork lee antes de escribir y confirma todos los cambios atómicamente. Máximo 20 líneas y 100 lotes/series afectados.
- Madera, moda, equipos serializados, tienda, cerámicas y cemento tienen procesos propios. No reinterpretar stock antiguo: conversión auditada con valor total exacto, sin costo desconocido ni solicitud pendiente.
- Entradas comerciales hasta seis decimales; piezas/pares/cajas/bolsas/series enteros. Conversiones internas racionales exactas, dinero entero acotado a 10^12, redondeo mitades arriba. Costo promedio común y costo específico serializado.
- Caja única abierta por negocio, movimientos inmutables, cierre con motivo si hay diferencia. Devoluciones con cantidades/costo/neto originales; equipos en inspección. Cambio atómico y pago de diferencia.
- PDF no fiscal mediante pdfmake y fuentes empaquetadas. Snapshot inmutable y numeración por negocio/tipo/año. Guardar/compartir no repite operaciones comerciales. Windows escribe solo en el archivo elegido.
- Solicitudes inciertas en IndexedDB por cuenta/negocio, incluida creación; consulta antes del reintento manual. Sin reenvío automático. Resolver pendientes anteriores antes de convertir.
- Emuladores predeterminados. Perfil alojado requiere configuración, proyecto y despliegue futuros autorizados. El servidor rechaza cloud; no activar facturación, recursos, firma, publicación, push ni accesos.
- Instrucción posterior: **no ejecutar pruebas en esta entrega**. Solo compilación, análisis estático e instaladores; registrar pruebas no ejecutadas. Capturas, vídeos y trazas visuales desactivados. La incidencia de reingreso Windows/WebKit sigue sin corrección acreditada.
