---
title: The change-safety screens
category: safety
order: 10
summary: The Live and Review switch, the four keys, the Level 3 warning, the reboot launch, live progress, the history manager and the household screen with its top talkers tab.
status: in-progress
related: safety/change-safety, safety/change-history, safety/undo-changes, safety/super-confirmation
---

This page describes what you see and press. The server rules behind it are in [Change safety, live mode and the household](change-safety.md).

## The top bar

Four things sit beside the search box. The **allowance chip** reads, for example, "Allowance: Level 1 · Your brother is home (desk PC on Wi-Fi)"; it opens the household screen. The **Live / Review** switch chooses how changes apply. **Undo** and **Redo** buttons show their shortcuts in a tooltip. When nobody is set up yet the chip says so, and when your brother has only wired devices it says it cannot tell.

## Live and Review

In **Live** mode (the default) the pending-changes bar shows **Apply now**. A change that has no effect on the house (Level 0) applies by itself after a short pause that you can use to discard it. In **Review** mode the same bar shows **Review and apply**, and you check the preview first. In both modes **Later** schedules the change for a set time or for when the house is quiet (nobody's devices on the home Wi-Fi).

After a live change an **Undo** toast stays for eight seconds.

## Undo and redo

`Ctrl+Z` undoes the last router change, `Ctrl+Shift+Z` or `Ctrl+Y` redoes it. They also live in the Ctrl+K palette, in the right-click menu and in the top bar. They never run while focus is in a text field, a text area or a menu, so those keep their own undo. An undo or redo is itself a change with an impact level, so it asks for the same keys.

## Impact levels on every control

Every setting that has a level shows a small badge beside its name: Level 0 green, Level 1 blue, Level 2 amber and Level 3 red, each with its own icon. The review dialog lists the reasons behind the highest level and an estimate of how long the house is disturbed.

## Four keys

A change above Level 0 asks for four keys, in any order:

1. **Acknowledge** each person who is affected.
2. **Type the name** of the change exactly.
3. **Hold** the button for the time the server asks for (1.5 seconds).
4. Press **Ctrl+Shift+Enter**.

The dialog first says who will notice: which of your brother's devices are on the home Wi-Fi right now and will drop, and an estimate of the outage. It also draws a picture of what the change does.

If the household does not allow this much disturbance right now, the dialog says who limits it and why. Only the owner can override that, and the override still needs the four keys.

## Level 3: Prepare for brother mad

Before the keys, a Level 3 change fills the screen with a warning headed **Prepare for brother mad**. Cancel is always available and the Continue button waits a moment so the warning is read. With reduced motion the warning is a still page.

## Rebooting: the launch control

A reboot cannot be sent with a button. After the four keys a launch panel opens: lift the **safety cover**, flip the **arm** switch, read the **launch code** and type it back (three wrong tries abort the launch), hold **key 1 and key 2** together, start the **10 second countdown** (**ABORT** works until the end), then press the big red button. The panel shows the run's timeline until the router answers again and its settings have been read back.

## Progress for everything that takes time

Applying, undoing, restoring, a quiet apply and a reboot all show a live timeline that keeps updating until the router has really answered. The dialog can be hidden; the run continues.

## The history manager

Open **History manager** from the Safety section. It has seven views:

- **Timeline**: every change by day or by area, with who made it, the mode, the impact and any owner override.
- **Compare**: pick any two versions or bookmarks and read what differs.
- **One setting**: the history of a single setting, with a button to put it back.
- **Bookmarks**: named points you can restore.
- **Statistics**: changes per day, per impact, per person and the most changed settings.
- **Pending**: changes waiting for a time or a quiet house, with a Cancel button.
- **Export**: JSON, CSV, Markdown, HTML or PDF of the entries that match the filters. Secrets are never included, and a CSV cell that starts with a formula character is neutralised.

The filters are area, mode, impact, person and dates. The search box has the regex builder beside it; a pattern is checked before it is sent.

Every entry opens into its changes, each with a **before and after picture** built from its real old and new values: the Wi-Fi spectrum for channels, the address pool for DHCP and the router address, the packet path for port rules, firewall decisions, queue bars, VPN routing, the weekly parental grid, the network map for device lists, and a generic before-and-after for everything else. The same picture appears in the four-key dialog, the review dialog and the progress dialog. Each is labelled as a visual explanation, plays on demand and has a **Step** button that reduced motion uses.

**Restore** puts one setting, or everything, back to a point. Secrets are skipped and reported, never restored.

## The household

The **Household** screen has five views. **People** has the household limit, "Most brother madness allowed" (0 to 3), then one card per person: name in English and Cantonese, the devices that say they are home, the Home Assistant entities, a weekly schedule you paint with a brush (at work, sleeping, at home, erase; drag, or use the arrow keys and Space) and what they put up with at work, asleep, at home and away. The first person is **Your brother** (你兄弟). **Who is home** shows presence. **Home Assistant** stores the address and token (the token goes to the vault and is never shown again). **Home Wi-Fi** chooses which networks count as home and sets the time zone.

Presence comes only from which home Wi-Fi network a device is connected to, and from Home Assistant entities the owner picked. There are no pings, no address tracking, no location and nothing is stored. A person with only wired devices shows as unknown, which counts as home.

### Who uses the most

The **Who uses the most** tab, also available as its own **Top talkers** screen under Monitor, ranks devices by what they are downloading or uploading right now, over the last minute, or in total. Devices that belong to a person carry their name, and a second list totals each person. It reads the router's connection table every three seconds and says plainly when the router does not count bytes.

## What is not finished

The screens are driven against the pretend router and checked in a desktop-size browser; the 360 px layout, a real router and a real Home Assistant are not yet verified.
