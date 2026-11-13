# Preparación de lanzamiento y recuperación (sin despliegue)

Estado: **no apto para datos reales**. No se han creado proyectos cloud, activado facturación, publicado la aplicación ni invitado negocios piloto. Los paquetes de desarrollo usan emuladores. La beta 1.0 incluye un perfil alojado separado que requiere configuración y autorización.

## Paso futuro: Firebase de pruebas autorizado

1. El propietario entra con su propia cuenta a https://console.firebase.google.com/; nunca envía contraseña ni cuentas de servicio al agente.
2. Tras revisar región, cuotas y presupuesto, crea un proyecto de pruebas separado del futuro productivo. Analytics no es necesario para los requisitos y no se activa por defecto.
3. Activa Authentication por correo/contraseña y configura dominios y recuperación/verificación. Configura Firestore en la región acordada, sin modo público; prepara reglas probadas antes de cargar datos.
4. Registra una app web, usa configuración de cliente en variables locales/CI; esos identificadores no reemplazan autorización. No poner Admin SDK ni claves privadas en Vite. El bloqueo demo de esta base se adaptará explícitamente durante esa tarea.
5. Prueba autenticación, aislamiento y consultas/índices en staging autorizado; los emuladores no reproducen todos los límites de producción. No copiar datos de pruebas al proyecto productivo.
6. Revisar HTTPS, dominios, cabeceras de seguridad, App Check, políticas de correo, CSP compatible, alertas de consumo y control de accesos. Solicitar autorización separada para despliegue público.

## Costos y servicios diferidos

Storage no está instalado ni activado. La documentación oficial de Firebase consultada el 30/10/2026 describe los requisitos del plan Blaze para aprovisionamiento y acceso a buckets: https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024 . Deben revisarse de nuevo las condiciones, región, almacenamiento, operaciones, transferencia y cuotas **antes de pedir autorización**; no se promete costo cero ni un precio fijo sin carga medida. RNF-05/PB-08 quedan pendientes por ello.

CSV descargable localmente ya está implementado, sin Storage. Permite revisión externa, pero no cumple por sí solo RNF-05 ni es un respaldo completo. Posponer Storage evita habilitar servicios facturables ahora, con el impacto explícito de que no existen respaldos cloud ni descarga asíncrona almacenada.

Si se requiere Functions para garantizar invariantes comerciales, comparar costo de invocaciones/cómputo/red con alternativas confiables. Functions se eligió y autorizó exclusivamente en emuladores para la beta; no se ha habilitado en cloud. El presupuesto se estimará con lecturas/escrituras por flujo, volumen de operaciones y retención por negocio; registrar mediciones, no cifras inventadas.

## Respaldo y restauración: estrategia pendiente de ejecutar

- **Código:** commits locales por unidad lógica y remoto oficial. El propietario autorizó la subida de la primera versión de prueba con inventario; verificar el hash remoto antes de afirmar que existe respaldo. Esta autorización no incluye despliegues ni cambios de visibilidad.
- **Datos locales ficticios:** export/import de Emulator Suite en `.emulator-data`, fuera de Git; no es solución para producción.
- **Datos comerciales futuros:** evaluar exportaciones administradas de Firestore o backups/PITR y Auth por separado, con autorización de costos y control de acceso. Definir retención, ubicación, responsables, RPO/RTO y cifrado antes del piloto; aún no hay objetivos acordados.
- **Restauración:** ensayar en un proyecto aislado autorizado, comprobar propietarios, conteos, importes, stock, vínculos venta-fiado/cobro y acceso A/B; registrar fecha y resultado. No probar restauración sobre producción ni considerar un CSV como ensayo de recuperación.
- **Baja/exportación:** la app y la web reciben solicitudes de eliminación de cuenta. Configuración descarga registros comerciales y documentos paginados. La descarga no sustituye un respaldo restaurable. Antes del piloto, asignar un responsable y plazo para tramitar solicitudes, incluir el manejo de respaldos y documentar la retención aplicable a cobros.

Checklist previo al piloto: RF/RNF completos o excepciones aprobadas, reglas y concurrencia verificadas, usabilidad cronometrada (<60 s), teléfonos físicos, evaluación WCAG 2.2 AA, HTTPS/PWA, privacidad/términos, recuperación ensayada, costos/monitoreo y autorización explícita para usuarios reales.

## Paquetes internos beta 0.3

Windows usa Tauri/WebView2 y Android Capacitor/SDK 36. Instalador NSIS x64 y APK debug, sin firma comercial. Los binarios se generan localmente y se excluyen de Git. No se instalaron automáticamente ni publicaron. Windows apunta al PC local; Android solo al host 10.0.2.2 del emulador, no a un teléfono físico. El núcleo de servidor sigue siendo local. No se debe ofrecer esta configuración a clientes reales hasta autorizar y preparar un entorno seguro conectado, validar dispositivos y completar privacidad/recuperación/costos.

La exportación Android usa caché privada y la selección de destino del usuario; no requiere permiso general de almacenamiento ni comparte información automáticamente. Windows incluye CSP limitada a recursos empaquetados y servicios de loopback, sin permisos de shell/archivos del host.


## Perfil y paquetes 0.4

