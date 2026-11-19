# Avance de KhypuPyme 2.0

## Bloque 1 · Cimientos

- Proyecto nuevo en `feat/khypupyme-2-0`, con historial iniciado en esta rama. Referencia funcional anterior en `chore/entrega-docente` (`5147dfd`).
- PostgreSQL 18 ya estaba instalado por el propietario. Se prepararon y migraron en loopback las bases `khypupyme2_dev` y `khypupyme2_test`, con roles propietarios y de aplicación independientes.
- Solución ASP.NET Core, EF Core y Npgsql. Los tipos de la página React se generan del contrato OpenAPI. API y base tienen comprobaciones separadas.
- La primera ejecución interactiva de la preparación falló al cargar el módulo de cifrado de PowerShell 5.1. Se sustituyó esa dependencia por la API de protección de datos de Windows, se comprobó el cifrado en esa misma versión y se completó la preparación en el segundo intento.

### Verificación

| Comprobación | Resultado |
|---|---|
| Compilación de .NET | Aprobada con 0 advertencias y 0 errores. |
| Generación de tipos, lint, TypeScript y compilación de React | Aprobados. |
| Migración inicial desde una base vacía | Aplicada en ambas bases. El modelo de EF Core coincide con la migración. |
| Permisos de PostgreSQL | Cada rol de aplicación tiene acceso a su esquema y carece de permisos para crearlo o conectar a la otra base. |
| API local | Respondió HTTP 200 para API y PostgreSQL en desarrollo y pruebas. Sin conexión configurada respondió HTTP 200 para API y HTTP 503 para PostgreSQL. |
| Contrato y web | OpenAPI documenta HTTP 200 y 503. La página React compilada y su consulta a PostgreSQL vía Vite respondieron HTTP 200. |

## Bloque 2 · Cuentas, permisos y Mis negocios

- Alta, recuperación, ingreso y cierre de sesión con ASP.NET Core Identity. Códigos de cinco dígitos de un uso, buzón local, protección CSRF y revocación de sesiones al recuperar la contraseña.
- Google utiliza credenciales opcionales y vinculación explícita para cuentas existentes. El servidor local prepara el flujo PKCE de Android y Windows.
- Selector con búsqueda y paginación, último negocio autorizado y asistente de rubro, configuración y revisión. Los 21 rubros se pueden elegir en el alta. La aplicación abre la ficha correspondiente al negocio creado.
- PostgreSQL separa los negocios por propietario y la ficha por negocio activo. Las claves foráneas impiden referencias cruzadas. El rol de ejecución puede crear negocios y actualizar ajustes, con el rubro fijo.

### Verificación

| Comprobación | Resultado |
|---|---|
| Compilación, lint, tipos y OpenAPI | Aprobados. EF Core coincide con la migración aplicada a las bases locales de desarrollo y pruebas. |
| Registro y recuperación | Aprobados en PostgreSQL con buzón local. Se comprobaron código vencido, reutilizado, reenvío, intentos agotados, CSRF, contraseña anterior y revocación de sesiones. |
| Aislamiento | Aprobado con dos cuentas y dos negocios por cuenta. Consultar, seleccionar y editar el negocio ajeno se rechazó. Se comprobó el rechazo de una ficha de otro negocio propio, el alcance de RLS y la clave foránea con el rol real de ejecución. |
| Clientes instalados | Aprobados el retorno registrado para Windows y Android, PKCE S256 y el uso de un token para leer y escribir en el ámbito autorizado. |
| Web | Edge a 390 px completó alta, ingreso, asistente, búsqueda, reapertura del último negocio y cierre de sesión sobre la base de pruebas. |
| Google real | Pendiente de credenciales OAuth. La prueba local comprobó la respuesta de configuración pendiente y mantuvo la autenticación externa fuera del recorrido automatizado. |

## Bloque 3 · Diseño, Inicio y navegación

- Sistema compartido de campos, botones, alertas, tarjetas, tablas y estados vacíos. Las 21 identidades de rubro se aplican en Mis negocios, el asistente y el espacio activo.
- Inicio identifica el negocio y reúne Caja, acciones disponibles y gráfica de ventas y gastos. El bloque comercial todavía debe aportar datos confirmados, por lo que Caja y la gráfica muestran estados vacíos y las pantallas comerciales quedan fuera de la navegación.
- Navegación lateral en escritorio, compacta en tablet y fija abajo en móvil. La vista se guarda en `vista` para recargar o usar Atrás. La configuración conserva el rubro y actualiza los datos visibles del negocio.
- **Revisar** ocupa una fila propia debajo del carrito. El diálogo conserva sus campos al minimizar, admite Escape y devuelve el foco al carrito. El componente espera su integración con el carrito comercial.

### Verificación

| Comprobación | Resultado |
|---|---|
| Lint, TypeScript y compilación web | Aprobados. |
| Edge con PostgreSQL de pruebas | Completados ingreso, asistente con regreso al paso anterior, búsqueda, cambio de negocio, guardado, recarga y Atrás. |
| 360, 768 y 1440 px | Aprobadas navegación con teclado y toque emulado, foco al cambiar de vista y ausencia de desborde horizontal. En móvil, el espacio reservado dejó Revisar por encima de la navegación. |
| Paletas | Los 21 rubros del servidor tienen paleta. El contraste mínimo comprobado entre texto y fondo de los pares de rubro fue de 5,41:1. |
| Gráfica y Revisar | Aprobados estado vacío en la app y prueba aislada con datos ficticios para barras, tabla, Escape, minimización, conservación de campos y devolución de foco. |

## Bloque 4 · Núcleo comercial, documentos e informes

- Catálogo por piezas, clientes, caja, compras, ventas, cotizaciones, devoluciones, gastos, fiados, cobro del saldo, historial e informes. La venta admite cliente ocasional y alta de cliente dentro de Revisar. Las cotizaciones duran siete días y su conversión comprueba precio y stock.
- Las escrituras comerciales utilizan una sola transacción en PostgreSQL. El bloqueo por negocio serializa operaciones de existencias y caja. El identificador se vincula a cuenta, negocio y contenido. Las tablas comerciales tienen políticas por negocio, claves foráneas compuestas y movimientos históricos de solo inserción para el rol de la API.
- Los documentos guardan nombre, precios, cantidades y subtotales confirmados. La descarga PDF se genera en el navegador desde ese registro, con fuentes locales y aviso no fiscal.
- IndexedDB guarda borradores y solicitudes originales por cuenta y negocio. Si la respuesta resulta incierta, se consulta su estado desde la app y se habilita el reintento manual cuando el servidor aún no registra la operación.
- Informes separa compras, costo vendido, gastos y pérdidas. Inicio consulta la caja y las cifras confirmadas. Los casos de madera por especie y medidas pertenecen al siguiente bloque.

### Verificación

