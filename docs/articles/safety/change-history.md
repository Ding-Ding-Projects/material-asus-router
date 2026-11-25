---
title: Change history
category: safety
order: 4
summary: A searchable record of every change with who made it, the old and new values and how it ended.
status: in-progress
related: safety/undo-changes, safety/safe-changes, safety/connection-guard, app/exports
---

The change history is the app's memory. Each time a change is applied, undone or reverted by the guard, one entry is recorded. It is what makes undo possible and what lets you answer "what changed before the Wi-Fi stopped working?".

> [!NOTE]
> Recording changes is part of the change engine. The history screen with search, filters and undo is **In progress**.

## What an entry contains

| Field | Meaning |
| --- | --- |
| Time | When the change was applied, shown in 24-hour time in your time zone. |
| Person | The account that confirmed it, for example Pat or Alex. |
| Area | Wi-Fi, Internet, Firewall and so on. |
| Rows | Each value with its friendly label, old value and new value. Secret values are masked. |
| Result | **Applied**, **Applied and confirmed**, **Reverted by the guard**, **Failed**, or **Undone**. |
| Guard | Whether a timed revert was armed and whether it was cancelled or fired. |
| Link | For an undo, a link to the entry it undid. |

> [!EXAMPLE]
> Example entry, not from your router: "14:05, Alex, Wi-Fi, Applied and confirmed. 2.4 GHz channel: 6 to 11. Guard armed for 90 seconds, cancelled after reconnecting."

## Find an entry

1. Open **Change history** from the navigation.
2. Type in the search box. Plain text works by default, and the regex builder next to it is described in [search and regex builder](../app/search-and-regex-builder.md).
3. Narrow by area, person, result or date.
4. Open an entry to see every row and the options **Undo** and **Copy as text**.

## Exporting

Entries can be exported as text or JSON so you can keep a copy outside the app. See [exports](../app/exports.md).

## What is not stored

- Passwords and keys. Secret rows show only that the value changed.
- Reads. Looking at a screen is not a change and is not recorded.
- Reboots are recorded as an event with the person and time, but not as a value change.

## How long entries are kept

The history lives on the app's data volume, next to the encrypted vault, and is kept until you remove it. Clearing entries is planned to be an owner-only action, and a cleared entry can no longer be undone.

## Related

Read how [undo](undo-changes.md) uses an entry, and how the [guard](connection-guard.md) marks one as reverted.
