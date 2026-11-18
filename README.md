# KhypuPyme 2.0

Bloque 1. Base local con ASP.NET Core sobre .NET 10, React con TypeScript y PostgreSQL 18.
La página **Estado local** comprueba la API y PostgreSQL por separado.
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

Abre [Estado local](http://127.0.0.1:5282/). La API de desarrollo usa
`127.0.0.1:5182`. Para arrancar con la base de pruebas y el puerto 5183,
ejecuta `.\scripts\Start-Api.ps1 -Database Test`.

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

Alcance y referencia en [PLAN.md](PLAN.md). Resultados en [PROGRESO.md](PROGRESO.md).
