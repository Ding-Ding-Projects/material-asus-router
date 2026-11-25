# Material Asus Router one-command setup. Asks for every value it cannot choose itself, picks
# the rest (a free port, this computer's LAN address), writes .env, then starts the app with
# host.ps1 and prints the working link. Router passwords are never asked for here: they are
# entered only in the app's own setup screen.
#
#   powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
#   scripts\setup.ps1 -NonInteractive -Port 8790 -Tag latest -Demo
param(
    [switch] $NonInteractive,
    [int] $Port = 0,
    [string] $Tag = '',
    [switch] $Demo,
    [string] $Remote = ''
)
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$EnvFile = Join-Path $Root '.env'

function Read-Env {
    $values = @{}
    if (Test-Path $EnvFile) {
        foreach ($line in Get-Content $EnvFile) {
            if ($line -match '^([A-Z_]+)=(.*)$') { $values[$Matches[1]] = $Matches[2] }
        }
    }
    return $values
}

function Test-PortFree([int] $Candidate) {
    $listener = $null
    try {
        $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $Candidate)
        $listener.Start()
        return $true
    } catch { return $false } finally { if ($listener) { $listener.Stop() } }
}

function Find-FreePort([int] $Start) {
    for ($p = $Start; $p -lt $Start + 50; $p++) { if (Test-PortFree $p) { return $p } }
    throw "No free port found between $Start and $($Start + 49)."
}

function Choose([string] $Title, [string[]] $Options, [int] $Default = 0) {
    $index = $Default
    if (-not [Console]::IsInputRedirected) {
        while ($true) {
            Clear-Host
            Write-Host 'Material Asus Router setup' -ForegroundColor Cyan
            Write-Host ''
            Write-Host $Title
            for ($i = 0; $i -lt $Options.Count; $i++) {
                if ($i -eq $index) { Write-Host "  > $($Options[$i])" -ForegroundColor Green } else { Write-Host "    $($Options[$i])" }
            }
            Write-Host ''
            Write-Host 'Up and Down to move, Enter to choose, Backspace to go back' -ForegroundColor DarkGray
            $key = [Console]::ReadKey($true)
            switch ($key.Key) {
                'UpArrow' { $index = ($index - 1 + $Options.Count) % $Options.Count }
                'DownArrow' { $index = ($index + 1) % $Options.Count }
                'Enter' { return $index }
                'Backspace' { return -1 }
            }
        }
    }
    for ($i = 0; $i -lt $Options.Count; $i++) { Write-Host "  [$($i + 1)] $($Options[$i])" }
    $answer = Read-Host "$Title (Enter for $($Default + 1))"
    if (-not $answer) { return $Default }
    return [int]$answer - 1
}

function Ask([string] $Title, [string] $Default, [scriptblock] $Valid, [string] $Hint) {
    while ($true) {
        $answer = Read-Host "$Title [$Default]"
        if (-not $answer) { $answer = $Default }
        if (& $Valid $answer) { return $answer }
        Write-Host $Hint -ForegroundColor Yellow
    }
}

$saved = Read-Env
$values = [ordered]@{
    ROUTER_APP_PORT = if ($Port) { "$Port" } elseif ($saved.ROUTER_APP_PORT) { $saved.ROUTER_APP_PORT } else { "$(Find-FreePort 8790)" }
    ROUTER_APP_TAG = if ($Tag) { $Tag } elseif ($saved.ROUTER_APP_TAG) { $saved.ROUTER_APP_TAG } else { 'latest' }
    ROUTER_APP_DEMO = if ($Demo) { '1' } elseif ($saved.ROUTER_APP_DEMO) { $saved.ROUTER_APP_DEMO } else { '0' }
}

if (-not $NonInteractive) {
    $step = 0
    while ($step -lt 3) {
        switch ($step) {
            0 {
                $pick = Choose 'Connect to your real router, or try the built-in pretend router first?' @('My real Asus router', 'Pretend router (demo)') ([int]($values.ROUTER_APP_DEMO -eq '1'))
                if ($pick -lt 0) { continue }
                $values.ROUTER_APP_DEMO = if ($pick -eq 1) { '1' } else { '0' }
                $step++
            }
            1 {
                $values.ROUTER_APP_PORT = Ask 'Port for the app on this computer' $values.ROUTER_APP_PORT { param($v) $v -match '^\d+$' -and [int]$v -ge 1024 -and [int]$v -le 65535 } 'Enter a number from 1024 to 65535.'
                $step++
            }
            2 {
                Clear-Host
                Write-Host 'Review' -ForegroundColor Cyan
                $values.GetEnumerator() | ForEach-Object { Write-Host ("  {0,-18} {1}" -f $_.Key, $_.Value) }
                $pick = Choose 'Write these settings and start the app?' @('Start the app', 'Go back and change something')
                if ($pick -eq 0) { $step = 3 } else { $step = 0 }
            }
        }
    }
}

# Keep any unrelated lines a person added to .env.
$lines = [System.Collections.Generic.List[string]]::new()
if (Test-Path $EnvFile) { foreach ($line in Get-Content $EnvFile) { if ($line -notmatch '^(ROUTER_APP_PORT|ROUTER_APP_TAG|ROUTER_APP_DEMO)=') { $lines.Add($line) } } }
foreach ($entry in $values.GetEnumerator()) { $lines.Add("$($entry.Key)=$($entry.Value)") }
Set-Content -Path $EnvFile -Value $lines -Encoding ascii
Write-Host "Saved $EnvFile" -ForegroundColor Green

$hostArgs = @('--detached', '--port', $values.ROUTER_APP_PORT, '--tag', $values.ROUTER_APP_TAG)
if ($values.ROUTER_APP_DEMO -eq '1') { $hostArgs += '--demo' }
if ($Remote) { $hostArgs += @('--remote', $Remote) }
& (Join-Path $PSScriptRoot 'host.ps1') @hostArgs
exit $LASTEXITCODE
