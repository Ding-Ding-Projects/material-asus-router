---
title: Scheduled reboot
category: merlin
order: 3
summary: Restart the router at a quiet hour, whether it helps, and the difference between the stock scheduler and a Merlin cron job.
status: in-progress
related: router/scheduled-jobs, router/maintenance, merlin/cron-jobs, wireless/wifi-schedule
---

A router that restarts every night clears memory leaks and stuck connections, but it also hides problems and drops every connection once a day. Use it as a patch, not a cure. If a router needs a daily restart to stay healthy, look for a firmware update or a faulty device first.

## Two ways to schedule

| Method | Firmware | Notes |
| --- | --- | --- |
| Reboot scheduler | Stock and some builds | A simple setting: choose days and hour |
| Cron job | Merlin | Flexible. See [Cron jobs](cron-jobs.md) and [Scheduled jobs](../router/scheduled-jobs.md) |

## Choose the time

1. The router clock must be correct. Check the time zone and time server in [System](../router/system.md).
2. Pick a time when nothing important happens: 04:00 is usual. Avoid the hour when downloads or backups run.
3. Weekly is usually enough. Daily is rarely needed.

## What happens during the restart

Wi-Fi and the internet are down for one to three minutes. Every connection is dropped. Devices reconnect by themselves. Port forwards, DHCP reservations and all saved settings stay.

> [!WARNING]
> A restart ends any timed revert in progress. Do not schedule a reboot to fall inside a change you are testing.

## Instead of a daily reboot

| Symptom | Better fix |
| --- | --- |
| Wi-Fi slows down over days | Update firmware. Check the 2.4 GHz band for interference |
| Memory fills up | Look at what Merlin scripts or add-ons are running |
| Internet drops weekly | Check the line and the provider before blaming the router |

## Manual restart, for now

The app can restart the router (see [Maintenance](../router/maintenance.md)). It uses a two-step confirmation so you cannot do it by accident.

## Status

| Part | State |
| --- | --- |
| Manual reboot with confirmation | Built |
| Schedule editor | Planned |
