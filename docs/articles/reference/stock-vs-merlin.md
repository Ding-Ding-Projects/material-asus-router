---
title: Stock ASUS firmware or Asuswrt-Merlin
category: reference
order: 6
summary: A side-by-side comparison of the two firmwares the app supports, what each adds, and how to decide whether to switch.
status: ready
related: setup/firmware-detection, router/merlin-extras, merlin/firmware-update-walkthrough, reference/faq
---

The app works with both. It detects which one your router runs and shows controls that need Merlin as disabled, with the reason, on stock firmware. This page helps you understand the difference and decide whether to move.

## What they are

| | Stock ASUS | Asuswrt-Merlin |
| --- | --- | --- |
| Made by | ASUS | A community developer, building on ASUS's code |
| Cost | Included | Free |
| Support | The vendor | Community, forums and the project page |
| Updates | Vendor schedule. Older models stop | Often longer for supported models. Still only supported models |
| Looks | The vendor's interface | Almost the same, with extra pages |

## What Merlin adds

| Feature | Stock | Merlin |
| --- | --- | --- |
| Custom scripts at events | No | Yes. See [Merlin scripts](../merlin/merlin-scripts.md) |
| Cron jobs | No | Yes. See [Cron jobs](../merlin/cron-jobs.md) |
| DNS Director | No | Yes. See [DNS Director](../internet/dns-director.md) |
| VPN Director | Similar feature on newer builds | Yes. See [VPN Director](../connect/vpn-director.md) |
| Add-on ecosystem and Entware | Not supported | Yes. See [Entware](../merlin/entware.md) |
| Extra tuning values | Limited | More, under [Advanced](../router/advanced.md) |
| Cloud features and vendor apps | Yes | Some removed or changed |
| AiProtection | Yes | Present on some models |

## What stock keeps

- A warranty position that is simpler, since you run the vendor's software.
- The vendor's phone app, cloud sign-in and automatic updates.
- No third-party code on your router.

## Should you switch?

| If you | Suggestion |
| --- | --- |
| Want it to just work and update itself | Stay on stock |
| Want scripts, advanced DNS or VPN routing, or per-device tricks | Consider Merlin |
| Run a router the vendor no longer updates | Merlin may extend its safe life if your model is supported |
| Are not sure | Stay on stock and try [the demo](../start/demo-router.md) first |

## Before you switch

1. Confirm your exact model and hardware revision are supported.
2. Back up your settings. See [Backup and restore](../router/backup-restore.md).
3. Follow the [firmware update walkthrough](../merlin/firmware-update-walkthrough.md).
4. After the switch, reset to factory settings if the project says so, and set up again rather than restoring an incompatible backup.

## What the app does either way

The core safe-change path, the guard, the history, undo, and the devices, Wi-Fi, internet, firewall, VPN, USB and system areas work on both. Only controls that need Merlin are different.

## Status

This is a comparison, not a feature, so it is marked Ready. Individual features carry their own status.
