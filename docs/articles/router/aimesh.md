---
title: AiMesh
category: router
order: 16
summary: See your mesh nodes, how they connect and whether they are healthy, and know which changes affect the whole mesh.
status: in-progress
related: router/wifi, router/firmware, router/maintenance, router/overview
---

AiMesh joins several compatible Asus routers into one Wi-Fi network. One router is the **main router**; the others are **nodes**. Devices move between them with one name and one password. This app manages the main router, and shows the state of the nodes it can see.

> [!NOTE]
> **In progress.** Reading mesh state is built to the extent the router exposes it; the screen is still being built. Adding or removing nodes, and node firmware updates, are planned and not available yet. Do those in the router's own pages for now.

## What you see

| Item | Meaning |
| --- | --- |
| Node name and model | The name you gave it and its model |
| Role | Main router or node |
| Connection | Wired backhaul, or wireless backhaul on a band |
| Status | Online, offline or updating |
| Signal to the main router | Strength of a wireless link, where applicable |
| Firmware | The version each node runs |
| Devices | How many devices are connected to each node |

## Check mesh health

1. Open **AiMesh**.
2. Look at the connection column. A wired backhaul is more reliable than a wireless one, so use cables between nodes when you can.
3. A node with a weak signal to the main router can be moved closer, or connected by cable.
4. Check that all nodes run the same firmware family and a compatible version. Mixed versions cause odd behaviour.

## What affects the whole mesh

| Change | Effect on nodes |
| --- | --- |
| Wi-Fi name, password and security ([Wi-Fi](wifi.md)) | Nodes follow the main router. They drop their clients and reconnect |
| Local network address and DHCP ([Local network](local-network.md)) | Nodes must reconnect; guarded changes can disconnect the whole mesh |
| Firmware update of the main router ([Firmware](firmware.md)) | Nodes may restart too |
| Reboot ([Maintenance](maintenance.md)) | The mesh is down until the main router and nodes are back |

The connection-loss guard protects your own session. It cannot stop a node from losing its link to the main router for a minute, so plan changes for a time when you will not mind.

## Nodes are managed elsewhere

On some models, a node's own settings are hidden because the main router controls them. This app follows the same rule: it shows the node but does not try to change its settings directly.

## Stock and Merlin differences

| Item | Stock ASUS | Asuswrt-Merlin |
| --- | --- | --- |
| AiMesh | Yes, on supported models | Yes, on supported models; some Merlin settings apply to the main router only |
| Mesh nodes running Merlin | Not applicable | Need the same firmware family as the main router for best results |

## Status

| Part | State |
| --- | --- |
| Read node list and state | Built to what the router exposes |
| AiMesh screen | In progress |
| Add and remove nodes, node updates | Planned |

## See it in action

::sim[network-map]

*The panel above is a demonstration with made-up values. It does not read or change your router.*

## Go deeper

- [Manage an AiMesh network](../connect/aimesh-management.md)
