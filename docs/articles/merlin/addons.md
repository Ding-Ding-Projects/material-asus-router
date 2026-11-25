---
title: Merlin add-ons
category: merlin
order: 9
summary: A tour of the popular community add-ons for Merlin, what each one is for, and how to choose without overloading a small router.
status: in-progress
related: merlin/entware, merlin/merlin-scripts, router/merlin-extras, connect/qos-modes
---

A thriving community writes add-ons for Asuswrt-Merlin. They are scripts and small programs that add features the firmware lacks. They are not made or supported by ASUS, by the Merlin project or by this app, and the app does not install them. This page helps you choose.

> [!IMPORTANT]
> Add-ons run with full router power. Read each project's own page, check that it is actively maintained and that it supports your firmware version, and install one at a time.

## A short tour (examples, not endorsements)

| Add-on | What it does | Cost |
| --- | --- | --- |
| amtm | A menu that installs and updates other add-ons and Entware | Light |
| FlexQoS | Makes the traffic priority rules easy to tune. Pairs with [traffic priority](../connect/qos-modes.md) | Light |
| Skynet | Blocks known bad addresses at the firewall | Memory grows with list size |
| YazFi | Extra guest networks with their own rules | Light |
| scMerlin | A page to restart services and see status | Light |
| connmon and spdMerlin | Monitor internet quality and speed over time | Light to moderate |
| Diversion | Network-wide ad blocking through DNS | Needs a USB drive and more memory |

If a link, name or feature changed since this was written, trust the project page, not this list.

## Choose with a checklist

1. **Do I have a clear problem?** "I want better night-time ping" is a reason. "It looked cool" is not.
2. **Is there a simpler built-in answer?** Many needs are covered by a firmware setting or a [family DNS resolver](../internet/dns-director.md).
3. **Does my router have the memory and a USB drive for it?** Check free memory before you start.
4. **Is the project alive?** Recent updates and a helpful community are good signs.
5. **How do I undo it?** Know the uninstall step before the install step.

## Habits

- Install one add-on, live with it for a week, then decide.
- Back up the router before each addition. See [Backup and restore](../router/backup-restore.md).
- Keep firmware and add-ons updated together. A big firmware jump can break an old add-on.
- Never expose an add-on's web page to the internet.

## Status

| Part | State |
| --- | --- |
| Guide | Written |
| Add-on management in the app | Not planned. The app only shows whether scripts are enabled |
