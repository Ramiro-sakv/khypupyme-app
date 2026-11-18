$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Postgres.Local.ps1')

Get-PostgresTool 'psql' | Out-Null
& (Get-PostgresTool 'pg_isready') -h $script:PostgresHost -p $script:PostgresPort
if ($LASTEXITCODE -ne 0) { throw 'Inicia el servicio PostgreSQL 18 y vuelve a ejecutar este script.' }

Write-Host 'KhypuPyme2.0 | Preparar bases locales de desarrollo y pruebas'
Write-Host 'Usa la contraseña del usuario postgres que elegiste al instalar PostgreSQL.'
$adminSecret = Read-Host 'Contraseña de postgres' -AsSecureString
$adminPassword = ([pscredential]::new('postgres', $adminSecret)).GetNetworkCredential().Password

try {
    $version = Invoke-LocalPsql -User 'postgres' -Database 'postgres' -Password $adminPassword -Arguments @('-Atc', 'SHOW server_version_num')
    if ([int]$version -lt 180000 -or [int]$version -ge 190000) { throw 'Se esperaba el servidor local PostgreSQL 18.' }

    if (-not (Test-Path -LiteralPath $script:CredentialsPath)) {
        $existing = Invoke-LocalPsql -User 'postgres' -Database 'postgres' -Password $adminPassword -Arguments @(
            '-Atc', "SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname IN ('khypupyme2_dev', 'khypupyme2_test')) OR EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN ('khypupyme2_dev_owner', 'khypupyme2_dev_app', 'khypupyme2_test_owner', 'khypupyme2_test_app'))"
        )
        if ($existing -eq 't') { throw 'Ya existen nombres reservados sin el archivo local de credenciales. Revisa la instalación antes de continuar.' }

        $newCredentials = [ordered]@{}
        $random = [Security.Cryptography.RandomNumberGenerator]::Create()
        try {
            foreach ($database in $script:LocalDatabases) {
                foreach ($access in @('owner', 'app')) {
                    $bytes = [byte[]]::new(32)
                    $random.GetBytes($bytes)
                    $password = [BitConverter]::ToString($bytes).Replace('-', '').ToLowerInvariant()
                    $plain = [Text.Encoding]::UTF8.GetBytes($password)
                    try {
                        $encrypted = [Security.Cryptography.ProtectedData]::Protect(
                            $plain, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser
                        )
                        $newCredentials["${database}_$access"] = [Convert]::ToBase64String($encrypted)
                    }
                    finally { [Array]::Clear($plain, 0, $plain.Length) }
                }
            }
        }
        finally { $random.Dispose() }

        $credentialDirectory = Split-Path -Parent $script:CredentialsPath
        [IO.Directory]::CreateDirectory($credentialDirectory) | Out-Null
        [IO.File]::WriteAllText($script:CredentialsPath, ($newCredentials | ConvertTo-Json))
    }

    $credentials = Read-DatabaseCredentials
    foreach ($database in $script:LocalDatabases) {
        $owner = "${database}_owner"
        $app = "${database}_app"
        $previousOwnerPassword = $env:KHYPU_BOOTSTRAP_OWNER_PASSWORD
        $previousAppPassword = $env:KHYPU_BOOTSTRAP_APP_PASSWORD
        try {
            $env:KHYPU_BOOTSTRAP_OWNER_PASSWORD = Get-DatabasePassword $credentials $owner
            $env:KHYPU_BOOTSTRAP_APP_PASSWORD = Get-DatabasePassword $credentials $app
            Invoke-LocalPsql -User 'postgres' -Database 'postgres' -Password $adminPassword -Arguments @(
                '-v', "database_name=$database", '-v', "owner_name=$owner", '-v', "app_name=$app", '-f', (Join-Path $PSScriptRoot 'bootstrap-postgres.sql')
            )
        }
        finally {
            $env:KHYPU_BOOTSTRAP_OWNER_PASSWORD = $previousOwnerPassword
            $env:KHYPU_BOOTSTRAP_APP_PASSWORD = $previousAppPassword
        }
    }

    Write-Host 'Bases y usuarios preparados. Ya puedes aplicar las migraciones.'
}
finally {
    $adminSecret.Dispose()
    Remove-Variable adminPassword
}
