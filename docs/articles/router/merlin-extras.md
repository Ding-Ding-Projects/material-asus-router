---
title: Merlin extras
category: router
order: 24
summary: Controls that exist only on Asuswrt-Merlin, why they are disabled on stock firmware, and how to use them carefully.
status: in-progress
related: router/scheduled-jobs, router/advanced, setup/firmware-detection, router/vpn
---

Asuswrt-Merlin is a community-maintained firmware that adds features to the stock ASUS firmware. This app detects it automatically ([firmware detection](../setup/firmware-detection.md)) and unlocks a set of extra controls. On stock firmware the same controls are shown **disabled with the reason**, so you can see what you would gain and why you cannot use it yet.

> [!NOTE]
> **In progress.** Detecting Merlin and listing which extras are supported is built. Each extra is built one at a time; the table below says which are planned.

## How the disabling works

| Situation | What you see |
| --- | --- |
| Stock firmware | Merlin-only controls are visible but disabled, with a short reason: "Needs Asuswrt-Merlin" |
| Merlin firmware | Controls are active, with a small Merlin badge |
| Detection unsure | Controls stay disabled, and the app asks you to re-run detection |

The app never hides these controls, so the feature list does not change between firmwares. It also never tries a Merlin-only command on stock firmware, because that can produce errors or half-applied changes.

## The extras

| Extra | What it gives you | State |
| --- | --- | --- |
| [Scheduled jobs](scheduled-jobs.md) | Run commands at set times | List built; editing in progress |
| Custom configuration files | Extend the DHCP and name service with your own lines (for example extra DHCP options or local host names) | Planned |
| Script hooks | Run your own scripts at events such as start-up, firewall reload, VPN connect | Planned |
| Add-on management | See and manage add-ons installed on a USB drive | Planned |
| Persistent user area | A place where scripts and settings survive a reboot | Read-only view planned |
| More VPN options | Extra OpenVPN client profiles and selective routing | See [OpenVPN](vpn-openvpn.md) |
| Extra logs and persistent log location | Keep logs over reboots | Planned; see [Logs](logs.md) |

## Use extras carefully

Extras give you more power and more ways to break things. Keep to these habits:

1. **Back up first**, including the user area ([Backup and restore](backup-restore.md)).
2. **Change one thing at a time**, so a fault points to one change.
3. **Prefer the guided screens** to typing raw commands or scripts.
4. **Keep scripts short** and understand every line before you save it.
5. **Do not add what you cannot undo.** Anything you add through this app is saved in history, but a script's effects on the router (files written, services started) are not always undone by removing it.

> [!WARNING]
> A script hook runs with the router's full privileges. A mistake can disable the firewall or remove your own access. If you are not sure what a script does, do not save it.

## Firmware updates and extras

After a Merlin update, check that your extras still work. Scripts and add-ons saved in the persistent area normally stay, but a major version can change what they need. See [Firmware](firmware.md).

## Status

| Part | State |
| --- | --- |
| Detect Merlin and list supported extras | Built |
| Scheduled jobs list | Built |
| Other extras | Planned, in the order of the table |
