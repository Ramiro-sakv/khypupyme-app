# KhypuPyme

Cuaderno digital para negocios de Bolivia. Beta local **0.5.0-beta.6**, sin publicación ni conexión cloud activa.

Una cuenta administra varios negocios independientes. Después de ingresar se crea un espacio, se responde el cuestionario y se confirma un rubro fijo. Cada negocio conserva catálogo, clientes, compras, ventas, fiados, caja y documentos propios. Se abre el último negocio autorizado; **Cambiar negocio** vuelve al selector.

Modelos: madera por medidas/volumen, ropa y calzado por talla/color, electrodomésticos por serie y garantía, tienda 24/7 por lotes/vencimientos/peso, cerámicas por piezas/cajas/m² y cemento en bolsas/granel. Los demás rubros se identifican como núcleo común (productos por unidad y servicios). Los módulos están empaquetados, se cargan por demanda y no descargan programas externos.

Compras de hasta 20 líneas, ventas/cotizaciones, devoluciones/cambios vinculados, fiados con cobro completo, gastos, clientes, sesiones de caja, gráficos e informes. Las compras pagadas disminuyen caja, pero no son gastos operativos. Cantidades comerciales de hasta seis decimales mediante fracciones exactas; dinero entero en centavos BOB. PDF no fiscal con datos históricos y fuentes locales, generado al solicitarlo.

**Inicio recomendado:** crear negocio → abrir caja con el fondo real de prueba → crear productos vacíos → registrar compra con costo y lote/series cuando corresponda → registrar venta → consultar informes/documentos → cerrar caja. Para pagar en efectivo debe haber caja abierta y saldo suficiente; QR/transferencia se registran, sin conexión bancaria.

Los negocios anteriores conservan sus rutas e identificadores. Confirman el rubro una sola vez. **Registros anteriores** permite consultar y corregir operaciones antiguas; si falta costo, exige valoración explícita. La conversión al nuevo catálogo muestra unidades y valor anteriores, exige confirmar las nuevas cantidades y mantiene el valor total exacto. No copia ni borra historiales. Resuelve cualquier solicitud pendiente antes de convertir.

Las solicitudes sin confirmación se conservan en IndexedDB por cuenta/negocio, sin cola offline ni reintento automático. **Consultar confirmación** precede al reintento manual. La operación conserva su negocio original aunque cambies de espacio.

React + TypeScript + Vite + Firebase Functions/Firestore/Auth locales; Android con Capacitor y Windows con Tauri. Los paquetes locales aún necesitan los emuladores encendidos en el PC. Android usa el host 10.0.2.2 del emulador Android; no está preparado para teléfonos físicos. Esta entrega se compiló sin ejecutar pruebas por instrucción del propietario; no se acredita uso comercial.

## Maderas por especie · 0.5 beta 6

En Inventario, **Nueva especie** crea una ficha sin medidas ni existencias. Declara las tarifas por pie tablar para supercortas (1–2 pies), cortas (3–6) y largas (7–20). La tarifa depende de especie/categoría, no del espesor. Espesores como 1, 1½ y 2 pulgadas son ejemplos, no una lista obligatoria.

En Compras o en **Existencias, entradas y tarifas**, elige espesor, largo entero y anchos. La entrada crea la variante interna por espesor y conserva medidas reales, costo y movimientos. Las variantes no se muestran como productos independientes. Al vender, el largo determina categoría/tarifa y el espesor interviene en el volumen exacto. No se crean existencias al vender; una cotización puede prepararse sin existencias, pero convertirla exige disponibilidad. El inventario muestra resumen por categoría/espesor, filtros y medidas exactas; los costos mantienen promedio ponderado por espesor. El modo métrico admite largos equivalentes exactamente a 1–20 pies enteros.

Cambiar tarifas no reescribe documentos. El nombre de la especie queda fijo en esta entrega; se editan referencia, tarifas y estado. Las fichas anteriores conservan identificadores, medidas y costos en **Servicios y productos anteriores**, sin consolidación automática. Resuelve solicitudes pendientes con su contenido original. Se mantienen borradores, tutorial, aislamiento y recuperación manual.

## Tutorial y presentación · 0.5 beta 5

La guía habilita los formularios completos de apertura/cierre de caja y de clientes. La opción para continuar con una caja abierta depende de la consulta del espacio de práctica; el servidor vuelve a comprobarla. Abrir caja avanza tras la confirmación existente, sin registrar acciones automáticamente.

