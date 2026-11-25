---
title: The SSH action catalogue
category: workflows
order: 4
summary: The complete list of things the app may ask the router to do, how each command is built from validated pieces, and why nothing you type reaches a shell.
status: ready
related: reference/security-model, workflows/owner-terminal, workflows/router-tools, safety/safe-changes
---

The app talks to the router over SSH, but it does not give a browser a shell. Instead it holds a short, fixed **catalogue of actions**. Each action builds its command from validated pieces on the server. A person cannot make the app send an arbitrary command through the normal screens.

## Why a catalogue

| Alternative | Problem |
| --- | --- |
| Pass whatever the browser sends | One bad input, or one hijacked page, runs anything on the router |
| Give everyone a terminal | A mistake or a malicious person can wipe the router |
| A fixed catalogue | The worst a bad request can do is one of the actions below, with checked input |

## The actions

| Action | What it runs | Input checked |
| --- | --- | --- |
| Ping | `ping` with a count and a timeout | Host name or IPv4 address. Count 1 to 9 |
| Traceroute | `traceroute` with a hop limit | Host name or IPv4 address |
| Name lookup | `nslookup` | Host name |
| Wake-on-LAN | `ether-wake` on the home network | Hardware address, six pairs |
| Restart a service | `service <name>` | The name must be on the allowed list: wireless, address handout and DNS, firewall, router web page, clock, dynamic DNS, traffic priority, VPN, WireGuard, storage apps, SSH |
| Reboot | Restart the router | Needs two-step confirmation. See [Super confirmation](../safety/super-confirmation.md) |
| Install key | Adds the app's public key to the allowed SSH keys | The key must be the app's own and not already listed |

Reading and changing settings go through a separate, equally strict path: a setting name is checked against a pattern, a value is quoted for the shell, and the change is previewed and recorded.

## How a command is built

1. The server checks each input against a pattern. A host name must look like a host name. A setting name has only letters, digits and a few punctuation marks. A value cannot contain line breaks, except for the one setting that really holds several lines.
2. Each value is placed inside single quotes with any quote inside it escaped, so it stays data and never becomes a command.
3. The finished command is logged without secrets. The change history records what changed, not passwords.

## What this does not claim

- It does not make SSH safe by itself. The router's own login, the host key and your password or key still matter. See [Security model](../reference/security-model.md).
- A catalogue covers what the app is built to do. Anything outside it needs the [owner terminal](owner-terminal.md), which is separate on purpose.

## Status

The catalogue and its input checks are built and covered by tests.
