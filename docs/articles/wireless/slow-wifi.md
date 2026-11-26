---
title: My Wi-Fi is slow
category: wireless
order: 10
summary: The screen that checks the router for what slows Wi-Fi down, explains each finding and fixes it with a review before anything changes.
status: ready
related: reference/troubleshooting-by-symptom, wireless/roaming, tools/speed-test, safety/change-history
---

Open **My Wi-Fi is slow** in the Network group, or search for "slow" in the command palette. The screen reads the router, then lists what it found. Reading changes nothing on the router.

## What it reads

For each band it reads how busy the air is, how much of that comes from other networks and from things that are not Wi-Fi, the noise floor, the radio temperature, and the signal and link speed of every device joined to it. It also reads the router's Wi-Fi, acceleration and traffic priority settings and how long the router has been running. A reading the radio does not give is shown as a dash, never guessed.

## Problems and recommendations

**Problems to fix on the router** are settings or conditions slowing Wi-Fi now:

| Finding | Why it is slow | Fix |
| --- | --- | --- |
| A band is switched off | Every device shares the other band | Switch the band on |
| Legacy compatible mode | Everyone waits for the slowest device | Automatic mode |
| Wi-Fi 6 switched off | Wi-Fi 6 devices fall back to the older standard | Switch Wi-Fi 6 on |
| TKIP encryption allowed | TKIP devices are held to 54 Mbps | AES only |
| Low transmit power | A weaker signal further away | 100% power |
| 5 GHz held to 20 or 40 MHz | A narrow channel caps every device | Automatic width |
| 40 MHz on a crowded 2.4 GHz band | It overlaps the neighbours | 20 MHz |
| Busy air on a fixed channel | It cannot move away from neighbours | Automatic channel |
| Very busy air on an automatic channel | Devices wait their turn | Search for a quieter channel now |
| A radio at 90 °C or more | A hot radio slows itself down | Move it somewhere with air |
| Hardware acceleration off | The processor handles every packet | Switch acceleration on (after a restart) |

**Recommendations** are worth trying: weak or slow devices, interference that is not Wi-Fi, MU-MIMO or beamforming off, many networks on one band, the bandwidth limiter, a traffic priority download cap and a long uptime.

## How a fix is applied

**Fix on the router** and **Fix everything I can** put the settings in the pending-changes bar. They then go through the same steps as any change: the preview with the old and new values, the four keys when the change is above the household's level, the connection-loss safety net for changes that drop Wi-Fi, and undo in the [change history](../safety/change-history.md). A fix is offered only when the router has every setting it needs; otherwise the finding says why.

> [!TIP]
> Run a [speed test](../tools/speed-test.md) on a cable first. If that is slow as well, the line, not the Wi-Fi, is the bottleneck.
