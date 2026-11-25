---
title: DNS Director
category: internet
order: 6
summary: Force chosen devices to use chosen DNS servers, even devices that ignore the router, with family filters as the common example. Merlin only.
status: in-progress
related: internet/dns-over-tls, router/merlin-extras, setup/firmware-detection
---

Some devices ignore the DNS server the router offers and use a hard-coded one, such as a smart TV or a game console. **DNS Director** is an Asuswrt-Merlin feature that catches DNS questions from the home network and redirects them to the server you chose. It can apply to the whole house or to selected devices. On older Merlin versions the same idea was called DNSFilter.

> [!NOTE]
> **In progress.** Merlin only, and the app does not set it yet. On stock firmware the controls are shown disabled with the reason. See [Firmware detection](../setup/firmware-detection.md).

## Typical uses

| Goal | Setup |
| --- | --- |
| A family-safe resolver for the children's devices | Redirect those devices only |
| Stop a smart TV bypassing your resolver | Redirect all devices, or that device |
| Use a different resolver for guests | Redirect the guest network only |

## Modes per device

| Mode | Meaning |
| --- | --- |
| Router | Use the router's own DNS settings (the default) |
| Server 1, 2 and so on | Use that listed server |
| None | Leave the device alone, even when a global rule exists |

A global rule applies to everyone. A per-device rule overrides it. Name the devices clearly first, in [Devices](../router/devices.md), so the list is readable.

::sim[dns-race]

*The panel above is a demonstration with made-up times.*

## Limits to know

- It only redirects ordinary DNS (port 53). A device that uses encrypted DNS inside its own app, called DoH, bypasses it. See [DNS over TLS](dns-over-tls.md) for the router's own encrypted option.
- The router cannot see inside encrypted traffic, so a device determined to bypass it can.
- Redirecting breaks anything that must reach a specific private DNS server, such as a work VPN.

## Steps (planned)

1. Open **Merlin extras** and choose DNS Director.
2. Pick a global rule and the servers.
3. Set the exceptions per device. Read the preview and confirm.
4. Test from an affected device with [name lookup](../tools/network-tools.md) and check which server answered.

## Status

| Part | State |
| --- | --- |
| Guide | Written |
| DNS Director controls | Planned, Merlin only |
