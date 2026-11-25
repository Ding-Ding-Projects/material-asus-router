---
title: Manage an AiMesh network
category: connect
order: 7
summary: Add and remove nodes, choose wired or wireless backhaul, keep firmware matched and find a weak link.
status: in-progress
related: router/aimesh, wireless/roaming, router/firmware, router/devices
---

AiMesh joins several compatible ASUS routers into one Wi-Fi network with a single name and one place to manage. One router is the **main** router; the others are **nodes**. This guide covers keeping a mesh healthy. The app lists mesh nodes today (see [AiMesh](../router/aimesh.md)). Adding and removing nodes from the app is planned.

::sim[network-map]

*The map above is a demonstration with made-up devices. It does not read your network.*

## Backhaul: how nodes reach the main router

| Backhaul | Speed | Notes |
| --- | --- | --- |
| Ethernet cable | Best | Use it wherever you can. It frees the radios for devices |
| Wireless on a dedicated band | Good | Tri-band models reserve a band for the nodes |
| Wireless sharing the device band | Fair | Halves throughput at each hop. Keep hops to one |

## Placement

Put a node where the main router's signal is still **strong**, about half way, not in the dead room. A node placed in a weak spot repeats a weak signal. Check the signal between nodes in the mesh list.

## Add or replace a node

1. Reset the new node to factory settings, then power it near the main router.
2. Add it from the main router's mesh page. It takes a few minutes and restarts.
3. Move it to its final place and check the link quality.

## Keep firmware matched

Mesh works best when the main router and nodes run the same firmware generation. Update the main router first, then the nodes one by one. See [Firmware](../router/firmware.md).

> [!WARNING]
> Updating a node restarts it, which drops the devices on it. Do it when nobody is on a call.

## Find a weak link

| Symptom | Check |
| --- | --- |
| One room is slow | Signal strength between that node and the main router |
| Devices cling to a far node | See [Roaming](../wireless/roaming.md) |
| A node keeps going offline | Power supply, backhaul cable, firmware mismatch |

## Merlin

Asuswrt-Merlin supports AiMesh on selected models, as the main router or as a node. Check that your pair is supported before you mix firmware.

## Status

| Part | State |
| --- | --- |
| Node list | Built |
| Add, remove and reboot a node | In progress |
