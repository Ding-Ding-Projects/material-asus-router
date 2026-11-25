---
title: VPN
category: router
order: 13
summary: Choose between OpenVPN and WireGuard, understand client versus server, and see what your firmware supports.
status: in-progress
related: router/vpn-openvpn, router/vpn-wireguard, router/port-forwarding, router/dynamic-dns, router/firewall
---

A VPN makes an encrypted tunnel. Two roles are common, and it helps to keep them apart:

| Role | What it does | Example |
| --- | --- | --- |
| **Server** | Your router accepts connections, so you can reach home from outside | Reading files on your NAS from a hotel |
| **Client** | Your router connects out to a VPN provider, so devices behind it use that tunnel | Sending a streaming box through a provider's server |

> [!NOTE]
> **In progress.** Support detection per firmware is built; the VPN screens and the management of server and client profiles are still being built. See the two protocol guides for the current state of each.

## Which one to choose

| Question | OpenVPN | WireGuard |
| --- | --- | --- |
| Available on stock ASUS | Yes, on most models | On newer firmware versions and models only |
| Available on Asuswrt-Merlin | Yes | Yes, on supported models |
| Speed on the router | Slower, uses more processor | Usually faster |
| Compatibility | Very broad | Modern clients on all main systems |
| Set-up effort | More settings | Fewer settings |

If both are available, WireGuard is usually the better choice. If you need a protocol that works from almost any network, including strict ones, OpenVPN is the safer fallback.

## What the app does and does not do

- It shows which VPN types your router firmware supports, and disables the rest with the reason.
- It guides you through the settings and previews each change. Because starting or stopping a tunnel can cut your link, the connection-loss guard is armed.
- It never shows a private key or a password after you enter it.
- It does not run a VPN on the computer you are using. For that, import the exported profile into a VPN app on the device.

## Before you start a server

1. Make sure the router has a real public address and not one shared with other customers. Your provider can tell you.
2. Set up [Dynamic DNS](dynamic-dns.md) so you can use a name instead of a changing number.
3. Choose a port. The app creates the forwarding rule or tells you which port to forward; see [Port forwarding](port-forwarding.md).
4. Use a strong key or certificate and keep the list of allowed users short.

## Safety notes

> [!IMPORTANT]
> A VPN server is a door into your home. Keep the router firmware up to date ([Firmware](firmware.md)), remove clients you no longer use, and never share a client profile by an unprotected channel.

## Status

| Part | State |
| --- | --- |
| Detect what the firmware supports | Built |
| OpenVPN screens | In progress; see [OpenVPN](vpn-openvpn.md) |
| WireGuard screens | In progress; see [WireGuard](vpn-wireguard.md) |
| Real-router test | Not yet |

## See it in action

::sim[vpn-director]

*The panel above is a demonstration with made-up values. It does not read or change your router.*

## Go deeper

- [Pick a VPN server type](../connect/vpn-servers.md)
- [Use the router as a VPN client](../connect/vpn-client.md)
- [WireGuard peers and keys](../connect/wireguard-peers.md)
