---
title: Plan the address pool
category: lan
order: 1
summary: Size the range the router hands out, leave room for fixed addresses, and avoid the conflicts that cause half the home network mysteries.
status: in-progress
related: router/local-network, router/address-reservations, tools/subnet-calculator, lan/static-routes
---

The router hands out addresses to devices from a range called the **pool**. A little planning stops two devices from fighting over one address and leaves tidy room for things that must never move: the printer, the media server, the router itself.

> [!NOTE]
> **In progress.** The router address, network size, first and last pool address and lease time controls are built and checked against the pretend router. The guide below shows how to choose the values.

## Anatomy of a home network

Take the example network 198.51.100.0/24. The `/24` means the first three numbers identify the network and the last number identifies the device, so there are 254 usable addresses, from 198.51.100.1 to 198.51.100.254.

| Range | Use |
| --- | --- |
| 198.51.100.1 | The router |
| 198.51.100.2 to .49 | Fixed addresses for things you reserve or set by hand |
| 198.51.100.50 to .200 | The pool for ordinary devices |
| 198.51.100.201 to .254 | Spare, for later |

::sim[dhcp-pool]

*The panel above is a demonstration with made-up devices. It does not read your router.*

## Choosing the size

Count devices, double it, and add a little. Phones, laptops, TVs, smart plugs, speakers and cameras add up fast: 40 to 60 devices is normal for a busy home. A pool of 150 is generous.

## Lease time

The lease is how long a device may keep an address before asking again. One day suits most homes. Short leases (one hour) tidy guest networks. Long leases (a week) suit a network that rarely changes.

## Avoid conflicts

- Never place a fixed address inside the pool unless it is reserved. Use [Address reservations](../router/address-reservations.md) instead.
- Never reuse a range already used by a VPN. See [VPN](../router/vpn.md).
- Changing the router's own address disconnects everyone and moves the app's link. The [connection-loss guard](../safety/connection-guard.md) will restore it if the app cannot reach the router.

## Check your plan

Use the [subnet calculator](../tools/subnet-calculator.md) to confirm the numbers.

## Status

| Part | State |
| --- | --- |
| Pool and lease controls | Built |
| Test on a real router | Not yet done |
