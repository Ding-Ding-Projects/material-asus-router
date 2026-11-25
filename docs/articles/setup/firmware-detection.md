---
title: Firmware detection
category: setup
order: 5
summary: How the app tells stock ASUS firmware from Asuswrt-Merlin and what changes on each.
status: ready
related: router/merlin-extras, router/scheduled-jobs, setup/connect-router
---

Asus routers run either the stock ASUS firmware or Asuswrt-Merlin, a community build that adds features. The app works out which one you have right after it connects, and it shows the right controls for each.

## How it decides

The app reads all of the router's settings once and looks at them. A router counts as Merlin when its `3rd-party` setting says `merlin`. If that is not set, the app also checks for a Merlin helper file on the router. Otherwise it treats the router as stock ASUS firmware.

From the same read it works out:

- the model and firmware version and build,
- which Wi-Fi bands exist (2.4 GHz, 5 GHz and any others) and their interface names,
- which features the router advertises, such as USB, AiMesh, WireGuard, OpenVPN and QoS.

The settings are cached for a few seconds, and screens that show the router's present state (Overview, Devices, Advanced) always read fresh values.

## What you see on each firmware

| Control | Stock ASUS firmware | Asuswrt-Merlin |
| --- | --- | --- |
| Everything that exists on both | Available | Available |
| Merlin-only controls, for example [scheduled jobs](../router/scheduled-jobs.md) and [Merlin extras](../router/merlin-extras.md) | **Visible but disabled**, with the reason | Available |

On stock firmware a disabled control is never hidden and never fails silently. It stays on the screen with a short reason such as "needs Asuswrt-Merlin", so you can see that the feature exists and why you cannot use it.

> [!NOTE]
> Features the router hardware does not have, such as USB on a model without a port, are shown the same way: visible, disabled, with the reason.

## Check what the app found

Open the Overview. It shows the model and firmware flavour. If the answer looks wrong, see below.

## If detection looks wrong

| Symptom | What to check |
| --- | --- |
| A Merlin router shows as stock | Make sure it is really running Merlin and that SSH can read its settings. Reconnect from [Connect your router](connect-router.md). |
| Merlin-only controls stay disabled | The app only enables them when it detects Merlin. After flashing new firmware, reconnect so it reads the settings again. |
| A band is missing | The app lists bands from the router's own interface names. A band that the router does not report is not shown. |

## Why this matters for safety

Writing a Merlin-only setting to stock firmware could do nothing or something unexpected. Disabling those controls up front keeps previews honest: every change the app offers is one your router can actually apply.
