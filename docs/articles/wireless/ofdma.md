---
title: OFDMA and MU-MIMO
category: wireless
order: 3
summary: What Wi-Fi 6 does when many devices talk at once, what each OFDMA and MU-MIMO option means and why a few older devices dislike them.
status: in-progress
related: wireless/target-wake-time, wireless/beamforming, router/wifi, wiki:glossary
---

Older Wi-Fi gave the whole channel to one device at a time, very quickly. With many small messages (smart plugs, sensors, phones checking mail) most of the time was spent waiting for a turn. Wi-Fi 6 (802.11ax) splits the channel so several devices share one transmission.

> [!NOTE]
> **In progress.** The app does not yet show these options. This guide explains them so the future screen makes sense.

## The two ideas

| Idea | Plain meaning |
| --- | --- |
| OFDMA | One channel is cut into small slices and each device gets a slice, so many small messages go out together. Helps most with many chatty devices |
| MU-MIMO | The router talks to several devices at once using different antennas. Helps when several capable devices stream at the same time |

Each can apply to the router sending to devices (downlink, DL) and to devices sending to the router (uplink, UL).

## What the router options look like

| Option | Meaning |
| --- | --- |
| Off | Classic behaviour |
| DL OFDMA | Slices when the router sends |
| DL and UL OFDMA | Slices in both directions |
| OFDMA with MU-MIMO | Both ideas together |

## Should you change it?

For a household with many devices, keep the default on. Turn options off only to test a fault: a particular older laptop or a printer that will not join Wi-Fi 6 properly is the classic case. If switching OFDMA off fixes it, leave it off and look for a driver update for the device instead.

## Safe steps

1. Open **Wi-Fi**, pick the 5 GHz or 6 GHz band, and choose the new option.
2. Read the preview and confirm. The band restarts, so devices reconnect.
3. Test the affected device. If nothing changed, restore the old value from the [change history](../safety/change-history.md).

> [!IMPORTANT]
> OFDMA needs Wi-Fi 6 on both ends. A Wi-Fi 5 phone gains nothing but loses nothing either.

## Status

| Part | State |
| --- | --- |
| Guide | Written |
| OFDMA and MU-MIMO options in the app | In progress |
| Models that have them | Only Wi-Fi 6 routers. The app shows the option disabled elsewhere |
