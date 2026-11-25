---
title: Exports
category: app
order: 22
summary: Planned: save lists and records as text, CSV or JSON.
status: in-progress
related: safety/change-history, app/bulk-actions
---

This is one of the app's own features. It is marked **In progress**, which means the description below is the plan, not something you can use yet.

> [!NOTE]
> Exports is **In progress**. Treat everything under "Planned behaviour" as a goal until this page says otherwise.

## What it is for

Take a copy of a device list, a rule list, the log or the change history out of the app for a spreadsheet, a report or a backup.

## Planned behaviour

- Export the current view, with its filters applied.
- Formats: plain text, CSV and JSON.
- Secret values are never included.
- A preview shows how many rows will be exported.

## What is missing

Export buttons and file generation are not built.

## Good to know

- Exports are made on your device and downloaded by your browser.
- Exports are for reading; they are not a way to restore the router.

## A planned walkthrough (demonstration)

You want to keep a list of address reservations before a router reset.

1. Open **Address reservations** and choose **Export**.
2. Pick a format and preview what will be saved.
3. Save the file on your own device.

| Format | Good for |
| --- | --- |
| Text | Reading or pasting into a message |
| CSV | A spreadsheet |
| JSON | Another program, or re-importing later |

## What is never exported

Passwords, keys and the vault contents are left out of exports unless the owner asks for them in a [backup](../router/backup-restore.md), and then only into an encrypted file.

## Questions people ask

**Does exporting change the router?** No. It reads and saves a file only.

**Can a viewer export?** Only if the owner allows it, since lists can hold personal details such as device names.
