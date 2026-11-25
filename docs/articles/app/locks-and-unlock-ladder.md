---
title: Locks and the unlock ladder
category: app
order: 19
summary: Planned: lock sensitive areas and unlock them in steps, from a click to a typed phrase.
status: in-progress
related: safety/roles-and-access, safety/super-confirmation
---

This is one of the app's own features. It is marked **In progress**, which means the description below is the plan, not something you can use yet.

> [!NOTE]
> Locks and the unlock ladder is **In progress**. Treat everything under "Planned behaviour" as a goal until this page says otherwise.

## What it is for

Put extra friction in front of the riskiest areas, so a dangerous action needs more deliberate effort the more damage it could do.

## Planned behaviour

- Lock an area such as Firewall or Advanced so it opens read-only until unlocked.
- Unlock steps rise from a confirmation click, to your password, to the two-key confirmation used for reboots.
- Areas relock after a time you choose or when you leave.
- The owner decides which areas are locked by default.

## What is missing

Only the reboot two-key confirmation exists as a lock. Area locks and the ladder are not built.

## Good to know

- Locks add care; they do not replace roles.
- Viewers see locked areas as read-only anyway.

## A planned walkthrough (demonstration)

Some areas are risky: reboot, restore, the owner terminal. A lock puts steps in front of them:

| Rung | What you do | Typical use |
| --- | --- | --- |
| 1 | Click to unlock | Low-risk settings |
| 2 | Confirm with your password | Changes that affect connections |
| 3 | Type a short phrase shown on screen | Reboot, restore, delete |

Climbing a rung unlocks only that area, for a short time. It locks again when you leave or go idle.

## Questions people ask

**Does it replace roles?** No. Roles decide what a person may do. Locks make a person who is allowed slow down and mean it. See [Roles and access](../safety/roles-and-access.md) and [Super confirmation](../safety/super-confirmation.md).

**What if I forget the password?** The owner can reset a lock from a signed-in session. A lock never hides data from the owner.
