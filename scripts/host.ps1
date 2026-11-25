# Material Asus Router host script, started by host.bat. It runs the published image with
# the tracked compose.yaml, on this computer or on a Docker host reached over SSH
# (DOCKER_HOST=ssh://user@host), waits for the health check, checks the page from this
# computer and prints the address to open. With --lan-ip it also uses compose.lan.yaml so the
# app takes its own address on the home network (macvlan) instead of a published port.
param([Parameter(ValueFromRemainingArguments = $true)] [string[]] $Arguments)

# Native commands report through their exit codes; stderr from docker is normal output here.
$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent $PSScriptRoot
$Compose = Join-Path $Root 'compose.yaml'
$ComposeLan = Join-Path $Root 'compose.lan.yaml'
$HelperImage = 'busybox:1.36'
$Container = 'material-asus-router'

$Mode = $null
$Remote = $null
$Port = 8790
$Tag = 'latest'
$SkipPull = $false
$Demo = $false
$LanIp = ''
$LanParent = ''
$LanSubnet = ''
$LanGateway = ''
for ($i = 0; $i -lt $Arguments.Count; $i++) {
    switch ($Arguments[$i]) {
        '--detached' { $Mode = 'detached' }
        '--logs' { $Mode = 'logs' }
        '--stop' { $Mode = 'stop' }
        '--remote' { $Remote = $Arguments[++$i] }
        '--port' { $Port = [int]$Arguments[++$i] }
        '--tag' { $Tag = $Arguments[++$i] }
        '--skip-pull' { $SkipPull = $true }
        '--demo' { $Demo = $true }
        '--lan-ip' { $LanIp = $Arguments[++$i] }
        '--lan-parent' { $LanParent = $Arguments[++$i] }
        '--lan-subnet' { $LanSubnet = $Arguments[++$i] }
        '--lan-gateway' { $LanGateway = $Arguments[++$i] }
        default { Write-Host "Unknown option: $($Arguments[$i])" -ForegroundColor Red; exit 2 }
    }
}

function Fail([string] $Message) {
    Write-Host ''
    Write-Host "Failed: $Message" -ForegroundColor Red
    exit 1
}

$Ipv4 = '^((25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(25[0-5]|2[0-4]\d|1?\d?\d)$'
$Cidr = '^((25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(25[0-5]|2[0-4]\d|1?\d?\d)/(3[0-2]|[12]?\d)$'

function Use-Target {
    if ($script:Remote) {
        if ($script:Remote -notmatch '^[A-Za-z0-9._-]+@[A-Za-z0-9.:-]+$') { Fail "the remote target must look like user@host, not '$($script:Remote)'." }
        $env:DOCKER_HOST = "ssh://$($script:Remote)"
    } else {
        Remove-Item Env:DOCKER_HOST -ErrorAction SilentlyContinue
    }
    $env:ROUTER_APP_PORT = "$script:Port"
    $env:ROUTER_APP_TAG = $script:Tag
    $env:ROUTER_APP_DEMO = if ($script:Demo) { '1' } else { '0' }
    if ($script:LanIp) {
        $env:ROUTER_APP_LAN_IP = $script:LanIp
        $env:ROUTER_APP_LAN_PARENT = $script:LanParent
        $env:ROUTER_APP_LAN_SUBNET = $script:LanSubnet
        $env:ROUTER_APP_LAN_GATEWAY = $script:LanGateway
    }
}

# The compose files used to start the app. Stop, status and logs use compose.yaml alone: they
# find the container by its project and need none of the own-address settings.
function Up-Files { if ($script:LanIp) { return @('-f', $Compose, '-f', $ComposeLan) } else { return @('-f', $Compose) } }

function Target-Name { if ($script:Remote) { $script:Remote } else { 'this computer' } }

