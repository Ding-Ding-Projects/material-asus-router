---
title: IPTV and VLAN tagging
category: internet
order: 4
summary: Why some providers send TV and internet on separate tagged networks, and how to match your provider's profile without breaking either.
status: in-progress
related: internet/wan-types, router/local-network, router/internet
---

Some providers deliver internet, television and phone over the same fibre, kept apart with **VLAN tags**. A VLAN tag is a number stamped on every packet so equipment knows which service it belongs to. If your provider uses them, the router must tag and untag the right traffic, and the TV box must plug into the right port.

> [!NOTE]
> **In progress.** The app does not configure VLANs yet. This guide gives the checklist you need either way.

## What you need from the provider

| Item | Example form |
| --- | --- |
| Internet VLAN ID, or "untagged" | A number from 1 to 4094 or none |
| IPTV VLAN ID | Another number |
| Priority value for each | 0 to 7 |
| Which LAN port is for the TV box | Usually a numbered port |

Many routers include ready-made profiles for known providers. If yours is listed, choose it instead of typing numbers. If not, ask for the list above, because guessing a VLAN ID simply fails silently.

## How it works

The TV box asks for a multicast stream. The router must forward multicast to that port only, otherwise the stream floods the whole network and Wi-Fi slows down. Look for a setting about **multicast** or **IGMP** and leave it on.

## Mistakes to avoid

- Plugging the TV box into a non-IPTV port. It gets no picture or the wrong network.
- Tagging the internet connection when the provider expects it untagged. You lose internet.
- Changing this while connected through the same port. Use another port or a phone hotspot to recover.

> [!WARNING]
> Changing WAN tagging can cut internet entirely. The [connection-loss guard](../safety/connection-guard.md) puts the old values back if the app can no longer reach the router. Keep the provider's numbers written down.

## Stock and Merlin

Stock firmware offers provider profiles and a manual profile. Merlin keeps both. Per-port assignment depends on the model.

## Status

| Part | State |
| --- | --- |
| Guide and checklist | Written |
| VLAN and IPTV controls in the app | Planned |