Predeterminado: demo local. Para preparar después el servicio alojado: autorizar proyecto/costos, configurar Auth/Firestore/Functions, región, reglas/índices, validar aislamiento/recuperación, desplegar y activar un cliente separado con VITE_USE_EMULATORS=false, VITE_SERVICE_PROFILE=hosted, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN y VITE_FIREBASE_APP_ID. No hay credenciales reales. El perfil alojado 1.0 tiene configuración y CSP propias. Los paquetes de desarrollo conservan el perfil local.

Windows incorpora dialog:allow-save y fs:allow-write-file, con acceso al archivo seleccionado, sin acceso general al disco. Android conserva caché privada y compartir a elección del usuario. Instalar no inicia un servidor ni sustituye el servicio alojado.

v0.4 sin pruebas funcionales por instrucción del propietario. Antes del piloto retomar aislamiento A/B con dos negocios/cuenta, concurrencia/idempotencia, series/lotes, caja/devoluciones, compatibilidad, PDF y guardado nativo. Incidencia previa Windows/WebKit visible y sin corrección acreditada.

## Preparación comercial 1.0 beta.1

### Servicio y distribución

- Con aprobación, configurar un proyecto separado para el piloto con Authentication por correo, Firestore y Functions en us-central1. Usar `firebase.hosted.json` y las reglas alojadas que cierran el acceso directo a Firestore. En Functions fijar `KHYPU_SERVICE_PROFILE=hosted` y `KHYPU_HOSTED_PROJECT` con el ID exacto del proyecto. Reservar `KHYPU_BILLING_MODE=live` para cuando se autoricen los cobros. Los emuladores habituales permanecen en modo de desarrollo.
- Configurar un dominio HTTPS para el portal, darlo de alta en Auth y verificar inicio de sesión, entrega de enlaces de verificación y restablecimiento. El perfil público tiene /privacidad, /eliminar-cuenta y /pago/{businessId}. Revisar el aviso de privacidad, contacto, retención y plazos con el responsable antes de publicar. La baja crea una solicitud privada en accountDeletionRequests y requiere reautenticación. El operador debe tramitarla en el plazo publicado y comunicar el resultado.
- Usar las variables públicas de .env.example para el portal. Para nativos exportarlas en el entorno de compilación. Windows usa `pnpm windows:build:hosted` y abre solo la ruta de pago en el origen HTTPS compilado. Android usa `pnpm android:bundle:hosted` para crear el AAB de lanzamiento. Preparar las claves de firma fuera de Git tras autorización. El AAB de compilación se genera sin firma comercial. El APK debug y NSIS local siguen siendo paquetes de desarrollo.
- Ensayar respaldo y restauración con datos ficticios en un proyecto aislado antes de aceptar datos reales. Verificar Auth, relaciones de negocios, registros, saldos y vigencias. Supervisar lecturas, escrituras y ejecuciones, configurar presupuesto, alertas y límites disponibles. En los paquetes nativos confirmar el comportamiento en redes bolivianas y el reingreso Windows/WebKit.

### Cobro y conciliación

- Ejecutar `pnpm test:billing:browser` para recorrer alta, prueba, QR ficticio y baja en emuladores desechables. En Windows usa Edge instalado. Este perfil solo admite el proyecto `demo-khypupyme-tests` y los puertos de pruebas de Auth y Firestore.

- Google Play. Registrar el paquete en Play Console y crear el producto consumible `khypupyme_30_dias` de una unidad. Ajustar el precio mostrado por la tienda según sus monedas. Definir `KHYPU_PLAY_PACKAGE` y `KHYPU_PLAY_ACCOUNT`, dar al servicio de Functions permiso para generar tokens de la cuenta publicadora y limitar sus permisos de Play al paquete. Configurar notificaciones de compras únicas y anulaciones en el tema privado `khypupyme-play-billing`. Probar primero con licencias de prueba y `KHYPU_BILLING_MODE=staging` en un proyecto separado. El servidor de staging rechaza compras de Play sin contexto de prueba. Reconciliar notificaciones fallidas y pagos sin referencia antes del piloto.
- QR Simple. Contratar y verificar tarifa y campos en el ambiente de prueba del proveedor. En staging usar únicamente su URL y credenciales de prueba. Configurar `KHYPU_QR_BASE`, `KHYPU_QR_CLIENT`, `KHYPU_QR_ESTABLISHMENT`, `KHYPU_QR_NAME` y la URL HTTPS `KHYPU_QR_WEBHOOK`. Vincular los secretos `KHYPU_QR_BASIC` y `KHYPU_QR_WEBHOOK_SECRET` en Firebase Secret Manager. Confirmar en el entorno del proveedor la referencia, moneda BOB, importe, vigencia y aviso. Si falla la emisión, consultar el intento antes de crear otro. Si el proveedor confirma un reembolso fuera de la API de QR Simple, el operador con permiso billingOperator registra la evidencia mediante reconcileQrRefund. Esta función registra el ajuste de acceso, no mueve dinero.
- Antes del primer cobro, confirmar con un contador la factura de KhypuPyme y la conciliación entre canales. Registrar liquidaciones y tiempos de soporte por separado del inventario, Caja y las ventas de los clientes.
- Piloto inicial de 10 a 15 barracas y tiendas. Registrar fecha de activación, primera operación, primer y segundo pago verificados, soporte y costo del servicio. Comparar contribución neta con gastos fijos. Ampliar la venta cuando se comprueben renovaciones y capacidad de soporte.
