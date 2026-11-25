---
title: Wake-on-LAN schedules
category: tools
order: 9
summary: Planned: wake a device on a schedule, as well as on demand.
status: in-progress
related: tools/network-tools, router/devices
---

This is one of the planned router tools. It is marked **In progress**, which means the description below is the plan, not something you can use yet.

> [!NOTE]
> Wake-on-LAN schedules is **In progress**. Treat everything under "Planned behaviour" as a goal until this page says otherwise.

## What it is for

Switch on a computer or storage box at the same time each day, without leaving it running all night. Waking a device on demand already exists as a network tool; the schedule is the planned part.

## Planned behaviour

- Pick a device from the Devices list and a time and days of the week.
- Run the wake request from the router at that time, or from the app when the app is running.
- Show the last time each schedule ran and whether the device answered afterwards.
- Warn when the device does not support Wake-on-LAN.

## What is missing

Scheduling is not built. Running it on the router needs Asuswrt-Merlin scheduled jobs, and the app-side fallback needs the app to stay running.

## Good to know

- The device must have Wake-on-LAN enabled in its own settings.
- Wake-on-LAN works inside the local network only.

## What already works

Waking one device on demand is built (see [Network tools](network-tools.md)). The schedule adds the time dimension.

## How a schedule will work

1. Pick a device. The app needs its hardware address, which it knows if the device has been seen.
2. Choose the days and the time, for example weekdays at 07:30.
3. The router sends the wake packet at that time. A schedule stored on the router keeps working even if the app is closed.

## Before it can work

| Requirement | Why |
| --- | --- |
| Wake-on-LAN enabled in the device's firmware settings and its network card | Otherwise it ignores the packet |
| A wired connection, mostly | Many laptops cannot wake over Wi-Fi |
| The device is on the same local network | The packet does not cross the internet |
| The router's clock is right | The schedule follows it. See [System](../router/system.md) |

## A good use

Wake a media server at 17:00 so it is ready for the evening, and let it sleep by itself overnight.

## Questions people ask

**Why did nothing happen?** Check the device setting first. It is the cause nine times in ten. A test from the on-demand tool tells you whether the device wakes at all.

**Is it safe?** The packet only wakes a device that already trusts the local network. It carries no password.

