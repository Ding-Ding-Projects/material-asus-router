# Shared helpers for build.ps1 and build-installer.ps1: detect-first tool installs through
# Chocolatey, PATH refresh, and native commands that stop the script on a nonzero exit.
Set-StrictMode -Version Latest

function Write-Step([string] $Message) { Write-Host "==> $Message" -ForegroundColor Cyan }

function Update-SessionPath {
    $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $user = [Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path = (@($machine, $user) | Where-Object { $_ }) -join ';'
    $choco = Join-Path $env:ProgramData 'chocolatey\bin'
    if ((Test-Path $choco) -and ($env:Path -notlike "*$choco*")) { $env:Path += ";$choco" }
}

function Test-Admin {
    $principal = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Invoke-Native {
    param([string] $File, [string[]] $Arguments = @(), [string] $WorkingDirectory = (Get-Location).Path)
    Push-Location $WorkingDirectory
    try {
        & $File @Arguments
        if ($LASTEXITCODE -ne 0) { throw "$File $($Arguments -join ' ') failed with exit code $LASTEXITCODE." }
    } finally { Pop-Location }
}

function Get-NodeMajor {
    $node = Get-Command node -ErrorAction SilentlyContinue
    if (-not $node) { return 0 }
    $text = (& node --version) -replace '^v', ''
    return [int]($text.Split('.')[0])
}

function Test-Tools([int] $MinNode = 22) {
    return ((Get-NodeMajor) -ge $MinNode) -and [bool](Get-Command npm -ErrorAction SilentlyContinue)
}

# Installs Chocolatey (official script) when it is missing, then Node.js. Needs administrator
# rights, so it is only called from an elevated process.
function Install-Tools {
    Update-SessionPath
    if (-not (Get-Command choco -ErrorAction SilentlyContinue)) {
        Write-Step 'Installing Chocolatey with its official install script'
        Set-ExecutionPolicy Bypass -Scope Process -Force
        [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor 3072
        Invoke-Expression ((New-Object Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
        Update-SessionPath
        if (-not (Get-Command choco -ErrorAction SilentlyContinue)) { throw 'Chocolatey did not install.' }
    }
    if (-not (Test-Tools)) {
        Write-Step 'Installing Node.js (LTS) with Chocolatey'
        Invoke-Native 'choco' @('install', 'nodejs-lts', '-y', '--no-progress')
        Update-SessionPath
    }
    if (-not (Test-Tools)) { throw 'Node.js 22 or newer and npm are still missing after the install.' }
}

# Detect first: use what is installed. Install only what is missing, through one native
# administrator prompt that you approve; refusing it leaves everything as it was.
function Confirm-Tools([string] $ScriptPath) {
    Update-SessionPath
    if (Test-Tools) { Write-Host "Node $(& node --version) and npm $(& npm --version) are ready."; return }
    Write-Step 'Node.js 22 or newer is missing'
    if (Test-Admin) { Install-Tools }
    elseif ($env:CI -or -not [Environment]::UserInteractive) { throw 'Node.js 22 or newer is missing and this run cannot ask for administrator rights. Install Node.js and run again.' }
    else {
        Write-Host 'Approve the Windows prompt to install Chocolatey and Node.js.'
        $args = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$ScriptPath`"", '-InstallToolsOnly')
        try { $p = Start-Process powershell -Verb RunAs -ArgumentList $args -Wait -PassThru }
        catch { throw 'The administrator prompt was cancelled, so nothing was installed.' }
        if ($p.ExitCode -ne 0) { throw "Installing the tools failed with exit code $($p.ExitCode)." }
        Update-SessionPath
    }
    if (-not (Test-Tools)) { throw 'Node.js 22 or newer and npm are still missing.' }
    Write-Host "Node $(& node --version) and npm $(& npm --version) are ready."
}

function Show-File([string] $Path) {
    if (Test-Path $Path) {
        $item = Get-Item $Path
        Write-Host ("  {0}  ({1:N1} MB)" -f $item.FullName, ($item.Length / 1MB))
    }
}
