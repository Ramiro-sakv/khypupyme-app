param([ValidateSet('dev','emulators','check','test:emulators','preview')][string]$Task = 'dev')
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path $PSScriptRoot -Parent)
# Los cambios de entorno solo duran esta sesión. No instala herramientas del sistema.
$taskRuntime = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  $taskNodePath = Join-Path $taskRuntime 'node\bin'
  if (Test-Path -LiteralPath (Join-Path $taskNodePath 'node.exe')) { $env:Path = "$taskNodePath;$env:Path" }
}
$taskPnpm = Get-Command pnpm.cmd -ErrorAction SilentlyContinue
if (-not $taskPnpm) {
  $taskPnpmPath = Join-Path $taskRuntime 'bin\fallback'
  if (Test-Path -LiteralPath (Join-Path $taskPnpmPath 'pnpm.cmd')) { $env:Path = "$taskPnpmPath;$env:Path" }
  $taskPnpm = Get-Command pnpm.cmd -ErrorAction SilentlyContinue
}
if (-not $taskPnpm) { throw 'Instala Node.js 24 LTS y pnpm 11.25.0. Consulta README.md.' }
if ($Task -in @('emulators','test:emulators') -and -not (Get-Command java -ErrorAction SilentlyContinue)) {
  $taskJdkRoot = Join-Path $env:USERPROFILE '.jdks'
  $taskJdk = Get-ChildItem -LiteralPath $taskJdkRoot -Directory -ErrorAction SilentlyContinue |
    Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'bin\java.exe') } |
    Sort-Object Name -Descending | Select-Object -First 1
  if ($taskJdk) { $env:JAVA_HOME = $taskJdk.FullName; $env:Path = "$(Join-Path $taskJdk.FullName 'bin');$env:Path" }
  else { throw 'No se encontró Java. Instala JDK 21 LTS o superior y configura JAVA_HOME para ejecutar los emuladores.' }
}
& $taskPnpm.Source run $Task
exit $LASTEXITCODE
