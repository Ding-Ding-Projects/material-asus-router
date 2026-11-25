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