function Lan-Address {
    if ($script:Remote) {
        $hostPart = $script:Remote.Split('@')[1]
        if ($hostPart -match '^\d+\.\d+\.\d+\.\d+$') { return $hostPart }
        try { return ([System.Net.Dns]::GetHostAddresses($hostPart) | Where-Object AddressFamily -eq 'InterNetwork' | Select-Object -First 1).IPAddressToString } catch { return $hostPart }
    }
    $route = Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue | Sort-Object RouteMetric | Select-Object -First 1
    if ($route) {
        $ip = Get-NetIPAddress -InterfaceIndex $route.InterfaceIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($ip) { return $ip.IPAddress }
    }
    return '127.0.0.1'
}

function Check-Runtime {
    Write-Host "Checking Docker on $(Target-Name)..."
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { Fail 'the docker command is not installed on this computer. Install Docker Desktop, then run this again.' }
    docker compose version *> $null
    if ($LASTEXITCODE -ne 0) { Fail 'Docker Compose is not available. Update Docker Desktop, then run this again.' }
    docker info --format '{{.ServerVersion}}' *> $null
    if ($LASTEXITCODE -ne 0) {
        if ($script:Remote) { Fail "Docker on $($script:Remote) cannot be reached over SSH. Check that 'ssh $($script:Remote) docker info' works without a password prompt." }
        Fail 'Docker is installed but not running. Start Docker Desktop, then run this again.'
    }
}

# Runs a short-lived busybox container on the target Docker host, on that host's own network.
function Invoke-Helper([string] $Script, [hashtable] $Environment = @{}) {
    $runArgs = @('run', '--rm', '--network', 'host')
    foreach ($key in $Environment.Keys) { $runArgs += @('-e', "$key=$($Environment[$key])") }
    $runArgs += @($HelperImage, 'sh', '-c', $Script)
    return @(docker @runArgs 2>$null)
}

function Network-Of([string] $Address, [int] $Prefix) {
    $bytes = [System.Net.IPAddress]::Parse($Address).GetAddressBytes()
    [Array]::Reverse($bytes)
    $value = [BitConverter]::ToUInt32($bytes, 0)
    $mask = if ($Prefix -eq 0) { [uint32]0 } else { [uint32]([uint32]::MaxValue -shl (32 - $Prefix)) }
    $net = [BitConverter]::GetBytes([uint32]($value -band $mask))
    [Array]::Reverse($net)
    return "$(([System.Net.IPAddress]::new($net)).IPAddressToString)/$Prefix"
}

