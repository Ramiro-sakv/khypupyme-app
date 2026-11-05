# Modelo documental

Clasificación: negocio/usuario/producto/venta/gasto/fiado están documentados conceptualmente; los campos, rutas y movimientos siguientes son **propuestos/derivados**. Perfil e inventario están implementados localmente. Unidades enteras y movimientos con motivo fueron confirmados por el propietario; los demás módulos siguen propuestos.

| Entidad / ruta | Campos y restricciones | Estado |
| --- | --- | --- |
| Usuario Firebase Authentication | UID, correo; contraseña administrada por Auth; un administrador por microempresa | Implementado en emulador. No colección duplicada de datos personales |
| `businesses/{uid}` | `ownerUid == uid`, `name` 2–80 caracteres, `currency: BOB`, `timeZone: America/La_Paz`, `createdAt`, `updatedAt` timestamps servidor | Implementado; nombre editable, resto inmutable |
| `businesses/{businessId}/products/{productId}` | `name` 2–80, `priceMinor` 1–999.999.999 centavos BOB, `stock` y `minimumStock` enteros 0–1.000.000, `active`, `lastMovementId`, `createdAt`, `updatedAt` servidor | Implementado; sin código ni costo de compra |
| `…/sales/{operationId}` | Estado vigente/anulado, fecha comercial, timestamps, moneda, método informativo, total menor entero, origen/idempotencia, detalles acotados | Propuesto; acceso cerrado |
| Detalle de venta embebido | ID de producto opcional para monto libre, nombre/precio/costo histórico, cantidad, subtotal; no depende del precio actual | Propuesto; tamaño máximo y validación de sumas por resolver |
| `…/inventoryMovements/{operationId}` | `productId`, `kind` opening/entry/exit, `delta` entero, `stockBefore`, `stockAfter`, `reason` 3–200, `authorUid`, `createdAt` servidor; `initialProduct` con nombre/precio/mínimo originales en apertura, null en entradas/salidas | Implementado e inmutable; aún sin relación con ventas |
| `…/expenses/{operationId}` | Monto menor entero positivo, fecha, descripción, categoría, estado, timestamps y autor | Propuesto; acceso cerrado |
| `…/receivables/{receivableId}` | Nombre mínimo del cliente, monto original menor entero, pendiente/pagado, origen manual/venta, saleId opcional, fechas | Propuesto; acceso cerrado |
| `…/payments/{receivableId}` | Un cobro total por deuda; monto, método, fecha comercial, timestamp y enlace a deuda | Propuesto; acceso cerrado |

Un propietario no puede elegir otro UID para apropiarse de un negocio. Conocer un `businessId` no da permisos. Los documentos futuros deberán incluir referencias verificables a operaciones atómicas, no solo campos descriptivos. No hay creación de membresías ni edición de propietario desde cliente.

Todos los timestamps guardados son de Firestore; la interfaz los convierte en fechas de dominio. Futuras fechas operativas son `YYYY-MM-DD` calculadas con la zona del negocio, no `toISOString().slice(0,10)` sobre UTC. Toda aritmética monetaria deberá comprobar enteros seguros y desbordamiento; nunca truncar silenciosamente datos inválidos.

La eliminación lógica de producto preservará snapshots históricos. Anular ventas o gastos conservará evidencia con compensaciones; la política debe revisarse antes del núcleo comercial. El cierre/borrado de negocio necesita política de privacidad y restauración; actualmente delete está denegado.

Inventario actual: el ID de producto coincide con el ID de su apertura. Se guarda la solicitud original en el movimiento inicial para reconocer un reintento incluso después de editar o archivar el producto. Entradas/salidas usan IDs únicos por operación y transacciones que recalculan el stock vigente. Reutilizar un ID con otra solicitud se rechaza. Productos archivados solo admiten metadatos/reactivación, sin cambios de stock.

Consultas de productos: filtro `active`, orden por `createdAt` descendente e ID descendente. Historial: filtro `productId`, mismo orden. Se solicitan 26 documentos para mostrar 25 y detectar la página siguiente. El cursor conserva segundos/nanosegundos originales; convertirlo solo a Date perdería precisión. Índices correspondientes en `firestore.indexes.json`; deben validarse en staging antes de cloud porque el emulador no reproduce su obligatoriedad.
