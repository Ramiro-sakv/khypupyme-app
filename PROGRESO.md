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
