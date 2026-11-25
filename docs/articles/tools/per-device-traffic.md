---
title: Per-device traffic
category: tools
order: 4
summary: Planned: see how much data each device uses over time.
status: in-progress
related: router/devices, router/traffic-priority
---

This is one of the planned router tools. It is marked **In progress**, which means the description below is the plan, not something you can use yet.

> [!NOTE]
> Per-device traffic is **In progress**. Treat everything under "Planned behaviour" as a goal until this page says otherwise.

## What it is for

Answer the question "which device is using all the bandwidth?" with a live view and a daily total per device.

## Planned behaviour

- Show current upload and download per device, with the device name from the Devices screen.
- Keep daily totals for a limited period and show the top users.
- Link each device to its Devices page so you can block it or change its priority.
- Mark devices that were not seen recently.

## What is missing

Traffic counters depend on firmware features that are not available on every router. No collection, storage or chart exists yet.

## Good to know

- Counters can reset when the router reboots, and the app will say when that happened.
- Totals are an estimate from the router, not a bill.

## How it will work

The router keeps running totals of data sent and received for each device. The app reads them regularly and charts them by day and by week, per device.

## What to use it for

| Question | How the chart helps |
| --- | --- |
| Who is using the data? | The biggest bar is the heaviest device |
| Why was the line slow last night? | A spike on one device at that hour |
| Is a camera or gadget sending more than it should? | A steady upload from a device that should be quiet |
| Do I need a higher plan? | Weekly totals against the plan |

Names make this readable. Rename devices first in [Devices](../router/devices.md).

## Limits to know

- Totals reset when the router restarts unless it is set to store them, so a [scheduled reboot](../merlin/scheduled-reboot.md) will clear them.
- Phones with private addresses can appear as several devices over time.
- Counting uses some router power, and turning on accounting may lower the top speed on some models. The app will say so before it changes anything.
- It shows amounts, not content. The router does not see what is inside encrypted traffic.

## Good to know about privacy

Usage per person is personal information. In the app, viewers can see totals only if the owner allows it.

