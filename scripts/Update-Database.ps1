param([ValidateSet('Development', 'Test', 'Both')][string]$Database = 'Both', [ValidateSet('Debug', 'Release')][string]$Configuration = 'Debug')

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Postgres.Local.ps1')
$root = Split-Path -Parent $PSScriptRoot
$project = Join-Path $root 'server/KhypuPyme.Api'
$databases = switch ($Database) {
    'Development' { 'khypupyme2_dev' }
    'Test' { 'khypupyme2_test' }
    'Both' { $script:LocalDatabases }
}

$previousConnection = $env:ConnectionStrings__KhypuPyme
Push-Location -LiteralPath $root
try {
    $credentials = Read-DatabaseCredentials
    foreach ($target in $databases) {
        Write-Host "Aplicando migraciones a $target"
        $env:ConnectionStrings__KhypuPyme = Get-LocalConnectionString $target 'owner'
        dotnet ef database update --project $project --configuration $Configuration
        if ($LASTEXITCODE -ne 0) { throw "Falló la migración de $target." }

        $owner = "${target}_owner"
        $app = "${target}_app"
        Invoke-LocalPsql -User $owner -Database $target -Password (Get-DatabasePassword $credentials $owner) -Arguments @(
            '-v', "app_name=$app", '-f', (Join-Path $PSScriptRoot 'grant-application.sql')
        )
        $env:ConnectionStrings__KhypuPyme = Get-LocalConnectionString $target 'app'
        $previousEnvironment = $env:ASPNETCORE_ENVIRONMENT
        $previousDotnetEnvironment = $env:DOTNET_ENVIRONMENT
        try {
            $env:ASPNETCORE_ENVIRONMENT = 'Development'
            $env:DOTNET_ENVIRONMENT = 'Development'
            dotnet run --project $project --configuration $Configuration --no-launch-profile --no-build -- --register-native-clients
            if ($LASTEXITCODE -ne 0) { throw "Falló el registro de clientes locales en $target." }
        }
        finally {
            $env:ASPNETCORE_ENVIRONMENT = $previousEnvironment
            $env:DOTNET_ENVIRONMENT = $previousDotnetEnvironment
        }
    }
}
finally {
    $env:ConnectionStrings__KhypuPyme = $previousConnection
    Pop-Location
}
