param(
    [ValidateSet('4', '5', '6', '7a', '7b', '7c', '7d', '8', '9', 'perf', 'parcial1')][string]$Block = '4',
    [string]$PublishedWebDirectory
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Postgres.Local.ps1')
$root = Split-Path -Parent $PSScriptRoot
$project = Join-Path $root 'server/KhypuPyme.Api'
$api = Join-Path $project 'bin/Release/net10.0/KhypuPyme.Api.exe'
$address = 'http://127.0.0.1:5183'
if ($PublishedWebDirectory) {
    if ($Block -ne '8') { throw 'La comprobación de la web publicada reutiliza el recorrido del bloque 8.' }
    $project = (Resolve-Path -LiteralPath $PublishedWebDirectory).Path
    $api = Join-Path $project 'KhypuPyme.Api.exe'
    if (-not (Test-Path -LiteralPath (Join-Path $project 'wwwroot/index.html'))) { throw 'Falta la web publicada.' }
    $address += ';https://localhost:7243'
}
if (-not (Test-Path -LiteralPath $api)) { throw 'Primero compila la solución con la configuración Release.' }
if (Get-NetTCPConnection -State Listen -LocalPort 5183 -ErrorAction SilentlyContinue) {
    throw 'El puerto local de pruebas 5183 debe estar libre.'
}

$directory = Join-Path $env:TEMP ("khypupyme-block$Block-" + [Guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($directory) | Out-Null
$process = $null
$previous = @{}
$testEnvironment = @{
    ConnectionStrings__KhypuPyme = Get-LocalConnectionString 'khypupyme2_test' 'app'
    ASPNETCORE_ENVIRONMENT = 'Development'
    DOTNET_ENVIRONMENT = 'Development'
    Email__MailboxPath = $directory
    Google__ClientId = ''
    Google__ClientSecret = ''
    KHYPU_TEST_PSQL = Get-PostgresTool 'psql'
}
if ($PublishedWebDirectory) { $testEnvironment.KHYPU_TEST_WEB_ORIGIN = 'https://localhost:7243' }
if ($Block -eq 'perf') {
    $testEnvironment.KHYPU_PERF_API_LOG = Join-Path $directory 'api.log'
    $testEnvironment['Logging__LogLevel__Microsoft.EntityFrameworkCore.Database.Command'] = 'Information'
}
try {
    foreach ($name in $testEnvironment.Keys) {
        $previous[$name] = [Environment]::GetEnvironmentVariable($name)
        [Environment]::SetEnvironmentVariable($name, $testEnvironment[$name])
    }
    if ($Block -eq '9') {
        & $api --register-native-clients *> (Join-Path $directory 'native.log')
        if ($LASTEXITCODE -ne 0) { throw 'No se pudieron preparar los clientes instalados de prueba.' }
    }
    $launch = @{
        FilePath = $api
        ArgumentList = @('--urls', ('"' + $address + '"'))
        WorkingDirectory = $project
        RedirectStandardOutput = Join-Path $directory 'api.log'
        RedirectStandardError = Join-Path $directory 'errors.log'
        WindowStyle = 'Hidden'
        PassThru = $true
    }
    if ($Block -eq 'parcial1') {
        $web = Join-Path $root 'web/dist'
        if (-not (Test-Path -LiteralPath (Join-Path $web 'index.html'))) { throw 'Primero compila la web.' }
        $launch.ArgumentList += @('--webroot', ('"' + $web + '"'))
    }
    $process = Start-Process @launch
    $ready = $false
    foreach ($attempt in 1..20) {
        if ($process.HasExited) { break }
        try {
            $health = Invoke-RestMethod -Uri 'http://127.0.0.1:5183/api/v1/health/database' -TimeoutSec 2
            if ($health.status -eq 'available') { $ready = $true; break }
        }
        catch { Start-Sleep -Milliseconds 250 }
    }
    if (-not $ready) { throw "La API de prueba no quedó disponible. Consulta $directory." }
    $credentials = @{
        owner = Get-DatabasePassword (Read-DatabaseCredentials) 'khypupyme2_test_owner'
    }
    if ($Block -eq '9') { $credentials.app = Get-DatabasePassword (Read-DatabaseCredentials) 'khypupyme2_test_app' }
    $credentials | ConvertTo-Json -Compress | node (Join-Path $PSScriptRoot "test-block$Block.mjs")
    if ($LASTEXITCODE -ne 0) { throw "Fallo del recorrido. Registros técnicos en $directory." }
}
finally {
    if ($process -and -not $process.HasExited) {
        Stop-Process -InputObject $process
        $null = $process.WaitForExit(5000)
    }
    foreach ($name in $previous.Keys) { [Environment]::SetEnvironmentVariable($name, $previous[$name]) }
}
