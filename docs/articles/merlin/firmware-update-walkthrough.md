---
title: Firmware update walkthrough
category: merlin
order: 5
summary: A calm, ordered checklist for updating router firmware: what to prepare, what to expect, how to know it worked and how to go back.
status: in-progress
related: router/firmware, router/backup-restore, setup/firmware-detection, connect/aimesh-management
---

A firmware update replaces the router's operating software. It fixes security holes and bugs, and occasionally adds features. It is also the one routine task that can leave a router unusable if the power fails halfway, so a little preparation pays off. The app detects the current firmware and its version (see [Firmware](../router/firmware.md)). Starting the update from the app is planned. Until then, use the router's own update page and follow this list.

## Before you start

1. **Check the exact model and hardware revision** on the label under the router. Firmware for a different model or revision can brick it.
2. **Read the release notes** for known issues with your model.
3. **Back up the settings** with the app. See [Backup and restore](../router/backup-restore.md). Keep the file somewhere other than the router.
4. **Write down your connection type and login** (see [connection types](../internet/wan-types.md)), in case a reset is needed.
5. **Choose a quiet time.** The router is offline for two to five minutes.
6. **Make sure the power is steady.** Do not update during a storm or on a loose plug.

## Stock or Merlin?

| You run | Update from |
| --- | --- |
| Stock ASUS | The vendor's download page for your model, or the router's check-for-update button |
| Asuswrt-Merlin | The Merlin download page for your model. A model may support only some Merlin releases |
| Switching between them | Possible on supported models, but follow the project's notes. Reset to factory settings afterwards |

Download from the official source only. Compare the file's checksum with the published one if the page provides it.

## During the update

1. Upload the file in the router's update page.
2. **Do not power off, refresh or unplug anything.** The progress bar can sit still for a while.
3. Wait until the router comes back and the lights settle.

## After the update

| Check | How |
| --- | --- |
| Version changed | **Overview** shows the new version |
| Internet works | Run [ping](../tools/network-tools.md) |
| Wi-Fi works | Reconnect one device |
| Settings survived | Open **Wi-Fi** and **Port forwarding** and compare |
| Mesh nodes | Update nodes next. See [AiMesh management](../connect/aimesh-management.md) |

## If something is wrong

- Try a reboot first.
- If settings look strange after a major jump, reset to factory settings and restore your backup.
- If you cannot reach the router at all, most models have a recovery mode. Follow the vendor's recovery instructions.

## Status

| Part | State |
| --- | --- |
| Firmware detection and version display | Built |
| Starting an update from the app | Planned |
