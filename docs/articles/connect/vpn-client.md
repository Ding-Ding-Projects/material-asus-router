---
title: Use the router as a VPN client
category: connect
order: 3
summary: Connect the whole router to a VPN provider, which devices are covered, and what to do about speed, leaks and a dropped tunnel.
status: in-progress
related: connect/vpn-director, connect/vpn-servers, router/vpn, internet/dns-over-tls
---

The router can connect to a commercial VPN service and send traffic through it. Every device behind the router is covered with nothing to install, including TVs and consoles that have no VPN app. This is a different direction from a VPN server: here the router is the **client**.

> [!NOTE]
> **In progress.** The app has no VPN client screen yet. To send only some devices through the tunnel, read [VPN Director](vpn-director.md) too.

## Two ways to use it

| Approach | Covers | Trade-off |
| --- | --- | --- |
| Whole house | Every device | Everything slows to the tunnel's speed, and some sites block VPN addresses |
| Chosen devices (VPN Director) | Only the devices or destinations you pick | More setup, much less side-effect |

## What you need

- A subscription to a VPN service that gives a configuration file for OpenVPN or WireGuard.
- Enough router power. Small models cap out far below fast fibre speeds when encrypting. Expect a fraction of your line speed, especially with OpenVPN.

## Steps (planned)

1. Open **VPN**, choose the client section and import the provider's file. The app reads it locally and does not send it anywhere.
2. Choose the DNS behaviour. Using the VPN's DNS avoids leaking lookups to your provider.
3. Read the preview. Keys and passwords are masked.
4. Confirm. A tunnel change can cut your connection, so it runs under the [guard](../safety/connection-guard.md).

## Check there is no leak

1. With the tunnel up, find your public address with a site you trust. It should be the VPN's address, not your provider's.
2. Run a DNS leak test. The resolvers shown should be the VPN's.
3. Unplug the tunnel's connection or disable it and check that devices you wanted protected lose internet rather than falling back silently. That behaviour is called a **kill switch**. It is a policy rule in [VPN Director](vpn-director.md), not a magic button.

## Common problems

| Symptom | Likely cause |
| --- | --- |
| Slow | Router too weak to encrypt at line speed. Choose WireGuard or a nearer server |
| Some sites refuse you | They block VPN addresses. Exclude them in VPN Director |
| Streams fail | Same reason |
| Tunnel drops now and then | Use a keepalive, or a more stable server |

## Status

| Part | State |
| --- | --- |
| Guide | Written |
| VPN client controls | Planned |
