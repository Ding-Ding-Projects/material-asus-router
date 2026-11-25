---
title: Roaming and band steering
category: wireless
order: 1
summary: Why phones cling to a weak signal, what roaming assistants and fast roaming do, and how to tune them without breaking old devices.
status: in-progress
related: wireless/smart-connect, router/wifi, router/aimesh, wiki:glossary
---

Walk from the living room to the bedroom and your phone should hop to the stronger access point or band. Often it does not. Phones decide when to move, and many hold on to a fading signal for as long as they can. The router can only nudge them.

> [!NOTE]
> **In progress.** The app has no roaming screen yet. This guide explains the ideas so you can decide what you want, and says what the app will do when the screen is built.

## The three tools the router has

| Tool | What it does | Risk |
| --- | --- | --- |
| Roaming assistant | Disconnects a device whose signal drops below a threshold, so it looks for a better one | A threshold that is too high disconnects devices that were fine |
| Neighbour reports (802.11k) and move suggestions (802.11v) | Tell a device which other access points are nearby and ask it politely to move | Old devices ignore them. Harmless |
| Fast roaming (802.11r) | Skips most of the handshake when moving between access points that share a name | A few older devices fail to join a network with it on |

## Choose a threshold

Signal strength is measured in dBm. Closer to zero is stronger, so -50 dBm is excellent and -80 dBm is poor. A common starting point is to disconnect below roughly -70 dBm in a small home. In a large house with several access points, a slightly stronger threshold such as -65 dBm moves devices sooner. These numbers are examples, not advice for your walls.

::sim[wifi-spectrum]

*The panel above is a demonstration with made-up signals. It does not read your router.*

## A safe way to tune it

1. Change nothing until a device actually misbehaves. Roaming defaults suit most homes.
2. Change one band only, and note the old value. The app records old values in the [change history](../safety/change-history.md).
3. Walk the route with a phone, using a Wi-Fi scanner app to watch the signal.
4. If devices start dropping, raise the tolerance (a lower number such as -75 dBm) rather than turning everything off.

> [!TIP]
> Roaming only helps if there is somewhere better to go. One router in a corner cannot fix a dead room. See [AiMesh](../router/aimesh.md) for adding access points.

## What the app will check

- It will refuse a threshold outside the range the router accepts.
- It treats the change as a Wi-Fi change, so it runs under the [connection-loss guard](../safety/connection-guard.md) when you are connected over Wi-Fi.

## Stock and Merlin

Stock ASUS firmware exposes the roaming assistant on supported models. Merlin keeps it and adds more per-band values under [Advanced](../router/advanced.md).

## Status

| Part | State |
| --- | --- |
| Guide | Written |
| Roaming screen in the app | In progress |
| Test on a real router | Not yet done |
