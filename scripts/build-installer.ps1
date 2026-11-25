# Builds the release files for the desktop app, in desktop\dist:
#   squirrel\Material-Asus-Router-Setup.exe, RELEASES and the .nupkg (genuine Squirrel.Windows, unsigned)
#   builder\Material-Asus-Router-<version>-portable.exe (one file, no install, no adjacent folder)
# It runs the normal build first (tests included unless -SkipTests). Exits nonzero on any failure.
param([switch] $SkipTests)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib.ps1')
$Root = Split-Path -Parent $PSScriptRoot
$Desktop = Join-Path $Root 'desktop'

try {
    $build = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $PSScriptRoot 'build.ps1'), '-Installer')
    if ($SkipTests) { $build += '-SkipTests' }
    & powershell @build
    if ($LASTEXITCODE -ne 0) { throw "The build failed with exit code $LASTEXITCODE." }
    Update-SessionPath

    Write-Step 'Building the Squirrel.Windows installer'
    Invoke-Native 'node' @('scripts/squirrel.mjs') $Desktop

    $setup = Join-Path $Desktop 'dist\squirrel\Material-Asus-Router-Setup.exe'
    $releases = Join-Path $Desktop 'dist\squirrel\RELEASES'
    $nupkg = Get-ChildItem (Join-Path $Desktop 'dist\squirrel') -Filter '*-full.nupkg' -ErrorAction SilentlyContinue | Select-Object -First 1
    $portable = Get-ChildItem (Join-Path $Desktop 'dist\builder') -Filter '*-portable.exe' -ErrorAction SilentlyContinue | Select-Object -First 1
    foreach ($needed in @($setup, $releases)) { if (-not (Test-Path $needed)) { throw "Expected file is missing: $needed" } }
    if (-not $nupkg) { throw 'The full .nupkg is missing.' }
    if (-not $portable) { throw 'The portable .exe is missing.' }

    Write-Host ''
    Write-Host 'Installer build finished:' -ForegroundColor Green
    Show-File $setup; Show-File $releases; Show-File $nupkg.FullName; Show-File $portable.FullName
    exit 0
} catch {
    Write-Host ''
    Write-Host "Installer build failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
