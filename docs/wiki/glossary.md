---
title: Glossary
order: 2
summary: Plain definitions of the words used in the app and the documentation, from AiMesh to WPS, with links to the full guides.
---

Short definitions, in alphabetical order. Where a longer guide exists, the entry links to it. Addresses in examples use the documentation ranges 198.51.100.0/24 and 203.0.113.0/24, never real ones.

## A

**AiMesh**: ASUS's way of linking several compatible routers or nodes into one Wi-Fi network with a single name. See [Manage an AiMesh network](../articles/connect/aimesh-management.md).

**AiProtection**: ASUS's built-in security suite, powered by a third-party threat list. See [AiProtection](../articles/security/aiprotection.md).

**Access point**: A device that provides Wi-Fi. A router is one, and so is every mesh node.

**Adaptive QoS**: A traffic priority method that recognises kinds of traffic and ranks them for you. See [Traffic priority modes](../articles/connect/qos-modes.md).

**Asuswrt-Merlin**: A community-maintained firmware for many Asus routers that adds features to the stock ASUS firmware. Some controls in the app exist only on Merlin and are shown disabled, with the reason, on stock firmware. See [firmware detection](../articles/setup/firmware-detection.md) and [Stock or Merlin](../articles/reference/stock-vs-merlin.md).

**Authenticator**: An app on your phone that makes a six-digit code that changes every 30 seconds, used as a second sign-in step.

## B

**Backhaul**: The link a mesh node uses to reach the main router, wired or wireless.

**Band**: A range of radio frequencies. Wi-Fi uses 2.4 GHz, 5 GHz and, on newer models, 6 GHz.

**Beamforming**: Shaping the radio signal so more of it reaches the device that is talking. See [Beamforming](../articles/wireless/beamforming.md).

**Bridge mode**: Making a router stop translating addresses so a router in front of it does the work. Used to fix double NAT.

## C

**Channel**: One slice of a Wi-Fi band. Neighbours on the same or overlapping channels slow each other down.

**Connection guard**: A timer placed on the router before a risky change. If the app cannot reach the router afterwards, the timer restores the old values by itself. See the [guide](../articles/safety/connection-guard.md) and the [timeline](../articles/workflows/guard-timeline.md).

**Cron**: The scheduler that runs a command at set times. Merlin only. See [Cron jobs](../articles/merlin/cron-jobs.md).

## D

**Demo mode**: A built-in pretend router that lets anyone try the app with no real router. Its numbers are made up.

**DFS**: Dynamic Frequency Selection. Some 5 GHz channels are shared with radar, so the router must listen for it and move away. See [DFS channels](../articles/wireless/dfs-channels.md).

**DHCP**: The service on the router that hands out addresses to devices when they join the network. A *reservation* gives one device the same address every time. See [Plan the address pool](../articles/lan/dhcp-pool-planning.md).

**DMZ host**: One device that receives all unsolicited incoming traffic. The riskiest way to let traffic in. See [DMZ host](../articles/lan/dmz.md).

**DNS**: The service that turns a name such as a website into an address. See [network tools](../articles/tools/network-tools.md).

**DNS Director**: A Merlin feature that forces chosen devices to use chosen DNS servers. See [DNS Director](../articles/internet/dns-director.md).

**DNS over TLS (DoT)**: DNS lookups wrapped in encryption on port 853. See [DNS over TLS](../articles/internet/dns-over-tls.md).

**Double NAT**: Two routers in a row both translating addresses. Often breaks port forwarding and some VPNs.

**Dual WAN**: Using two internet connections, for backup or sharing. See [Dual WAN](../articles/internet/dual-wan.md).

**DDNS**: Dynamic DNS. A name that always points to your home address even when the provider changes it. See [Dynamic DNS](../articles/router/dynamic-dns.md).

## E

**Entware**: A community package repository that adds programs to Merlin routers using a USB drive. See [Entware](../articles/merlin/entware.md).

**Ethernet backhaul**: A mesh node connected to the main router by cable. The best option.

## F

**Failover**: Switching to a backup internet connection when the main one fails.

**Firewall**: The router's rule list that decides which connections are allowed. See [Firewall rules in practice](../articles/security/firewall-rules.md).

**Firmware**: The software that runs the router. The app detects whether it is stock ASUS firmware or Asuswrt-Merlin.

## G

**Gateway**: The device that traffic goes to when it is leaving a network. At home, it is the router.

**Guest network**: A separate Wi-Fi for visitors, kept apart from your devices. See [Guest network](../articles/router/guest-network.md).

## H

**Hardware address (MAC address)**: The identifier of a network card, written like `AA:BB:CC:DD:EE:FF`. Phones may use a random one per network.

**Hidden network**: A Wi-Fi network that does not broadcast its name. It adds no real security.

**Host key**: The fingerprint an SSH server presents to prove which device it is. The app asks you to approve it once and then pins it. See [host key pinning](../articles/safety/host-key-pinning.md).

## I

**IGMP**: The protocol devices use to ask for multicast streams, such as TV. See [IPTV and VLAN tagging](../articles/internet/iptv-vlan.md).

**IPv4 and IPv6**: The two kinds of internet address. IPv6 has so many that every device can have a public one. See [IPv6](../articles/internet/ipv6.md).

