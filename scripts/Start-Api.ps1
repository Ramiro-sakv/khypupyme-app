param([ValidateSet('Development', 'Test')][string]$Database = 'Development')

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Postgres.Local.ps1')
$project = Join-Path (Split-Path -Parent $PSScriptRoot) 'server/KhypuPyme.Api'
$target = if ($Database -eq 'Test') { 'khypupyme2_test' } else { 'khypupyme2_dev' }
$port = if ($Database -eq 'Test') { 5183 } else { 5182 }

$previousConnection = $env:ConnectionStrings__KhypuPyme
$previousEnvironment = $env:ASPNETCORE_ENVIRONMENT
try {
    $env:ConnectionStrings__KhypuPyme = Get-LocalConnectionString $target 'app'
    $env:ASPNETCORE_ENVIRONMENT = 'Development'
    dotnet run --project $project --no-launch-profile --urls "http://127.0.0.1:$port"
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
finally {
    $env:ConnectionStrings__KhypuPyme = $previousConnection
    $env:ASPNETCORE_ENVIRONMENT = $previousEnvironment
}
