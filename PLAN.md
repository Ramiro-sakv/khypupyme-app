# KhypuPyme2.0 · Plan completo y prompts de implementación

## 1. Qué vamos a construir

**Una nueva KhypuPyme con C# en el servidor, React y TypeScript en la interfaz, y PostgreSQL como base de datos.** La aplicación actual servirá para comprobar qué hace cada función, cómo se usa y qué resultados debe producir la nueva.

El proyecto se creará en **`C:\Users\ramir\OneDrive\Documentos\ChatGPT\KhypuPyme2.0`**, al lado de la carpeta actual. Usaremos una rama local independiente, `feat/khypupyme-2-0`, en un espacio de trabajo separado de Git. La referencia funcional será la versión actual del proyecto, commit **`5147dfd`**. Empezaremos con cuentas nuevas y datos ficticios que se puedan cargar por elección.

La meta incluye **los 21 rubros**, una web y aplicaciones instalables para **Android y Windows**. La primera entrega por internet será un **piloto privado**, con un flujo de pago de apariencia realista en el que se utilizan tarjetas de prueba. Se mantienen español, bolivianos, hora de Bolivia, un propietario por negocio y operación con internet.

**Puedes enviar un prompt por bloque en este mismo chat.** El primer bloque guardará `PLAN.md` y `PROGRESO.md` en el proyecto nuevo. En esos archivos quedarán el plan, las decisiones, lo verificado y el último bloque terminado. Esto permite seguir incluso si cambias de chat. Envía el siguiente prompt cuando termine y se verifique el bloque anterior.

### Tamaño probable del proyecto

El conteo previo de KhypuPyme fue de **36.847 líneas de aplicación y código compartido**, más **4.213 de pruebas**. Para 2.0 usaría este presupuesto inicial:

| Parte | Estimación | Dónde va el trabajo |
|---|---:|---|
| Interfaz React, TypeScript y CSS | 22.000–27.000 | Pantallas compartidas, diseño adaptable y recorridos de los 21 rubros. |
| Servidor C# | 11.000–15.000 | Cuentas, permisos, servicios comerciales, API, informes y licencias. |
| SQL escrito a mano | 1.000–3.000 | Restricciones, índices, aislamiento y consultas especializadas. |
| Empaquetado y operación | 1.000–2.000 | Android, Windows, automatización y despliegue. |
| **Aplicación** | **35.000–47.000** | Código propio, con archivos generados y dependencias excluidos. |
| Pruebas | 6.000–10.000 | Reglas, PostgreSQL, seguridad y recorridos de usuario. |
| **Total estimado** | **41.000–57.000** | Rango para repartir el trabajo. |

Las líneas sirven para estimar esfuerzo. **La medida principal será cuántos recorridos completos podemos reproducir y verificar.** Después de cerrar la venta de madera, revisaremos cuánto costó implementar ese recorrido y ajustaremos el resto.

## 2. Decisiones técnicas que guían todos los bloques

