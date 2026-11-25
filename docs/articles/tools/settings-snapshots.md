---
title: Settings snapshots and diff
category: tools
order: 7
summary: Planned: save named snapshots of the router settings and compare any two.
status: in-progress
related: router/backup-restore, safety/change-history
---

This is one of the planned router tools. It is marked **In progress**, which means the description below is the plan, not something you can use yet.

> [!NOTE]
> Settings snapshots and diff is **In progress**. Treat everything under "Planned behaviour" as a goal until this page says otherwise.

## What it is for

Take a named snapshot before a big change and later see exactly what differs from now, row by row.

## Planned behaviour

- Save a snapshot with a name such as "Before moving house".
- Compare two snapshots, or a snapshot with the current settings, with old and new values side by side.
- Start a restore from a snapshot through the usual preview and guard steps.
- Mask secret values in the comparison.

## What is missing

No snapshot store, comparison view or restore path yet. How it relates to the router's own backup file is still being decided.

## Good to know

- A snapshot is not a full backup of the router. Use the backup guide for that.
- Snapshots live on the app's data volume.

## How it will work

A **snapshot** is a named copy of the settings the app can read, taken at a moment you choose. Unlike the [full backup](../router/backup-restore.md), a snapshot is a light record for comparing. You can take one before a project, such as "Before new Wi-Fi names", and another after.

## Comparing two snapshots

The app lines up the two and lists only what differs, in plain words:

| Setting | Before | After |
| --- | --- | --- |
| Wi-Fi 5 GHz name | Home-5 | Pat-5G |
| Guest network | Off | On |
| Port forward "camera" | Present | Removed |

Secrets such as passwords are never shown. They are compared as "changed" or "unchanged" only.

## How it differs from change history and backup

| Tool | Best for |
| --- | --- |
| [Change history](../safety/change-history.md) | A detailed log of each change the app made, with undo |
| Snapshot | A named point to compare against, including changes made outside the app |
| [Backup and restore](../router/backup-restore.md) | Getting a router back to a known state |

## Questions people ask

**Can I restore from a snapshot?** It is for comparing. Use a backup to restore.

**Does it find changes made on the router's own page?** Yes. A snapshot reads the live settings, so it shows changes from any source.

