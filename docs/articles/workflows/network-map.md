---
title: Read the network map
category: workflows
order: 6
summary: What the devices map shows, how to spot an unknown device, and how to name things so the map stays useful.
status: in-progress
related: router/devices, connect/aimesh-management, security/hardening-checklist, router/address-reservations
---

The devices screen lists everything connected to the router: wired and wireless, online now or seen before. A map presents the same facts as a picture: the router at the centre, nodes and switches around it, devices hanging off them.

> [!NOTE]
> **In progress.** The device list is built with names, addresses, connection type and online state. The picture view is planned.

::sim[network-map]

*The map above is a demonstration with made-up devices. It does not read your network.*

## What each device shows

| Item | Meaning |
| --- | --- |
| Name | What you called it, or what it called itself |
| Address | The address it holds on your network |
| Hardware address | The stable identifier of its network card. May be random per network on phones |
| Connection | Wired, or the Wi-Fi band it is on |
| Online | Whether the router currently sees it |

## Spotting a stranger

1. Count your devices. Phones, laptops, TVs, speakers, plugs, printers, consoles.
2. Sort by name. Unnamed devices come first.
3. Check each unnamed one: look at its hardware address and manufacturer prefix, check the router's [DHCP log](../merlin/logging.md) for when it joined, then turn devices off one by one and watch which entry goes offline.
4. A device you cannot identify, on your network without your knowledge, is a reason to change the Wi-Fi password.

> [!NOTE]
> Phones that use private addresses will show as a new device each time they join a new network. That is normal, not a stranger.

## Naming so it stays useful

| Instead of | Use |
| --- | --- |
| Android-9f2c | Alex phone |
| ESP_3A1B77 | Garden sensor |
| (blank) | Living room TV |

Rename a device from its row. It is a low-risk change with undo.

## Status

| Part | State |
| --- | --- |
| Device list and rename | Built |
| Picture map | Planned |
