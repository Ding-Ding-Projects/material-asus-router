---
title: Parental controls and schedules
category: router
order: 11
summary: Set internet time limits and blocks for the devices you choose, with schedules that you can read at a glance.
status: in-progress
related: router/devices, router/firewall, router/traffic-priority
---

Parental controls limit when chosen devices can use the internet. They work per device, not per person, so name the devices first in [Devices](devices.md): `Alex tablet` is easier to manage than a hardware address.

> [!NOTE]
> **In progress.** The master switch and the list of devices that can be controlled are built; the schedule editor, filters and real-router tests are still being built. Content filtering by category depends on the router model and is not yet covered.

## Master switch

| Control | What it does | Safe recommendation |
| --- | --- | --- |
| Parental controls | Turns all blocks and schedules on or off at once | Leave on once rules exist. Turn off to test whether a rule is the cause of a problem |

## Time schedules

A schedule is a grid of days and hours. The editor shows it as a week with coloured blocks: green hours are allowed, red hours are blocked. A typical rule for a school night:

| Device | Allowed | Blocked |
| --- | --- | --- |
| Alex tablet | Monday to Friday 07:00 to 21:00 | Monday to Friday 21:00 to 07:00 |
| Alex tablet | Saturday and Sunday 08:00 to 22:00 | Rest of the weekend |

## Create a schedule

1. Open **Parental controls** and choose **Add device rule**.
2. Pick one or more devices from the list.
3. Paint the blocked hours on the week grid, or choose a preset (School nights, Bedtime, Always block).
4. Review the preview. It lists each device and the blocked periods in words, for example "Alex tablet cannot use the internet on weekdays from 21:00 to 07:00".
5. Confirm. Because blocking your own device could cut your session, the app warns you if the device you are using is in the rule.
6. Check from the controlled device that the block starts and ends at the expected times. The router clock must be correct; see [System](system.md).

## Block now

To stop a device at once, open it in [Devices](devices.md) and choose **Block**. It is quicker than a schedule and equally reversible.

## Limits to be aware of

- Rules follow the device's hardware address. A device that switches to a private address, or a child who borrows another device, is not controlled.
- A device on mobile data is outside the router's control.
- A VPN on the controlled device can hide traffic from the router; filtering by schedule still stops the connection itself.
- Schedules rely on the router's clock and time zone. A wrong time zone shifts every block.

## Stock and Merlin differences

| Item | Stock ASUS | Asuswrt-Merlin |
| --- | --- | --- |
| Time schedules per device | Yes | Yes |
| Category content filtering | Model dependent, may need a cloud account | Model dependent |
| Extra filtering through add-ons | No | Possible through [Merlin extras](merlin-extras.md) |

## Status

| Part | State |
| --- | --- |
| Master switch and device list | Built |
| Schedule editor and plain-word preview | In progress |
| Content filtering | Not planned for the first release |

## See it in action

::sim[parental-schedule]

*The panel above is a demonstration with made-up values. It does not read or change your router.*

## Go deeper

- [Parental schedules](../security/parental-schedules.md)
- [URL and keyword filters](../security/url-keyword-filters.md)