**IPTV**: Television delivered over the internet connection, often on its own VLAN.

## J

**JFFS**: The small permanent storage area inside the router where Merlin keeps scripts.

## L

**LAN**: The local network inside your home.

**Lease**: How long a device may keep an address from DHCP before it asks again.

## M

**MAC filter**: A list of hardware addresses allowed or refused on Wi-Fi. See [Wireless MAC filter](../articles/wireless/mac-filter.md).

**Mesh**: Several access points working as one Wi-Fi network.

**Merlin script**: A script that runs when the router does something, such as start up. See [Merlin custom scripts](../articles/merlin/merlin-scripts.md).

**MU-MIMO**: Talking to several devices at once using different antennas. See [OFDMA and MU-MIMO](../articles/wireless/ofdma.md).

**Multicast**: One stream sent to many listeners, used by TV and some audio systems.

## N

**NAT**: The router feature that lets many devices share one public address. See [NAT passthrough](../articles/lan/nat-passthrough.md).

**Node**: A mesh access point that is not the main router.

**nvram**: The router's stored settings. The app shows them with friendly names and keeps the raw name in the Advanced view.

## O

**OFDMA**: Splitting a Wi-Fi channel into small slices so many devices share one transmission.

**Operator**: A role that can view the router and change settings. See [accounts and roles](../articles/app/accounts-and-roles.md).

**Owner**: The first account created. It can also manage people and the router connection.

**OpenVPN**: A widely supported VPN protocol. See [OpenVPN](../articles/router/vpn-openvpn.md).

## P

**Packet loss**: Messages that never arrive. A little is normal on Wi-Fi, a lot is a fault.

**Peer**: In WireGuard, a device allowed to join the server. See [WireGuard peers and keys](../articles/connect/wireguard-peers.md).

**Ping**: A tiny test message that measures whether an address answers and how long it takes. See [Router tools](../articles/workflows/router-tools.md).

**Port**: A number that says which service on a device traffic is for, such as 443 for secure web pages.

**Port forwarding**: Sending traffic that arrives from outside on a chosen port to a device on your network. See [Forward a port safely](../articles/security/port-forward-safely.md).

**Port triggering**: Opening a port only after a device inside connects out on another. See [Port triggering](../articles/lan/port-triggering.md).

**PPPoE**: A login-style connection type some providers use. See [Choosing a connection type](../articles/internet/wan-types.md).

**Preview**: The list of old and new values shown before any change is applied. See [preview, confirm and apply](../articles/safety/safe-changes.md).

**Prefix length**: The number after a slash in an address range, such as the 24 in `198.51.100.0/24`.

## Q

**QoS**: Quality of service, also called traffic priority: deciding which kinds of traffic get bandwidth first.

## R

**Roaming**: A device moving from one access point or band to a stronger one. See [Roaming](../articles/wireless/roaming.md).

**Route**: A rule saying which way to send traffic for a network. See [Static routes](../articles/lan/static-routes.md).

## S

**SLAAC**: How IPv6 devices pick their own addresses without a server.

**Smart Connect**: One Wi-Fi name for all bands, with the router choosing the band. See [Smart Connect](../articles/wireless/smart-connect.md).

**SSH**: The secure remote login that the app uses to talk to the router. See [SSH keys](../articles/merlin/ssh-keys.md).

**SSID**: The name of a Wi-Fi network.

**Subnet**: A block of addresses that belong to one network, written like `198.51.100.0/24`. See [Subnet calculator](../articles/tools/subnet-calculator.md).

**Super confirmation**: A two-step confirmation for destructive actions such as reboot. See [Super confirmation](../articles/safety/super-confirmation.md).

## T

**Target Wake Time (TWT)**: A Wi-Fi 6 feature that lets battery devices sleep between agreed wake-ups. See [Target Wake Time](../articles/wireless/target-wake-time.md).

**Traceroute**: A test that lists the hops traffic crosses to reach a destination.

**TTL**: A counter that stops a packet circling forever. Traceroute uses it.

## U

**UPnP**: Lets devices ask the router to open ports for themselves. See [UPnP](../articles/lan/upnp.md).

## V

**Vault**: The encrypted store for the router password or key. See [the encrypted vault](../articles/safety/encrypted-vault.md).

**Viewer**: A role that can look but not change.

**VLAN**: A virtual network on shared cabling, marked by a number tag. See [IPTV and VLAN tagging](../articles/internet/iptv-vlan.md).

**VPN**: A private, encrypted tunnel. See [VPN](../articles/router/vpn.md), [Pick a VPN server type](../articles/connect/vpn-servers.md) and [VPN Director](../articles/connect/vpn-director.md).

## W

**WAN**: The side of the router facing your provider and the internet.

**Wake-on-LAN**: A special packet that switches on a device that has been set up to listen for it, on the local network only.

**WireGuard**: A modern, fast VPN protocol using key pairs. See [WireGuard](../articles/router/vpn-wireguard.md).

**WPA2 and WPA3**: Wi-Fi encryption standards. WPA3 is newer and stronger. See [Wi-Fi](../articles/router/wifi.md).

**WPS**: A push-button or PIN way to join Wi-Fi without a password. The PIN method is unsafe. See [WPS](../articles/wireless/wps.md).
