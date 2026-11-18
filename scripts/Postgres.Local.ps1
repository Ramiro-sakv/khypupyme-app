Set-StrictMode -Version Latest

if ($PSVersionTable.PSEdition -eq 'Desktop') {
    Add-Type -AssemblyName System.Security
}

$script:PostgresHost = '127.0.0.1'
$script:PostgresPort = 5432
$script:CredentialsPath = Join-Path $env:LOCALAPPDATA 'KhypuPyme2.0\postgres-local.json'
$script:LocalDatabases = @('khypupyme2_dev', 'khypupyme2_test')

function Get-PostgresTool([string]$Name) {
    $installed = Join-Path $env:ProgramFiles "PostgreSQL\18\bin\$Name.exe"
    if (Test-Path -LiteralPath $installed) { return $installed }

    $onPath = Get-Command "$Name.exe" -ErrorAction SilentlyContinue
    if ($onPath) { return $onPath.Source }

    throw "Falta $Name. Instala PostgreSQL 18 con las herramientas de línea de comandos."
}

function Read-DatabaseCredentials {
    if (-not (Test-Path -LiteralPath $script:CredentialsPath)) {
        throw 'Primero ejecuta scripts/Initialize-Postgres.ps1 para crear las bases y usuarios locales.'
    }
    return Get-Content -LiteralPath $script:CredentialsPath -Raw | ConvertFrom-Json
}

function Get-DatabasePassword($Credentials, [string]$Role) {
    $entry = $Credentials.PSObject.Properties[$Role]
    if (-not $entry) { throw "Faltan las credenciales locales de $Role." }
    $decoded = [Convert]::FromBase64String($entry.Value)
    $plain = [Security.Cryptography.ProtectedData]::Unprotect(
        $decoded, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser
    )
    try { return [Text.Encoding]::UTF8.GetString($plain) }
    finally { [Array]::Clear($plain, 0, $plain.Length) }
}

function Get-LocalConnectionString([string]$Database, [ValidateSet('owner', 'app')][string]$Access) {
    if ($Database -notin $script:LocalDatabases) { throw 'Base local fuera del proyecto.' }
    $role = "${Database}_$Access"
    $password = Get-DatabasePassword (Read-DatabaseCredentials) $role
    return "Host=$script:PostgresHost;Port=$script:PostgresPort;Database=$Database;Username=$role;Password=$password;Timeout=3;Command Timeout=5;Include Error Detail=false"
}

function Invoke-LocalPsql {
    param(
        [string]$User,
        [string]$Database,
        [string]$Password,
        [string[]]$Arguments = @()
    )

    $psql = Get-PostgresTool 'psql'
    $previousPassword = $env:PGPASSWORD
    try {
        $env:PGPASSWORD = $Password
        & $psql -X -w -h $script:PostgresHost -p $script:PostgresPort -U $User -d $Database -v ON_ERROR_STOP=1 @Arguments
        if ($LASTEXITCODE -ne 0) { throw "PostgreSQL no completó la operación en $Database (salida $LASTEXITCODE)." }
    }
    finally {
        $env:PGPASSWORD = $previousPassword
    }
}