# Fills in whatever of the parent interface, subnet and gateway was not given: first by asking
# the target Docker host (a Linux host, over the same connection), then the person.
function Resolve-Lan {
    if ($script:LanIp -notmatch $Ipv4) { Fail "--lan-ip must be an IPv4 address, not '$($script:LanIp)'." }
    if ($script:LanSubnet -and $script:LanSubnet -notmatch $Cidr) { Fail "--lan-subnet must look like 198.51.100.0/24, not '$($script:LanSubnet)'." }
    if ($script:LanGateway -and $script:LanGateway -notmatch $Ipv4) { Fail "--lan-gateway must be an IPv4 address, not '$($script:LanGateway)'." }
    if ($script:LanParent -and $script:LanParent -notmatch '^[A-Za-z0-9._-]{1,15}$') { Fail "--lan-parent must be an interface name such as eth0, not '$($script:LanParent)'." }
    $system = docker info --format '{{.OperatingSystem}}' 2>$null
    if ("$system" -match 'Docker Desktop') { Fail "its own address needs Docker on a Linux host. Docker Desktop on $(Target-Name) cannot give a container an address on the home network. Use --remote with a Linux Docker host, or the published-port mode." }
    if (-not ($script:LanParent -and $script:LanSubnet -and $script:LanGateway)) {
        Write-Host "Looking up the network on $(Target-Name)..."
        $found = Invoke-Helper 'ip -4 route show default; echo ---; ip -4 -o addr show'
        $default = $found | Where-Object { $_ -match '^default via (\S+) dev (\S+)' } | Select-Object -First 1
        if ($default -match '^default via (\S+) dev (\S+)') {
            if (-not $script:LanGateway) { $script:LanGateway = $Matches[1] }
            if (-not $script:LanParent) { $script:LanParent = $Matches[2] }
        }
        if (-not $script:LanSubnet -and $script:LanParent) {
            $line = $found | Where-Object { $_ -match "^\d+:\s+$([regex]::Escape($script:LanParent))\s+inet (\S+)/(\d+)" } | Select-Object -First 1
            if ($line -match 'inet (\S+)/(\d+)') { $script:LanSubnet = Network-Of $Matches[1] ([int]$Matches[2]) }
        }
    }
    $asks = @(
        @{ Name = 'LanParent'; Text = 'the host network interface, for example eth0' },
        @{ Name = 'LanSubnet'; Text = 'the network in CIDR form, for example 198.51.100.0/24' },
        @{ Name = 'LanGateway'; Text = "the router's address, for example 198.51.100.1" }
    )
    foreach ($ask in $asks) {
        if (-not (Get-Variable -Name $ask.Name -Scope Script -ValueOnly)) {
            if ([Console]::IsInputRedirected) { Fail "could not work out $($ask.Text) on $(Target-Name). Pass --lan-parent, --lan-subnet and --lan-gateway." }
            Set-Variable -Name $ask.Name -Scope Script -Value ((Read-Host "Enter $($ask.Text)").Trim())
        }
    }
    if ($script:LanSubnet -notmatch $Cidr) { Fail "the subnet '$($script:LanSubnet)' is not in CIDR form such as 198.51.100.0/24." }
    if ($script:LanGateway -notmatch $Ipv4) { Fail "the gateway '$($script:LanGateway)' is not an IPv4 address." }
    if ($script:LanParent -notmatch '^[A-Za-z0-9._-]{1,15}$') { Fail "the interface '$($script:LanParent)' is not a valid interface name." }
    $env:ROUTER_APP_LAN_PARENT = $script:LanParent
    $env:ROUTER_APP_LAN_SUBNET = $script:LanSubnet
    $env:ROUTER_APP_LAN_GATEWAY = $script:LanGateway
    Write-Host "Own address $($script:LanIp) on $($script:LanSubnet), gateway $($script:LanGateway), interface $($script:LanParent)."
}

# Refuses an address that already answers: it must be free before the app takes it. The check
# runs from a short-lived container on the target host's own network.
function Test-LanFree {
    Write-Host "Checking that $($script:LanIp) is not already in use..."
    $result = Invoke-Helper 'if ping -c 2 -W 1 $CHECK_IP >/dev/null 2>&1; then echo ANSWERED; else ip neigh show to $CHECK_IP; fi' @{ CHECK_IP = $script:LanIp }
    if ($LASTEXITCODE -ne 0) { Fail "the address check could not run on $(Target-Name). Check that Docker can pull $HelperImage there." }
    if ($result -contains 'ANSWERED') { Fail "$($script:LanIp) already answers on the network. Choose an address that nothing uses." }
    if ($result | Where-Object { $_ -match 'lladdr' -and $_ -notmatch 'FAILED|INCOMPLETE' }) { Fail "$($script:LanIp) is already known to the network by a hardware address. Choose an address that nothing uses." }
    Write-Host 'Nobody answers there. Good.'
}

