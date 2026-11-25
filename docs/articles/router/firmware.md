---
title: Firmware
category: router
order: 21
summary: Check the firmware version and update with care, with a backup first and a plan for when it goes wrong.
status: in-progress
related: router/backup-restore, router/maintenance, setup/firmware-detection, router/merlin-extras
---

Firmware is the router's operating system. Updates fix security problems and bugs, so staying current matters. But a firmware update is also the riskiest thing you do to a router, so this app treats it with extra care.

> [!NOTE]
> **In progress.** Reading the firmware version and family is built. Checking for updates and applying an update through the app are planned and not available yet; update through the router's own page for now, following the safety steps below.

## What you see

| Item | Meaning |
| --- | --- |
| Family | Stock ASUS or Asuswrt-Merlin, found automatically ([how](../setup/firmware-detection.md)) |
| Version | The installed version and build |
| Model | The router model, which decides which firmware files are valid |
| Update state | Whether a newer version is known (when update checking is built) |

## Before you update

1. **Back up.** Follow [Backup and restore](backup-restore.md) and keep the file off the router.
2. **Read the release notes** from the firmware's publisher. Look for notes about settings being reset, or about changed behaviour.
3. **Check the model.** Firmware is model-specific. Installing the wrong one can make the router unusable. The app refuses a file whose model does not match.
4. **Pick a quiet time.** The router restarts and the whole network is down for several minutes. On a mesh, nodes restart too ([AiMesh](aimesh.md)).
5. **Make sure power is stable.** Never update during a storm or on a flaky plug.
6. **Use a cable** between the computer and the router. Do not update over Wi-Fi.

## During the update

- Do not turn off, unplug or reset the router.
- Do not close the browser tab or the app until it says the router is back.
- Expect the router to restart more than once.

## After the update

1. Wait for the router lights to settle, then check the **Overview** shows the new version.
2. Check internet access, Wi-Fi and a few devices.
3. If settings were reset, restore your backup if the firmware version allows it. A backup from a very different version may not restore cleanly; compare first.
4. Keep the old firmware file for a while in case you need to roll back.

## Moving between stock and Merlin

Switching between stock and Merlin is a firmware change with extra risks, such as settings that do not carry over. Do it only by following the Merlin project's own instructions, with a backup and a clear recovery plan. This app can show you the family before and after, but it does not perform the switch.

## If something goes wrong

| Symptom | What to try |
| --- | --- |
| Router does not come back after 10 minutes | Power-cycle once. If it still does not answer, use the manufacturer's recovery tool |
| Router works but settings are gone | Restore the backup |
| Wi-Fi works but the app cannot connect | Check the router address and SSH setting in [System](system.md), and repeat the [connection steps](../setup/connect-router.md) |
| The new version behaves badly | Roll back to the file you kept, using the router's own page |

## Stock and Merlin differences

| Item | Stock ASUS | Asuswrt-Merlin |
| --- | --- | --- |
| Update source | The manufacturer | The Merlin project, matched to your model |
| Update timing | Often tied to a cloud check | Manual download |
| Add-ons after update | Not applicable | Stay if their storage is kept; re-check after a major version |

## Status

| Part | State |
| --- | --- |
| Read version and family | Built |
| Update check and apply from the app | Planned |

## Go deeper

- [Firmware update walkthrough](../merlin/firmware-update-walkthrough.md)
- [Stock or Merlin](../reference/stock-vs-merlin.md)
