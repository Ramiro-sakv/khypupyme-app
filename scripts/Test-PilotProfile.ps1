param([Parameter(Mandatory)][string]$PublishedWebDirectory)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Postgres.Local.ps1')
$published = (Resolve-Path -LiteralPath $PublishedWebDirectory).Path
$api = Join-Path $published 'KhypuPyme.Api.exe'
if (-not (Test-Path -LiteralPath (Join-Path $published 'wwwroot/index.html'))) { throw 'Falta la web publicada.' }

$directory = [IO.Directory]::CreateDirectory((Join-Path $env:TEMP ('khypu-pilot-profile-' + [Guid]::NewGuid().ToString('N')))).FullName
$cluster = Join-Path $directory 'pg'
$certFile = Join-Path $directory 'tls.crt'
$keyFile = Join-Path $directory 'tls.key'
$pfxFile = Join-Path $directory 'tls.pfx'
$initFile = Join-Path $directory 'secret.tmp'
$owner = 'khypu_test_owner'
$appRole = 'khypupyme2_pilot_app'
$ownerSecret = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
$appSecret = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
$process = $null
$running = $false

function Get-FreePort {
    $socket = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
    $socket.Start()
    try { $socket.LocalEndpoint.Port } finally { $socket.Stop() }
}

$dbPort = Get-FreePort
$origin = 'https://localhost:' + (Get-FreePort)
function Start-TestApi {
    Start-Process -FilePath $api -WorkingDirectory $published -ArgumentList @('--urls', $origin) -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput (Join-Path $directory 'api.log') -RedirectStandardError (Join-Path $directory 'errors.log')
}

function Wait-TestApi {
    foreach ($attempt in 1..60) {
        if ($process.HasExited) { throw "La API cerró durante el arranque. Registros en $directory." }
        try {
            if ((Invoke-RestMethod "$origin/api/v1/health/database" -SkipCertificateCheck -TimeoutSec 2).status -eq 'available') { return }
        } catch { Start-Sleep -Milliseconds 250 }
    }
    throw 'No respondió la comprobación de la base.'
}

$previous = @{}
function Set-TestVariables($settings) {
    foreach ($name in $settings.Keys) {
        if (-not $previous.ContainsKey($name)) { $previous[$name] = [Environment]::GetEnvironmentVariable($name) }
        [Environment]::SetEnvironmentVariable($name, $settings[$name])
    }
}