function Start-App {
    Use-Target
    Check-Runtime
    if ($script:LanIp) {
        Resolve-Lan
        # An app that is already running with this address is being updated, not claiming it.
        $running = docker inspect --format '{{.State.Running}}' $Container 2>$null
        if ($running -ne 'true') { Test-LanFree }
    }
    if ($script:SkipPull) {
        # An image built or loaded on the host already, for example while a release is pending.
        docker image inspect "ghcr.io/ding-ding-projects/material-asus-router:$script:Tag" *> $null
        if ($LASTEXITCODE -ne 0) { Fail "--skip-pull was given, but ghcr.io/ding-ding-projects/material-asus-router:$script:Tag is not on $(Target-Name)." }
        Write-Host "Using ghcr.io/ding-ding-projects/material-asus-router:$script:Tag already on $(Target-Name)."
    } else {
        Write-Host "Pulling ghcr.io/ding-ding-projects/material-asus-router:$script:Tag..."
        docker compose @(Up-Files) pull 2>&1 | Out-Host
        if ($LASTEXITCODE -ne 0) { Fail 'the image could not be pulled. Check the network and the version given with --tag.' }
    }
    Write-Host 'Starting...'
    docker compose @(Up-Files) up -d 2>&1 | Out-Host
    if ($LASTEXITCODE -ne 0) { Fail $(if ($script:LanIp) { "the app did not start with its own address. Check the parent interface, subnet and gateway, and that $script:LanIp is outside the router's DHCP pool." } else { "the app did not start. If port $script:Port is taken, run again with --port and another number." }) }
    Write-Host -NoNewline 'Waiting for the health check'
    $healthy = $false
    for ($n = 0; $n -lt 45; $n++) {
        $health = docker inspect --format '{{.State.Health.Status}}' $Container 2>$null
        if ($health -eq 'healthy') { $healthy = $true; break }
        Write-Host -NoNewline '.'
        Start-Sleep -Seconds 2
    }
    Write-Host ''
    if (-not $healthy) { Fail "the app started but did not report healthy within 90 seconds. Run 'host.bat --logs$(if ($script:Remote) { " --remote $($script:Remote)" })' to see why." }
    if ($script:LanIp) {
        # The container has its own address. This computer reaches it only when the Docker
        # host is a different machine: a macvlan container cannot be reached from its own host.
        $url = "http://$($script:LanIp):8790/"
        if (-not $script:Remote) {
            Write-Host ''
            Write-Host 'Material Asus Router is running with its own address on this computer.' -ForegroundColor Green
            Write-Host "Open from another device: $url" -ForegroundColor Green
            Write-Host 'This computer cannot reach a container that shares its network card, so the address was not checked from here.' -ForegroundColor Yellow
            return $url
        }
    } else {
        $url = "http://$(Lan-Address):$script:Port/"
    }
    try {
        $reply = Invoke-RestMethod -Uri "${url}health" -TimeoutSec 8
        if (-not $reply.ok) { throw 'no ok' }
    } catch {
        Fail "the app is healthy inside Docker, but $url does not answer from this computer. Check that this computer is on the same network and that nothing else uses $(if ($script:LanIp) { $script:LanIp } else { 'the port' })."
    }
    Write-Host ''
    Write-Host "Material Asus Router $($reply.version) is running on $(Target-Name)$(if ($script:LanIp) { ' with its own address' })." -ForegroundColor Green
    Write-Host "Open: $url" -ForegroundColor Green
    return $url
}

function Stop-App {
    Use-Target
    Check-Runtime
    docker compose -f $Compose stop 2>&1 | Out-Host
    if ($LASTEXITCODE -ne 0) { Fail 'the app could not be stopped.' }
    Write-Host 'Stopped. Its settings, vault and change history are kept for the next start.' -ForegroundColor Green
}

