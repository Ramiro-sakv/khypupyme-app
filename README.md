# KhypuPyme 2.0

Base local con ASP.NET Core sobre .NET 10, React con TypeScript y PostgreSQL 18.
Incluye el ingreso y el selector **Mis negocios**. **Estado local** comprueba la API y PostgreSQL por separado.
La aplicación de referencia está en el commit `5147dfd` de la rama `chore/entrega-docente`.

## Preparación en Windows

Requiere el SDK .NET 10.0.403, Node.js 24, pnpm 11.25.0 y PostgreSQL 18
con las herramientas de línea de comandos. El servidor local se conecta a
`127.0.0.1:5432`. Desde la raíz del proyecto, ejecuta en PowerShell:

```powershell
dotnet tool restore
dotnet restore KhypuPyme.slnx --locked-mode
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Initialize-Postgres.ps1
.\scripts\Update-Database.ps1
pnpm --dir web install --frozen-lockfile
```

En la preparación, escribe la contraseña de PostgreSQL en la terminal si se solicita.
El script crea `khypupyme2_dev` y `khypupyme2_test`, con un rol de migración y otro
de aplicación para cada una. Genera sus credenciales y las cifra para tu usuario
de Windows en `%LOCALAPPDATA%\KhypuPyme2.0\postgres-local.json`.

## Arrancar

Abre dos terminales en la raíz:

```powershell
# Terminal 1
.\scripts\Start-Api.ps1
```

```powershell
# Terminal 2
pnpm --dir web dev
```

Abre [KhypuPyme 2.0](http://127.0.0.1:5282/). La API de desarrollo usa
`127.0.0.1:5182`. Para arrancar con la base de pruebas y el puerto 5183,
ejecuta `.\scripts\Start-Api.ps1 -Database Test`.

## Ingreso y negocios

Para registrar una cuenta o recuperar la contraseña, solicita el código desde el portal.
En desarrollo, el mensaje se guarda en `%LOCALAPPDATA%\KhypuPyme2.0\mailbox`.
Abre el JSON más reciente para tu correo y copia los cinco dígitos al formulario.
El código tiene diez minutos de vigencia y la contraseña requiere al menos doce caracteres.

Después de ingresar, **Mis negocios** permite buscar, paginar y crear un negocio en tres pasos.
El último negocio seleccionado se abre al volver a ingresar. El rubro queda fijo desde el alta.

## Núcleo comercial

Desde Inicio, abre caja para operar con efectivo, crea un producto en Catálogo y registra una compra
para darle existencias. En Ventas, añade productos y abre **Revisar** para elegir cliente y forma de pago,
verificar el total y confirmar. El historial permite abrir el comprobante no fiscal o descargar su PDF.

Si una operación queda incierta, usa **Consultar estado**. La app conserva su solicitud original
y permite reintentar cuando el servidor todavía no la registra.

### Google y clientes instalados

**Continuar con Google** se habilita cuando el servidor recibe `Google__ClientId` y
`Google__ClientSecret`. Para probar desde la web local, registra
`http://127.0.0.1:5282/signin-google` como URL de retorno en el cliente OAuth de Google.
Una cuenta existente con el mismo correo debe ingresar y usar **Vincular Google**.

La actualización local de la base registra `khypupyme-windows` y `khypupyme-android`.
El navegador autoriza en `/connect/authorize`. El cliente intercambia el código en
`/connect/token` mediante PKCE S256, conserva el token en el almacenamiento protegido
de su plataforma y puede revocarlo en `/connect/revoke`. Windows usa
`http://127.0.0.1:43823/callback`. El retorno Android de desarrollo es
`bo.khypupyme.app:/oauth/callback`, configurable con `NativeAuth__AndroidRedirectUri`.
Los tokens de este flujo local usan claves efímeras y requieren un nuevo ingreso tras reiniciar la API.
El piloto alojado requerirá claves persistentes y verificar el retorno y el almacenamiento en cada instalador.

## Comprobar

- `GET /api/v1/health/api` verifica que la API responde.
- `GET /api/v1/health/database` verifica el acceso a PostgreSQL y al esquema migrado.
- `GET /openapi/v1.json` sirve el contrato en el perfil de desarrollo de la API.
- `& 'C:\Program Files\PostgreSQL\18\bin\pg_isready.exe' -h 127.0.0.1 -p 5432` comprueba PostgreSQL directamente.

Si cambia el contrato, compila y regenera los tipos de TypeScript.

```powershell
dotnet build KhypuPyme.slnx
pnpm --dir web generate:api
pnpm --dir web lint
pnpm --dir web typecheck
pnpm --dir web build
```

El recorrido de cuentas y negocios usa PostgreSQL real en la base de pruebas y un buzón temporal.
El puerto 5183 debe estar libre.

```powershell
.\scripts\Update-Database.ps1 -Database Test
.\scripts\Test-Block2.ps1
```

Para verificar el núcleo comercial en la base de pruebas, con el puerto 5183 libre:

```powershell
.\scripts\Update-Database.ps1 -Database Test -Configuration Release
.\scripts\Test-Block4.ps1
```

Alcance y referencia en [PLAN.md](PLAN.md). Resultados en [PROGRESO.md](PROGRESO.md).
