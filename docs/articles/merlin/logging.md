---
title: Logging: reading and keeping router logs
category: merlin
order: 1
summary: What the router records, how to read the common entries, and how to keep logs longer than the router's small memory allows.
status: in-progress
related: router/logs, merlin/merlin-scripts, security/hardening-checklist
---

The router writes a running diary of events: devices joining, connection changes, firewall blocks, time changes and errors. The diary lives in memory, is small and is lost at reboot. The app can read it today (see [Logs](../router/logs.md)).

## Where to look

| Log | Tells you |
| --- | --- |
| General | Startup, service restarts, login attempts, warnings |
| DHCP | Which device asked for which address, and when |
| Wireless | Devices joining and leaving each band, with reasons |
| Connections | Active connections through the router |
| Routing and port forwarding | The route table and forwarded ports |

## Reading common entries

Example lines, written as a demonstration, not from your router:

| Entry (example) | Meaning |
| --- | --- |
| `dnsmasq-dhcp: DHCPACK(br0) 198.51.100.52 AA:BB:CC:DD:EE:01 tablet` | The router gave the address to a device called tablet |
| `wlceventd: deauth ... reason 3` | A device left, usually by itself or went out of range |
| `ntp: time sync` | The clock set itself from the time server |
| `sshd: Failed password` | Someone tried to log in with a wrong password. Many in a row from outside means open SSH to the internet. See the [hardening checklist](../security/hardening-checklist.md) |

## Keep logs longer

The built-in log is a ring: new lines push old ones out. For history:

1. **Send to a remote log server.** Both firmwares can forward log lines over the network to another device on your LAN that is always on.
2. **Write to a USB drive.** On Merlin, a script can append logs to a file on a mounted drive. See [Merlin scripts](merlin-scripts.md).
3. **Download regularly.** The app can copy the visible log.

> [!WARNING]
> Logs may contain device names, addresses and sometimes names of sites. Treat saved logs as private, and remove them before sharing screenshots or asking for help.

## Be selective

A log with everything switched on is noisy and fills up. Turn on the extra detail only while you investigate a problem, then switch it back.

## Status

| Part | State |
| --- | --- |
| Reading the log | Built |
| Filtering, search and copy | In progress |
| Remote logging setup | Planned |