| Comprobación | Resultado |
|---|---|
| Lint, TypeScript y compilaciones | Aprobados. Vite informó que los paquetes de PDF y fuentes superan 500 kB. Ambos se cargan al generar un comprobante. |
| PostgreSQL de pruebas | Aprobados aislamiento, reversión íntegra de una compra rechazada, respuesta idempotente y dos ventas que disputan la última unidad. |
| Devoluciones, gastos y fiados | Aprobados devolución parcial, redondeo acumulado, pérdida sin reintegro, anulación sin duplicado y cobro completo. |
| Conciliación del informe | El caso de prueba produjo Bs 225,00 en ventas netas, Bs 507,00 en compras, Bs 107,00 en costo vendido, Bs 0,00 en gastos netos, Bs 50,00 en pérdidas y Bs 68,00 de resultado. |
| Edge a 390 px y PDF | Compra de diez piezas, alta de cliente sin perder el carrito y restauración tras recarga. Tras perder la respuesta de la venta, la consulta manual confirmó Bs 200,00 y ocho piezas restantes. Se verificaron el importe y el número en pantalla, historial y texto del PDF descargado. |

## Bloque 5 · Sicomoro, madera y práctica

- Catálogo de madera con nombre, especie, código y tarifa por pie tablar en cada tramo de largo. Supercorta de 1 a 2 pies, corta de 3 a 6 y larga de 7 a 20. El equivalente métrico se captura en milímetros. Las fichas por pieza siguen disponibles.
- El inventario detalla largo, espesor, ancho, piezas, volumen y valor. El carrito admite listas de anchos, multiplicadores y selección desde existencias. Las compras guardan su costo por pieza. Las ventas suman volumen exacto y redondean el importe por grupo de producto, largo y espesor antes de repartir los centavos entre medidas. El límite es de 20 grupos y 100 líneas por operación.
- Compras, ventas, cotizaciones y devoluciones conservan la medida de cada línea. El comprobante incluye todas las especies y medidas. La devolución se vincula a la línea original y usa su costo histórico. Cambiar las unidades de presentación conserva las medidas almacenadas y la unidad de los comprobantes emitidos.
- La práctica reanuda el avance confirmado por el servidor. Admite valores distintos de los sugeridos, guía movible y documentos ficticios identificados. Finalizar o abandonar elimina el espacio temporal y limpia sus borradores y solicitudes locales. El negocio real usa otro contexto y conserva sus registros.

### Verificación

| Comprobación | Resultado |
|---|---|
| Lint, TypeScript y compilaciones | Aprobados. Vite mantiene el aviso de tamaño de PDF y fuentes cargados bajo demanda. |
| Compra y venta en PostgreSQL | Diez tablas de 2″ × 6″ × 10′ a Bs 50 cada una, venta de dos por Bs 200 y ocho restantes con valor de Bs 400. |
| Venta mixta, devolución y faltantes | Dos especies y tres medidas en un comprobante por Bs 325,21. Devolución parcial con costo histórico. Solicitar cuatro piezas de un ancho con tres disponibles se rechazó sin mover caja ni descontar la otra medida. |
| Anchos y cálculo | La primera lista produjo siete piezas y 51,67 pies tablares. La lista con multiplicadores produjo 16 piezas y 165 pies tablares. Aprobados la equivalencia métrica, la normalización de ancho comercial y el redondeo del importe desde el volumen exacto. |
| Práctica y navegador | Aprobados avance con valores distintos, pausa, reanudación, regeneración de PDF y eliminación del espacio temporal. Edge a 360 px confirmó revisión, Escape, faltante en el carrito y movimiento de la guía con teclado y arrastre. |
| Compatibilidad | Aprobado el recorrido de regresión del bloque 4. Migración aplicada a PostgreSQL de pruebas y desarrollo. |

La comprobación de PostgreSQL usa `scripts/Test-Block5.ps1`. El recorrido de Edge se habilita indicando la ruta a `playwright-core` en `KHYPU_TEST_PLAYWRIGHT` y dejando Vite de prueba disponible en el puerto 5283. Las cuentas y negocios de prueba se crean y retiran únicamente en `khypupyme2_test`.

## Bloque 6 · Tienda 24/7, Ropa y Electrodomésticos

