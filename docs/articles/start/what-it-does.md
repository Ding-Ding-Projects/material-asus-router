---
title: What the app does
category: start
order: 2
summary: Every area of the app, what you can do in it, and which parts are still being built.
status: in-progress
related: start/quick-tour, start/welcome, setup/firmware-detection
---

Material Asus Router connects to your router over SSH, reads its settings, and shows them in readable screens. It changes settings only through a preview, a confirmation and a recorded history entry.

## The areas

| Area | What it covers | Guide |
| --- | --- | --- |
| Overview | Model, firmware, uptime, load, WAN state | [Overview](../router/overview.md) |
| Devices | Connected devices, names, wake-on-LAN | [Devices](../router/devices.md) |
| Wi-Fi | Each band and the guest network | [Wi-Fi](../router/wifi.md) |
| Internet | Connection type, DNS, dynamic DNS | [Internet](../router/internet.md) |
| Local network | Router address, DHCP, reservations | [Local network](../router/local-network.md) |
| Port forwarding | Rules that open a port to a device | [Port forwarding](../router/port-forwarding.md) |
| Firewall | Firewall switches and filters | [Firewall](../router/firewall.md) |
| Parental controls | Time and access rules per device | [Parental controls](../router/parental-controls.md) |
| Traffic priority | QoS | [Traffic priority](../router/traffic-priority.md) |
| VPN | OpenVPN and WireGuard | [VPN](../router/vpn.md) |
| AiMesh | Mesh nodes | [AiMesh](../router/aimesh.md) |
| USB and storage | Attached disks and sharing | [USB and storage](../router/usb-storage.md) |
| Logs | The router's system log | [Logs](../router/logs.md) |
| Network tools | Ping, traceroute, name lookup | [Network tools](../tools/network-tools.md) |
| Scheduled jobs | Merlin only | [Scheduled jobs](../router/scheduled-jobs.md) |
| Backup and restore | Download and re-apply settings | [Backup and restore](../router/backup-restore.md) |
| Firmware, System, Maintenance | Updates, time, reboot, housekeeping | [Firmware](../router/firmware.md), [System](../router/system.md), [Maintenance](../router/maintenance.md) |
| Merlin extras | Merlin-only controls | [Merlin extras](../router/merlin-extras.md) |
| Advanced | Every router value, friendly label first | [Advanced](../router/advanced.md) |
| Change history | Every change with one-click undo | [Change history](../safety/change-history.md) |

## Three ideas run through everything

- **Preview, confirm, save, apply.** No change goes straight to the router. See [Make changes safely](../safety/safe-changes.md).
- **A timed revert for risky changes.** Changes that could cut your connection arm a router-side revert first. See [Connection-loss guard](../safety/connection-guard.md).
- **Honest firmware detection.** On stock ASUS firmware, Merlin-only controls stay visible but disabled, with the reason. See [Firmware detection](../setup/firmware-detection.md).

## People and roles

The first account becomes the owner. The owner can add operators, who can change settings, and viewers, who can only look. See [Accounts and roles](../app/accounts-and-roles.md).

## What is not finished

Each area guide has a status badge. Where an area is **In progress**, its guide says what is missing. The list of areas above describes the planned scope, not a promise that every screen already exists. Use the [demo router](demo-router.md) to see exactly what works today.
