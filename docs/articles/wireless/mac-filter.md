---
title: Wireless MAC filter
category: wireless
order: 8
summary: Allow or block specific devices on Wi-Fi by hardware address, and why this is a convenience rather than real security.
status: in-progress
related: router/devices, wireless/wps, security/hardening-checklist, router/wifi
---

Every network card has a hardware address called a MAC address, written like `AA:BB:CC:DD:EE:FF`. A MAC filter lets the router accept only listed devices, or refuse listed ones, before they even try the password.

> [!NOTE]
> **In progress.** Blocking a device from the internet is built under [Devices](../router/devices.md). A per-band Wi-Fi MAC filter list is not.

## Two modes

| Mode | Behaviour | Use for |
| --- | --- | --- |
| Reject listed | Everyone may join except the listed addresses | Keeping one unwanted device off |
| Accept listed | Only the listed addresses may join | A small, fixed household of known devices |

## Why it is weak security

MAC addresses are broadcast in the clear. Anyone nearby can see an allowed address and copy it. The filter stops a casual guest, not a determined person. A strong password with WPA3 or WPA2 is the real protection.

## Why it can lock out your own phone

Modern phones and laptops use a **private (random) address per network** by default. If you add the phone's real hardware address to an accept list, the phone joins with a different one and is refused. Check the address the phone shows for *this* network, not the one on its box.

> [!WARNING]
> In **Accept listed** mode, a new device cannot join until you add it. Do not switch this on from a phone that is connected over Wi-Fi without first adding that phone, or you will lose your connection. The [connection-loss guard](../safety/connection-guard.md) restores the old setting, but only if the app can still reach the router.

## Steps (planned)

1. Open **Devices** and copy the address of each device you want to list.
2. Open **Wi-Fi**, pick the band and choose the mode.
3. Add addresses. The app validates the format (six pairs separated by colons).
4. Read the preview and confirm.

## Status

| Part | State |
| --- | --- |
| Address format check | Built |
| Block a device from the internet | Built (Devices) |
| Per-band Wi-Fi MAC filter | In progress |