Arrastra **Mover guía** con ratón/dedo o utiliza las flechas del teclado desde ese botón. **Restablecer posición**, **Minimizar/Mostrar guía** y **Pausar** permanecen en la cabecera. La posición se conserva entre pasos de la misma sesión y se limita al espacio visible, incluido dentro de formularios. Las tarjetas y resúmenes comparten tonos crema suaves; campos blancos y verde principal se mantienen.

## Maderas rápidas y tutorial · 0.5 beta 4

Crea un producto **Madera por especie, espesor y medidas agrupadas**. Desde Compras o una entrada manual con costo, registra grupos con largo y anchos; repetir un ancho aumenta piezas, sin crear productos nuevos. Cada producto conserva piezas, volumen exacto y valor; la venta comprueba disponibilidad de cada medida.

En una misma venta puedes añadir varios grupos, especies, largos y otros productos. Cada grupo calcula piezas, pies tablares e importe. Ejemplo sugerido: Pino, espesor 2 pulgadas, largo 10 pies, anchos 6; 8; 10, tarifa Bs 10/pie tablar: tres piezas, 40 pies tablares, Bs 400. La tarifa parte del catálogo y puede cambiar solo para ese grupo; el registro conserva tarifa original y aplicada. En compras y entradas agrupadas el costo se declara **por pie tablar**. La captura calcula al escribir: comas, punto y coma o saltos de línea separan piezas; 5x10 significa cinco piezas de ancho diez, y también admite X o ×. En pulgadas, el ancho comercial descarta la fracción: 5.5 se usa como 5, con aviso; anchos menores de una pulgada se rechazan. El espesor conserva sus fracciones. En métrico el ancho conserva decimales con punto. Se agrupan anchos repetidos y una entrada incompleta no se envía. Los resultados muestran máximo dos decimales, sin redondear el cálculo interno del precio.

El panel de cobro permite **Minimizar / Mostrar cobro**, conserva sus campos y se oculta cuando el carrito queda vacío. Confirmar exige abrirlo y revisar el importe vigente. **Duplicar grupo** conserva producto, largo y tarifa con anchos vacíos; **Vaciar anchos** limpia solo esa captura.

Los borradores incorporan una captura versión 2 separada del contrato financiero. Un texto pendiente anterior conserva sus separadores originales y requiere recuperarlo o descartarlo expresamente. La selección de medidas existentes mantiene sus valores canónicos, incluidas medidas antiguas no enteras; no se normalizan historiales ni solicitudes enviadas.

**Mi negocio → Medidas de madera** conserva pulgadas/pies o métrico. El catálogo anterior mantiene sus identificadores, unidades, tarifas e historiales; no se convierte automáticamente al modelo agrupado. Las devoluciones del nuevo modelo eligen las medidas originales y sus piezas pendientes, con costo histórico. Los documentos siguen siendo no fiscales.

El cliente es opcional al contado; un fiado nuevo requiere cliente registrado. Desde la venta puedes buscar clientes de todo el negocio o crear uno sin perder el carrito. Nombre obligatorio y teléfono opcional. La búsqueda compatible con clientes antiguos tiene un límite explícito de 10.000 registros, sin reescribirlos. El filtro de activos admite catálogo, clientes y medidas. Los errores muestran el dato que falta o la operación fallida y su código; la validación local utiliza categorías de aplicación, sin fingir una petición HTTP. La presentación no sustituye las excepciones originales ni altera consultas y reintentos manuales.

En **Inicio** o **Cómo trabajar aquí → Aprender usando la aplicación**, la guía nueva oscurece el fondo y mantiene activo el control o formulario indicado. Ofrece siete recorridos cortos elegibles: inventario; venta; clientes/fiados; cotizaciones/devoluciones; caja/gastos; cortes/entregas; informes/documentos. Los datos son sugerencias libres; los importes y existencias proceden de tus registros. Los pasos comerciales avanzan tras confirmación del servidor. No rellena ni envía formularios automáticamente.

La práctica empieza vacía en un espacio temporal oculto y separado. Puedes pausar, reanudar, cambiar de recorrido o terminar. Los recorridos de venta requieren registrar madera y una entrada con costo primero. Si hace falta caja, el instructor permite abrirla y volver al paso. Las solicitudes inciertas conservan contenido e identificador originales y solo se reintentan manualmente.

Terminar o abandonar bloquea nuevas operaciones y elimina exclusivamente esa práctica, sus subcolecciones, claves y datos locales. Tras siete días sin actividad se limpia al siguiente acceso; una limpieza fallida se puede reanudar. Conserva los 21 negocios. Los PDF llevan **PRÁCTICA — DATOS FICTICIOS**; los archivos guardados fuera de la app no se eliminan. Una práctica del tutorial anterior puede continuar con su contrato original o abandonarse expresamente antes de iniciar la nueva.