- Tienda abre la venta desde el lector y permite comprar por caja o unidad según la ficha. Las unidades de peso y volumen se convierten a gramos o mililitros. Las capturas admiten hasta tres decimales y la libra estándar equivale exactamente a 453,59237 g. El importe usa la tarifa guardada de la ficha y la cantidad sin redondear. [NIST, Handbook 44, apéndice C](https://nvlpubs.nist.gov/nistpubs/hb/2026/NIST.HB.44-2026.pdf)
- Cada compra con control de lote conserva el código y su vencimiento cuando se declara. La venta consume primero el lote vendible que vence antes. El control usa la fecha de Bolivia y excluye los lotes desde el día siguiente a su vencimiento. Inicio muestra reposición con saldo vendible y lotes que caducan en los próximos 30 días.
- Ropa consulta el modelo en una matriz de tallas y colores. El cambio se inicia desde la venta y elige el reemplazo del mismo modelo. La transacción registra el reintegro de la variante anterior, la salida de la nueva y la diferencia revisada. Si la venta original conserva un fiado, primero se aplica ahí el importe correspondiente de la devolución.
- Electrodomésticos permite pegar una lista de series en compras y elegir unidades disponibles en ventas. El historial por serie enlaza sus comprobantes, conserva la garantía declarada al vender y permite resolver la inspección como reintegro o baja con motivo. El equipo en inspección conserva su costo y queda fuera del stock vendible.
- Los tres rubros tienen accesos y paneles propios en Inicio y comparten el carrito, Revisar, la recuperación de solicitudes y los comprobantes. Las fichas por piezas anteriores conservan su modelo.

### Verificación

| Comprobación | Resultado |
|---|---|
| Tienda | Dos cajas de 24 menos cinco vendidas dejaron 43 unidades vendibles. La operación usó el lote más próximo a vencer. Una venta de 44 se rechazó aunque existían unidades vencidas. |
| Conversiones | Compra de 2 kg y venta de 1 lb dejaron 1.546,40763 g. Devolver media libra dejó 1.773,203815 g. Comprar 3 L y vender 500 mL dejó 2.500 mL. |
| Ropa | Se rechazaron una variante duplicada y un cambio con stock insuficiente. Un cambio de talla registró Bs 20 de diferencia y actualizó las dos variantes. |
| Electrodomésticos | Se rechazaron series duplicadas en la misma lista y en compras posteriores. Pasaron venta por serie, garantía histórica, devolución a inspección y regreso a stock. |
| Edge a 360 px | Pasaron el lector con Enter, el aviso de faltante, la revisión con Escape, el cambio desde la venta y el historial de garantía desde el comprobante. |
| Lint, tipos y compilación | Aprobados. Vite mantuvo el aviso sobre PDF y fuentes cargados bajo demanda. |
| Compatibilidad | Aprobados los recorridos PostgreSQL de los bloques 4 y 5. Migración aplicada en las bases locales de prueba y desarrollo. |

El bloque se verifica con `scripts/Test-Block6.ps1`. El recorrido de Edge usa la misma configuración opcional del bloque 5.

## Bloque 7A · Abarrotes, Bebidas, Cosméticos y Mascotas

- Abarrotes recibe por presentación, vende con la unidad y tarifa de su ficha y consume primero el lote vendible que vence antes. La reposición usa existencias vendibles.
- Bebidas admite cajas y unidades sueltas en una línea. El comprobante guarda la equivalencia y los envases entregados y devueltos. El servidor verifica las devoluciones contra el saldo previo del cliente y luego calcula la disponibilidad para nuevas entregas. Los movimientos de envases se pueden registrar también sin venta y representan únicamente cantidades físicas.
- Cosméticos busca por marca, presentación o tono. Apartar un lote mantiene su cantidad y valor, pero impide venderlo. Liberar un lote vendible o darlo de baja exige un motivo. La baja registra la pérdida de inventario en Informes.
- Mascotas exige rastrear el origen del alimento por peso. La venta permite registrar el lote de la bolsa abierta y conserva su vencimiento y la cantidad utilizada en el comprobante.
- Se dejó una cuenta verificada en PostgreSQL de desarrollo con cuatro negocios de práctica vacíos. El registro local deposita sus códigos en el buzón de Windows descrito en el README.

### Verificación

| Rubro | Recorrido y resultado |
|---|---|
| Abarrotes | Dos cajas de 24 menos cinco unidades dejaron 43 vendibles. La venta tomó el lote más próximo a vencer y se rechazó una venta que habría consumido piezas vencidas. |
| Bebidas | Una caja de 24 más dos sueltas se vendieron en una línea. Un cliente con saldo de cuatro no pudo devolver cinco, incluso al recibir más envases en la misma operación. Se verificaron el saldo, la devolución independiente y la idempotencia de la venta. |
| Cosméticos | Se encontró el mismo producto por marca, presentación y tono. Apartar el lote mantuvo Bs 60 de valor y bloqueó su venta, liberarlo devolvió las tres piezas a disponibilidad y la baja quedó en el informe. |
| Mascotas | Vender 0,5 kg de una bolsa seleccionada guardó su código y vencimiento. Se rechazó vender desde ese lote más del saldo disponible, aunque otro lote tuviera stock. |
| Interfaz y cuenta local | Edge a 360 px completó los cuatro recorridos. El ingreso a la cuenta de prueba se confirmó desde la pantalla de inicio de sesión. |
| Compatibilidad | Lint, TypeScript, compilaciones y regresiones de los bloques 4 a 6 aprobados. Migración aplicada en las bases de prueba y desarrollo. |

La comprobación de PostgreSQL usa `scripts/Test-Block7a.ps1`. El recorrido de Edge usa la configuración opcional del bloque 5.

## Bloque 7B · Calzado, Electrónica, Ferretería, Repuestos y Librería

- Calzado registra variantes por modelo, talla y color y presenta las existencias en pares. Desde una venta se elige otra talla o color del mismo modelo. El cambio conserva las líneas originales y confirma la devolución, la salida del reemplazo y la diferencia de cobro en una transacción.
- Electrónica combina accesorios por cantidad y equipos por serie en un comprobante. La ficha técnica agrega marca, modelo y referencia. Las unidades vendidas conservan su garantía declarada y una devolución pasa por inspección.
- Ferretería busca por código, referencia, medida o estante. La ficha se configura por piezas/cajas o por metros con longitud declarada de rollo. La compra guarda la conversión aplicada y su costo. La venta y la devolución operan sobre los metros reales disponibles.
- Repuestos guarda referencias originales y equivalentes y una lista de compatibilidades declaradas. Los filtros de marca, modelo y año se aplican a una misma fila de compatibilidad en el servidor, antes de paginar. Las filas pendientes se muestran por confirmar. Los comprobantes conservan la ficha que se utilizó al vender.
- Librería incluye artículos y tarifas de impresión por tamaño y color en una venta. El servidor calcula caras como copias por caras de cada copia y hojas por copia según una cara o doble cara. El servicio se cobra por cara y los artículos vendidos se descuentan como líneas independientes.
- Las ampliaciones conservan las huellas de las solicitudes anteriores. Las referencias y compatibilidades tienen claves foráneas por negocio y políticas de aislamiento de PostgreSQL.

### Recorridos verificados

| Rubro | Recorrido y resultado |
|---|---|
| Calzado | Crear tallas 40, 41 y 42, comprar pares, vender talla 40 e iniciar cambio desde la venta. La talla 41 sin stock se rechazó sin reintegrar el par anterior. El reemplazo por talla 42 confirmó Bs 10 de diferencia. |
| Electrónica | Comprar accesorios y dos equipos con serie, vender ambos tipos en un comprobante por Bs 850 y devolver el equipo a inspección. Se verificaron rechazo de serie duplicada, garantía histórica y liberación de la unidad. |
| Ferretería | Comprar dos rollos de 50 m incorporó 100 m. Vender 12,5 m y devolver 2,5 m dejó 90 m. Una salida de más del saldo se rechazó y la búsqueda encontró referencia, medida y estante. |
| Repuestos | Buscar una referencia equivalente y filtrar por marca, modelo y año encontró la compatibilidad declarada. Se comprobaron extremos inclusivos del rango y rechazo de combinar la marca de una fila con el modelo de otra. Editar la ficha conservó el comprobante previo. |
| Librería | Vender dos lápices y tres copias de cinco caras a doble cara produjo 15 caras, nueve hojas y un total de Bs 10,50. Cambiar a una cara conservó el importe de impresión y mostró 15 hojas. |
| Edge a 360 px | Completados matriz de pares y cambio, venta mixta por serie, compra por rollo, aviso de faltante, filtro de vehículo, impresión a doble cara y descarga del PDF. |
| Contratos anteriores | Las huellas almacenadas de los contratos de los bloques 6 y 7A coincidieron con las calculadas desde sus formatos originales. |
| Verificación final | Lint, TypeScript y compilaciones web/C# aprobados. Pasaron las regresiones PostgreSQL de los bloques 4, 5, 6 y 7A. La migración se aplicó a pruebas y desarrollo. Vite conserva el aviso de tamaño del PDF y las fuentes cargados bajo demanda. |

La verificación usa `scripts/Test-Block7b.ps1`. El recorrido de Edge utiliza la configuración opcional del bloque 5.

## Bloque 7C · Muebles, Cerámicas y Cemento

- Muebles registra ancho, fondo y alto en centímetros y muestra las existencias de piezas terminadas. La cotización conserva las cantidades y se puede convertir en venta. Desde la venta se programa un retiro o entrega, con fecha y dirección cuando corresponda. Completarla actualiza su estado sin volver a registrar una salida.
- Cerámicas registra cobertura por caja, piezas, tono y calibre. La venta y la cotización permiten capturar cajas o piezas y calcular la cobertura con merma. El servidor valida la cantidad y exige confirmar el tono y el calibre declarados en la ficha. El comprobante conserva la selección y la cobertura calculada.
- Cemento registra peso por bolsa y lote. El formato a granel se habilita por ficha con su propia tarifa por kg y conserva el lote y su vencimiento. La apertura traslada las bolsas y su costo proporcional a kilogramos en una transacción. El historial y el PDF muestran el valor transferido. Una vez habilitado el granel, su tarifa se administra desde la ficha de bolsas.

### Verificación

| Recorrido | Resultado |
|---|---|
| Muebles | Se compraron cinco piezas. La cotización dejó cinco y su venta dejó tres. Programar, reprogramar y completar la entrega conservó las tres. Una referencia de otro negocio se rechazó y repetir la confirmación conservó el resultado. |
| Cerámicas | 12 m² con 10 % de merma requirieron diez cajas de 1,44 m², con 14,4 m² entregados. La alternativa por piezas dio 55. Se rechazaron nueve cajas, el tono sin seleccionar y el calibre incorrecto. |
| Cemento | Dos bolsas de 50 kg trasladaron 100 kg y Bs 100 del lote. Se conservaron el efectivo y el informe del periodo. Se rechazaron el lote vencido, el exceso de bolsas y un valor de traslado desactualizado. Repetir la solicitud no duplicó su efecto. |
| Interfaz | Edge a 360 px completó cotización, venta y entrega de muebles, revisó el cálculo y la selección en cerámicas y confirmó la apertura con descarga del PDF en cemento. Se comprobó el retorno al carrito con Escape. |
| Compatibilidad | Aprobados lint, TypeScript, compilación web y .NET y regresiones PostgreSQL de los bloques 4, 5, 6, 7A y 7B. Migración aplicada a las bases locales de prueba y desarrollo. Vite mantiene el aviso de tamaño de los módulos de PDF cargados bajo demanda. |

El bloque se comprueba con `scripts/Test-Block7c.ps1`. El recorrido de Edge usa la configuración opcional del bloque 5.

## Bloque 7D · Peluquería, Limpieza, Profesionales, Taller y Artesanía

- Peluquería tiene agenda por día en hora de Bolivia. Una cita indica cliente, servicio, hora y duración. Reprogramar vuelve a verificar el horario. Registrar inasistencia libera el turno. Atender sin cita abre la venta habitual.
- Limpieza organiza cada trabajo por cliente, dirección, fecha y tareas. Tiene campos separados para materiales previstos y usados. Anotarlos en la orden conserva el registro operativo. Las existencias se descuentan cuando los productos se agregan al comprobante.
- Profesionales reúne fecha comprometida, entregables y presupuesto. Se puede aprobar, iniciar, marcar listo, entregar y cobrar desde la orden. El presupuesto se muestra al revisar la venta y el total se calcula con las líneas elegidas.
- Taller registra equipo, accesorios y falla. La constancia de recepción se puede descargar en PDF desde su registro original. La orden pasa por diagnóstico, aprobación, reparación y entrega. Mano de obra y repuestos pueden compartir el comprobante.
- Artesanía separa la venta directa de piezas listas de los encargos con especificaciones, presupuesto y fecha prometida.
- La revisión del cobro conserva un borrador por cuenta, negocio y trabajo. El servidor confirma el vínculo con una sola venta en la misma transacción que el stock, la caja o el fiado. Entregar una orden actualiza su estado y conserva su vínculo. Los servicios tienen tarifa y carecen de existencias.

### Verificación de los 21 rubros

| Bloque | Rubros revisados y recorridos |
|---|---|
| 5 | **Maderas y barraca**. Compra y venta por medidas, comprobante con varias especies, devolución parcial y práctica aislada. |
| 6 | **Tienda 24/7, Ropa y accesorios y Electrodomésticos**. Lector y lotes vendibles, matriz y cambio de talla, venta por serie y garantía. |
| 7A | **Abarrotes, Bebidas, Cosméticos y Mascotas**. Presentación de compra, devolución de envases, lote apartado y venta fraccionada con origen. |
| 7B | **Calzado, Electrónica, Ferretería, Repuestos y Librería**. Cambio en pares, venta mixta, rollos a metros, compatibilidad e impresión por caras. |
| 7C | **Muebles, Cerámicas y Cemento**. Entrega sin nueva salida, diez cajas para 12 m² con merma y traslado de 100 kg conservando valor. |
| 7D | **Peluquería, Limpieza, Profesionales, Taller y Artesanía**. Se rechazaron cruces de citas y cobros duplicados, incluidos intentos simultáneos. La entrega posterior al cobro conservó el comprobante y el saldo de inventario. Se verificaron también presupuesto, constancia PDF y separación entre venta directa y encargo. |

El bloque 7D se comprueba con `scripts/Test-Block7d.ps1`. El recorrido en Edge a 360 px usa la configuración opcional del bloque 5 y comprueba los cinco rubros, el borrador de venta vinculada tras recargar y la descarga de la constancia. La API también verificó los 21 identificadores únicos del selector. Pasaron lint, TypeScript y las compilaciones de React y .NET. La migración se aplicó a PostgreSQL local de pruebas y desarrollo. Vite conserva el aviso de tamaño de los módulos de PDF cargados bajo demanda.

## Bloque 8 · Planes y demostración de pago

- El primer negocio de una cuenta con correo verificado puede activar una prueba de 30 días. Los pases por negocio son Bs 39 por 30 días, Bs 210 por seis meses calendario y Bs 390 por un año. Renovar un negocio activo amplía su vigencia desde el fin del periodo actual. Los meses usan la hora de Bolivia y ajustan el día al final del mes cuando corresponde.
- Al seleccionar un negocio sin acceso aparece su panel de planes. El panel muestra el importe y la fecha estimada antes del checkout. Los negocios activos abren Inicio y pueden renovar desde Configuración. El indicador «Demostración · Sin cargos» acompaña el proceso.
- El catálogo de prueba usa tres tarjetas predefinidas. Cada intento guarda su identificador, marca, últimos cuatro dígitos y resultado previsto, además del importe y periodo del pase. Las solicitudes solo admiten los identificadores de la selección y acciones del intento. El formulario y el contrato carecen de campos de número completo y CVV.
- Un intento pendiente dura 15 minutos y se recupera al volver a abrir el panel. Confirmar el mismo intento de nuevo devuelve el resultado original. El reembolso retira la vigencia restante de ese pase y recoloca los pases posteriores sin usar. Los pagos se registran en su propio historial y quedan fuera de la caja y los informes comerciales.
- La licencia vencida permite consultar el historial, descargar un JSON del negocio, regenerar los PDF y cerrar la caja que quedó abierta. El servidor conserva la consulta y el resultado de solicitudes confirmadas. Las nuevas operaciones comerciales requieren vigencia.
- Para negocios anteriores a esta migración, la primera ficha se identifica por el movimiento comercial más antiguo disponible. En ausencia de movimientos se aplica un orden estable por identificador. Esos negocios conservan sus registros y pueden pasar a modo de consulta hasta activar un acceso.

### Verificación

| Comprobación | Resultado |
|---|---|
| Prueba | Pasaron correo verificado, elegibilidad del primer negocio y activación simultánea sin extender los 30 días. |
| Checkout | Pasaron aprobación, rechazo, cancelación, vencimiento por reloj y recuperación de un pendiente. Se rechazaron campos de número completo y CVV. |
| Vigencia | Pasaron confirmación duplicada simultánea, acumulación de pases, fin de mes, año bisiesto y reembolsos de periodos activos o en cola. Se comprobaron el aislamiento y la ausencia de movimientos de caja o ventas por el pago. |
| Modo de consulta | PostgreSQL permitió historial, comprobante, exportación y cierre de la caja abierta. Rechazó nuevas ventas, otra apertura y un segundo cierre. |
| Edge a 360 px | Pasaron la selección y revisión, la recuperación tras recargar, aprobación, rechazo, reembolso, prueba gratuita y descarga de JSON y PDF con acceso vencido. |
| Compatibilidad | Pasaron lint, TypeScript, compilación web y .NET y las regresiones de cuentas y permisos del bloque 2 y del núcleo comercial de los bloques 4 a 7D. Se aplicó la migración en PostgreSQL local de pruebas y desarrollo. Vite mantiene el aviso de tamaño de los módulos de PDF cargados bajo demanda. |

El recorrido aislado se ejecuta con `scripts/Test-Block8.ps1`.

## Bloque 9 · Seguridad, exportación y baja

- Devoluciones, cambios, anulaciones, ajustes de existencias y de caja y ediciones de productos o clientes requieren motivo y confirmación reciente de identidad. La contraseña se valida con ASP.NET Core Identity. Las cuentas sin contraseña pueden confirmar por correo verificado. La autorización dura dos minutos, queda ligada al titular, negocio, identificador y contenido de la operación, y se consume con ella en una transacción. Una repetición de la solicitud original recupera el comprobante existente.
- La auditoría registra titular, fecha, motivo, registro afectado y la solicitud comercial. La edición de una ficha conserva también sus datos anteriores relevantes. Se consulta y exporta desde Configuración. El rol de ejecución puede consultar y agregar auditoría dentro de su contexto. Los cambios y borrados directos de sus filas quedan denegados.
- La eliminación de negocio exige escribir su nombre exacto, confirmar identidad y canjear un código de cinco dígitos. El código dura diez minutos, admite cinco intentos y reemplazarlo invalida el anterior. En desarrollo se entrega al buzón local. Se comprueba la caja y las operaciones por revisar en el negocio y en su práctica. Los resultados confirmados requieren acuse del cliente y los navegadores conservan sus solicitudes inciertas. Los registros anteriores a la migración se consideran revisados en el servidor. Un borrador local previo puede seguir consultando su resultado.
- Tras canjear el código, el negocio queda bloqueado. Un segundo paso elimina exclusivamente ese negocio y su práctica. Si se interrumpe, Mis negocios permite reanudar. Solo se muestra «Negocio eliminado» después de confirmar la limpieza. La marca mínima del borrado y el uso de prueba de la cuenta se conservan.
- La solicitud de eliminación de cuenta suspende el acceso y revoca las sesiones web e instaladas. Registra la solicitud para su tramitación posterior, con los historiales conservados. La revocación de sesiones también se ofrece por separado.

### Verificación

| Comprobación | Resultado |
|---|---|
| Correcciones | PostgreSQL rechazó una corrección sin autorización, un contenido modificado y una autorización vencida. Se comprobó el consumo único, la confirmación de repetidos y la auditoría exportada. |
| Permisos | Con el usuario de ejecución se rechazaron la edición y el borrado de auditoría, la lectura en otro ámbito y el intento de eliminar otro negocio usando una solicitud válida. |
| Eliminación | Se rechazaron el nombre inexacto, el código incorrecto, vencido y usado, la caja abierta y la operación sin revisar. Se comprobó el bloqueo, la reanudación y la eliminación del negocio y de su práctica, con los negocios vecinos intactos. |
| Cuenta y móvil | Pasó la confirmación por correo de una cuenta de prueba sin contraseña. Se revocaron cookies, acceso y renovación de una sesión instalada. Edge a 360 px verificó una edición autorizada y reanudó un borrado que quedó interrumpido tras confirmar el código. |
| Migración y respaldo | Migración aplicada a las bases existentes de desarrollo y pruebas. Un respaldo con registros ficticios se restauró en `khypupyme2_restore`, en una instancia PostgreSQL aislada. Se comprobaron los registros esperados de auditoría, baja y negocios. |
| Compatibilidad | Pasaron lint, TypeScript, compilaciones web y .NET y las regresiones de API de los bloques 4 a 8. Vite conserva el aviso de tamaño de los módulos PDF cargados bajo demanda. |

`scripts/Test-Block9.ps1 -RestoreBackup` ejecuta los recorridos con datos ficticios y verifica la restauración en una instancia local aislada.

## Bloque 10 · Instaladores y piloto privado

- El Blueprint crea un servicio independiente para React y ASP.NET Core. El perfil hospedado exige HTTPS, una lista de invitados y una conexión directa TLS a `khypupyme2_pilot` con un rol de ejecución separado. PostgreSQL conserva las claves cifradas que usan las cookies. El correo de desarrollo sigue en el buzón local y el perfil hospedado prepara la entrega con Resend por HTTPS.
- Android y Windows usan identificadores propios y la misma API. El ingreso abre el navegador, exige PKCE y vuelve por el protocolo de Android o por loopback de Windows. Los tokens de renovación se protegen con Android Keystore y DPAPI, respectivamente. Los PDF y las exportaciones se guardan mediante el selector de archivos del dispositivo.
- La prueba y los pases siguen siendo demostraciones. Los 21 rubros y las operaciones comerciales conservan sus contratos. La migración de claves se aplicó a las bases locales existentes de desarrollo y pruebas.

| Comprobación | Resultado |
|---|---|
| Compilación | Pasaron .NET, ESLint, TypeScript, Vite, el APK de desarrollo y el instalador NSIS x64. Vite informa el tamaño de los módulos PDF que se cargan bajo demanda. |
| Web con API HTTPS local | Edge a 360 px verificó ingreso, pago de demostración, venta y PDF. También verificó recuperación del pago pendiente, reembolso, rechazo, exportación y descarga con acceso vencido. |
| PostgreSQL local aislado | Pasaron los recorridos y excepciones de los 21 rubros, las regresiones de cuentas y finanzas, el aislamiento, la repetición de solicitudes, la disputa por stock, las correcciones y el borrado protegido. |
| Autorización instalada | La API rechazó el regreso con PKCE incorrecto y la reutilización de un código. Comprobó las dos rutas de regreso, sesión con token, revocación y rechazo de referencias cruzadas. |
| Perfil hospedado en local | El perfil Production inició con rol limitado y PostgreSQL TLS. Se comprobaron la web HTTPS, el rechazo del registro de un correo ajeno y la recuperación de claves cifradas después de reiniciar. |
| Windows con API HTTPS local | WebView2 abrió una sesión desde el navegador y regresó por loopback. Confirmó una venta con licencia de demostración, guardó el PDF con el diálogo nativo y conservó la sesión al reabrir. Luego cerró sesión e ingresó otra vez. El caso previo de la aplicación anterior sigue abierto hasta revisar el piloto alojado. |
| Respaldo local | Se restauró el respaldo ficticio en `khypupyme2_restore` en una instancia distinta. Se comprobaron los registros esperados de auditoría, bajas y negocios. |
| Android | Se verificaron la firma de desarrollo y la identidad del APK. La ejecución en un teléfono físico queda pendiente. |
| Render, Neon y correo real | Configuración preparada. Pendientes el despliegue, la entrega real de correo, la restauración en Neon y la aceptación desde las tres plataformas con el servicio alojado. Docker tampoco se ejecutó en este equipo. |

Los archivos generados se guardan en `artifacts/pilot/KhypuPyme2-Piloto-Android.apk` y `artifacts/pilot/KhypuPyme2-Piloto-Windows.exe`. Apuntan a `https://khypupyme2-piloto.onrender.com`, la dirección prevista. Si Render asigna otra, se vuelven a generar con esa dirección.

[PILOTO.md](PILOTO.md) explica cómo arrancar en local, preparar las cuentas del titular y verificar los recorridos alojados. La siguiente etapa del plan es activar el piloto con autorización del titular y cerrar su aceptación. El lanzamiento público y los cargos reales se deciden después.

## Pulido de 2.0 con KhypuPyme 1 como referencia

- Inicio recupera el estado de Caja, las acciones de cada rubro y las barras de ventas y gastos con compras opcionales. Mis negocios destaca el último espacio autorizado y el asistente ordena los 21 rubros por familia. Las imágenes de ingreso y planes proceden de KhypuPyme 1.
- La navegación agrupa las operaciones, la gestión y el archivo. Ayuda reúne los atajos, las guías por rubro y los calculadores de madera, cerámicas y cemento. En la práctica móvil, ir al formulario reduce la guía hasta confirmar el paso.
- Las compras, ventas y cotizaciones mantienen el borrador y el panel Revisar. Se recuperaron la búsqueda por lector, la consulta de medidas paginada y filtrada, las tarifas de madera por grupo, el servicio de corte y el alta conjunta de variantes.
- Se incorporaron entradas manuales de inventario, aportes y retiros de Caja, fiados manuales, reclamos de garantía y estados de entregas. Las operaciones sensibles usan la reautenticación existente. El servidor conserva la validación y la confirmación en una transacción por negocio.
- Documentos incorpora filtros por fechas y número, cliente o referencia. El informe PDF usa los mismos resultados que la pantalla. Las constancias de trabajo y despacho guardan sus datos al emitirlas y se vuelven a abrir desde el archivo.
- Quedan por recuperar el cambio de nombre desde Configuración, los pies de página personalizados y el archivo de informes emitidos con un número propio. Las versiones de la aplicación conservan bases independientes.

Pasaron ESLint, TypeScript y las compilaciones web y .NET. En PostgreSQL aislado se verificaron los 21 rubros, la repetición de solicitudes, la protección de correcciones, las devoluciones, las licencias y la conservación de las constancias. En Edge a 360 y 1440 px se verificaron el nuevo selector, los atajos, la búsqueda de documentos, la descarga del informe y, en el recorrido móvil de madera, el faltante, la minimización, Escape, el regreso al carrito y el avance de la práctica.

Los instaladores Android y Windows del piloto se regeneraron. Todavía apuntan al servicio previsto del piloto. Para revisar este cambio ahora, la web local está en `http://127.0.0.1:5282/`. Android físico, el piloto alojado y el regreso a la sesión instalada siguen pendientes de aceptación para esta revisión.


## Paridad operativa de los cuatro rubros principales

| Rubro | Referencia de 1.0 incorporada en 2.0 | Verificado |
|---|---|---|
| Maderas y barraca | Costo por pie tablar en compras nuevas, tres tarifas por largo, desglose editable, disponibilidad por medida y movimientos desde Almacén. | 4 piezas y Bs 403,33 con anchos 4, 5, 6 y 7. 4 piezas y Bs 550,00 con anchos 6, 7, 8 y 9. Costo acumulado de Bs 953,33. Compra anterior por pieza, venta mixta, PDF, borrador y práctica conservados. |
| Tienda 24/7 | Venta con lector, equivalencias, reposición y lotes vendibles, vencidos o apartados. | Dos cajas de 24 menos cinco unidades dejan 43. El carrito agrupa 25 más 19, muestra el faltante y excluye el lote vencido. Apartado y liberación con motivo. |
| Ropa y accesorios | Matriz talla/color, estado Sin stock y cambio desde la venta original con revisión de la diferencia. | Cambio rechazado sin stock, reposición por variante comprobada antes de cobrar y diferencia de Bs 20 confirmada. |
| Electrodomésticos | Almacén por unidad, historial y garantía, recepción rápida por series y resolución de inspección. | Serie duplicada detectada al recibir. Una unidad en inspección queda fuera del stock vendible hasta que el propietario confirme su liberación. |

- Almacén pagina productos y movimientos dentro del negocio. La consulta de disponibilidad usa un contrato de lectura, agrupa las cantidades por producto y medida, y distingue las series. La transacción comercial vuelve a comprobar el saldo. El historial continúa utilizando el comprobante de origen.
- Nuevas fichas sin código reciben MAD, TIE, ROP o ELE con un consecutivo por negocio. Los códigos manuales mantienen la búsqueda por lector. Clientes usa CLI; la migración asigna códigos a las fichas existentes de los cuatro rubros. Se comprobó la concurrencia, la idempotencia y el aislamiento entre negocios.
- La migración se aplicó a PostgreSQL de pruebas y de desarrollo. Pasaron ESLint, TypeScript, Vite, .NET y las suites 4, 5, 6 y 9, con recorridos en Edge a 360 y 1440 px y una comprobación del núcleo a 768 px. La revisión usa la web local en http://127.0.0.1:5282/.

## Rendimiento, tipografía y revisión de los 21 rubros

Almacén y la comprobación completa del carrito usan la misma base comercial en los 21 rubros. La vista previa suma líneas equivalentes, respeta el lote elegido, las series y las medidas, y conserva la venta bloqueada mientras falte una comprobación. Las cotizaciones permiten seguir con un aviso. La confirmación conserva la validación transaccional. El carrito también recupera sus fichas y tarifas en una petición por conjunto.

La interfaz usa tipografía del sistema de peso 400 para texto, 500 para controles y 600 para títulos e importes principales. Las pantallas de operación se cargan al abrirlas. Revisar permanece compacto en la esquina inferior derecha, con espacio reservado sobre la navegación móvil. Cerrar el diálogo devuelve el foco al carrito y conserva el desplazamiento.

### Medición repetible

`pwsh -File scripts/Test-Block4.ps1 -Block perf` usa `khypupyme2_test`, con un negocio ficticio de madera, 60 fichas, 100 medidas y 20 grupos. Compara 15 solicitudes por caso después de una inicial. La cuenta y las operaciones de la muestra se retiran al terminar. El conteo incluye cinco comandos de autorización y contexto por petición.

| Consulta | SQL antes → después | Mediana antes → después | P95 antes → después |
|---|---:|---:|---:|
| Inicio, tres peticiones | 23 → 19 | 18,77 → 18,14 ms | 51,12 → 41,41 ms |
| Búsqueda | 6 → 6 | 15,69 → 17,97 ms | 19,23 → 29,57 ms |
| Almacén | 7 → 7 | 18,28 → 19,90 ms | 20,09 → 42,18 ms |
| Carrito | 107 → 7 | 190,02 → 17,28 ms | 227,02 → 23,86 ms |
| Informes | 9 → 7 | 17,43 → 14,48 ms | 21,82 → 17,21 ms |

PostgreSQL examinó 60 fichas para devolver 21 filas en la consulta representativa de búsqueda y leyó dos movimientos en el periodo de la muestra. La consulta por medida examinó 100 filas y devolvió una. El plan agrupado leyó una vez esas 100 filas y devolvió las 100 coincidencias exactas. Con esta muestra se conservaron los índices existentes. Búsqueda y Almacén registraron tiempos mayores en la comparación local. [PostgreSQL · Planes de ejecución](https://www.postgresql.org/docs/current/using-explain.html)

El JavaScript inicial, incluidas las precargas del HTML, pasó de 479,99 a 360,23 kB, o de 145,94 a 116,59 kB comprimidos. Con cinco aperturas en frío por pantalla en Edge, Inicio pasó de 426,53 a 442,12 ms y Ventas de 355,22 a 412,75 ms. El ahorro de descarga y la mejora de la consulta del carrito se observaron de forma independiente del tiempo para abrir las pantallas. Los módulos grandes de PDF y fuentes se cargan al pedir el documento.

### Recorridos y validación con comerciantes

| Rubro | Recorrido y excepción comprobados con datos ficticios | Punto para revisar con comerciantes |
|---|---|---|
| Maderas y barraca | Tarifas por largo, compra de Bs 403,33 o Bs 550 con las medidas del ejemplo, comprobante mixto y faltante por ancho exacto. | Medidas y formatos de captura que anotan al recibir. |
| Tienda 24/7 | Lector, compra por caja, lotes próximos primero y vencidos excluidos, peso y volumen exactos. | Nivel de reposición y unidad más usada. |
| Ropa y accesorios | Matriz, cambio con diferencia y rechazo cuando falta la variante. | Orden de tallas y filtros usados al cambiar. |
| Electrodomésticos | Recepción por serie, garantía, duplicado e inspección bloqueada. | Datos que anotan al recibir una garantía. |
| Abarrotes y minimercado | Dos cajas de 24 menos cinco dejan 43 vendibles. El carrito coincide con la exclusión de vencidos. | Cómo nombran las presentaciones y capturan lotes. |
| Bebidas y distribuidora | Cajas más sueltos convertidos antes de vender. Envases y venta atómicos, con rechazo de devoluciones superiores al saldo previo. | Cómo registran diferentes tipos de envase. |
| Cosméticos y cuidado personal | Almacén busca por marca, presentación o tono. La duración tras apertura se guarda en la ficha y el vencimiento por lote. Apartado y baja protegidos. | Qué datos trae el envase y cómo separan los lotes. |
| Productos para mascotas | El carrito suma dos líneas del mismo lote elegido, muestra el faltante y conserva su fecha y costo al fraccionar. | Cómo identifican la bolsa de origen en el mostrador. |
| Calzado | Cambios con consulta actual de pares y rechazo por talla agotada. | Sistemas de talla que anotan en el local. |
| Electrónica y accesorios | Accesorio y equipo con serie en un comprobante. Serie en inspección visible antes de vender. | Uso de marca, modelo y números de garantía. |
| Ferretería y herramientas | Búsqueda en Almacén por referencia, medida y estante. Dos rollos de 50 m, venta de 12,5 m y devolución de 2,5 m. | Cómo declaran rollos empezados y ubicaciones. |
| Repuestos y accesorios de vehículos | Almacén combina equivalencias y filtros por vehículo y año. Una combinación fuera del rango queda excluida. | Origen y confirmación de las compatibilidades. |
| Librería y papelería | Artículos e impresión en un comprobante. Tres copias de cinco caras a doble cara usan 15 caras y nueve hojas. | Tarifas que usan por tamaño, color y cara. |
| Muebles y decoración | Cotización, venta y entrega vinculada. Despachar conserva las tres piezas restantes tras la venta. | Indicaciones de retiro o dirección que necesitan. |
| Cerámicas y revestimientos | El carrito verifica 10 cajas para 12 m² con 10 % de merma y valida tono y calibre antes de cobrar. | Cómo eligen tono y calibre cuando preparan un pedido. |
| Cementos y aglomerantes | Abrir dos bolsas de 50 kg traslada 100 kg y Bs 100 de valor. Almacén conserva el movimiento de origen y destino. | Cuándo abren bolsas y cómo anotan la pérdida. |
| Peluquería y belleza | Agenda, reprogramación, cruce rechazado, inasistencia y cobro único. | Duraciones que reservan entre servicios. |
| Limpieza y mantenimiento | Orden con dirección y materiales previstos, usados, a cobrar y de consumo interno. El trabajo entregado conserva su venta. | Qué materiales cobran y cuáles descargan con un ajuste. |
| Servicios profesionales | Entregables y compromiso, aprobación del presupuesto y cobro único. | Cómo registran la entrega y aceptación del cliente. |
| Taller y reparación | Constancia de recepción, diagnóstico, mano de obra y repuesto, entrega y vínculo a la misma venta. | Qué accesorios y estados anotan al recibir el equipo. |
| Artesanía y productos terminados | Venta de piezas listas y encargo con especificaciones y fecha. La entrega queda en la orden original. | Qué campos necesitan para definir el encargo. |

Referencias de operación consultadas. [Loyverse · Compra por caja](https://support.loyverse.com/en/articles/3961065-how-to-purchase-items-by-boxes-and-sell-them-by-the-piece) · [Odoo · Lotes y vencimientos](https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/inventory/shipping_receiving/removal_strategies/fefo.html) · [Shopify POS · Cambios](https://help.shopify.com/en/manual/sell-in-person/shopify-pos/order-management/exchange) · [Coca-Cola Bolivia · Retornabilidad](https://www.micoca-cola.bo/retornabilidad) · [FDA · Vida útil de cosméticos](https://www.fda.gov/cosmetics/cosmetics-labeling/shelf-life-and-expiration-dating-cosmetics) · [Galba · Cable por metro](https://galba.com.bo/producto/cable-flexible-4-mm-por-metro/) · [Marazzi · Cobertura](https://www.marazzigroup.com/installation/laying-solutions/) · [Square · Agenda](https://squareup.com/help/us/en/article/5354-square-appointments-guide) · [Odoo · Órdenes de reparación](https://www.odoo.com/documentation/master/applications/inventory_and_mrp/repairs/repair_orders.html).

### Verificación y paquetes

- Pasaron ESLint, TypeScript y las compilaciones de Vite y .NET Release. En PostgreSQL aislado y Edge pasaron los bloques 4, 5, 6 y 7A–7D. Incluyeron carrera por la última unidad, repetición de la solicitud, rechazo de registros de otro negocio y comprobantes descargados. La revisión de teclado y tacto simulado a 360, 768 y 1440 px recuperó el foco del carrito sin mover el desplazamiento al minimizar.
- Se restauró un respaldo anterior en PostgreSQL separado, se aplicó la migración y coincidieron las huellas de existencias, documentos y auditoría. Se guardó un respaldo legible de la sesión local antes de aplicar la migración a desarrollo. La comprobación del perfil de piloto en Production local pasó con PostgreSQL TLS, rol limitado y recuperación de claves tras reiniciar.
- Instaladores generados en `artifacts/optimizacion-2.0`. Android usa `KhypuPyme2-Piloto-Android.apk`, con firma de desarrollo validada. Windows x64 usa `KhypuPyme2-Piloto-Windows.exe`. Ambos apuntan al origen previsto del piloto en Render. Android físico y la aceptación del entorno alojado quedan pendientes.

## Reglas de operación por negocio

- En Configuración se puede elegir la forma de pago inicial de compras y ventas, fijar el descuento máximo, definir la vigencia de nuevas cotizaciones y activar o desactivar los fiados nuevos. Los ocho rubros que admiten lotes también pueden elegir el plazo de aviso en Inicio e Inventario. Cada uno de los 21 rubros tiene dos accesos a sus herramientas y un enlace a su guía.
- Cada cambio requiere confirmar identidad y registrar un motivo. La autorización corresponde al contenido, al titular, al negocio y a una solicitud. El servidor registra la configuración anterior y el cambio solicitado, rechaza revisiones obsoletas y devuelve el mismo resultado al repetir una solicitud confirmada.
- Las cotizaciones emitidas conservan su vigencia y su descuento si se convierten en las condiciones originales. Los fiados anteriores siguen visibles y se pueden cobrar. La migración conserva el comportamiento inicial con efectivo, hasta 100 % de descuento, siete días para cotizar, fiados habilitados y 30 días de aviso.
- Pasaron .NET Release, ESLint, TypeScript, Vite y los bloques 4, 5 y 9. En PostgreSQL se comprobaron límites de descuentos y fiados, reintento, rechazo de otra cuenta y de otro negocio, revisiones obsoletas, cotizaciones históricas y filtros de vencimiento. Edge verificó el guardado protegido, la recarga, la forma de pago inicial y el ancho disponible a 360, 768 y 1440 px.
- Se actualizó también un respaldo anterior en PostgreSQL aislado. Las huellas de existencias, documentos y auditoría coincidieron antes y después. Después de validar una copia de desarrollo, se aplicó la migración local y se conservaron las fichas, los documentos, la auditoría y las preferencias previas.
- Paquetes generados en `artifacts/reglas-por-negocio`. Se verificó la firma de desarrollo de Android. Los paquetes apuntan al piloto alojado y estas reglas están disponibles en la API local. La verificación de esta revisión en Android físico y Windows instalado queda pendiente, incluida la descarga del PDF y el reingreso en Windows.
- Total de 22.112 líneas físicas. C# de la API 6.215, frontend 7.961, migraciones con C# y SQL 2.993, integración nativa 619, pruebas 4.057 y utilidades 267. Se excluyen dependencias, contratos generados, diseñadores de migraciones y archivos de compilación.

## Operación diaria de los 17 rubros

- Se contrastaron los recorridos con referencias de fabricantes, comercios y herramientas del sector. El estudio incluye un ejemplo en BOB y una pregunta para validar con comerciantes por rubro. [Estudio y guía de mantenimiento](docs/OPERACION-POR-RUBRO.md)
- Inicio presenta tres tareas por rubro y pendientes calculados desde sus registros. Envases agrega búsqueda por cliente y tipo. Despachos filtra por fecha operativa, modalidad y estado. Lotes distingue vencidos, próximos a vencer y apartados. Agenda y Órdenes permiten buscar por cliente y consultar los próximos siete días.
- Cancelar una cita libera el horario con motivo y confirmación de identidad. Taller conserva el repuesto pendiente en la orden y exige reanudar antes de marcarla lista. Se reutilizaron las consultas por negocio, los comandos transaccionales, la autorización y la auditoría existentes.
- Pasaron .NET Release, ESLint, TypeScript, Vite y los bloques 7A, 7B, 7C y 7D en PostgreSQL. Edge abrió los 17 inicios a 360, 768 y 1440 px. También se comprobó el ingreso y la navegación desde Inicio a envases, despachos, repuestos pendientes, próximos trabajos, cambios y lotes vencidos.
- La revisión web local se abrió en `http://127.0.0.1:5284/` con el comando `pwsh -File scripts/Start-Api.ps1 -Port 5284 -IncludeWeb`. Se preparó una cuenta ficticia independiente con los 17 negocios y acceso de demostración. Los comercios de ejemplo se crean mediante la API y las credenciales se conservan fuera del repositorio.
- Total de 22.710 líneas con el criterio anterior. C# de la API 6.336, frontend 8.195, migraciones 2.993, integración nativa 619, pruebas 4.093 y utilidades 474.
