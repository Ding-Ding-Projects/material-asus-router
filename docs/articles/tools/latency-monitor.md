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

## How it will work

The router sends a small ping to a target every few seconds and records the delay. The app charts it over minutes, hours or days, and counts the replies that never came back.

## What the chart tells you

| Pattern | Likely cause |
| --- | --- |
| A steady low line | A healthy connection |
| A line that climbs when someone downloads | The line fills up. [Traffic priority](../connect/qos-modes.md) will help |
| Regular spikes at the same hour | A schedule or a busy neighbour. Look for what runs then |
| Gaps | Packets lost: Wi-Fi, line or provider |
| One target bad, others fine | The problem is that site or the route to it |

## Choosing targets

Use two or three. One public address by number, one by name, and the router's own address. If the router's own address is steady while the public ones are not, the problem is beyond your home.

## Questions people ask

**How often should it ping?** Every few seconds is plenty. More often adds noise and traffic.

**Does it slow the connection?** No, pings are tiny.

