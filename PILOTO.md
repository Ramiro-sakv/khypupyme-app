# Piloto privado de KhypuPyme 2.0

La web y la API viven en el mismo servicio HTTPS de Render. Neon mantiene PostgreSQL, las cuentas y las claves cifradas que permiten recuperar sesiones tras un reinicio. Android y Windows llevan la misma interfaz web empaquetada. El ingreso abre el navegador y regresa por un enlace exclusivo de Android o por el puerto local 43823 en Windows. Las licencias y tarjetas son de demostración.

## Arranque local

En una terminal, ejecuta `pwsh -File .\scripts\Start-Api.ps1`. En otra, ejecuta `pnpm --dir web dev`. Abre `http://127.0.0.1:5282`. Los códigos llegan al buzón local descrito en [README.md](README.md). Los instaladores del piloto apuntan a Render.

## Activación desde las cuentas del titular

1. En **Neon**, crea un proyecto independiente de PostgreSQL 18. En **Databases**, crea `khypupyme2_pilot` con el rol propietario de Neon. En **Connect**, desactiva **Connection pooling** y conserva el host directo, la base y el usuario administrador para la preparación. [Conexión de Neon](https://neon.com/docs/connect/connect-from-any-app)
2. Con la conexión directa del propietario aplica las migraciones mediante `dotnet run --project server/KhypuPyme.Api -c Release --no-launch-profile -- --migrate-pilot`. Antes de ejecutar, define temporalmente `ConnectionStrings__KhypuPyme` en PowerShell con `Host=HOST;Database=khypupyme2_pilot;Username=PROPIETARIO;Password=CONTRASEÑA;SSL Mode=VerifyFull`. Usa `Read-Host -AsSecureString` para la contraseña y un `NpgsqlConnectionStringBuilder` si contiene caracteres reservados. Retira la variable de entorno al terminar.
3. Desde `psql`, conectado como propietario a esa base, crea el rol de ejecución con `CREATE ROLE khypupyme2_pilot_app LOGIN;` y fija su clave con `\password khypupyme2_pilot_app`. En esa conexión, ejecuta `REVOKE CONNECT ON DATABASE khypupyme2_pilot FROM PUBLIC;` y `GRANT CONNECT ON DATABASE khypupyme2_pilot TO khypupyme2_pilot_app;`. Desde la raíz del repositorio, carga los permisos con `\set app_name khypupyme2_pilot_app` y `\i scripts/grant-application.sql`. Conserva separadas las dos claves. Render usará el rol limitado, y el propietario quedará para administrar la base y sus respaldos. [Roles en Neon](https://neon.com/docs/manage/roles)
4. En **Resend**, crea una clave de envío y elige el remitente. Para probar solo con tu propio correo puedes usar `onboarding@resend.dev` si es el correo de tu cuenta de Resend. Para invitar otras direcciones, verifica un dominio remitente. La entrega usa HTTPS. [Envío de correo con Resend](https://resend.com/docs/api-reference/emails/send-email) · [Restricción del dominio de prueba](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain)
5. Genera el certificado interno y guárdalo en un lugar privado con su contraseña. En PowerShell 7 puedes ejecutar `$cert = New-SelfSignedCertificate -Subject 'CN=KhypuPyme2 Pilot Keys' -KeyAlgorithm RSA -KeyLength 3072 -KeyUsage DigitalSignature,KeyEncipherment,DataEncipherment -KeyExportPolicy Exportable -CertStoreLocation Cert:\CurrentUser\My -NotAfter (Get-Date).AddYears(2)` y después `Export-PfxCertificate -Cert $cert -FilePath "$env:LOCALAPPDATA\KhypuPyme2.0\pilot.pfx" -Password (Read-Host 'Contraseña del PFX' -AsSecureString)`. El valor en base64 se obtiene con `[Convert]::ToBase64String([IO.File]::ReadAllBytes("$env:LOCALAPPDATA\KhypuPyme2.0\pilot.pfx"))`. Conserva el mismo PFX entre despliegues y guárdalo separado de su contraseña. Render proporciona el certificado HTTPS público del sitio.
6. Una vez autorizado subir **el commit del piloto a una rama remota**, en Render elige **New → Blueprint**. Conecta esa rama y usa `render.yaml`. Configura las variables de la tabla. El servicio es independiente del piloto anterior, parte en **Free** y tiene el despliegue automático desactivado. El plan gratuito puede dormirse y tardar en abrir. [Blueprint de Render](https://render.com/docs/infrastructure-as-code) · [Servicios gratuitos](https://render.com/docs/free)

| Variable en Render | Valor |
|---|---|
| `ConnectionStrings__KhypuPyme` | Conexión directa a `khypupyme2_pilot` con `SSL Mode=VerifyFull` y usuario `khypupyme2_pilot_app`. |
| `Pilot__AllowedEmails` | Correos invitados, separados por comas. |
| `Pilot__CertificateBase64` y `Pilot__CertificatePassword` | El PFX interno en base64 y su contraseña. |
| `Mail__From` y `Mail__Token` | Remitente habilitado y clave Resend con permiso de envío. |

Render da la URL canónica a la aplicación mediante `RENDER_EXTERNAL_URL`. Cuando el servicio esté disponible, abre `/api/v1/health/database` en esa URL. Antes de compartir los instaladores, comprueba que coincida con la base HTTPS empaquetada. [Variables de Render](https://render.com/docs/environment-variables#render_external_url)

## Instaladores

Desde PowerShell, con Node/pnpm instalados y las herramientas de Android y Windows disponibles, ejecuta `pwsh -File .\scripts\Build-Pilot.ps1 -ApiOrigin https://khypupyme2-piloto.onrender.com`. Usa la URL real de Render si asigna otra. El script produce estos dos archivos en `artifacts/pilot`:

| Archivo | Uso |
|---|---|
| `KhypuPyme2-Piloto-Android.apk` | Instalación directa con firma de desarrollo. |
| `KhypuPyme2-Piloto-Windows.exe` | Instalador NSIS del piloto con identidad separada. Sin firma comercial. |

## Respaldo y validación

- En Neon, realiza un respaldo con `pg_dump -Fc` usando la conexión directa TLS del propietario. Guarda el archivo fuera de Git. Restaura con `pg_restore --exit-on-error --no-owner --no-acl` en una base de comprobación separada. Verifica allí el negocio, el historial, sus importes, la licencia y los registros de auditoría. Si se abre un servicio contra la restauración, configura su rol de ejecución y conserva el certificado original para leer las claves de sesión.
- En cada plataforma, ingresa con un correo invitado, selecciona el mismo negocio ficticio y verifica la misma vigencia de demostración. Registra una venta ficticia con un identificador distinto por plataforma, guarda su PDF y descarga el historial. Cierra sesión, abre de nuevo e ingresa desde el navegador. En Android físico repite también después de cerrar el proceso. En Windows repite con la app cerrada y con una sesión anterior del navegador.
- En un negocio alterno, verifica que un registro de otro negocio se rechace. Repite una solicitud confirmada y comprueba que exista una sola venta. Después reinicia el servicio Render para comprobar la recuperación del inicio de sesión y de las solicitudes pendientes. El resultado local de cada comprobación está en [PROGRESO.md](PROGRESO.md).

Para repetir la comprobación del perfil hospedado en Windows sin cuentas externas, prepara una carpeta de compilación con la web en `wwwroot` y ejecuta estos comandos en PowerShell 7 desde la raíz:

```powershell
$output = Join-Path $PWD 'artifacts/pilot-web-check'
dotnet publish server/KhypuPyme.Api -c Release -o $output
pnpm --dir web exec vite build --outDir (Join-Path $output 'wwwroot')
.\scripts\Test-PilotProfile.ps1 -PublishedWebDirectory $output
.\scripts\Test-Block9.ps1 -RestoreBackup
```

`Test-PilotProfile` crea una instancia PostgreSQL desechable para verificar el perfil Production con conexiones TLS, un rol limitado y un reinicio. La prueba de restauración usa los registros ficticios de la base de pruebas y un destino aparte.
