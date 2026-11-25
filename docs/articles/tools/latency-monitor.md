---
title: Latency monitor
category: tools
order: 11
summary: Planned: ping a target on a schedule and chart delay and packet loss.
status: in-progress
related: tools/network-tools, router/logs
---

This is one of the planned router tools. It is marked **In progress**, which means the description below is the plan, not something you can use yet.

> [!NOTE]
> Latency monitor is **In progress**. Treat everything under "Planned behaviour" as a goal until this page says otherwise.

## What it is for

Spot an unstable connection by watching delay and lost packets over hours, instead of one ping that happens to look fine.

## Planned behaviour

- Ping one or more targets at an interval from the router and plot delay over time.
- Show packet loss as a separate line with the time each gap started.
- Mark router events such as reboots on the same timeline.
- Stop automatically after a time you choose, so it does not run forever.

## What is missing

Nothing is built beyond the single ping in Network tools. Continuous sampling, storage and the chart are still to do.

## Good to know

- Monitoring adds a small amount of traffic.
- A single ping is available now in the network tools guide.
