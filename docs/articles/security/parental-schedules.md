---
title: Parental schedules
category: security
order: 4
summary: Give each child's devices their own weekly online hours, handle random device addresses, and avoid the most common ways schedules fail.
status: in-progress
related: router/parental-controls, security/url-keyword-filters, wireless/wifi-schedule, router/devices
---

A parental schedule lets selected devices go online only during hours you choose, for example school nights 07:00 to 21:00 and weekends 08:00 to 22:00. It acts on devices, not on the Wi-Fi radio, so the rest of the household is unaffected.

> [!NOTE]
> **In progress.** The parental controls master switch and the device block list are built (see [Parental controls](../router/parental-controls.md)). The weekly time grid is planned.

::sim[parental-schedule]

*The grid above is a demonstration with made-up hours. It does not change your router.*

## How to set it up

1. Make sure the router clock is right. Check the time zone and time server in [System](../router/system.md).
2. Name the devices clearly in [Devices](../router/devices.md): "Alex tablet", not "Android-9f2c".
3. Choose the devices, then paint the hours they may be online. One clear summary line appears: "Alex tablet: online 07:00 to 21:00 Monday to Friday".
4. Read the preview and confirm.

## The common ways it fails

| Problem | Cause | Fix |
| --- | --- | --- |
| The rule seems to be ignored | The device uses a private (random) hardware address and changed it | Turn off the private address for this network on the device, then list the address it now shows |
| The wrong hours apply | Router clock or time zone is wrong | Correct the time and time zone first |
| The device is still online | It moved to another network, such as a phone's mobile data | The router cannot control mobile data. Use the phone's own limits |
| A second device sneaks past | A new device with a different address | Add it, or consider an accept-list approach for the child's range |

## Good practice

- Agree the hours with the child. A schedule explained is easier to live with.
- Keep a short time buffer at the end, so a video call does not drop in the middle.
- Use [URL and keyword filters](url-keyword-filters.md) and DNS-level filters for content, schedules for time.

## Status

| Part | State |
| --- | --- |
| Master switch and device blocks | Built |
| Weekly time grid per device | Planned |
