---
title: Preview, confirm and apply a change
category: safety
order: 1
summary: Every change shows old and new values first, saves the previous values, and only then reaches the router.
status: in-progress
related: safety/connection-guard, safety/undo-changes, safety/change-history, wiki:glossary
---

Material Asus Router never writes to the router straight from a form. Every change, from a Wi-Fi name to a firewall switch, goes through the same four steps so you always know what will happen and can take it back.

> [!NOTE]
> The change engine and its preview endpoint exist in the repository. The on-screen preview dialogs are still being finished for every area, so this page is marked **In progress**. Where a screen is not built yet, its area guide says so.

## The four steps

1. **Edit.** You change a value on a screen. Nothing is sent yet.
2. **Preview.** The app builds a readable list of what will change. Each row shows a friendly label, the **old value** and the **new value**. Rows that would restart a router service are listed too, with a plain sentence such as "Wi-Fi will restart for a few seconds".
3. **Confirm.** You press the confirm button. Viewers can open a preview but cannot confirm one.
4. **Apply.** The app saves the previous values, arms the connection guard when the change could cut your connection, writes the new values, commits them on the router and restarts only the services that need it.

## What a preview shows

| Part | Meaning |
| --- | --- |
| Label | A plain name such as "Guest network, 2.4 GHz". Advanced users can also see the raw router key. |
| Old value | What the router holds now, read just before the preview. |
| New value | What the app will write. Secret values such as Wi-Fi passwords are masked. |
| Effect | Services restarted, and whether your connection may drop. |
| Guard | Whether a timed revert will be armed, and for how long. |

> [!EXAMPLE]
> Example preview, not output from your router: changing the 2.4 GHz channel from `6` to `11` lists one row (old `6`, new `11`), says that Wi-Fi restarts, and shows "Safety timer: 90 seconds".

## Why previous values are saved first

The app stores the previous values in the change history before it writes anything. That record is what makes [one-click undo](undo-changes.md) possible, and it is also what the router-side timer uses to restore itself. If the app cannot save the previous values, it refuses to apply.

## Changes that are refused

- A change that no longer matches the router, for example because someone edited the same value in the router's own web page after you opened the preview. The app asks you to preview again.
- A control that needs Asuswrt-Merlin when the router runs stock firmware. These controls are shown disabled with the reason. See [firmware detection](../setup/firmware-detection.md).
- A change requested by a viewer account. See [roles and access](roles-and-access.md).

## Tips

- Make one logical change at a time. Short previews are easier to read and easier to undo.
- Read the Effect line. If it says your connection may drop, the [connection guard](connection-guard.md) will be armed for you.
- Reboots are not ordinary changes. They need the [two-key confirmation](super-confirmation.md).
