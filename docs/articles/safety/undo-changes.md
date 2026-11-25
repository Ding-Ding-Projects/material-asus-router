---
title: Undo a change
category: safety
order: 3
summary: Put a router back to how it was before any recorded change, with a preview of the undo itself.
status: in-progress
related: safety/change-history, safety/safe-changes, safety/connection-guard
---

Because every change stores the previous values before it is applied, any recorded change can be undone later with one action. Undo is not a special back door: it is a new change in the opposite direction, so it gets the same preview, the same guard and its own history entry.

> [!NOTE]
> Undo is part of the change engine. The undo button on the history screen is still being finished, so this page is marked **In progress**.

## Undo a change

1. Open **Change history** and find the entry.
2. Press **Undo**. The app reads the router's current values again.
3. Read the preview. It shows the current value as "old" and the saved previous value as "new".
4. Confirm. The [connection guard](connection-guard.md) is armed if the undo could cut your connection.
5. The history gains a new entry that says "Undo of change from 14:05" and links back to the original.

## What undo can and cannot do

| Situation | What happens |
| --- | --- |
| The router still holds the value the change wrote | Undo restores the previous value. |
| A later change touched the same value | The preview shows the difference and asks you to undo the later change first, or to continue and accept the current value as the starting point. |
| The value was changed outside the app | Undo still works from the router's current value, and the preview shows exactly what will move. |
| The change restarted a service | The same service restarts again. |
| A reboot | Not undoable; a reboot is not a stored value. |
| A firmware update | Not undone by this feature. See the firmware guide for what the router allows. |

## Undo and the guard

If a change was already reverted by the guard, its history entry is marked as reverted and there is nothing to undo. Undoing it again would apply the old values twice and is not offered.

## Who can undo

Owners and operators can undo. Viewers can see the history and open the undo preview but cannot confirm it. See [roles and access](roles-and-access.md).

## Tips

- Undo a recent change soon. The longer you wait, the more likely a later change has touched the same value.
- If the preview shows more rows than you expected, stop and read it. It means other changes happened in between.
- For a bigger rollback, use a settings backup from the [backup and restore guide](../router/backup-restore.md).
