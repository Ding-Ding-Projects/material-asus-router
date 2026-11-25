---
title: Backup and restore
category: router
order: 20
summary: Save the router's settings to a file, keep it safe, and restore it when something goes wrong.
status: in-progress
related: router/firmware, router/maintenance, safety/undo-changes, safety/change-history
---

A backup is a copy of the router's settings. If you reset the router, replace it with the same model, or a firmware update goes badly, a restore puts your settings back. It is the safety net behind everything else in the app.

> [!NOTE]
> **In progress.** The app can count the settings it will include; the backup and restore actions and their tests on real routers are still being built.

## Backup is not the same as undo

| | Backup and restore | [Undo](../safety/undo-changes.md) |
| --- | --- | --- |
| Covers | All router settings at one moment | One change made through this app |
| Stored | In a file you keep | In the app's history |
| Use it for | Reset, replacement, bad firmware, disaster | A mistake in a recent change |

Use both. Undo is faster for small mistakes; a backup is what saves you from a big one.

## Make a backup

1. Open **Backup and restore** and choose **Back up now**.
2. The app shows the router model, the number of settings it will save and the time.
3. Choose whether to include secrets such as Wi-Fi passwords and VPN keys. **By default, secrets are left out.** Include them only if the owner asks for it, because a file with secrets is as sensitive as the passwords themselves.
4. Save the file. The name includes the model and the date.
5. Store it somewhere other than the router, ideally two places: for example a cloud drive and a USB stick. Protect it with a password if you included secrets.

Take a backup:

- before a firmware update;
- before big changes such as a new VPN or address change;
- after you finish setting a new router up;
- on a regular schedule, for example every month.

## Restore

> [!WARNING]
> A restore replaces the router's settings with the contents of the file and reboots the router. You will lose the connection for a few minutes, and anything changed since the backup is lost. The app asks for the same two-step confirmation as a reboot. See [Maintenance](maintenance.md).

1. Choose **Restore** and pick the backup file.
2. The app checks that the file is for the same model and warns if the firmware versions differ. A file for another model is refused.
3. Review the summary: model, date, count of settings, and whether secrets are included.
4. Confirm twice. The app arms the timed revert only where the router can return to its previous state; otherwise it tells you clearly that this change cannot be reverted by the guard.
5. Wait for the router to restart, then sign back in and check the Overview.

If the restore leaves the router unreachable, the router's own reset button and the manufacturer's recovery tool are the last resort. Keep the router's local address, the backup file and your provider's connection details together.

## What a backup does not contain

- The app's own accounts and history, which are stored by the app, not the router. Back up the app's data folder or volume separately; see the [install guide](../setup/install.md) for where it lives.
- Files on a USB drive.
- Add-ons installed on Merlin, beyond their settings files.

## Stock and Merlin differences

| Item | Stock ASUS | Asuswrt-Merlin |
| --- | --- | --- |
| Settings backup and restore | Yes | Yes |
| Extra user files (scripts, jobs, add-ons) | Not applicable | Included where they are stored in the router's persistent area |

## Status

| Part | State |
| --- | --- |
| Count of settings to be saved | Built |
| Back up, restore and file checks | In progress |
| Real-router test | Not yet |
