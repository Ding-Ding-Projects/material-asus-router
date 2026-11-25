---
title: Local network and DHCP
category: router
order: 7
summary: Change the router address, the DHCP address range, the lease time and the local domain.
status: in-progress
related: router/address-reservations, router/devices, safety/connection-guard, safety/undo-changes
---

The Local network area decides the addresses inside your home: the router's own address, the range it hands out to devices (DHCP), how long a device keeps an address, and the local domain name. In this guide the example network is 198.51.100.0/24 with the router at 198.51.100.1.

> [!NOTE]
> **In progress.** The controls are defined and the change engine is built; the screen and real-router tests are still being built.

> [!WARNING]
> Changing the router address or turning DHCP off moves or stops the thing you are connected to. The app always arms the [connection-loss guard](../safety/connection-guard.md) for these changes and keeps the old address ready. Do not change them over a connection you cannot afford to lose, and never while a firmware update is running.

## Controls

| Control | What it does | Safe recommendation |
| --- | --- | --- |
| Router address | The router's own address, for example 198.51.100.1 | Change only if it clashes with a VPN or another network |
| Network size | How many addresses the home network has (the mask, such as /24 = 254 devices) | /24 is enough for nearly every home |
| Local domain | Lets devices be reached as `name.domain`, for example `nas.home.lan` | Use a private name such as `home.lan`, not a real internet domain |
| Hand out addresses (DHCP) | Gives new devices an address automatically | Leave on unless another device on the network already does it |
| First address / Last address | The pool the router hands out | Leave room outside the pool for devices you give fixed addresses |
| Lease time | How long a device keeps an address before asking again; one day is 86,400 seconds | One day is a good default |

## Change the DHCP range

1. Open **Local network**.
2. Edit **First address** and **Last address**. The app checks that both are inside the network and that first comes before last.
3. Review the preview with old and new range.
4. Confirm. Devices that already hold an address keep it until their lease ends.

For example, with the router at 198.51.100.1, a pool of 198.51.100.100 to 198.51.100.199 leaves 198.51.100.2 to 198.51.100.99 free for fixed addresses and [reservations](address-reservations.md).

## Change the router address

This is the riskiest change on this page.

1. Pick a new address on a different range than any VPN you use, for example 203.0.113.1.
2. The preview shows the old and new address, and warns that you will need to reconnect.
3. Confirm. The app arms the timed revert on the router, then applies the change.
4. Your devices renew their addresses and the app reconnects to the new address. When it reaches the router, it cancels the revert.
5. If it cannot reach the router, the router restores the old address after 90 seconds by itself.

Everything that points at the old address, such as bookmarks, [port forwards](port-forwarding.md) to fixed addresses and VPN settings, must be updated by hand.

## Stock and Merlin differences

| Item | Stock ASUS | Asuswrt-Merlin |
| --- | --- | --- |
| Address, DHCP range, lease time, domain | Yes | Yes |
| Custom DHCP options and extra name-service settings | No | Yes, through custom configuration; see [Merlin extras](merlin-extras.md) |

## Status

| Part | State |
| --- | --- |
| Control definitions, validation and guarded apply | Built |
| Local network screen | In progress |
| Real-router test of an address change | Not yet |