try {
    $rsa = [Security.Cryptography.RSA]::Create(3072)
    $request = [Security.Cryptography.X509Certificates.CertificateRequest]::new('CN=localhost', $rsa,
        [Security.Cryptography.HashAlgorithmName]::SHA256, [Security.Cryptography.RSASignaturePadding]::Pkcs1)
    $san = [Security.Cryptography.X509Certificates.SubjectAlternativeNameBuilder]::new()
    $san.AddDnsName('localhost')
    $request.CertificateExtensions.Add($san.Build())
    $cert = $request.CreateSelfSigned([DateTimeOffset]::UtcNow.AddDays(-1), [DateTimeOffset]::UtcNow.AddDays(2))
    [IO.File]::WriteAllText($certFile, $cert.ExportCertificatePem())
    [IO.File]::WriteAllText($keyFile, $rsa.ExportPkcs8PrivateKeyPem())
    [IO.File]::WriteAllBytes($pfxFile, $cert.Export([Security.Cryptography.X509Certificates.X509ContentType]::Pkcs12, $ownerSecret))
    [IO.File]::WriteAllText($initFile, $ownerSecret)
    & (Get-PostgresTool 'initdb') -D $cluster -U $owner -A scram-sha-256 --pwfile=$initFile -E UTF8 --locale=C --no-instructions | Out-Null
    if ($LASTEXITCODE) { throw 'No se pudo inicializar PostgreSQL de pruebas.' }
    Remove-Item -LiteralPath $initFile
    @"
ssl = on
ssl_cert_file = '$($certFile.Replace('\','/'))'
ssl_key_file = '$($keyFile.Replace('\','/'))'
"@ | Add-Content -LiteralPath (Join-Path $cluster 'postgresql.conf')
    & (Get-PostgresTool 'pg_ctl') start -D $cluster -l (Join-Path $directory 'postgres.log') -o "-h 127.0.0.1 -p $dbPort" -w
    if ($LASTEXITCODE) { throw "PostgreSQL no quedó disponible. Registros en $directory." }
    $running = $true
    $database = "Host=localhost;Port=$dbPort;Database=khypupyme2_pilot;SSL Mode=VerifyFull;Root Certificate=$certFile"
    Set-TestVariables @{
        PGPASSWORD = $ownerSecret; PGSSLMODE = 'verify-full'; PGSSLROOTCERT = $certFile
        ConnectionStrings__KhypuPyme = "$database;Username=$owner;Password=$ownerSecret"
        ASPNETCORE_ENVIRONMENT = 'Production'; DOTNET_ENVIRONMENT = 'Production'; Pilot__Enabled = 'false'
    }

    $psql = Get-PostgresTool 'psql'
    $connection = @('-h', 'localhost', '-p', $dbPort, '-U', $owner, '-w', '-X', '-v', 'ON_ERROR_STOP=1')
    "CREATE ROLE $appRole LOGIN PASSWORD '$appSecret';`nCREATE DATABASE khypupyme2_pilot;" | & $psql @connection -d postgres -q
    if ($LASTEXITCODE) { throw 'No se pudo crear el rol de prueba.' }
    & $api --migrate-pilot | Out-Null
    if ($LASTEXITCODE) { throw 'Falló la migración del piloto de prueba.' }
    & $psql @connection -d khypupyme2_pilot -q -v "app_name=$appRole" -f (Join-Path $PSScriptRoot 'grant-application.sql')
    if ($LASTEXITCODE) { throw 'No se pudieron aplicar los permisos de ejecución.' }
    Set-TestVariables @{
        ConnectionStrings__KhypuPyme = "$database;Username=$appRole;Password=$appSecret"
        Pilot__Enabled = 'true'; Pilot__Origin = $origin; Pilot__AllowedEmails = 'invitado@example.test'
        Pilot__CertificateBase64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($pfxFile))
        Pilot__CertificatePassword = $ownerSecret; Pilot__UseRenderProxy = 'false'
        Mail__Token = 'sin-envio'; Mail__From = 'test@example.test'
        ASPNETCORE_Kestrel__Certificates__Default__Path = $pfxFile
        ASPNETCORE_Kestrel__Certificates__Default__Password = $ownerSecret
    }

    $process = Start-TestApi
    Wait-TestApi
    $webPage = Invoke-WebRequest $origin -SkipCertificateCheck
    if ($webPage.Content -notmatch 'KhypuPyme') { throw 'La API no sirvió la web.' }
    $token = (Invoke-RestMethod "$origin/api/v1/auth/csrf" -SkipCertificateCheck -SessionVariable clientSession).token
    Stop-Process -InputObject $process
    $null = $process.WaitForExit(5000)
    $process = Start-TestApi
    Wait-TestApi
    $response = Invoke-WebRequest "$origin/api/v1/auth/register/code" -SkipCertificateCheck -WebSession $clientSession -Method Post `
        -Headers @{'X-CSRF-TOKEN' = $token} -ContentType 'application/json' -Body '{"email":"no-invitado@example.test"}' -SkipHttpErrorCheck
    if ($response.StatusCode -ne 403) { throw "Se esperaba 403 después del reinicio. Se obtuvo $($response.StatusCode)." }
    $encrypted = & $psql @connection -d khypupyme2_pilot -Atq -c "SELECT EXISTS (SELECT 1 FROM khypupyme.pilot_key_ring WHERE payload LIKE '%encryptedSecret%');"
    if ($LASTEXITCODE -or $encrypted -ne 't') { throw 'Falta la clave de sesión cifrada.' }
    Write-Host 'Perfil Production local: PostgreSQL TLS, rol limitado, web HTTPS, filtro de invitación y claves cifradas recuperadas tras reiniciar.'
} finally {
    if ($process -and -not $process.HasExited) { Stop-Process -InputObject $process; $null = $process.WaitForExit(5000) }
    if ($running) { & (Get-PostgresTool 'pg_ctl') stop -D $cluster -w -m fast | Out-Null }
    foreach ($path in @($initFile, $keyFile, $pfxFile)) {
        if (Test-Path -LiteralPath $path) { Remove-Item -LiteralPath $path }
    }
    foreach ($name in $previous.Keys) { [Environment]::SetEnvironmentVariable($name, $previous[$name]) }
}
