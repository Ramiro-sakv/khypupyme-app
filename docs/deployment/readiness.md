# Preparación de lanzamiento y recuperación (sin despliegue)

Estado: **no apto para datos reales**. No se han creado proyectos cloud, activado facturación, publicado la aplicación ni invitado negocios piloto. La configuración permite solo demo/emuladores.

## Paso futuro: Firebase de pruebas autorizado

1. El propietario entra con su propia cuenta a https://console.firebase.google.com/; nunca envía contraseña ni cuentas de servicio al agente.
2. Tras revisar región, cuotas y presupuesto, crea un proyecto de pruebas separado del futuro productivo. Analytics no es necesario para los requisitos y no se activa por defecto.
3. Activa Authentication por correo/contraseña y configura dominios y recuperación/verificación. Configura Firestore en la región acordada, sin modo público; prepara reglas probadas antes de cargar datos.
4. Registra una app web, usa configuración de cliente en variables locales/CI; esos identificadores no reemplazan autorización. No poner Admin SDK ni claves privadas en Vite. El bloqueo demo de esta base se adaptará explícitamente durante esa tarea.
5. Prueba autenticación, aislamiento y consultas/índices en staging autorizado; los emuladores no reproducen todos los límites de producción. No copiar datos de pruebas al proyecto productivo.
6. Revisar HTTPS, dominios, cabeceras de seguridad, App Check, políticas de correo, CSP compatible, alertas de consumo y control de accesos. Solicitar autorización separada para despliegue público.

## Costos y servicios diferidos

Storage no está instalado ni activado. La documentación oficial de Firebase consultada el 30/10/2026 describe los requisitos del plan Blaze para aprovisionamiento y acceso a buckets: https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024 . Deben revisarse de nuevo las condiciones, región, almacenamiento, operaciones, transferencia y cuotas **antes de pedir autorización**; no se promete costo cero ni un precio fijo sin carga medida. RNF-05/PB-08 quedan pendientes por ello.

CSV descargable localmente será la primera exportación, sin Storage. Permite revisión externa, pero no cumple por sí solo RNF-05 ni es un respaldo completo. Posponer Storage evita habilitar servicios facturables ahora, con el impacto explícito de que no existen respaldos cloud ni descarga asíncrona almacenada.

Si se requiere Functions para garantizar invariantes comerciales, comparar costo de invocaciones/cómputo/red con alternativas confiables. No se ha elegido ni habilitado. El presupuesto se estimará con lecturas/escrituras por flujo, volumen de operaciones y retención por negocio; registrar mediciones, no cifras inventadas.

## Respaldo y restauración: estrategia pendiente de ejecutar

- **Código:** commits locales por unidad lógica y remoto oficial. El propietario autorizó la subida de la primera versión de prueba con inventario; verificar el hash remoto antes de afirmar que existe respaldo. Esta autorización no incluye despliegues ni cambios de visibilidad.
- **Datos locales ficticios:** export/import de Emulator Suite en `.emulator-data`, fuera de Git; no es solución para producción.
- **Datos comerciales futuros:** evaluar exportaciones administradas de Firestore o backups/PITR y Auth por separado, con autorización de costos y control de acceso. Definir retención, ubicación, responsables, RPO/RTO y cifrado antes del piloto; aún no hay objetivos acordados.
- **Restauración:** ensayar en un proyecto aislado autorizado, comprobar propietarios, conteos, importes, stock, vínculos venta-fiado/cobro y acceso A/B; registrar fecha y resultado. No probar restauración sobre producción ni considerar un CSV como ensayo de recuperación.
- **Baja/exportación:** diseñar descarga completa y tratamiento de solicitudes con política de conservación; no está implementado y bloquea el lanzamiento real.

Checklist previo al piloto: RF/RNF completos o excepciones aprobadas, reglas y concurrencia verificadas, usabilidad cronometrada (<60 s), teléfonos físicos, evaluación WCAG 2.2 AA, HTTPS/PWA, privacidad/términos, recuperación ensayada, costos/monitoreo y autorización explícita para usuarios reales.
