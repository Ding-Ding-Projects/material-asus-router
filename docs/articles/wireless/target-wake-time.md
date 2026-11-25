---
title: Target Wake Time
category: wireless
order: 4
summary: How Wi-Fi 6 lets battery devices sleep between agreed wake-up times, and why switching it off can fix a sulky sensor.
status: in-progress
related: wireless/ofdma, router/wifi, wiki:glossary
---

Target Wake Time (TWT) is a Wi-Fi 6 feature. Instead of a battery device listening constantly, it agrees a schedule with the router: "I will wake every 60 seconds, send my reading and sleep again." The router holds anything addressed to the device until then. Battery life goes up, and the airwaves are less crowded because devices stop all talking at once.

> [!NOTE]
> **In progress.** The app has no TWT switch yet. This guide describes what the switch controls.

## Who benefits

| Device | Effect of TWT |
| --- | --- |
| Door and window sensors, thermometers | Much longer battery life |
| Phones and laptops | Small saving; most already manage power well |
| Streaming boxes, consoles | No benefit, since they are always active |

## When it causes trouble

A few devices say they support TWT and then behave badly: they miss messages, show as offline for a minute, or react slowly to a command. If a smart device that used to answer instantly now takes ten seconds, TWT is a good suspect. Test by switching it off and comparing.

## Steps

1. Open **Wi-Fi** and pick the band that carries the device (TWT is a Wi-Fi 6 feature, usually 5 GHz and 6 GHz).
2. Switch **Target Wake Time** and read the preview. The band restarts briefly.
3. Confirm, wait for the device to reconnect, and repeat the test that failed.
4. If it did not help, switch it back from the [change history](../safety/change-history.md).

> [!TIP]
> Many small sensors sit on 2.4 GHz, where TWT does not apply because that band is usually Wi-Fi 4. Check the band before you blame TWT.

## Status

| Part | State |
| --- | --- |
| Guide | Written |
| TWT switch in the app | In progress |
| Availability | Wi-Fi 6 routers only. Shown disabled with the reason elsewhere |
