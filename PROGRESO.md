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

El siguiente alcance es **Bloque 3 · Diseño, Inicio y navegación**, cuando el propietario lo indique.
