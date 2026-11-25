---
title: Wi-Fi channel analyser
category: tools
order: 3
summary: Planned: scan nearby networks and suggest a less crowded Wi-Fi channel.
status: in-progress
related: tools/network-tools, router/wifi
---

This is one of the planned router tools. It is marked **In progress**, which means the description below is the plan, not something you can use yet.

> [!NOTE]
> Wi-Fi channel analyser is **In progress**. Treat everything under "Planned behaviour" as a goal until this page says otherwise.

## What it is for

Show which channels the networks around you use, so you can pick a quieter one instead of guessing.

## Planned behaviour

- Scan for nearby networks on each band and show their channel and signal strength.
- Draw a simple chart of how crowded each channel is.
- Suggest a channel and open the Wi-Fi change preview with it filled in, so the usual safe-change steps still apply.
- Explain what a wider channel width costs in interference.

## What is missing

Scanning depends on what the router firmware lets the app run. No scan, chart or suggestion logic exists yet.

## Good to know

- A scan can briefly disturb Wi-Fi on some routers, so the app will say so before it starts.
- Nothing is changed until you confirm the preview.

## How it will work

1. The router listens on a band for a few seconds and records every network it hears: name, channel, width and signal strength.
2. The app draws each network as a hump on the channel axis. Taller means stronger, wider means a wider channel.
3. It scores each free channel by how many strong networks overlap it, and suggests the quietest.

::sim[wifi-spectrum]

*The chart above is a demonstration with made-up neighbours. It is not a scan of your area.*

## Reading the chart

| What you see | What it means |
| --- | --- |
| Many humps stacked on one channel | That channel is crowded. Pick another |
| A hump straddling two channels | An overlapping neighbour, which is worse than sharing a channel exactly |
| A flat region | A quiet channel |

On 2.4 GHz only channels 1, 6 and 11 avoid overlapping each other, so choose among those. On 5 GHz, remember [DFS channels](../wireless/dfs-channels.md) need a minute of radar listening.

## Questions people ask

**Will it interrupt Wi-Fi?** A scan can pause that band for a few seconds on some models. The app warns you first and asks you to confirm.

**Why does the best channel keep changing?** Neighbours move too. A weekly check is plenty.

