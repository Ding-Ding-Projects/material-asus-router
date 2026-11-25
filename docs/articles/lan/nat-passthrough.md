---
title: NAT passthrough and helpers
category: lan
order: 6
summary: PPTP, L2TP, IPsec, SIP and similar helpers that let special protocols cross the router, and when switching one off fixes a call or a VPN.
status: in-progress
related: router/vpn, lan/upnp, reference/troubleshooting-by-symptom, router/firewall
---

Network address translation (NAT) rewrites addresses as traffic crosses the router. Some protocols hide addresses inside their own data and break when only the outside is rewritten. **Passthrough** and **helper** switches teach the router to cope with each one.

> [!NOTE]
> **In progress.** The app has no passthrough switches yet.

## The usual list

| Switch | Helps with | Leave it |
| --- | --- | --- |
| PPTP passthrough | Old PPTP VPN connections made from a home device | On if you use one, otherwise off |
| L2TP passthrough | L2TP VPN from a home device | On |
| IPsec passthrough | IPsec VPN from a home device | On |
| PPPoE relay | Letting a device behind the router log in to the provider itself | Off unless you know you need it |
| RTSP, H.323 helpers | Some camera and old video conference systems | On |
| SIP passthrough | Internet phone calls from a home device | On, but see below |

## When a helper causes trouble

Helpers that try to be clever can break modern applications. The classic case is the SIP helper: it rewrites phone call setup messages and, on some services, makes calls drop after 30 seconds or have one-way sound. If a phone app or an IP phone behaves like that, switch the **SIP passthrough** off and test.

## A safe way to test

1. Write down the current setting. The app keeps it in the [change history](../safety/change-history.md).
2. Change one switch.
3. Repeat the failing action, such as a call or the VPN connection.
4. If nothing changed, put it back. Do not leave switches off "just in case".

## Related causes

If a VPN client from a home device cannot connect, check the VPN server's address and port first, then [Troubleshooting by symptom](../reference/troubleshooting-by-symptom.md). Double NAT, where two routers in a row both translate, also breaks these protocols, and no switch fixes it.

## Status

| Part | State |
| --- | --- |
| Guide | Written |
| Passthrough switches | Planned |
