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
> **In progress.** The seven ready-made modes, the mode cards and the mode builder are built and tested against the pretend router. They have not been tried on a real router yet, and scheduling a mode at a set time is not built.

::sim[one-click-modes]

*The panel above is a demonstration. Pressing a mode here changes nothing on your router.*

## The ready-made modes

| Mode | What it changes |
| --- | --- |
| Gaming | Traffic priority on, the chosen console first, UPnP on |
| Bedtime | The chosen devices lose the internet from 21:30 to 07:00 (you can change the times) |
| Guest party | The guest Wi-Fi on every band, closed after four hours, no access to home devices, with a QR card |
| Work from home | Traffic priority on, video calls first, the chosen laptop first |
| Privacy DNS | Encrypted DNS (DNS over TLS) with a resolver you choose. Needs Asuswrt-Merlin |
| Lock it down | WPS off, the router's web page closed to the internet, WPA2 and WPA3 together on every band |
| Away | Wi-Fi on for a short window each day, wake-on-LAN off |

Every card lists the exact settings with their old and new value before anything is written. A card is **On** only when the router itself reports every value in place. A setting this router does not have is shown as unavailable with the reason ("This router does not have the setting ...") and is never written. If a setting the whole mode depends on is missing, the whole mode says it cannot be used here.

## Your own modes

Open the **mode builder** from the Modes screen. Search the whole catalogue, add the settings you want, choose each target value with the same control the Settings screens use, give the mode a name and an icon, and save it. A mode that contradicts itself, such as switching a radio off and a guest network on the same radio on, is refused with the reason. Passwords and keys can never be part of a mode. Saving writes nothing to the router; your mode becomes a card on the Modes screen.

## How a mode works

1. **Define it.** The ready-made modes pick their settings for you, and you may choose a device or a time. In the builder you pick the settings and the value each takes.
2. **Preview it.** Pressing the mode shows every setting with its old and new value, for the whole bundle at once.
3. **Confirm.** The app saves the previous values of everything and applies the bundle in one change. If anything could cut your connection, it runs under the [guard](../safety/connection-guard.md).
4. **Undo.** One undo puts every setting in the bundle back. See [Undo changes](../safety/undo-changes.md).

## Rules the app will keep

- A mode may contain only settings that you could change by hand.
- A mode cannot hide a risky change. A mode that includes a risky or destructive setting asks for its normal confirmation.
- A mode that affects the connection you are using is flagged in the preview.
- Modes use roles: a viewer cannot press one, an operator can use modes an owner prepared, and only an owner can edit them. See [Accounts and roles](../app/accounts-and-roles.md).

## Scheduling

A mode can later be switched at set times, such as Bedtime at 23:00. That depends on the router clock being right and is not built yet. Bedtime and Away already use the router's own schedules for the device and Wi-Fi windows they set.

## Status

| Part | State |
| --- | --- |
| Guide | Written |
| Safe-change engine and undo | Built |
| Seven ready-made modes, cards, exact old and new values, one-tap apply and undo | Built, tested against the pretend router |
| Mode builder with real controls | Built, tested against the pretend router |
| Real router check | Not done |
| Turning a mode on at a set time, and a mode that turns itself off | Planned |
