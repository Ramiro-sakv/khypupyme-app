$ErrorActionPreference = 'Stop'
if (-not $env:KHYPU_TEST_PLAYWRIGHT) {
    throw 'Indica la ruta a playwright-core/index.mjs en KHYPU_TEST_PLAYWRIGHT.'
}
& (Join-Path $PSScriptRoot 'Test-Block4.ps1') -Block parcial1
