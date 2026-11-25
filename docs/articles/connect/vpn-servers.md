---
title: Pick a VPN server type
category: connect
order: 2
summary: Compare OpenVPN, WireGuard, IPsec and PPTP servers so you can reach your home network safely from outside.
status: in-progress
related: router/vpn, router/vpn-openvpn, router/vpn-wireguard, connect/wireguard-peers, internet/dual-wan
---

A VPN server on the router lets you join your home network from a hotel, a cafe or work, so you can reach files, cameras and printers as if you were at home, and so your traffic is encrypted on public Wi-Fi. This is safer than opening the router's page or your devices to the internet.

The app can already switch the OpenVPN and WireGuard servers and set their port and protocol. See [VPN](../router/vpn.md), [OpenVPN](../router/vpn-openvpn.md) and [WireGuard](../router/vpn-wireguard.md).

## Compare the types

| Type | Speed | Setup | Notes |
| --- | --- | --- | --- |
| WireGuard | Fastest, light on the router | One key pair per device | Modern and simple. Best first choice if your model has it |
| OpenVPN | Good, heavier on the router | Export a profile file per user | Very widely supported, works through strict networks on port 443 over TCP |
| IPsec | Good | Built into many phones | Varies by firmware. Sometimes fiddly on mobile networks |
| PPTP | Fast | Easy | Avoid. Its encryption is broken |

## Before you start

1. **A reachable address.** The server needs your home's public address. Use [Dynamic DNS](../router/dynamic-dns.md) so a name always finds you.
2. **No double NAT.** A router behind another router cannot be reached from outside without forwarding the port on the first one. See [Troubleshooting by symptom](../reference/troubleshooting-by-symptom.md).
3. **A free address range.** Do not let the VPN's address range overlap with your home range or with the network you visit. See [Plan the address pool](../lan/dhcp-pool-planning.md).

## Steps

1. Open **VPN** and switch on the server you chose.
2. Check the port and protocol. Defaults are fine.
3. Read the preview and confirm. The VPN service restarts. Connected users drop and reconnect.
4. Create a profile or key for each person or device. Give each its own, so you can remove one without affecting the rest.
5. Test from outside using mobile data, not your home Wi-Fi.

> [!TIP]
> If you are connected to the router through the VPN and change VPN settings, you can cut yourself off. The [guard](../safety/connection-guard.md) will restore the old setting.

## Keep it safe

- Anyone with a profile can reach your home network, so protect the files and revoke lost devices.
- Keep firmware up to date: VPN code is a frequent target.
- Consider whether you need a server at all. A simple alternative is reaching a single service through a [safe port forward](../security/port-forward-safely.md), but a VPN is generally the better choice.

## Status

| Part | State |
| --- | --- |
| Server switch, port and protocol | Built |
| Profile and key management | In progress |
