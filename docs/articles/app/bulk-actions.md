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

## A planned walkthrough (demonstration)

You want to block six old devices from the internet.

1. In **Devices**, tick the six rows. A bar shows "6 selected".
2. Choose **Block internet access**. The preview lists all six, by name, with the old and new state.
3. Confirm once. The app saves the previous state of all six and applies them as one change.
4. One undo reverses all six. See [Undo changes](../safety/undo-changes.md).

## Limits

- A bulk action works only on actions you could do one at a time.
- A bulk action that includes a risky or destructive item asks for that item's normal confirmation, once for the batch.
- If one item fails the checks, the preview says which and applies nothing, rather than half the list.

## Questions people ask

**Can I select everything?** Yes, with a clear count of what that means before you confirm.
