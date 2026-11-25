---
title: Beamforming
category: wireless
order: 2
summary: How the router aims its signal at a device, the difference between explicit and universal beamforming, and when to switch it off.
status: in-progress
related: wireless/ofdma, router/wifi, wiki:glossary
---

Beamforming makes the router shape its radio signal so that more of it arrives at the device that is talking, instead of spreading evenly in every direction. In practice you get a steadier signal at the edge of the room, not faster speeds next to the router.

> [!NOTE]
> **In progress.** The app does not have a beamforming switch yet. The explanation below is what the switch will mean.

## Two kinds

| Kind | How it works | Works with |
| --- | --- | --- |
| Explicit beamforming | The device reports how it hears the router, and the router adjusts. Part of the standard | Devices that support Wi-Fi 5 (802.11ac) or newer |
| Universal (implicit) beamforming | The router guesses from the replies it already receives | Older devices that support no beamforming at all |

Many routers list both as separate switches. Explicit is the better behaved. Universal helps older devices but occasionally confuses a device that handles it badly.

## When to leave it on

Leave both on for a normal home. They cost nothing and help most with devices at medium range, such as a phone in the next room.

## When to try switching it off

- A single device keeps dropping while everything else is fine. Switch universal beamforming off first and test again.
- You are chasing a fault and want to remove variables. Change one thing, test, then change it back if there was no difference.

> [!TIP]
> Beamforming cannot create range. If a room has no signal, move or add an access point. See [AiMesh](../router/aimesh.md).

## Safe way to change it

1. Open **Wi-Fi** and pick the band.
2. Switch the beamforming option and read the preview. The change restarts that band's radio, so devices on it reconnect.
3. Confirm. The app runs the change under the [connection-loss guard](../safety/connection-guard.md) when you are connected over Wi-Fi.
4. Test the device that had the problem. If nothing improved, put it back from the [change history](../safety/change-history.md).

## Stock and Merlin

Both firmwares offer explicit and universal beamforming on models with the hardware. On routers without it the controls are shown disabled with the reason.

## Status

| Part | State |
| --- | --- |
| Guide | Written |
| Beamforming switches in the app | In progress |
