# Material Asus Router one-command setup. Asks for every value it cannot choose itself, picks
# the rest (a free port, this computer's LAN address), writes .env, then starts the app with
# host.ps1 and prints the working link. Router passwords are never asked for here: they are
# entered only in the app's own setup screen.
#
#   powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
#   scripts\setup.ps1 -NonInteractive -Port 8790 -Tag latest -Demo
#   scripts\setup.ps1 -NonInteractive -Remote user@host -LanIp 198.51.100.50
#
# Network mode: the app is reached on a port of its host (the default), or takes its own
# address on the home network through a macvlan network (-LanIp, see compose.lan.yaml).
# -PublishedPort switches a saved own-address setup back to the published port.
param(
    [switch] $NonInteractive,
    [int] $Port = 0,
    [string] $Tag = '',
    [switch] $Demo,
    [string] $Remote = '',
    [string] $LanIp = '',
    [string] $LanParent = '',
    [string] $LanSubnet = '',
    [string] $LanGateway = '',
    [switch] $PublishedPort
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
$Ipv4 = '^((25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(25[0-5]|2[0-4]\d|1?\d?\d)$'
$Cidr = '^((25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(25[0-5]|2[0-4]\d|1?\d?\d)/(3[0-2]|[12]?\d)$'
$values = [ordered]@{
    ROUTER_APP_PORT = if ($Port) { "$Port" } elseif ($saved.ROUTER_APP_PORT) { $saved.ROUTER_APP_PORT } else { "$(Find-FreePort 8790)" }
    ROUTER_APP_TAG = if ($Tag) { $Tag } elseif ($saved.ROUTER_APP_TAG) { $saved.ROUTER_APP_TAG } else { 'latest' }
    ROUTER_APP_DEMO = if ($Demo) { '1' } elseif ($saved.ROUTER_APP_DEMO) { $saved.ROUTER_APP_DEMO } else { '0' }
    ROUTER_APP_LAN_IP = if ($LanIp) { $LanIp } elseif ($saved.ROUTER_APP_LAN_IP) { $saved.ROUTER_APP_LAN_IP } else { '' }
    ROUTER_APP_LAN_PARENT = if ($LanParent) { $LanParent } elseif ($saved.ROUTER_APP_LAN_PARENT) { $saved.ROUTER_APP_LAN_PARENT } else { '' }
    ROUTER_APP_LAN_SUBNET = if ($LanSubnet) { $LanSubnet } elseif ($saved.ROUTER_APP_LAN_SUBNET) { $saved.ROUTER_APP_LAN_SUBNET } else { '' }
    ROUTER_APP_LAN_GATEWAY = if ($LanGateway) { $LanGateway } elseif ($saved.ROUTER_APP_LAN_GATEWAY) { $saved.ROUTER_APP_LAN_GATEWAY } else { '' }
}
# The network mode: 'port' publishes a port on the host, 'lan' gives the app its own address.
# An address given on the command line wins; otherwise the saved mode is kept.
$values.ROUTER_APP_NETWORK = if ($PublishedPort) { 'port' } elseif ($LanIp) { 'lan' } elseif ($saved.ROUTER_APP_NETWORK -eq 'lan' -and $saved.ROUTER_APP_LAN_IP) { 'lan' } else { 'port' }

function Test-LanValues {
    if ($values.ROUTER_APP_NETWORK -ne 'lan') { return $true }
    return ($values.ROUTER_APP_LAN_IP -match $Ipv4) -and (-not $values.ROUTER_APP_LAN_SUBNET -or $values.ROUTER_APP_LAN_SUBNET -match $Cidr) -and (-not $values.ROUTER_APP_LAN_GATEWAY -or $values.ROUTER_APP_LAN_GATEWAY -match $Ipv4)
}
if (-not (Test-LanValues)) { throw 'The own-address settings are not valid: use an IPv4 address, a subnet such as 198.51.100.0/24 and an IPv4 gateway.' }

if (-not $NonInteractive) {
    $step = 0
    while ($step -lt 4) {
        switch ($step) {
            0 {
                $pick = Choose 'Connect to your real router, or try the built-in pretend router first?' @('My real Asus router', 'Pretend router (demo)') ([int]($values.ROUTER_APP_DEMO -eq '1'))
                if ($pick -lt 0) { continue }
                $values.ROUTER_APP_DEMO = if ($pick -eq 1) { '1' } else { '0' }
                $step++
            }
            1 {
                $pick = Choose 'How should people reach the app?' @('On a port of the computer running it', 'Its own address on the home network') ([int]($values.ROUTER_APP_NETWORK -eq 'lan'))
                if ($pick -lt 0) { $step--; continue }
                $values.ROUTER_APP_NETWORK = if ($pick -eq 1) { 'lan' } else { 'port' }
                $step++
            }
            2 {
                if ($values.ROUTER_APP_NETWORK -eq 'lan') {
                    Write-Host 'Own address: pick one outside the router DHCP pool (or reserve it), and nothing else may use it.' -ForegroundColor Cyan
                    $values.ROUTER_APP_LAN_IP = Ask 'Address for the app (for example 198.51.100.50)' $values.ROUTER_APP_LAN_IP { param($v) $v -match $Ipv4 } 'Enter an IPv4 address such as 198.51.100.50.'
                    Write-Host 'The next three can stay empty: they are looked up on the Docker host.' -ForegroundColor DarkGray
                    $values.ROUTER_APP_LAN_PARENT = Ask 'Host network interface (empty to detect)' $values.ROUTER_APP_LAN_PARENT { param($v) $v -eq '' -or $v -match '^[A-Za-z0-9._-]{1,15}$' } 'Enter an interface name such as eth0, or leave it empty.'
                    $values.ROUTER_APP_LAN_SUBNET = Ask 'Network in CIDR form (empty to detect)' $values.ROUTER_APP_LAN_SUBNET { param($v) $v -eq '' -or $v -match $Cidr } 'Enter a network such as 198.51.100.0/24, or leave it empty.'
                    $values.ROUTER_APP_LAN_GATEWAY = Ask 'Router address (empty to detect)' $values.ROUTER_APP_LAN_GATEWAY { param($v) $v -eq '' -or $v -match $Ipv4 } 'Enter an IPv4 address, or leave it empty.'
                } else {
                    $values.ROUTER_APP_PORT = Ask 'Port for the app on this computer' $values.ROUTER_APP_PORT { param($v) $v -match '^\d+$' -and [int]$v -ge 1024 -and [int]$v -le 65535 } 'Enter a number from 1024 to 65535.'
                }
                $step++
            }
            3 {
                Clear-Host
                Write-Host 'Review' -ForegroundColor Cyan
                $values.GetEnumerator() | ForEach-Object { Write-Host ("  {0,-18} {1}" -f $_.Key, $_.Value) }
                $pick = Choose 'Write these settings and start the app?' @('Start the app', 'Go back and change something')
                if ($pick -eq 0) { $step = 4 } else { $step = 0 }
            }
        }
    }
}

# Keep any unrelated lines a person added to .env.
$lines = [System.Collections.Generic.List[string]]::new()
if (Test-Path $EnvFile) { foreach ($line in Get-Content $EnvFile) { if ($line -notmatch '^(ROUTER_APP_PORT|ROUTER_APP_TAG|ROUTER_APP_DEMO|ROUTER_APP_NETWORK|ROUTER_APP_LAN_IP|ROUTER_APP_LAN_PARENT|ROUTER_APP_LAN_SUBNET|ROUTER_APP_LAN_GATEWAY)=') { $lines.Add($line) } } }
foreach ($entry in $values.GetEnumerator()) { $lines.Add("$($entry.Key)=$($entry.Value)") }
Set-Content -Path $EnvFile -Value $lines -Encoding ascii
Write-Host "Saved $EnvFile" -ForegroundColor Green

$hostArgs = @('--detached', '--port', $values.ROUTER_APP_PORT, '--tag', $values.ROUTER_APP_TAG)
if ($values.ROUTER_APP_DEMO -eq '1') { $hostArgs += '--demo' }
if ($values.ROUTER_APP_NETWORK -eq 'lan') {
    $hostArgs += @('--lan-ip', $values.ROUTER_APP_LAN_IP)
    if ($values.ROUTER_APP_LAN_PARENT) { $hostArgs += @('--lan-parent', $values.ROUTER_APP_LAN_PARENT) }
    if ($values.ROUTER_APP_LAN_SUBNET) { $hostArgs += @('--lan-subnet', $values.ROUTER_APP_LAN_SUBNET) }
    if ($values.ROUTER_APP_LAN_GATEWAY) { $hostArgs += @('--lan-gateway', $values.ROUTER_APP_LAN_GATEWAY) }
}
if ($Remote) { $hostArgs += @('--remote', $Remote) }
& (Join-Path $PSScriptRoot 'host.ps1') @hostArgs
exit $LASTEXITCODE
