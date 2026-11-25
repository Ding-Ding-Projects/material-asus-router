---
title: Maintenance and reboot
category: router
order: 23
summary: Restart single services, or reboot the whole router behind a two-key confirmation.
status: in-progress
related: safety/safe-changes, router/backup-restore, router/aimesh, router/firmware
---

Maintenance is for upkeep, not for configuration. It lets you restart one part of the router when it misbehaves, and reboot the whole router when you must. Because a reboot drops everyone, it is protected by a **two-key confirmation**.

> [!NOTE]
> **In progress.** The service restart list is defined and reboot is being built with its two-key step; real-router tests are not done yet.

## Restart a single service

Restarting one service is gentler than a reboot. Try this first.

| Service | Restart it when | What drops while it restarts |
| --- | --- | --- |
| Wi-Fi | Devices cannot join, or the signal seems stuck | All Wi-Fi devices disconnect for a short time |
| Address handout and DNS | Devices get no address, or names do not resolve | New address requests and lookups pause briefly |
| Firewall | A rule change does not seem to take effect | Existing connections may reset |
| Router web page | The router's own page is not responding | Only the router's page |
| Clock | The time is wrong | Nothing |

### Steps

1. Open **Maintenance** and pick the service.
2. The preview lists what will drop and for roughly how long.
3. Confirm. The app arms the connection-loss guard when the service could affect your own link.
4. Wait for the status to come back, then test.

## Reboot the router

A reboot restarts everything. Do it for a stubborn fault that service restarts did not fix, after a firmware change, or when asked to by support.

> [!IMPORTANT]
> **Two keys.** To stop an accidental reboot, the app needs two separate confirmations: first you choose **Reboot**, then you type the word shown on screen, or confirm a second prompt that names the router and the consequences. The two-key rule is part of the safety design, and no role skips it.

1. Open **Maintenance** and choose **Reboot**.
2. Read the warning: the whole network is down for a few minutes, active downloads and calls stop, and mesh nodes restart ([AiMesh](aimesh.md)).
3. Complete the second key.
4. The app sends the reboot and starts waiting for the router to answer again, with a progress display.
5. When the router is back, check the **Overview**: uptime should be small.

If the router does not come back, wait ten minutes and power-cycle it once. See [Firmware](firmware.md) for recovery steps.

## Regular upkeep

| Task | How often |
| --- | --- |
| Take a backup ([Backup and restore](backup-restore.md)) | Monthly and before every big change |
| Check for firmware updates | Every few months |
| Review [port forwards](port-forwarding.md) and devices | Every few months |
| Read the [logs](logs.md) for repeated failures | When something seems wrong |
| Schedule a reboot | Not normally needed; a router that needs a regular reboot has a fault worth investigating |

## Stock and Merlin differences

| Item | Stock ASUS | Asuswrt-Merlin |
| --- | --- | --- |
| Service restarts and reboot | Yes | Yes |
| Scheduled reboot | Possible through the router's own schedule setting | Possible through [Scheduled jobs](scheduled-jobs.md) |

## Status

| Part | State |
| --- | --- |
| Service restart list | Built |
| Reboot with two-key confirmation | In progress |
| Waiting and progress display | In progress |