Referencias de cálculo: [pie tablar de Virginia Forestry](https://www.dof.virginia.gov/glossary/board-foot/) y [longitud de NIST](https://www.nist.gov/pml/owm/si-units-length). No se infieren medidas reales a partir de nominales ni se vende por pie lineal. Esta entrega se verifica solo mediante lint, tipos, compilaciones e instaladores, sin pruebas ni recorridos automáticos.

## Rubros y ejemplos 0.5

Los 21 rubros tienen una guía propia en **Cómo trabajar aquí**, con pasos, ejemplos, advertencias e ilustraciones SVG locales. Moda muestra una matriz de variantes; madera, cerámicas y cemento incluyen simuladores sin guardado. Las simulaciones no representan stock ni registran operaciones.

Agenda única para belleza; órdenes para maderas, limpieza, servicios profesionales, reparación y artesanía; entregas de ventas en muebles/materiales/bebidas; y préstamos/devoluciones de envases en bebidas. Los registros tienen revisión e historial. Planificar o cambiar estados no cobra ni mueve productos: la venta vinculada lo hace en una transacción y solo una vez. Cancelar una entrega no anula una venta. Los envases controlan cantidades propias, sin depósitos monetarios.

Catálogo con búsqueda por prefijo (desde dos caracteres) de nombre, código o referencia, paginación y datos descriptivos congelados con la ficha. Lotes/peso y equipos serializados se habilitan también en los rubros relacionados. Se conserva la lectura de contratos v2 anteriores.

Los espacios **Ejemplo · datos ficticios** contienen catálogos, clientes, compras cuando corresponden, ventas, gastos, cotizaciones, fiados, cajas, documentos y casos del rubro. Sus números proceden de operaciones ficticias registradas mediante los servicios; no son cifras comerciales reales. La cuenta y su contraseña no se sustituyen. Estudio y límites: [industry-study.md](docs/requirements/industry-study.md).

La herramienta administrativa scripts/seed-industry-examples.mjs exige un archivo local de autorización con UID y cuatro identificadores explícitos; autorización, manifiesto y resumen se guardan en artifacts/ y quedan fuera de Git. --inspect solo lee; --apply ejecuta la sustitución autorizada, conserva solicitudes originales para reanudar y exporta a .emulator-data sin detener servicios. Rechaza otras cuentas, proyectos, negocios inesperados o destinos remotos. No es una función pública de eliminación ni una herramienta para producción.

## Continuidad beta 3

Venta, cotización y compra conservan un borrador por cuenta/negocio/tipo en IndexedDB, separado del registro de solicitudes inciertas. El estado y la fecha de guardado son visibles. Al volver, el usuario elige restaurar o descartar; la restauración consulta el negocio y su catálogo autorizado. Precios cambiados requieren revisión, las series de salida se seleccionan de nuevo y una oferta cambiada exige nueva cotización. Los borradores guardan referencias y entradas del formulario, sin contraseñas, tokens, existencias ni costos consultados. El costo declarado de compra sí es una entrada.

Las revisiones evitan sobrescribir silenciosamente otra pestaña: se puede cargar la versión guardada o reemplazarla expresamente con la pantalla actual. Un borrador enviado queda vinculado a su solicitud original hasta consultar su resultado; solo una confirmación permite limpiarlo. No hay envío ni reintento automático, sincronización entre equipos ni operación comercial offline. No borrar el almacenamiento de la aplicación si hay solicitudes pendientes.

Inicio ofrece una guía derivada de registros existentes y cada rubro muestra ayuda propia. Las compras comparten consulta filtrada/paginada y detalle; los documentos muestran su copia histórica y permiten regenerar el PDF sin repetir operaciones.

Orden de lectura: `DraftRepository` y `WorkspaceRepository` → `TradeDraftService`, `WorkspaceCommandService`, `AccountCreationService` → `IndexedDbDraftRepository`, `OperationJournal` y adaptador Firebase → hooks y pantallas por área. Autenticación, selección de negocios y espacio de trabajo están separados. Los cálculos y contratos comerciales existentes se conservan.

## Ejecutar en Windows

Requisitos: Node.js **24 LTS >=24.12**, pnpm **11.25.0**, JDK **21 LTS o superior** para Firestore. Las versiones están fijadas en `package.json` y `pnpm-lock.yaml`. No se requiere Firebase Console, login de Firebase, facturación ni credenciales privadas.

```powershell
Set-Location 'ruta\a\khypupyme-app'
pnpm install --frozen-lockfile
# Terminal 1: Auth + Firestore + Functions + panel local
.\scripts\local.ps1 emulators
# Terminal 2
.\scripts\local.ps1 dev
```

Abrir http://127.0.0.1:5173. Panel de emuladores: http://127.0.0.1:4000. Los puertos 5173, 8080, 9099, 5001 y 4000 deben estar libres. Si tenías emuladores v0.2 abiertos, deténlos tú con Ctrl+C para exportar tus datos y vuelve a ejecutar el comando de emuladores; así se cargará Functions. El script local puede usar Node/pnpm incluidos en Codex y el JDK encontrado en `.jdks`, sin cambiar el PATH del sistema. Si PowerShell bloquea scripts, ejecutar los comandos `pnpm dev` y `pnpm emulators` con Node, pnpm y Java disponibles en la terminal; no es necesario reducir la política global de ejecución.

La configuración funciona sin `.env.local`. `.env.example` muestra la configuración habitual; el perfil local rechaza proyectos sin prefijo `demo-` ; el perfil alojado requiere preparación y autorización separadas. Firebase CLI está instalado **dentro del proyecto**, sin instalación global. El primer arranque descarga los componentes de Emulator Suite. Se escucha exclusivamente en loopback; para probar en un teléfono físico hará falta preparar acceso y HTTPS por separado.

Los datos locales se importan desde `.emulator-data` si existe y se exportan allí al apagar normalmente los emuladores. Esa carpeta está excluida de Git y **no constituye un respaldo comercial**. Los tests limpian exclusivamente su proyecto efímero separado: no importar datos ni apuntarlos a la sesión interactiva.

## Si npm no aparece

En el equipo del propietario se comprobaron Node 24.22.2, npm.cmd 11.19.1 y pnpm 11.25.0. Si otra terminal no los encuentra, revisar `npm.cmd --version`, `Get-Command npm*` y las rutas del usuario antes de concluir que faltan.

Si realmente falta npm: instalar o reparar **Node.js 24 LTS** desde https://nodejs.org/, manteniendo npm y PATH, y abrir una terminal nueva. Instalar después el gestor fijado con `npm.cmd install --global pnpm@11.25.0`. No generar un segundo lockfile con npm.

## Verificaciones

```powershell
.\scripts\local.ps1 check
pnpm exec playwright install chromium webkit
# Usa otro proyecto y puertos; no limpia la sesión interactiva:
.\scripts\local.ps1 test:emulators
```

`check` ejecuta lint, typecheck, unitarias/componentes y build. `test:emulators` usa `firebase.test.json`, proyecto efímero `demo-khypupyme-tests`, Auth 19099, Firestore 18080, Functions 15001, hub 14400 y preview 4173. Comprueba puertos libres, nunca importa/exporta datos y no reutiliza los emuladores interactivos. Ejecuta integración, Security Rules y E2E; los tests de reglas limpian solo ese proyecto aislado. El lanzador fija `VITE_EMULATOR_PROFILE=test`; el perfil habitual sigue en 9099/8080. Playwright cubre Chromium de escritorio/móvil y WebKit móvil; no reemplaza teléfonos físicos. Evidencias y límites: [docs/testing/validation.md](docs/testing/validation.md).

## Interfaz beta 2

Diseño profesional claro, verde profundo y detalles por rubro. Menú lateral en escritorio, compacto en tablet y barra inferior en móvil (Inicio, Vender, Inventario, Caja y Más). El negocio activo y el entorno local permanecen identificados. Altas y edición de productos, devoluciones y menú móvil usan paneles con foco contenido, cierre con Escape y aviso al descartar cambios.

Inicio muestra el resumen del mes, inventario actual, fiados de todos los periodos y accesos rápidos. Informes conserva selección de fechas y PDF. Ventas y Cotizaciones tienen entradas separadas; convertir una cotización conserva la operación en su editor hasta confirmarla. El catálogo distingue búsqueda en la página cargada, estados, precio, costo y unidades. Tablas en escritorio y tarjetas en móvil para inventario, clientes y ventas.

La sección actual se guarda en el parámetro vista de la URL (también dentro del hash de los instaladores). Recargar y Atrás conservan navegación por secciones; las no disponibles para el rubro vuelven a Inicio. Los formularios modificados avisan antes de salir; esto no cancela ni reenvía solicitudes ya enviadas. La recuperación de operaciones inciertas sigue separada por negocio.

Estilos preparados para 360, 768, 1100 y 1440 px, sin revisión visual ni pruebas en dispositivos en esta entrega. No cambian reglas, contratos, datos históricos ni cálculos comerciales. Sin nuevas librerías visuales o fuentes remotas.

## Código y orden de lectura

1. shared/workspace/model.ts, exact.ts y validation.ts: modelos, límites y cantidades/dinero exactos.
2. src/features/workspace/WorkspaceRepository.ts: contrato de la interfaz.
3. functions/src/workspace/WorkspaceService.ts: coordinación y autorización; InventoryService, TradeService y CashService implementan las operaciones.
4. UnitOfWork.ts: lecturas y cambios preparados, confirmados en una única transacción; FirebaseWorkspaceRepository adapta las llamadas desde la app.
5. firestore.rules: lecturas autorizadas y escrituras v2 directas cerradas; índices en firestore.indexes.json.
6. BusinessWizard, WorkspaceApp, Catalog, Trade, Operations, Reports y módulos: formularios y navegación por negocio.
7. Documents.ts y workspace/pdf.ts: datos históricos y generación local de PDF.

Los módulos anteriores de business/inventory/purchases/commerce y shared/commerce conservan el contrato previo para compatibilidad y recuperación. No son la pantalla principal 0.4. Auth permanece compartido. Los componentes no importan Firestore.

Cada escritura comercial captura negocio e identificador. El servidor obtiene la cuenta del token y valida el propietario real, referencias, cantidades, unidades, stock, valor y caja. Una solicitud confirmada se devuelve sin duplicarla; reutilizar su identificador con otro contenido o negocio se rechaza. Las solicitudes inciertas requieren consulta y reintento manual del original.

Las conversiones de producto son fijas. Compras/entradas suman valor declarado; salidas descuentan costo proporcional exacto, mitades hacia arriba, y al agotar retiran todo el valor. Series usan costo individual. Las devoluciones conservan neto/costo histórico, los equipos quedan en inspección y los cambios cobran solo la diferencia. Fiados se cobran completos; no hay abonos parciales.

## Paquetes locales

- Android: pnpm android:build (SDK 36, JDK 21 y ANDROID_HOME).
- Windows: pnpm windows:build (Visual Studio C++, Rust >=1.90 y WebView2).
- APK generado en android/app/build/outputs/apk/debug/app-debug.apk.
- Instalador NSIS en src-tauri/target/release/bundle/nsis/.
- Copias identificadas por versión y SHA-256 en artifacts/, excluido de Git.

Son paquetes de prueba sin firma comercial. Instalar no inicia el servidor: Auth, Firestore y Functions locales deben seguir encendidos. Android apunta al emulador del PC, no a teléfonos físicos. En equipos de 8 GB compilar Android/Windows por separado.

PDF usa fuentes empaquetadas y tablas multipágina. Se guarda o comparte a elección del usuario: caché privada/compartir en Android, diálogo de destino y escritura limitada al archivo elegido en Windows. Un error de exportación permite regenerar el documento, sin repetir ni anular una venta.

## Continuidad y límites

Repositorio único: https://github.com/Ramiro-sakv/khypupyme-app. Esta ampliación y sus commits son locales, sin push. No se crearon recursos Firebase, facturación, despliegues, accesos de escritorio ni publicaciones. El perfil alojado está preparado en configuración, pero el servidor mantiene el bloqueo cloud hasta una autorización y preparación futuras.

Dossier Final V2 de 21 páginas como fuente inicial; decisiones posteriores del propietario en AGENTS.md, modelo y trazabilidad. No se añade el PDF original al repositorio.

**0.4 compilada sin pruebas por instrucción del propietario.** No se ejecutaron pnpm check ni test:emulators, pruebas unitarias/integración/reglas/E2E, lectura de PDF ni pruebas de dispositivos. Capturas, vídeos y trazas visuales desactivados. Resultados históricos de beta 3 no acreditan 0.4. La incidencia previa de reingreso Windows/WebKit sigue sin corrección acreditada.

Pendientes para clientes reales: validación funcional/de aislamiento, dispositivos, privacidad/términos, respaldo/restauración, costos y aprobación del servicio alojado/firma/publicación. No incluye empleados, producción industrial, facturación fiscal, adjuntos PDF, bancos ni operación comercial offline.

Ver [modelo](docs/architecture/data-model.md), [trazabilidad](docs/requirements/traceability.md), [verificación real](docs/testing/validation.md) y [preparación de lanzamiento](docs/deployment/readiness.md).
