---
title: Address reservations
category: router
order: 8
summary: Make the router give a chosen device the same local address every time.
status: in-progress
related: router/local-network, router/devices, router/port-forwarding
---

An address reservation (also called a static DHCP lease) ties a device's hardware address to a local address. The device still asks the router for an address as normal, but always gets the same one. This is the safest way to give a printer, server or camera a fixed address, because the device itself needs no manual setup.

> [!NOTE]
> **In progress.** The reservation list and form are still being built.

## When to use it

- You forward a port to the device. See [Port forwarding](port-forwarding.md).
- Other devices connect to it by address, such as a printer or a media server.
- You want a rule, such as a block or priority, to follow the same device.

## Add a reservation

1. Open **Local network** and choose **Address reservations**, or open the device in [Devices](devices.md) and choose **Reserve address**.
2. Pick the device. Its hardware address (MAC) is filled in.
3. Type the address, for example 198.51.100.20. It must be inside the network and, to avoid clashes, outside the dynamic pool.
4. Add a short name, such as `Printer`.
5. Review the preview and confirm.
6. Make the device renew its address by turning its Wi-Fi off and on. Until then it keeps the old address.

The app refuses an address that is already reserved for another device, is the router's own address, or lies outside the network.

## Edit or remove

- **Edit** changes the address or name. The device moves to the new address at its next renewal.
- **Remove** returns the device to the dynamic pool. Previous values are saved, so [undo](../safety/undo-changes.md) works.

## Tips

> [!TIP]
> Keep reservations in a block just below the pool, for example 198.51.100.2 to 198.51.100.99 if the pool starts at 198.51.100.100. Then you can see at a glance which addresses are fixed.

> [!WARNING]
> Phones that use a private Wi-Fi address show a different hardware address on each network. Reserve using the address the phone shows for your home network, and switch off the private address option for that network if reservations keep failing.

## Stock and Merlin differences

| Item | Stock ASUS | Asuswrt-Merlin |
| --- | --- | --- |
| Reservations by hardware address | Yes | Yes |
| Maximum number | Model dependent | Model dependent, typically higher |
| Per-device extra DHCP options | No | Yes, through custom configuration |

## Status

| Part | State |
| --- | --- |
| Validation rules (duplicates, range, own address) | Built |
| Reservation list and form | In progress |

## See it in action

::sim[dhcp-pool]

*The panel above is a demonstration with made-up values. It does not read or change your router.*

## Go deeper

- [Plan the address pool](../lan/dhcp-pool-planning.md)
- [Subnet calculator](../tools/subnet-calculator.md)
