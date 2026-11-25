---
title: Firewall rules in practice
category: security
order: 1
summary: How the router decides what to allow, a worked set of rules, and how to write a rule without cutting yourself off.
status: in-progress
related: router/firewall, security/port-forward-safely, security/hardening-checklist, safety/connection-guard
---

A firewall is a list of rules read from the top. The first rule that matches a connection decides what happens to it. If none match, the default applies. A home router's default is simple and good: connections started from inside are allowed, and connections started from outside are refused.

> [!NOTE]
> **In progress.** The firewall master switch, answer-ping, flood protection and IPv6 firewall controls are built (see [Firewall](../router/firewall.md)). A rule editor for per-device or per-service rules is planned.

::sim[firewall]

*The panel above is a demonstration with made-up connections. It does not read your router.*

## Rule anatomy

| Part | Meaning |
| --- | --- |
| Direction | Out (home to internet) or in (internet to home) |
| Source | Which device or network the connection comes from |
| Destination and port | Where it is going, and the service number such as 443 |
| Action | Allow or block |
| Schedule | Optional: only at certain times |

## A worked set (demonstration)

| # | Rule | Why |
| --- | --- | --- |
| 1 | Block the games console to port 25 | Console never needs outgoing mail |
| 2 | Block the guest network to the home network | Guests reach the internet only |
| 3 | Allow everything else out | The normal default |

Order matters: put narrow rules before broad ones. If rule 3 were first, rules 1 and 2 would never be reached.

## Write a rule without getting locked out

1. Never write a rule that blocks the device you are using, or the router's own address, until you have tested it from a second device.
2. Prefer **block one device** over **block everything except**.
3. Check the preview. The app shows the old and new list side by side.
4. Confirm. The change runs under the [connection-loss guard](../safety/connection-guard.md) if it could cut you off.
5. Test from the affected device, then check the log.

## What a firewall cannot do

- It cannot see inside encrypted traffic.
- It cannot protect a device that invites malware in.
- It cannot replace updates. See the [hardening checklist](hardening-checklist.md).

## Stock and Merlin

Stock firmware has a network services filter and basic rules. Merlin adds custom rules through a firewall script, covered under [Merlin scripts](../merlin/merlin-scripts.md).

## Status

| Part | State |
| --- | --- |
| Master switch, answer ping, flood protection, IPv6 | Built |
| Rule editor | Planned |
