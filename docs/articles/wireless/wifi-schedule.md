---
title: Wi-Fi schedule
category: wireless
order: 7
summary: Switch a Wi-Fi band off at set hours, what a schedule really saves, and why the router clock must be right first.
status: in-progress
related: security/parental-schedules, router/system, router/guest-network, router/wifi
---

A Wi-Fi schedule turns a band or the guest network off during hours you choose, for example 01:00 to 06:00 every night. People use it to lower night-time radio use, to stop a games console staying up late, or simply to make the house quiet.

> [!NOTE]
> **In progress.** The app has no schedule grid yet. The router supports it, and the design is a week grid you paint with your finger or pointer.

## Before you start

- **The router's clock must be correct.** A schedule follows the router's own time and time zone. Check **System** first: time zone and time server. A router stuck at the wrong time will switch Wi-Fi off in the middle of the afternoon.
- **A schedule is not a lock.** It switches the radio off, so every device on that band loses Wi-Fi, including phones that rely on it for alarms or a baby monitor.
- **Wired devices are not affected.**

## Plan it

::sim[parental-schedule]

*The grid above is a demonstration. It is not your router's schedule.*

| Goal | Suggested schedule |
| --- | --- |
| Quiet nights | Whole house 01:00 to 06:00 |
| Visitors only in the day | Guest network off 22:00 to 08:00 |
| Smart sensors must stay up | Leave 2.4 GHz on, schedule 5 GHz only |

## Steps (planned)

1. Open **Wi-Fi** and pick the band or the guest network.
2. Paint the hours you want it **off**. Read back the summary line, for example "Off every day 01:00 to 06:00".
3. Confirm. The change is a time table stored on the router, so it is safe even if the app is later turned off.

## Per-device limits are different

To limit one person's device instead of a whole band, use [Parental schedules](../security/parental-schedules.md). That targets devices, not radios.

## Status

| Part | State |
| --- | --- |
| Guide | Written |
| Time zone and time server controls | Built (see [System](../router/system.md)) |
| Schedule grid | In progress |
