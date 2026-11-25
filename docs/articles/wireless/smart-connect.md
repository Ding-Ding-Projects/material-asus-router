---
title: Smart Connect
category: wireless
order: 6
summary: One Wi-Fi name for every band, how the router chooses a band for each device, and when separate names work better.
status: in-progress
related: wireless/roaming, router/wifi, router/aimesh
---

Smart Connect gives the 2.4 GHz, 5 GHz and 6 GHz bands the same name and password. The router then decides which band each device should use and can move it later when conditions change. You get one network to join instead of three.

> [!NOTE]
> **In progress.** The app edits each band separately today. A Smart Connect switch and its rules are planned.

## One name or separate names

| Choice | Good for | Weak point |
| --- | --- | --- |
| Smart Connect (one name) | Phones, laptops and most homes. Nothing to think about | You cannot choose the band. A device may sit on a slow one |
| Separate names | Smart plugs, printers, older gadgets, anything that must stay on 2.4 GHz | You choose manually, and devices do not move by themselves |

A good compromise: Smart Connect for 5 GHz and 6 GHz, with a separate 2.4 GHz name for gadgets that are fussy about joining.

## Steering rules

Steering means the router asks a device to change band. Typical triggers are signal strength, how busy each band is and the speed a device could reach. The more aggressive the rule, the more often a device is moved. Moves cause a brief pause, so aggressive steering can interrupt a video call.

## Why a gadget will not join

Many smart devices only support 2.4 GHz and fail to set up when they see a network that also offers 5 GHz. If setup fails:

1. Turn Smart Connect off temporarily, or join the phone you use for setup to the 2.4 GHz-only name.
2. Set up the gadget.
3. Turn Smart Connect back on. The gadget usually stays on 2.4 GHz.

## Steps in the app (planned)

1. Open **Wi-Fi** and choose Smart Connect.
2. The preview shows the name and password every band will share. Passwords are masked.
3. Confirm. The change restarts every band, so it runs under the [connection-loss guard](../safety/connection-guard.md).

> [!WARNING]
> Turning Smart Connect on makes every band take one name. Devices that were joined to the old per-band names must be joined again.

## Status

| Part | State |
| --- | --- |
| Guide | Written |
| Per-band names and passwords | Built |
| Smart Connect switch and steering rules | In progress |
