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
