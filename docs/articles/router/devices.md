---
title: Devices
category: router
order: 2
summary: See every connected device, give it a readable name, block it, wake it or reserve its address.
status: in-progress
related: router/address-reservations, router/parental-controls, router/wifi, safety/safe-changes
---

The Devices screen lists everything the router knows about: phones, laptops, TVs, printers and smart plugs. It is the quickest way to answer "what is this device?" and "who is using the bandwidth?".

> [!NOTE]
> **In progress.** The device list is read from the router, but the full screen, per-device actions and real-router verification are still being built.

## What each row shows

| Column | Meaning |
| --- | --- |
| Name | The name you gave it, or the name the device announced, or its maker if it announced nothing |
| Status | Online or offline |
| Connection | Wired, or the Wi-Fi band it is on (2.4 GHz, 5 GHz, 6 GHz) |
| Address | The local address it holds right now, for example 198.51.100.23 |
| Hardware address (MAC) | The device's network identity. Some phones use a different private one for each Wi-Fi network |
| Signal | For Wi-Fi devices, how strong the signal is |

A summary above the list shows the total, how many are online and how many are on Wi-Fi.

## Find an unknown device

1. Open **Devices** and sort by **Status** so online devices come first.
2. Open the row of the device you do not recognise. The detail shows its maker (derived from the hardware address), its address and how long it has been connected.
3. Turn off Wi-Fi on one of your own devices at a time and watch which row goes offline. This is the simplest way to match a name to a real device.
4. Give it a readable name (see below), or block it if it does not belong.

## Rename a device

A clear name makes every other screen easier to read.

1. Open the device and choose **Rename**.
2. Type a short name such as `Pat laptop` or `Living room TV`.
3. Review the preview. It shows the old and new name.
4. Confirm. The name is saved on the router, so it appears there too.

Renaming is low risk and is not guarded by a timed revert.

## Block or allow a device

Blocking stops the device reaching the internet and, on most firmware, the local network. Use **Block** for a device you do not recognise, or a stolen phone.

1. Open the device and choose **Block**.
2. Read the preview. If the device is the one you are using to run this app, the app warns you, because blocking it cuts you off.
3. Confirm. Changes that could cut your connection arm the [connection-loss guard](../safety/connection-guard.md) first.

To undo, choose **Allow**, or use [undo](../safety/undo-changes.md) on the history entry.

> [!TIP]
> Blocking a hardware address can be bypassed by a device that changes its address. For a schedule or a stronger rule, use [Parental controls](parental-controls.md) or a [firewall](firewall.md) rule.

## Reserve an address

Choose **Reserve address** to make the router hand the same address to this device every time. It opens the form described in [Address reservations](address-reservations.md) with the device already filled in.

## Wake a device

If the device supports Wake-on-LAN, choose **Wake** to send a wake packet from the router. This works only for wired devices that have the feature turned on in their own settings. See [Network tools](../tools/network-tools.md) for the wake tool.

## Stock and Merlin differences

| Item | Stock ASUS | Asuswrt-Merlin |
| --- | --- | --- |
| Device list, names, signal | Yes | Yes |
| Block a device | Yes | Yes |
| Extra detail such as device history | Limited | More, depending on add-ons |

## Safe recommendations

- Name every device you own. An unnamed device later looks like an intruder.
- Reserve the address of anything you forward ports to, such as a server or camera.
- Do not block the device you are managing from until you have a second way in.

## Status

| Part | State |
| --- | --- |
| Reading the device list | Built |
| Rename, block, reserve and wake screens | In progress |
| Verified on real routers | Not yet |
