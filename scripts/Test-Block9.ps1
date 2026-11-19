param([switch]$RestoreBackup, [string]$PreviousBackup)

$ErrorActionPreference = 'Stop'
if (-not $RestoreBackup) {
    if ($PreviousBackup) { throw 'Usa -RestoreBackup para comprobar la actualización sobre una copia anterior.' }
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
$oldConnection = $env:ConnectionStrings__KhypuPyme
$started = $false
try {
    if ($PreviousBackup) {
        $backup = (Resolve-Path -LiteralPath $PreviousBackup).Path
    } else {
        $env:KHYPU_TEST_DUMP_PATH = $backup
        $env:KHYPU_TEST_PGDUMP = Get-PostgresTool 'pg_dump'
        & (Join-Path $PSScriptRoot 'Test-Block4.ps1') -Block '9'
    }
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
    $psql = Get-PostgresTool 'psql'
    $restore = @('-X', '-d', 'khypupyme2_restore', '-Atq', '-v', 'ON_ERROR_STOP=1')
    $hasOpening = @'
SELECT EXISTS (
  SELECT 1 FROM information_schema.columns WHERE table_schema='khypupyme'
    AND table_name='products' AND column_name='AfterOpeningMonths');
'@
    if ($PreviousBackup) {
        $existing = & $psql @connection @restore -c $hasOpening
        if ($LASTEXITCODE -ne 0 -or $existing -ne 'f') { throw 'La copia debe ser anterior a la migración de cosméticos.' }
        $fingerprint = @'
SELECT md5(concat_ws('|',
    (SELECT string_agg((to_jsonb(p) - 'AfterOpeningMonths')::text, ',' ORDER BY p."BusinessId", p."Id") FROM khypupyme.products p),
    (SELECT string_agg(to_jsonb(e)::text, ',' ORDER BY e."BusinessId", e."Id") FROM khypupyme.commerce_entries e),
    (SELECT string_agg(to_jsonb(a)::text, ',' ORDER BY a."BusinessId", a."OperationId") FROM khypupyme.commerce_audit a)));
'@
        $before = & $psql @connection @restore -c $fingerprint
        if ($LASTEXITCODE -ne 0) { throw 'No se pudo comprobar el historial antes de actualizar.' }
        $env:ConnectionStrings__KhypuPyme = "Host=127.0.0.1;Port=$port;Database=khypupyme2_restore;Username=khypu_restore_owner;Password=$secret"
        $project = Join-Path (Split-Path -Parent $PSScriptRoot) 'server/KhypuPyme.Api'
        & dotnet ef database update --no-build --configuration Release --project $project
        if ($LASTEXITCODE -ne 0) { throw 'La migración sobre la copia falló.' }
        $after = & $psql @connection @restore -c $fingerprint
        if ($LASTEXITCODE -ne 0 -or $before -ne $after) { throw 'La migración alteró existencias, documentos o auditoría.' }
        Write-Host 'Migración sobre el respaldo anterior: existencias, documentos y auditoría coinciden.'
    }
    $column = & $psql @connection @restore -c $hasOpening
    if ($LASTEXITCODE -ne 0 -or $column -ne 't') { throw 'Falta la columna opcional de duración tras apertura.' }
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
    $env:ConnectionStrings__KhypuPyme = $oldConnection
}
