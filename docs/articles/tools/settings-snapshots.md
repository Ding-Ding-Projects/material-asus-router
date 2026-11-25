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
