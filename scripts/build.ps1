# Builds the Material Asus Router desktop app on Windows: installs what is missing (Node.js
# through Chocolatey), installs packages, runs the tests, stages the app and packages it into
# desktop\dist\builder\win-unpacked. Exits nonzero on any failure.
#   build.bat                  build
#   build.bat -Run             build, then start the app
#   build.bat -SkipTests       skip the test run
param(
    [switch] $SkipTests,
    [switch] $Run,
    [switch] $DependenciesOnly,
    [switch] $InstallToolsOnly,
    [switch] $Installer
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib.ps1')
$Root = Split-Path -Parent $PSScriptRoot
$Desktop = Join-Path $Root 'desktop'

try {
    if ($InstallToolsOnly) { Install-Tools; exit 0 }
    Confirm-Tools $MyInvocation.MyCommand.Path

    Write-Step 'Installing the app packages'
    Invoke-Native 'npm' @('ci', '--ignore-scripts', '--no-audit', '--no-fund') $Root
    Write-Step 'Installing the desktop packages (this downloads Electron the first time)'
    Invoke-Native 'npm' @('ci', '--no-audit', '--no-fund') $Desktop
    if ($DependenciesOnly) { Write-Host 'Dependencies are ready.'; exit 0 }

    if (-not $SkipTests) {
        Write-Step 'Running the tests'
        Invoke-Native 'npm' @('test') $Root
    }

    Write-Step 'Staging the app'
    Invoke-Native 'node' @('desktop/scripts/stage.mjs') $Root

    Write-Step 'Packaging the desktop app'
    $targets = if ($Installer) { @('portable', 'dir') } else { @('dir') }
    Invoke-Native 'npx' (@('electron-builder', '--config', 'electron-builder.json', '--win') + $targets + @('--x64', '--publish', 'never')) $Desktop

    $exe = Join-Path $Desktop 'dist\builder\win-unpacked\Material Asus Router.exe'
    if (-not (Test-Path $exe)) { throw "The build finished but $exe is missing." }
    Write-Host ''
    Write-Host 'Build finished:' -ForegroundColor Green
    Show-File $exe
    if ($Run) { Start-Process $exe }
    exit 0
} catch {
    Write-Host ''
    Write-Host "Build failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
