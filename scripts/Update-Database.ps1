param([ValidateSet('Development', 'Test', 'Both')][string]$Database = 'Both')

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
        dotnet ef database update --project $project
        if ($LASTEXITCODE -ne 0) { throw "Falló la migración de $target." }

        $owner = "${target}_owner"
        $app = "${target}_app"
        Invoke-LocalPsql -User $owner -Database $target -Password (Get-DatabasePassword $credentials $owner) -Arguments @(
            '-c', "GRANT USAGE ON SCHEMA khypupyme TO $app"
        )
    }
}
finally {
    $env:ConnectionStrings__KhypuPyme = $previousConnection
    Pop-Location
}
