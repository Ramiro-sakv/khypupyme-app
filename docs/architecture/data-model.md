# Modelo documental

Clasificación: negocio/usuario/producto/venta/gasto/fiado están documentados conceptualmente; los campos, rutas y movimientos siguientes son **propuestos/derivados**. Perfil, inventario, compras y costos están implementados localmente. Unidades enteras, movimientos con motivo y extensión v0.2 fueron confirmados por el propietario; los demás módulos siguen propuestos.

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

## Extensión confirmada v0.2: compras y costos

- `products.inventoryValueMinor`: entero 0–1.000.000.000.000 centavos. Su ausencia en documentos v0.1 se interpreta en dominio como null/costo pendiente. Nunca se almacena null ni se completa automáticamente. Stock cero implica valor cero. Nombre, precio, mínimo y archivo no pueden cambiar este valor.
- Movimientos v0.2: incorporan `valueBeforeMinor`, `valueAfterMinor`, `unitCostMinor` y `purchaseId`; tipos `valuation`, `purchase` y `purchase-reversal` además de opening/entry/exit. Se leen los movimientos v0.1 sin inventar valoración; siguen inmutables.
- `purchases/{operationId}`: producto y nombre histórico, cantidad, costo unitario, total, fecha operativa YYYY-MM-DD, referencia opcional, existencias/valor anteriores y posteriores, autor y timestamp del servidor. Cantidad 1–1.000.000, costo unitario 1–999.999.999 centavos, valor/total dentro del límite de valoración. Un producto por compra, sin crédito a proveedores, impuestos desglosados ni gastos operativos.
- `purchaseReversals/{purchaseId}`: ID de compra, ID de operación de anulación, motivo, autor y timestamp. Inmutable y único por compra. Solo se crea junto con movimiento inverso y restauración de existencias/valor, cuando `lastMovementId == purchaseId`. La compra original no se modifica ni borra. Editar metadatos no cuenta como movimiento posterior.

El costo promedio es valor/stock y solo se aproxima al mostrarlo. Para retirar q unidades de un stock Q con valor V, se calcula R = floor((2×V×q+Q)/(2×Q)) con BigInt. Las reglas exigen `(2R−1)×Q <= 2×V×q < (2R+1)×Q`; los límites mantienen todos esos productos por debajo de 2×10^18 y dentro de int64. No se usan tolerancias flotantes ni centavos residuales al agotar. Entradas suman cantidad×costo declarado; compras exigen además el documento inmutable vinculado.

La fecha admite días reales entre 2000 y 2099, incluidos bisiestos; la auditoría siempre usa hora del servidor. Las consultas ordenan por fecha operativa descendente, timestamp descendente e ID descendente; el cursor añade fecha a segundos/nanosegundos/ID. Hay índices con y sin filtro por producto. No se editan fechas, costos o cantidades de compras ya confirmadas.

Migración incremental: los productos anteriores se pueden leer, editar en sus metadatos y archivar; no se pueden comprar ni mover hasta valorar explícitamente. La valoración conserva el stock y crea un movimiento, sin reconstruir compras ni modificar movimientos históricos. Un producto nuevo con stock exige costo inicial explícito, incluido cero si el propietario declara adquisición sin costo. Las salidas no pueden hacer negativo stock o valor. Los archivados no admiten compras, valoración ni anulación.

## Beta 0.3: escrituras financieras en servidor local

Colecciones bajo `businesses/{uid}`: `sales`, `expenses`, `receivables`, `payments`, `customers`, `services`, `cashEvents`, `operations`. Admin SDK vive solo en `functions`. Autor desde Auth, negocio existente y `ownerUid` verificado en cada comando. Lecturas financieras del cliente: propietario y máximo 26 documentos; escrituras directas y borrados siempre denegados.

`operations/{operationId}` conserva firma canónica, tipo, resultado, autor y timestamp. La misma solicitud devuelve el resultado previo; otro contenido con el mismo ID se rechaza. Una venta admite 30 líneas únicas por producto/servicio. Cada línea conserva nombre/precio/costo/descuento históricos; stock y costo proporcional se recalculan dentro de la transacción. Movimientos `sale` y `sale-reversal` solo los escribe el servidor. Anulación devuelve el costo histórico original, incluso si cambió el promedio actual, y verifica topes al restituir.

Venta fiada crea `receivables/{saleId}` sin ingreso de dinero. `payments/{receivableId}` impide el segundo cobro, incluso con otro operationId. Deuda manual no crea venta. `cashEvents` representa cobro, gasto o devolución atómicos, con signo y fecha; una devolución usa el día de anulación. No incluye compras y no constituye saldo bancario/caja. Anulaciones cambian estado y conservan campos originales; correcciones mediante nuevo registro. Archivo de clientes/servicios no altera nombres históricos.

Lecturas de informes no son un cierre contable: varias consultas acotadas, hasta 10.000 registros por sección y 366 días. Sin truncar cifras al exceder. Costos desconocidos de bajas anteriores se advierten y excluyen; productos sin costo no se venden. Ganancia bruta, resultado estimado y movimiento de dinero se muestran separados.

