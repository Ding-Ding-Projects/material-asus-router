---
title: Internet and DNS
category: router
order: 5
summary: Choose the connection type and the DNS servers the router uses to reach the internet.
status: in-progress
related: router/dynamic-dns, router/local-network, safety/connection-guard, tools/network-tools
---

The Internet area controls how the router connects to your provider and which name servers (DNS) it uses to turn names such as `example.com` into addresses. Most homes never need to change it, but it is where you fix "the router is on but nothing loads".

> [!NOTE]
> **In progress.** Connection type and DNS controls are defined; the screen, status readout and real-router tests are still being built.

> [!WARNING]
> A wrong connection type or wrong DNS can take the whole network offline. These changes are guarded: the app arms a timed revert first, and restores the old values if it cannot reach the router afterwards. Remember that the guard protects your link to the router, not your link to the internet. If the internet itself breaks, [undo](../safety/undo-changes.md) the change.

## Controls

| Control | What it does | Safe recommendation |
| --- | --- | --- |
| Connection type | How the router signs in to the provider: Automatic (DHCP), PPPoE, static address and others | Use Automatic unless your provider tells you otherwise |
| Use the provider's DNS | Takes name servers from the provider | Leave on unless you want a specific service |
| First DNS server | Name server used when the provider's DNS is off | A public resolver you trust, for example 1.1.1.1 |
| Second DNS server | Back-up if the first does not answer | A different provider's resolver, for example 9.9.9.9 |

PPPoE connections also need a user name and password from your provider. The password is typed once into a masked field, is never shown again, and is left out of previews and history.

## Check the connection

1. Open **Internet**. The status line says whether the router thinks it is connected, and shows its internet-side address.
2. If it says disconnected, check the cable and the provider's modem first.
3. If it says connected but pages do not load, the problem is often DNS. Use [Network tools](../tools/network-tools.md) to look up a name and see if it answers.

## Change the DNS servers

1. Turn off **Use the provider's DNS**.
2. Type a first and a second server.
3. Review the preview. It lists the old and new servers.
4. Confirm. The router restarts its name service, which takes a few seconds. Devices keep their addresses.
5. Look up a name with the lookup tool to check it works. If not, undo.

> [!TIP]
> Pick two servers from different providers. If one has an outage, the other still works.

## Change the connection type

Changing the type can disconnect the whole house for a minute while the router signs in again. Have your provider's details at hand. If you are unsure, do not change it. Ask the provider, or check the router's current values in [Advanced](advanced.md) first.

## Stock and Merlin differences

| Item | Stock ASUS | Asuswrt-Merlin |
| --- | --- | --- |
| Connection type, DNS | Yes | Yes |
| DNS over TLS and extra DNS filtering | Limited | More options |
| Dynamic DNS | Yes | Yes, with more providers; see [Dynamic DNS](dynamic-dns.md) |

## Status

| Part | State |
| --- | --- |
| Connection type and DNS control definitions | Built |
| Internet screen and status readout | In progress |
| Real-router test of a connection change | Not yet |

## Go deeper

- [Choosing a connection type](../internet/wan-types.md)
- [Dual WAN](../internet/dual-wan.md)
- [IPv6](../internet/ipv6.md)
- [IPTV and VLAN tagging](../internet/iptv-vlan.md)
- [DNS over TLS](../internet/dns-over-tls.md)
- [DNS Director](../internet/dns-director.md)
