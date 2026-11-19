param(
    [ValidateSet('All', 'Android', 'Windows')][string]$Platform = 'All',
    [uri]$ApiOrigin = 'https://khypupyme2-piloto.onrender.com',
    [string]$OutputDirectory
)

$ErrorActionPreference = 'Stop'
if (-not $ApiOrigin.IsAbsoluteUri -or $ApiOrigin.Scheme -ne 'https' -or $ApiOrigin.UserInfo -or
    $ApiOrigin.PathAndQuery -ne '/' -or $ApiOrigin.Fragment) {
    throw 'ApiOrigin debe ser un origen HTTPS, sin ruta, credenciales ni parámetros.'
}
$origin = $ApiOrigin.GetLeftPart([UriPartial]::Authority)
$root = Split-Path -Parent $PSScriptRoot
$web = Join-Path $root 'web'
$android = Join-Path $web 'android'
if (-not $OutputDirectory) { $OutputDirectory = Join-Path $root 'artifacts/pilot' }
$output = [IO.Directory]::CreateDirectory($OutputDirectory).FullName
$present = @{}
$names = @('VITE_KHYPU_NATIVE', 'VITE_KHYPU_API_ORIGIN', 'KHYPU_NATIVE_ORIGIN', 'CARGO_TARGET_DIR')

try {
    foreach ($name in $names) { $present[$name] = [Environment]::GetEnvironmentVariable($name) }
    $env:VITE_KHYPU_API_ORIGIN = $origin
    $env:KHYPU_NATIVE_ORIGIN = $origin
    if ($Platform -in 'All', 'Android') {
        $env:VITE_KHYPU_NATIVE = 'android'
        & pnpm --dir $web build
        if ($LASTEXITCODE) { throw 'Falló la compilación WebView de Android.' }
        & pnpm --dir $web exec cap sync android
        if ($LASTEXITCODE) { throw 'Falló la sincronización de Capacitor.' }
        Push-Location $android
        try {
            & .\gradlew.bat assembleDebug --console=plain
            if ($LASTEXITCODE) { throw 'Falló la generación del APK.' }
        } finally { Pop-Location }
        Copy-Item -LiteralPath (Join-Path $android 'app/build/outputs/apk/debug/app-debug.apk') -Destination (Join-Path $output 'KhypuPyme2-Piloto-Android.apk')
    }
    if ($Platform -in 'All', 'Windows') {
        $env:VITE_KHYPU_NATIVE = 'windows'
        if (-not $env:CARGO_TARGET_DIR) { $env:CARGO_TARGET_DIR = Join-Path $env:LOCALAPPDATA 'KhypuPyme2.0/native-target' }
        & pnpm --dir $web build
        if ($LASTEXITCODE) { throw 'Falló la compilación WebView de Windows.' }
        $overlay = Join-Path ([IO.Path]::GetTempPath()) ('khypupyme-tauri-' + [Guid]::NewGuid().ToString('N') + '.json')
        try {
            $tauriConfig = Get-Content (Join-Path $web 'src-tauri/tauri.conf.json') -Raw | ConvertFrom-Json
            $csp = $tauriConfig.app.security.csp.Replace('https://khypupyme2-piloto.onrender.com', $origin)
            $settings = @{ app = @{ security = @{ csp = $csp } } }
            if ($ApiOrigin.IsLoopback) { $settings.identifier = $tauriConfig.identifier + '.qa' }
            $settings | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $overlay -Encoding utf8
            & pnpm --dir $web exec tauri build --bundles nsis --config $overlay
            if ($LASTEXITCODE) { throw 'Falló la generación del instalador Windows.' }
        } finally { if (Test-Path -LiteralPath $overlay) { Remove-Item -LiteralPath $overlay } }
        $bundle = Join-Path $env:CARGO_TARGET_DIR 'release/bundle/nsis'
        $installer = Get-ChildItem -LiteralPath $bundle -File -Filter '*_2.0.0_*setup.exe' |
            Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if (-not $installer) { throw 'No se encontró el instalador generado.' }
        Copy-Item -LiteralPath $installer.FullName -Destination (Join-Path $output 'KhypuPyme2-Piloto-Windows.exe')
    }
    Write-Host "Instaladores para $origin en $output"
}
finally {
    foreach ($name in $present.Keys) { [Environment]::SetEnvironmentVariable($name, $present[$name]) }
}
