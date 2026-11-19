param([switch]$RestoreBackup)

$ErrorActionPreference = 'Stop'
if (-not $RestoreBackup) {
    & (Join-Path $PSScriptRoot 'Test-Block4.ps1') -Block '9'
    return
}

. (Join-Path $PSScriptRoot 'Postgres.Local.ps1')
$directory = Join-Path $env:LOCALAPPDATA ('KhypuPyme2.0\restore-check\' + [Guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($directory) | Out-Null
$backup = Join-Path $directory 'block9.backup'
$cluster = Join-Path $directory 'postgres'
$passwordFile = Join-Path $directory 'restore-password.tmp'
$oldDump = $env:KHYPU_TEST_DUMP_PATH
$oldPgDump = $env:KHYPU_TEST_PGDUMP
$oldPassword = $env:PGPASSWORD
$started = $false
try {
    $env:KHYPU_TEST_DUMP_PATH = $backup
    $env:KHYPU_TEST_PGDUMP = Get-PostgresTool 'pg_dump'
    & (Join-Path $PSScriptRoot 'Test-Block4.ps1') -Block '9'
    if (-not (Test-Path -LiteralPath $backup)) { throw 'Falta el respaldo de prueba.' }

    $secret = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
    [IO.File]::WriteAllText($passwordFile, $secret)
    & (Get-PostgresTool 'initdb') -D $cluster -U khypu_restore_owner -A scram-sha-256 --pwfile=$passwordFile -E UTF8 --locale=C --no-instructions | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo inicializar PostgreSQL aislado.' }
    Remove-Item -LiteralPath $passwordFile
    $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
    $listener.Start()
    $port = $listener.LocalEndpoint.Port
    $listener.Stop()
    & (Get-PostgresTool 'pg_ctl') start -D $cluster -l (Join-Path $directory 'postgres.log') -o "-h 127.0.0.1 -p $port" -w
    if ($LASTEXITCODE -ne 0) { throw 'No quedó disponible la instancia de restauración.' }
    $started = $true
    $env:PGPASSWORD = $secret
    $connection = @('-w', '-h', '127.0.0.1', '-p', $port, '-U', 'khypu_restore_owner')
    & (Get-PostgresTool 'createdb') @connection khypupyme2_restore
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear la base de destino.' }
    & (Get-PostgresTool 'pg_restore') @connection -d khypupyme2_restore --exit-on-error --no-owner --no-acl $backup
    if ($LASTEXITCODE -ne 0) { throw 'La restauración del respaldo falló.' }
    $answer = & (Get-PostgresTool 'psql') @connection -X -d khypupyme2_restore -Atq -v ON_ERROR_STOP=1 -c @'
SELECT EXISTS (SELECT 1 FROM khypupyme.account_closures)
   AND EXISTS (SELECT 1 FROM khypupyme.business_deletions WHERE "CompletedAt" IS NOT NULL)
   AND EXISTS (SELECT 1 FROM khypupyme.commerce_audit WHERE "Reason" LIKE '%comprobada')
   AND EXISTS (SELECT 1 FROM khypupyme.businesses WHERE "Name" = 'Negocio protegido');
'@
    if ($LASTEXITCODE -ne 0 -or $answer -ne 't') { throw 'La base restaurada carece de los registros esperados.' }
    Write-Host "Respaldo de pruebas restaurado y comprobado en khypupyme2_restore. Copia local: $backup"
}
finally {
    if ($started) { & (Get-PostgresTool 'pg_ctl') stop -D $cluster -w -m fast | Out-Null }
    if (Test-Path -LiteralPath $passwordFile) { Remove-Item -LiteralPath $passwordFile }
    $env:KHYPU_TEST_DUMP_PATH = $oldDump
    $env:KHYPU_TEST_PGDUMP = $oldPgDump
    $env:PGPASSWORD = $oldPassword
}
