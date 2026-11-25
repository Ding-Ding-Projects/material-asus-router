---
title: Advanced values
category: router
order: 25
summary: Browse and edit every router value, with a friendly label first and the raw name second, and strong warnings.
status: in-progress
related: safety/safe-changes, router/merlin-extras, safety/undo-changes, safety/change-history
---

Advanced shows **every** value the router stores, not only the ones that have a dedicated screen. Each row has a friendly label and help text where the app knows it, and the router's own raw name beside it. It is for the moments when a setting exists but has no screen of its own.

> [!NOTE]
> **In progress.** The list of values, with labels and masking of secrets, is built. Editing a raw value goes through the same preview, confirm and history as everything else, and that screen is still being built.

> [!WARNING]
> This is the sharpest tool in the app. A wrong value can break Wi-Fi, lock you out or stop the router booting normally. If a dedicated screen exists for the setting, use that instead. It adds checks and explanations that Advanced cannot.

## What you see

| Column | Meaning |
| --- | --- |
| Label | A friendly name, when the app knows the value. Unknown values show only the raw name |
| Raw name | The router's name for the value, for example for the Wi-Fi name or the DHCP start address |
| Value | The current value. Secrets such as passwords and keys are **masked** and never shown |
| Area | Which screen this value belongs to (for example Wi-Fi), so you can use the proper screen |
| Risk | Low, medium or high, from the app's own knowledge |

A count shows how many values the router holds, and the search box finds a label or raw name.

## Find and change a value

1. Search for the label or the raw name.
2. If the row has an **Area**, consider using that screen first.
3. Choose **Edit**. The app shows the allowed values or range when it knows them, and warns when it does not.
4. Read the preview: old and new values, the risk level, and a note when the value is part of a [guarded](../safety/connection-guard.md) area.
5. Confirm. The previous value is saved so it can be [undone](../safety/undo-changes.md).
6. Some values only take effect after the related service restarts. The app tells you which service, and offers to restart it ([Maintenance](maintenance.md)).

## Rules the app applies

- **Secrets stay hidden.** Passwords, keys and tokens are masked in the list, the preview and the history. You can replace one, but the app will not show its old value.
- **Read-only values stay read-only.** Values the router computes itself, such as counters, cannot be edited.
- **High-risk values need a second confirmation.** For example values that affect booting, the firewall, or remote access.
- **Unknown values get extra warnings.** If the app has no help for a value, it says so in the preview.

## Useful habits

| Habit | Why |
| --- | --- |
| Back up before editing ([Backup and restore](backup-restore.md)) | A backup restores everything, not just one value |
| Change one value at a time | You know which one caused a problem |
| Note the old value | The history has it, but a note helps you reason about it |
| Do not copy values from forums blindly | They may be for another model or firmware |

## Stock and Merlin differences

| Item | Stock ASUS | Asuswrt-Merlin |
| --- | --- | --- |
| Values listed | All values the router stores | All values, plus Merlin-specific ones |
| Merlin-only values | Shown disabled, with the reason | Editable; see [Merlin extras](merlin-extras.md) |
| Custom user values | Not applicable | Possible, stored in the persistent area |

## Status

| Part | State |
| --- | --- |
| List of all values with labels and masking | Built |
| Edit with preview, history and undo | In progress |
| Real-router test | Not yet |
