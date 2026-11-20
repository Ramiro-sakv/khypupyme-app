# KhypuPyme 2.0

Base local con ASP.NET Core sobre .NET 10, React con TypeScript y PostgreSQL 18.
Incluye el ingreso y el selector **Mis negocios**. **Estado local** comprueba la API y PostgreSQL por separado.
La aplicación de referencia está en el commit `5147dfd` de la rama `chore/entrega-docente`.

Para los instaladores privados y la configuración de Render y Neon, consulta [PILOTO.md](PILOTO.md).

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

## Primer parcial de Práctica Interna

La entrega está identificada por la etiqueta [parcial1-khypupyme2-v1](https://github.com/Ramiro-sakv/khypupyme-app/tree/parcial1-khypupyme2-v1). El [registro de verificación](docs/PARCIAL1.md) relaciona los criterios del parcial con el dossier y el código.

### Abrir la demostración en una instalación local

Completa la preparación de Windows de arriba. Las credenciales y el buzón se generan en tu equipo. Ejecuta en PowerShell:

```powershell
dotnet build KhypuPyme.slnx -c Release --no-restore
pnpm --dir web build
.\scripts\Start-Api.ps1 -Port 5284 -IncludeWeb
```

Abre [KhypuPyme 2.0 en el puerto 5284](http://127.0.0.1:5284/). Si quieres comprobar la conexión, visita [Estado de PostgreSQL](http://127.0.0.1:5284/api/v1/health/database) y busca el estado **available**. Si el puerto está ocupado, elige otro puerto libre y usa la nueva dirección. Mantén abierta la terminal mientras usas la app y pulsa Ctrl+C al terminar.

### Cargar datos ficticios y repetir los casos

1. Registra una cuenta nueva con un correo terminado en **@example.test**. Usa el código del buzón local, ingresa y crea **Sicomoro · Demostración** con rubro **Maderas y barraca** y medidas en pulgadas y pies. Activa la prueba desde el plan.
2. Abre Caja con **Bs 1.000**. En Inventario → Catálogo, crea **Tabla seca**, especie **Pino**, con tarifas de **Bs 8**, **Bs 9** y **Bs 10** por pie tablar según el largo. Puedes dejar el código vacío para que se genere.
3. En Compras, añade Tabla seca. Indica largo **10 pies**, espesor **2 pulgadas**, anchos **10x6** y costo **Bs 5 por pie tablar**. Pulsa **Revisar compra**, elige efectivo, marca la revisión del importe y confirma **Bs 500**. Quedan 10 piezas y **Bs 500** en Caja.
4. En Ventas, elige Tabla seca y **Elegir medida disponible**. Selecciona la medida y cambia la cantidad a **2**. Revisa y confirma **Bs 200** en efectivo. Recarga, abre el historial de ventas y descarga el PDF de esa venta. Comprueba **8 piezas** en Almacén y **Bs 700** en Caja.
5. Abre otra venta para la misma medida y solicita **9**. Verifica **Pedido 9 · Disponible 8 · Faltan 1** y abre **Revisar venta**. La confirmación debe quedar deshabilitada. Al volver a consultar Almacén, Caja e historial deben quedar ocho piezas, Bs 700 y una sola venta.

### Repetir la comprobación dirigida

Con Microsoft Edge instalado, la compilación web y .NET en Release completadas y el puerto 5183 libre, ejecuta:

```powershell
.\scripts\Update-Database.ps1 -Database Test -Configuration Release
$parcialTools = Join-Path $env:TEMP 'khypupyme-parcial1-tools'
npm install --prefix $parcialTools --no-save --no-package-lock --ignore-scripts playwright-core@1.62.1
$env:KHYPU_TEST_PLAYWRIGHT = Join-Path $parcialTools 'node_modules/playwright-core/index.mjs'
.\scripts\Test-Parcial1.ps1
```

El script registra una cuenta temporal, carga únicamente la ficha del ejemplo, abre Caja y registra la compra y la venta desde Edge. Verifica los saldos contra PostgreSQL, guarda el PDF desde el historial y exige un rechazo HTTP 409 al pedir más stock del disponible. Usa únicamente la base **khypupyme2_test** y retira la cuenta ficticia al final. Guarda el comprobante y el resultado en **artifacts/parcial1**.
