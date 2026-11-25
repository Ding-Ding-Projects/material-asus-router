---
title: VPN Director
category: connect
order: 5
summary: Decide which devices and destinations use the VPN tunnel and which go straight out, with a worked policy and a safe kill-switch rule.
status: in-progress
related: connect/vpn-client, router/vpn, security/hardening-checklist, setup/firmware-detection
---

With a VPN client running on the router, VPN Director chooses **who goes through the tunnel**. A rule says "this device, or this destination, uses the VPN" or "this one goes straight to the internet". Everything not matched by a rule follows the default.

> [!NOTE]
> **In progress.** VPN Director is an Asuswrt-Merlin feature. Newer stock firmware has a similar feature with its own name. The app does not set either yet, and shows the control disabled, with the reason, on firmware without it.

::sim[vpn-director]

*The panel above is a demonstration with made-up devices. It does not touch your router.*

## Rule parts

| Part | Meaning |
| --- | --- |
| Source | A device address or a range such as 198.51.100.40 |
| Destination | Everything, or a chosen address or range |
| Tunnel | Which VPN client connection to use, or the normal internet |
| Enabled | Rules can be paused without being deleted |

Rules are read from the top. The first match wins, so put specific rules above broad ones.

## A worked policy (demonstration)

| # | Source | Destination | Goes via |
| --- | --- | --- | --- |
| 1 | The games console | Everything | Normal internet. Games lag through a tunnel |
| 2 | Alex laptop | A banking site address | Normal internet. Banks distrust VPN addresses |
| 3 | Pat laptop and phone | Everything | VPN tunnel |
| 4 | Everything else | Everything | Normal internet |

## A safe kill switch

If the tunnel goes down, a rule that points devices to a dead tunnel normally lets them fall back to the normal internet, which leaks your real address. For devices that must never do that, use the option that **blocks traffic when the tunnel is down** rather than falling back. Test it by turning the tunnel off and checking that those devices lose internet.

> [!WARNING]
> A block-when-down rule on the device you are using can cut you off. The [connection-loss guard](../safety/connection-guard.md) restores the old rule if the app can no longer reach the router. Apply it from a device that is not covered by the rule.

## Check it works

1. From a covered device, find your public address. It should be the VPN's.
2. From an uncovered device, it should be your provider's.
3. Check DNS too. See [VPN client](vpn-client.md).

## Status

| Part | State |
| --- | --- |
| Guide | Written |
| VPN Director rules in the app | Planned, Merlin only |
