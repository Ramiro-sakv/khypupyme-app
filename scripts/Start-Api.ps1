param(
    [ValidateSet('Development', 'Test')][string]$Database = 'Development',
    [ValidateRange(1024, 65535)][int]$Port,
    [switch]$IncludeWeb
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Postgres.Local.ps1')
$project = Join-Path (Split-Path -Parent $PSScriptRoot) 'server/KhypuPyme.Api'
$target = if ($Database -eq 'Test') { 'khypupyme2_test' } else { 'khypupyme2_dev' }
if (-not $Port) { $Port = if ($Database -eq 'Test') { 5183 } else { 5182 } }
$address = "http://127.0.0.1:$Port"

$previousConnection = $env:ConnectionStrings__KhypuPyme
$previousEnvironment = $env:ASPNETCORE_ENVIRONMENT
try {
    $env:ConnectionStrings__KhypuPyme = Get-LocalConnectionString $target 'app'
    $env:ASPNETCORE_ENVIRONMENT = 'Development'
    if ($IncludeWeb) {
        $web = Join-Path (Split-Path -Parent $PSScriptRoot) 'web/dist'
        $api = Join-Path $project 'bin/Release/net10.0/KhypuPyme.Api.dll'
        if (-not (Test-Path (Join-Path $web 'index.html')) -or -not (Test-Path $api)) {
            throw 'Compila la web y .NET en Release antes de abrir la revisión local.'
        }
        dotnet $api --urls $address --contentRoot $project --webroot $web
    } else {
        dotnet run --project $project --no-launch-profile --urls $address
    }
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
finally {
    $env:ConnectionStrings__KhypuPyme = $previousConnection
    $env:ASPNETCORE_ENVIRONMENT = $previousEnvironment
}