# Live status and logs. F pauses or resumes following, S switches the service, R refreshes
# the status line, Q leaves the view. Leaving never stops the app.
function Watch-Logs([string] $Url) {
    $services = @(docker compose -f $Compose ps --services 2>$null | Where-Object { $_ })
    if ($services.Count -eq 0) { $services = @('asus-router') }
    $index = 0
    $follow = $true
    $since = (Get-Date).ToUniversalTime().AddMinutes(-10).ToString('yyyy-MM-ddTHH:mm:ssZ')
    $redraw = $true
    while ($true) {
        $service = $services[$index]
        if ($redraw) {
            Clear-Host
            $state = docker compose -f $Compose ps --format '{{.Service}}: {{.State}} {{.Health}}' 2>$null
            Write-Host "Material Asus Router on $(Target-Name)   $Url" -ForegroundColor Cyan
            Write-Host ("Status: " + ($state -join '  '))
            Write-Host "Service: $service   [F] $(if ($follow) { 'pause' } else { 'follow' })   [S] switch service   [R] refresh   [Q] leave (keeps it running)" -ForegroundColor DarkGray
            Write-Host ('-' * 80) -ForegroundColor DarkGray
            $redraw = $false
        }
        if ($follow) {
            $now = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
            docker compose -f $Compose logs --no-color --since $since --until $now $service 2>$null | ForEach-Object { Write-Host $_ }
            $since = $now
        }
        $deadline = (Get-Date).AddSeconds(1)
        while ((Get-Date) -lt $deadline) {
            if ([Console]::KeyAvailable) {
                $key = [Console]::ReadKey($true).Key
                switch ($key) {
                    'Q' { Write-Host ''; Write-Host 'Left the log view. The app is still running.' -ForegroundColor Green; return }
                    'Escape' { Write-Host ''; Write-Host 'Left the log view. The app is still running.' -ForegroundColor Green; return }
                    'F' { $follow = -not $follow; $redraw = $true }
                    'S' { $index = ($index + 1) % $services.Count; $since = (Get-Date).ToUniversalTime().AddMinutes(-10).ToString('yyyy-MM-ddTHH:mm:ssZ'); $redraw = $true }
                    'R' { $redraw = $true }
                }
                break
            }
            Start-Sleep -Milliseconds 100
        }
    }
}

function Choose([string] $Title, [string[]] $Options) {
    Write-Host ''
    Write-Host $Title -ForegroundColor Cyan
    for ($i = 0; $i -lt $Options.Count; $i++) { Write-Host "  [$($i + 1)] $($Options[$i])" }
    while ($true) {
        $key = [Console]::ReadKey($true).KeyChar
        $n = [int]::TryParse("$key", [ref]$null)
        if ($n -and [int]"$key" -ge 1 -and [int]"$key" -le $Options.Count) { return [int]"$key" }
    }
}

if (-not $Mode) {
    Write-Host 'Material Asus Router' -ForegroundColor Cyan
    # The last SSH target is remembered on this computer only, never in the repository.
    $memory = Join-Path $env:LOCALAPPDATA 'MaterialAsusRouter\last-remote.txt'
    $last = if (Test-Path $memory) { (Get-Content $memory -Raw).Trim() } else { '' }
    $options = @('This computer (local Docker)')
    if ($last) { $options += "$last over SSH" }
    $options += 'Another Docker host over SSH'
    $where = Choose 'Where should it run?' $options
    if ($last -and $where -eq 2) { $Remote = $last }
    elseif ($where -gt 1) {
        $Remote = (Read-Host 'SSH target (user@host)').Trim()
        New-Item -ItemType Directory -Force -Path (Split-Path $memory) | Out-Null
        Set-Content -Path $memory -Value $Remote
    }
    $how = Choose 'How should people reach it?' @('On a port of that computer', 'Its own address on the home network')
    if ($how -eq 2) { $LanIp = (Read-Host 'Address for the app, outside the router DHCP pool (for example 198.51.100.50)').Trim() }
    $what = Choose 'What should it do?' @('Start in the background', 'Start and watch status and logs', 'Stop', 'Quit')
    $Mode = @('detached', 'logs', 'stop', 'quit')[$what - 1]
    if ($Mode -eq 'quit') { exit 0 }
}

switch ($Mode) {
    'detached' { [void](Start-App) }
    'logs' { $url = Start-App; Watch-Logs $url }
    'stop' { Stop-App }
}
exit 0
