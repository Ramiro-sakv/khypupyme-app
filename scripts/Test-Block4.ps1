param([ValidateSet(4, 5, 6)][int]$Block = 4)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Postgres.Local.ps1')
$root = Split-Path -Parent $PSScriptRoot
$project = Join-Path $root 'server/KhypuPyme.Api'
$api = Join-Path $project 'bin/Release/net10.0/KhypuPyme.Api.exe'
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
try {
    foreach ($name in $testEnvironment.Keys) {
        $previous[$name] = [Environment]::GetEnvironmentVariable($name)
        [Environment]::SetEnvironmentVariable($name, $testEnvironment[$name])
    }
    $launch = @{
        FilePath = $api
        ArgumentList = @('--urls', 'http://127.0.0.1:5183')
        WorkingDirectory = $project
        RedirectStandardOutput = Join-Path $directory 'api.log'
        RedirectStandardError = Join-Path $directory 'errors.log'
        WindowStyle = 'Hidden'
        PassThru = $true
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
    @{
        owner = Get-DatabasePassword (Read-DatabaseCredentials) 'khypupyme2_test_owner'
    } | ConvertTo-Json -Compress | node (Join-Path $PSScriptRoot "test-block$Block.mjs")
    if ($LASTEXITCODE -ne 0) { throw "Fallo del recorrido. Registros técnicos en $directory." }
}
finally {
    if ($process -and -not $process.HasExited) {
        Stop-Process -InputObject $process
        $null = $process.WaitForExit(5000)
    }
    foreach ($name in $previous.Keys) { [Environment]::SetEnvironmentVariable($name, $previous[$name]) }
}
