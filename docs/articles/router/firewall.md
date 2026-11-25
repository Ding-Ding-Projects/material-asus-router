---
title: Firewall
category: router
order: 10
summary: Understand each firewall switch before you change it, and keep the router hard to scan.
status: in-progress
related: router/port-forwarding, router/parental-controls, router/merlin-extras, safety/safe-changes
---

The firewall decides which connections from the internet may reach your network. The defaults are good. This guide explains each switch in plain words, so that if you change one you know what you are trading.

> [!NOTE]
> **In progress.** The switches and their explanations are defined; the screen, any custom rule editor and real-router tests are still being built. Custom firewall rules are planned and are not available yet.

## Switches

| Control | What it does | Safe recommendation |
| --- | --- | --- |
| Firewall | Blocks connections from the internet that nobody asked for | Keep on. Turning it off exposes every device |
| Answer ping from the internet | Lets outsiders check that your address is alive | Keep off; hides you from simple scans |
| Flood protection (DoS protection) | Drops floods of connection attempts | On is fine. It can slow some online games; turn off only if you see that |
| IPv6 firewall | Protects devices that have their own IPv6 internet address | Keep on. IPv6 devices are directly reachable without it |

Every one of these shows the explanation above next to the switch, together with the risk level. Turning the main firewall off is shown as high risk in the preview.

## Change a switch

1. Open **Firewall**.
2. Flip the switch. The preview says what will change, for example "Outsiders will no longer get a reply when they ping your address".
3. Confirm. Firewall changes restart the firewall service for a moment. Existing connections can drop briefly.
4. The app arms the connection-loss guard when a mistake could block your own management connection.

## Check what is exposed

Your firewall is only as good as the doors you opened. Use this routine every few months:

1. Open [Port forwarding](port-forwarding.md) and remove forwards you no longer need.
2. Check that remote administration of the router from the internet is off ([System](system.md)).
3. Check that any [VPN](vpn.md) server uses a strong secret and a current protocol.
4. From a phone on mobile data, scan your public address with a trusted port-scan site and compare the result with your list.

## Custom rules (planned)

Custom allow and block rules by address, port and direction are planned. On Asuswrt-Merlin they will also be able to use the router's own script hooks; see [Merlin extras](merlin-extras.md). Until then, use the switches here and [Parental controls](parental-controls.md) for time-based blocking.

## Stock and Merlin differences

| Item | Stock ASUS | Asuswrt-Merlin |
| --- | --- | --- |
| The four switches above | Yes | Yes |
| Network service filter and URL filter | Yes (model dependent) | Yes |
| Firewall script hooks | No | Yes |

## Status

| Part | State |
| --- | --- |
| Switch definitions and help text | Built |
| Firewall screen | In progress |
| Custom rules | Planned, not built |