| Parte | Decisión |
|---|---|
| **Servidor** | ASP.NET Core sobre **.NET 10**, en una sola aplicación con módulos por responsabilidad. La API recibe y valida datos, los servicios coordinan operaciones, el dominio aplica las reglas y la infraestructura persiste en PostgreSQL. |
| **Interfaz** | **React + TypeScript + Vite**. Un mismo frontend para web, Android con Capacitor y Windows con Tauri. El cliente tipado se genera desde **OpenAPI** y consume `/api/v1`. |
| **Base de datos** | **PostgreSQL 18**, EF Core y Npgsql. Migraciones versionadas y probadas desde una base vacía y desde la versión anterior. Separar usuario de migraciones y usuario de ejecución. [EF Core](https://learn.microsoft.com/en-us/ef/core/managing-schemas/migrations/) · [Npgsql](https://www.npgsql.org/efcore/) |
| **Alojamiento** | Desarrollo local en Windows. Piloto con web y API en **Render**, PostgreSQL alojado en **Neon** y las apps instaladas conectadas a la misma URL HTTPS. [Render](https://render.com/docs/web-services) · [Neon](https://neon.com/pricing) |

### Base de datos y lógica comercial

- **Tablas por responsabilidad.** Separar usuarios, negocios, clientes, productos, variantes, medidas, lotes, series, compras, ventas, líneas, devoluciones, movimientos, caja, documentos y licencias. Los datos específicos de cada rubro se incorporan donde hacen falta. Un gasto, una compra de mercadería y un pago de licencia tendrán registros y efectos distintos.
- **Negocios aislados.** Cada registro comercial identifica su negocio. Las referencias entre tablas exigen que ambos registros pertenezcan al mismo espacio. El servidor comprueba el propietario a partir de la sesión y PostgreSQL aplica políticas por fila sobre las tablas comerciales. La conexión establece el contexto del negocio dentro de la transacción. [Políticas por fila de PostgreSQL](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- **Ventas completas o rechazadas.** Una transacción registra la venta, descuenta stock, afecta caja o fiado y genera el registro del comprobante. La comprobación final de existencias ocurre dentro de esa transacción. El mismo identificador con el mismo contenido recupera el resultado original. Usarlo con contenido distinto o en otro negocio devuelve un conflicto.
- **Importes reproducibles.** Dinero en centavos enteros y cantidades con precisión exacta. Desgloses y conversiones se guardan con el comprobante. Los redondeos de pantalla se aplican después del cálculo. El PDF se regenera desde el registro confirmado. Devoluciones y ajustes enlazan la operación original y conservan su historial.
- **Errores accionables.** Una respuesta informa qué falló, qué puede hacer el usuario y, cuando sirva para investigar, un código y una referencia. Si se pierde la respuesta a una venta, la app conserva la solicitud y ofrece consultar su estado. El reintento es manual y conserva el mismo identificador.

### Cuentas, correcciones y diseño

- **Cuentas nuevas en PostgreSQL.** ASP.NET Core Identity gestiona usuarios, contraseñas y recuperación. El alta por correo pide un código de **cinco dígitos**, válido por diez minutos, con cinco intentos, espera de un minuto entre reenvíos y máximo de tres envíos por hora. Reenviar invalida el código anterior. El entorno local utiliza un buzón de desarrollo. **Continuar con Google** se vincula a la cuenta usando un flujo explícito cuando ya existe el correo. [ASP.NET Core Identity](https://learn.microsoft.com/en-us/aspnet/core/security/authentication/identity)
- **Sesión por plataforma.** Web con cookies protegidas y protección contra solicitudes de otros sitios. Android y Windows abren el navegador del sistema y vuelven a la aplicación mediante autorización con PKCE. El dispositivo guarda las credenciales de sesión en almacenamiento protegido. [OpenIddict y PKCE](https://documentation.openiddict.com/configuration/proof-key-for-code-exchange.html)
- **Correcciones protegidas.** Antes de ajustar stock o caja, devolver, anular o modificar una ficha existente, mostrar negocio, efecto y motivo. La autorización es de un solo uso, dura dos minutos y queda vinculada a esa operación. Se confirma con contraseña o código de correo para una cuenta que solo usa Google. El borrado de un negocio tiene su propia confirmación, bloqueo y limpieza reanudable.
- **Pantallas de trabajo.** Inicio muestra primero el negocio activo, Caja y las acciones del rubro. La gráfica de ventas y gastos permanece accesible, con compras como serie opcional. Cada rubro tiene su identidad visual y sus controles prioritarios. El carrito conserva los datos al cerrar o minimizar la pestaña **Revisar**. La interfaz muestra pedido, disponible y faltante antes de cobrar. Cambiar cantidad, precio o descuento obliga a revisar el importe actualizado.

## 3. Prompts listos para enviar, en orden

### Prompt 1 · Carpeta nueva, solución y PostgreSQL

> Implementa el bloque 1 de KhypuPyme2.0. Crea `C:\Users\ramir\OneDrive\Documentos\ChatGPT\KhypuPyme2.0` como espacio de trabajo separado de Git en `feat/khypupyme-2-0`, con historial propio y tomando `5147dfd` como referencia de la aplicación anterior. Guarda el plan de este chat en `PLAN.md` y registra el avance en `PROGRESO.md`. Prepara ASP.NET Core .NET 10, React con TypeScript, OpenAPI, EF Core y Npgsql. Instala PostgreSQL 18 local y prepara bases separadas de desarrollo y pruebas en loopback. Entrega el arranque reproducible, una página que consulte el estado de la API y una comprobación independiente de disponibilidad de PostgreSQL. Verifica la compilación y que las migraciones arranquen desde una base vacía. Cierra con un commit local.
