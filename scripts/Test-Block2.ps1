$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Postgres.Local.ps1')
$root = Split-Path -Parent $PSScriptRoot
$api = Join-Path $root 'server/KhypuPyme.Api/bin/Debug/net10.0/KhypuPyme.Api.exe'
if (-not (Test-Path -LiteralPath $api)) { throw 'Compila la solución antes de probar.' }
if (Get-NetTCPConnection -State Listen -LocalPort 5183 -ErrorAction SilentlyContinue) {
    throw 'El puerto local de pruebas 5183 debe estar libre.'
}

$directory = Join-Path $env:TEMP ('khypupyme-block2-' + [Guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($directory) | Out-Null
$database = 'khypupyme2_test'
$process = $null
$previous = @{}
$environment = @{
    ConnectionStrings__KhypuPyme = Get-LocalConnectionString $database 'app'
    ASPNETCORE_ENVIRONMENT = 'Development'
    DOTNET_ENVIRONMENT = 'Development'
    Email__MailboxPath = $directory
    Google__ClientId = ''
    Google__ClientSecret = ''
    KHYPU_TEST_PSQL = Get-PostgresTool 'psql'
}
try {
    foreach ($name in $environment.Keys) {
        $previous[$name] = [Environment]::GetEnvironmentVariable($name)
        [Environment]::SetEnvironmentVariable($name, $environment[$name])
    }
    $launch = @{
        FilePath = $api
        ArgumentList = @('--urls', 'http://127.0.0.1:5183')
        WorkingDirectory = Split-Path -Parent $api
        RedirectStandardOutput = Join-Path $directory 'api.log'
        RedirectStandardError = Join-Path $directory 'errors.log'
        WindowStyle = 'Hidden'
        PassThru = $true
    }
    $process = Start-Process @launch
    $credentials = Read-DatabaseCredentials
    @{
        owner = Get-DatabasePassword $credentials 'khypupyme2_test_owner'
        app = Get-DatabasePassword $credentials 'khypupyme2_test_app'
    } | ConvertTo-Json -Compress | node (Join-Path $PSScriptRoot 'test-block2.mjs')
    if ($LASTEXITCODE -ne 0) { throw "Fallo del recorrido. Registros técnicos en $directory." }
}
finally {
    if ($process -and -not $process.HasExited) {
        Stop-Process -InputObject $process
        $null = $process.WaitForExit(5000)
    }
    foreach ($name in $previous.Keys) { [Environment]::SetEnvironmentVariable($name, $previous[$name]) }
}