## Configuración por negocio (beta 2)

`configuration` opcional contiene `profileId` (retail/services/mixed), `version: 1` y `tools` (inventory/purchases/services/customers/receivables, únicos; compras implica inventario). `configurationRevision` se crea en 1; ausencia en perfiles anteriores equivale a revisión 0 solo para configurar, no produce escritura automática. `activity` se deriva de las herramientas y no reemplaza los datos históricos.

`configure-business` recibe configuración y `expectedRevision`; el servidor valida forma/versión, propietario y revisión, incrementa esta última y registra la operación idempotente en la misma transacción. Conflictos de sesión se rechazan sin sobrescribir. Un reintento confirmado conserva el resultado aunque la revisión haya cambiado después. Las reglas validan creación completa y siguen denegando modificación directa de configuración/revisión desde el cliente.

Las herramientas son preferencias, no permisos ni tipos nuevos de inventario. Consultas financieras incluyen el historial de herramientas ocultas. Los perfiles admitidos comparten unidades enteras y BOB; perfiles que necesitarían medidas/variantes/series/producción siguen pendientes. El acceso a recuperar solicitudes tiene prioridad sobre ocultarlas; al resolver una solicitud se actualiza la interfaz sin reenvíos automáticos.


## Fichas por rubro, beta 3

`configuration.industryId` opcional elige uno de 21 rubros; `profileId` sigue indicando comercio/servicios/mixto. Se valida la compatibilidad del rubro con la familia; personalizar herramientas no cambia esta identidad. Configuraciones previas siguen válidas sin `industryId`.

`products.specification` es opcional para compatibilidad, versión 1: `{kind, unit, attributes}` además de `version`. Tipos `general/timber/apparel/appliance/perishable/ceramic/cement`, campos cerrados y límites replicados en reglas. Se copia exactamente en `inventoryMovements.initialProduct.specification` al crear; las reglas exigen igualdad y prohíben agregar, eliminar o modificar la ficha después. Cambiar variante/medida/lote/unidad requiere otro producto, sin convertir históricos. Los productos anteriores conservan unidades genéricas.

Compras conservan `specification` validada e igual a la del producto. Functions obtiene y valida la ficha del producto dentro de la transacción y la guarda en cada línea de venta; el cliente no puede suministrar esa copia. La fecha de vencimiento debe ser calendario válido; vender después de su vencimiento actual o con fecha de venta posterior se rechaza sin afectar stock/costos. Las anulaciones conservan sus mecanismos anteriores.

Milímetros, cm² por caja y gramos por bolsa son enteros; equivalencias y estimación de cajas usan BigInt. El stock permanece entero en la unidad fijada y el precio/costo sigue siendo por esa unidad. No hay cambios en reglas de valoración, límites monetarios, propietario o aislamiento.


## Modelo vigente 0.4 (secciones anteriores: contratos históricos)

businesses/{businessId} incorpora ownerUid, industryId inmutable, typeConfirmed, workspaceVersion=2, workflowVersion=2 y respuestas. users/{uid}/businesses/{businessId} es índice de navegación; autoriza el propietario del documento real. Creación/relación atómicas; users/{uid}/operationKeys/{operationId} vincula negocio, solicitud y resultado.

Subcolecciones v2: items, lots, serials, movementsV2, salesV2, purchasesV2, returns, exchanges, quotes, customersV2, debts, paymentsV2, expensesV2, expenseReversals, cashSessions, cashEntries, documentCounters, documentsV2, warrantyClaims, operationsV2 y legacyConversions. Índices privados de códigos, variantes y series. Escritas solo por Functions; sin borrado físico expuesto.

Unidades: piezas/pares/bolsas, mm³ para madera por volumen y gramos para granel/peso. Fracciones reducidas JSON n/d, denominador positivo, entrada comercial de seis decimales y conversión interna BigInt. 1 pie tablar = 144 pulgadas³ = 294967152/125 mm³; pulgada exacta 25,4 mm. Fichas/factores fijos. Ventas conservan unidad/factores, cantidad solicitada/entregada, precio, costo y asignaciones.

Costo común por valor total/existencia; seriales con costo individual. Devolución distribuye neto/costo histórico acumulativamente para conservar centavos. Apertura de bolsas reparte valor acumulativamente, sin inventar masa ni gasto. Series devueltas suman valor, pero no disponibilidad hasta inspección.

Informes en snapshot consistente, hasta 366 días/10.000 registros por sección. No suman unidades incompatibles. Documentos inmutables por negocio/tipo/año, máximo técnico 850.000 bytes para respetar Firestore, con error explícito. Fuentes locales y tablas multipágina. PDFs grandes requieren reducir el informe.

Historiales anteriores permanecen en sus rutas; conversiones crean movimientos vinculados y transfieren exactamente el valor. Costo ausente es pendiente. Una reversión antigua puede restaurar stock original; reconvertir exige el factor ya confirmado.
