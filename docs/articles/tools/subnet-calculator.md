---
title: Subnet calculator
category: tools
order: 10
summary: Planned: work out address ranges, masks and host counts for a network.
status: in-progress
related: router/local-network
---

This is one of the planned router tools. It is marked **In progress**, which means the description below is the plan, not something you can use yet.

> [!NOTE]
> Subnet calculator is **In progress**. Treat everything under "Planned behaviour" as a goal until this page says otherwise.

## What it is for

Turn a block such as 198.51.100.0/24 into its mask, first and last usable address and number of hosts, so you can plan DHCP ranges and reservations.

## Planned behaviour

- Accept an address with a prefix length or a mask.
- Show the mask, network and broadcast address, usable range and host count.
- Check whether an address is inside a range and whether two ranges overlap.
- Run entirely on your device with no call to the router.

## What is missing

The calculator screen is not built. It needs no router access, so it can be completed independently of the other tools.

## Good to know

- Example: 198.51.100.0/24 has 254 usable addresses, from 198.51.100.1 to 198.51.100.254.
- A calculator never changes the router. Use Local network for that.
