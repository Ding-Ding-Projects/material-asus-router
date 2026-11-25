---
title: Bulk actions
category: app
order: 23
summary: Planned: select many rows and act on them in one confirmed change.
status: in-progress
related: app/exports, router/devices
---

This is one of the app's own features. It is marked **In progress**, which means the description below is the plan, not something you can use yet.

> [!NOTE]
> Bulk actions is **In progress**. Treat everything under "Planned behaviour" as a goal until this page says otherwise.

## What it is for

Rename, block or reserve addresses for several devices at once, with one preview that lists every row.

## Planned behaviour

- Select rows with checkboxes, or select all in the current filter.
- One preview shows each affected row with old and new values.
- The whole bulk change is one history entry and can be undone together.
- A limit stops a very large selection from being applied by accident.

## What is missing

Selection, the combined preview and the single history entry are not built.

## Good to know

- Bulk changes still use the connection guard when needed.
- Viewers cannot confirm a bulk change.
