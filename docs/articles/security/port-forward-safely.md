---
title: Forward a port safely
category: security
order: 6
summary: A step-by-step way to open one port to one device, test it, and keep the risk small.
status: in-progress
related: router/port-forwarding, lan/dmz, lan/upnp, router/address-reservations, security/hardening-checklist
---

Port forwarding sends traffic arriving at one port on your public address to one device inside. Use it for a game server, a camera viewer or a web service you run yourself. This guide uses the rules the app already supports (see [Port forwarding](../router/port-forwarding.md)).

::sim[port-forward]

*The panel above is a demonstration with made-up devices and ports. It does not touch your router.*

## Before you open anything

1. **Do you need it?** A video call app, a streaming box and most consoles need nothing. Check whether the application works with no forward.
2. **Give the target a fixed address.** Make an [address reservation](../router/address-reservations.md). A rule pointing at a changing address ends up pointing at a stranger.
3. **Choose the narrowest rule.** One port, one protocol, one device. Avoid ranges.
4. **Update the device** and its application. An exposed program with a known flaw is the way in.

## The steps

1. Open **Port forwarding** and choose **Add**.
2. Give it a name you will recognise in a year.
3. Pick the device, the protocol, the external port and the internal port. Using the same number for both is simplest.
4. Read the preview. It shows the rule as "198.51.100.40 port 25565, TCP" and names the device.
5. Confirm. The change goes through the normal safe-change path and can be undone.

## Test it from outside

A test from inside your home often succeeds and proves nothing. Ask a friend, or use mobile data on a phone with Wi-Fi switched off, or an external port-check service. If it fails, work through the checks in [Troubleshooting by symptom](../reference/troubleshooting-by-symptom.md): double NAT, a firewall on the device, the wrong protocol, and a provider that blocks the port.

## Keep the risk small

| Do | Do not |
| --- | --- |
| Use a non-default port if the service allows | Forward remote desktop or management ports to the open internet |
| Add a password or key to the service | Leave a default password |
| Delete the rule when finished | Leave old rules for years |
| Use a [VPN](../router/vpn.md) for your own remote access | Expose the router's own page |

## If it must be reachable

Put the device on its own network if you can, and consider the [UPnP](../lan/upnp.md), [triggering](../lan/port-triggering.md) and [DMZ](../lan/dmz.md) alternatives only after reading their risks.
