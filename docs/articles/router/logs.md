---
title: Logs
category: router
order: 18
summary: Read the router log with search, level filters and time ranges, and learn what the common messages mean.
status: in-progress
related: router/overview, router/system, tools/network-tools, safety/change-history
---

The router keeps a running log of what it does: devices joining, connection attempts, warnings and errors. The Logs screen reads that log and makes it searchable. It is a read-only screen, so nothing on it changes a setting.

> [!NOTE]
> **In progress.** Reading and parsing the log is built; the filter and search screen is still being built. The log held by the router is limited in size and is lost at a restart, unless you set up a log server (see below).

## Read the log

1. Open **Logs**. The newest lines are at the top.
2. Use the search box to find a name, address or word, for example the name of a device from [Devices](devices.md).
3. Use the level filter to hide routine messages. Warnings and errors are the ones to read first.
4. Use the time range to look only at the minutes around a problem.
5. Copy a line, or export the visible lines, when you need to ask for help. Check the lines for personal details before sharing.

## What the columns mean

| Column | Meaning |
| --- | --- |
| Time | When the line was written, in the router's time zone |
| Source | Which part of the router wrote it, such as the wireless driver, the DHCP service or the firewall |
| Level | Information, warning or error |
| Message | The text of the line |

## Common messages

These are **examples** of the kind of line you will see. Your router's exact wording differs by model and firmware.

| Example message | Usually means |
| --- | --- |
| A device is given an address by the DHCP service | A device joined or renewed |
| A wireless client authenticated or disassociated | A device connected to or left Wi-Fi |
| A failed login to the router web page or SSH | Someone typed a wrong password. Several in a row from an address you do not know is a warning sign |
| The internet connection went down and came back | A provider outage or a cable problem |
| The firewall dropped packets from an outside address | The firewall doing its job; only worry if it repeats from many addresses to one port |

## Find out why a device cannot connect

1. Note the time the problem started.
2. Filter to that period and search for the device's hardware address.
3. Look for authentication failures (wrong password), repeated disconnects (weak signal), or no address given (DHCP problem; see [Local network](local-network.md)).

## Keep logs after a restart

The router's own log is kept in memory and disappears when it restarts. Where the firmware allows it, you can send the log to another computer or a file on a USB drive. This is a firmware setting that the app shows in [System](system.md) or, for Merlin, in [Merlin extras](merlin-extras.md). Do not leave a log on a drive that is shared without access control.

## Stock and Merlin differences

| Item | Stock ASUS | Asuswrt-Merlin |
| --- | --- | --- |
| General log | Yes | Yes |
| Wireless and DHCP detail | Limited | More |
| Persistent log location and extra logs | Limited | Yes, through settings and add-ons |

## Status

| Part | State |
| --- | --- |
| Read and parse the log | Built |
| Search and filter screen | In progress |
| Export | In progress |
