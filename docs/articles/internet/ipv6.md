---
title: IPv6
category: internet
order: 3
summary: What IPv6 changes at home, the connection modes the router offers, and why the IPv6 firewall matters more than it does for IPv4.
status: in-progress
related: router/firewall, router/internet, internet/wan-types, wiki:glossary
---

IPv4 addresses ran short, so devices share one public address through NAT. IPv6 has so many addresses that every device can have its own public one. That is simpler for the network and makes NAT's accidental shield disappear: a device with a public IPv6 address can be reached from the internet unless a firewall says no.

> [!NOTE]
> **In progress.** The IPv6 firewall switch is built (see [Firewall](../router/firewall.md)). The IPv6 connection mode screen is not.

## What the router does

| Piece | Plain meaning |
| --- | --- |
| Prefix delegation | The provider gives the router a block of addresses. The router carves it up for your LAN |
| SLAAC | Devices pick their own address inside that block, with no server needed |
| DHCPv6 | An optional server that hands addresses and DNS, like DHCP for IPv4 |
| Firewall | Blocks unsolicited incoming connections to those public addresses |

## Connection modes

| Mode | When to use it |
| --- | --- |
| Disabled | Your provider has no IPv6 or you want to avoid it |
| Native | The provider gives IPv6 directly. Pick this first |
| Passthrough | You run another device that should handle IPv6 |
| Tunnel (6in4, 6rd and similar) | The provider has no native IPv6 but offers a tunnel |

If unsure, try **Native** and see whether an address appears. If not, leave it disabled.

## Keep the firewall on

Leave the **IPv6 firewall** on. It allows replies to connections your devices started and blocks everything else. Open a port to one device on purpose only when you need it, and record why.

## Check that it works

1. In the connection status, look for an IPv6 address and prefix. Examples look like `2001:db8:1::/64`; real ones are yours alone.
2. From a device, load an IPv6-only test site you trust.
3. Run [name lookup](../tools/network-tools.md) and look for AAAA records.

## Common trouble

| Symptom | Likely cause |
| --- | --- |
| Slow first load, then fine | A site has broken IPv6. Turn IPv6 off to confirm |
| One device cannot be reached from outside | The IPv6 firewall is doing its job |

## Status

| Part | State |
| --- | --- |
| IPv6 firewall switch | Built |
| Connection mode and prefix display | In progress |
