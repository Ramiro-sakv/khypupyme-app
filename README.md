# KhypuPyme

Cuaderno digital para negocios de Bolivia. Beta local **0.4.0-beta.3**, sin publicación ni conexión cloud activa.

Una cuenta administra varios negocios independientes. Después de ingresar se crea un espacio, se responde el cuestionario y se confirma un rubro fijo. Cada negocio conserva catálogo, clientes, compras, ventas, fiados, caja y documentos propios. Se abre el último negocio autorizado; **Cambiar negocio** vuelve al selector.

Modelos: madera por medidas/volumen, ropa y calzado por talla/color, electrodomésticos por serie y garantía, tienda 24/7 por lotes/vencimientos/peso, cerámicas por piezas/cajas/m² y cemento en bolsas/granel. Los demás rubros se identifican como núcleo común (productos por unidad y servicios). Los módulos están empaquetados, se cargan por demanda y no descargan programas externos.

Compras de hasta 20 líneas, ventas/cotizaciones, devoluciones/cambios vinculados, fiados con cobro completo, gastos, clientes, sesiones de caja, gráficos e informes. Las compras pagadas disminuyen caja, pero no son gastos operativos. Cantidades comerciales de hasta seis decimales mediante fracciones exactas; dinero entero en centavos BOB. PDF no fiscal con datos históricos y fuentes locales, generado al solicitarlo.

**Inicio recomendado:** crear negocio → abrir caja con el fondo real de prueba → crear productos vacíos → registrar compra con costo y lote/series cuando corresponda → registrar venta → consultar informes/documentos → cerrar caja. Para pagar en efectivo debe haber caja abierta y saldo suficiente; QR/transferencia se registran, sin conexión bancaria.

Los negocios anteriores conservan sus rutas e identificadores. Confirman el rubro una sola vez. **Registros anteriores** permite consultar y corregir operaciones antiguas; si falta costo, exige valoración explícita. La conversión al nuevo catálogo muestra unidades y valor anteriores, exige confirmar las nuevas cantidades y mantiene el valor total exacto. No copia ni borra historiales. Resuelve cualquier solicitud pendiente antes de convertir.

Las solicitudes sin confirmación se conservan en IndexedDB por cuenta/negocio, sin cola offline ni reintento automático. **Consultar confirmación** precede al reintento manual. La operación conserva su negocio original aunque cambies de espacio.

React + TypeScript + Vite + Firebase Functions/Firestore/Auth locales; Android con Capacitor y Windows con Tauri. Los paquetes locales aún necesitan los emuladores encendidos en el PC. Android usa el host 10.0.2.2 del emulador Android; no está preparado para teléfonos físicos. Esta entrega se compiló sin ejecutar pruebas por instrucción del propietario; no se acredita uso comercial.

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
