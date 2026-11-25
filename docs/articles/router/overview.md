---
title: Overview
category: router
order: 1
summary: See the router model, firmware, uptime, load and connection state on one screen.
status: in-progress
related: router/devices, router/internet, setup/firmware-detection, safety/safe-changes
---

The Overview is the first screen after you sign in. It answers one question: is the router healthy right now? Nothing on this screen changes a setting, so it is safe to open as often as you like.

> [!NOTE]
> **In progress.** The data collection behind this screen exists, but the final screen and its verification against real routers are still being built. Try it with the [demo router](../start/demo-router.md) until then.

## What you see

| Card | What it tells you | Where the value comes from |
| --- | --- | --- |
| Router | Model name, firmware family (stock ASUS or Asuswrt-Merlin) and version | Read over SSH when the app connects |
| Uptime | How long the router has run since its last restart | Router system information |
| Load and memory | Processor load and how much memory is in use | Router system information |
| Internet | Whether the router has a working internet connection, and its connection type | Router connection status |
| Wi-Fi | Which bands are on and how many devices each carries | Router wireless status |
| Devices | Total devices known and how many are online | The device list |
| Recent changes | The last few changes made through this app | The app's own [change history](../safety/change-history.md) |

Values are read when you open the screen and refresh while it stays open. A small timestamp on each card shows how fresh it is, so you never mistake an old reading for a live one.

## Check on the router

1. Open **Overview**.
2. Look at the connection card first. If it says the internet is down, open [Internet](internet.md) to see the connection type and DNS.
3. Look at uptime. A very short uptime that you did not expect means the router restarted by itself, for example after a power cut. Check [Logs](logs.md) for the reason.
4. Look at load and memory. A load that stays high for hours, or memory that is almost full, often points to a runaway service or too many port forwards or logs.

## Firmware detection and the Merlin badge

When the app connects, it detects whether the router runs stock ASUS firmware or Asuswrt-Merlin ([how detection works](../setup/firmware-detection.md)). The Overview shows the result. On stock firmware, controls that need Merlin are shown **disabled with the reason** in other screens, instead of being hidden or failing.

## Quick actions

The Overview links to the tasks people do most: rename a device, open the guest network, run a ping, or take a backup. These are shortcuts to the other screens. Each one still goes through the normal preview, confirm and apply steps.

## Stock and Merlin differences

| Item | Stock ASUS | Asuswrt-Merlin |
| --- | --- | --- |
| Model, uptime, load, memory | Yes | Yes |
| Extra system readouts (for example temperature on some models) | Limited | More |
| Merlin badge | Not shown | Shown |

## Safe recommendations

- Treat the Overview as a dashboard, not a control panel. Make changes in the area they belong to, so the preview and guard can explain them.
- If a value looks wrong, refresh once before worrying. Then compare with the router's own web page.

## Status

| Part | State |
| --- | --- |
| Reading model, firmware and uptime | Collection built; screen in progress |
| Load, memory and connection cards | Screen in progress |
| Recent changes card | Depends on change history, in progress |
| Verified on real routers | Not yet |
