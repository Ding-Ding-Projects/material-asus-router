---
title: One-click modes
category: workflows
order: 2
summary: Bundles of settings you switch with one click, such as Away, Bedtime or Guests, each shown as a preview first and fully undoable.
status: in-progress
related: safety/safe-changes, safety/undo-changes, wireless/wifi-schedule, security/parental-schedules
---

A **mode** is a named bundle of settings changed together: "Bedtime" might turn the lights off, switch the guest network off and schedule a quiet radio. You press one button instead of visiting four screens. A mode is not a shortcut around safety. It is a prepared change that goes through the same preview, confirmation, saved old values and undo as any other.

> [!NOTE]
> **In progress.** Modes are planned. The change engine they depend on is built. The mode editor and its buttons are not.

::sim[one-click-modes]

*The panel above is a demonstration. Pressing a mode here changes nothing on your router.*

## Ideas for modes

| Mode | What it could change |
| --- | --- |
| Bedtime | Lights off, guest network off, Wi-Fi schedule for quiet hours |
| Away | Pause the kids' devices, close forwarded ports you open for visitors, keep cameras on |
| Guests | Turn the guest network on with a fresh password, limit its speed |
| Gaming | Raise priority for the console, pause large downloads |
| Lockdown | Turn the guest network and every forward off, tighten the firewall |

## How a mode works

1. **Define it.** You pick the settings and the value each should take in the mode.
2. **Preview it.** Pressing the mode shows every setting with its old and new value, for the whole bundle at once.
3. **Confirm.** The app saves the previous values of everything and applies the bundle in one change. If anything could cut your connection, it runs under the [guard](../safety/connection-guard.md).
4. **Undo.** One undo puts every setting in the bundle back. See [Undo changes](../safety/undo-changes.md).

## Rules the app will keep

- A mode may contain only settings that you could change by hand.
- A mode cannot hide a risky change. A mode that includes a risky or destructive setting asks for its normal confirmation.
- A mode that affects the connection you are using is flagged in the preview.
- Modes use roles: a viewer cannot press one, an operator can use modes an owner prepared, and only an owner can edit them. See [Accounts and roles](../app/accounts-and-roles.md).

## Scheduling

A mode can later be switched at set times, such as Bedtime at 23:00. That depends on the router clock being right and is part of the same plan.

## Status

| Part | State |
| --- | --- |
| Guide | Written |
| Safe-change engine and undo | Built |
| Mode editor and buttons | Planned |
