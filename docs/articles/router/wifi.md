---
title: Wi-Fi
category: router
order: 3
summary: Change the name, password, security mode, channel and power of each Wi-Fi band safely.
status: in-progress
related: router/guest-network, safety/connection-guard, safety/undo-changes, router/devices
---

Wi-Fi settings are kept per band: 2.4 GHz reaches furthest, 5 GHz is faster, and 6 GHz (on supported models) is fastest over short distances. Each band has its own card with its own switches, so you can treat them differently.

> [!NOTE]
> **In progress.** The controls, labels and help text are defined, but the final screen and tests on real routers are still being built.

> [!WARNING]
> If you are connected to the router over Wi-Fi, changing the name, password, security or channel of that band will disconnect you. These changes are guarded by a timed revert. Read [Connection-loss guard](../safety/connection-guard.md) before your first change.

## Controls on each band

| Control | What it does | Safe recommendation |
| --- | --- | --- |
| Radio | Turns the band's signal on or off. Devices on it disconnect while it is off | Leave on. Turn off 2.4 GHz only if nothing old needs it |
| Network name (SSID) | The name people see, up to 32 characters | Short and recognisable. Do not put personal details in it |
| Hide network name | Stops the name being broadcast. Devices must type it by hand | Leave off. It does not make Wi-Fi more secure |
| Security | The encryption mode | WPA2 and WPA3 together for mixed devices; WPA3 alone only if every device supports it |
| Wi-Fi password | 8 to 63 characters | Long and unique. Share it with the guest network instead of reusing it |
| Channel | Which radio channel the band uses | Automatic, unless a neighbour's network is clearly in the way |
| Channel width | How wide the channel is | Wide is faster but more easily disturbed; use a narrower width in crowded buildings |
| Transmit power | How strongly the router transmits | Lower it in a small flat to reduce interference |

## Change the network name or password

1. Open **Wi-Fi** and pick the band.
2. Edit the field. The password field hides its value and has a button to reveal it for checking.
3. Read the preview. Old and new values are side by side; passwords are masked in the preview and history.
4. Confirm. The app saves the previous values, arms the timed revert (90 seconds by default) and applies the change.
5. Reconnect your device with the new name or password. Once the app can reach the router again it cancels the revert and the change stays.

If you cannot reconnect in time, the router puts the old values back by itself. Nothing is lost; try again with the new values entered correctly.

> [!TIP]
> Make the change from a wired device or from a different band than the one you are editing. Then your own session is not interrupted.

## Pick a channel

Leave the channel on **Automatic** unless you have a reason. If you want to choose one, check which channels nearby networks use with your phone's Wi-Fi scanner, and pick one with fewer neighbours. On 2.4 GHz only channels 1, 6 and 11 avoid overlapping with each other.

## Security modes explained

| Mode | Notes |
| --- | --- |
| WPA2 | Works with almost everything. Solid for home |
| WPA2 and WPA3 | Best default. New devices use WPA3, old ones use WPA2 |
| WPA3 | Strongest, but older devices cannot join |
| Open | No password. Avoid it. The preview warns you clearly |

## Stock and Merlin differences

| Item | Stock ASUS | Asuswrt-Merlin |
| --- | --- | --- |
| All controls above | Yes | Yes |
| Extra radio tuning values | Limited | More, reachable under [Advanced](advanced.md) |

## Related areas

The visitors' network has its own guide: [Guest network](guest-network.md).

## Status

| Part | State |
| --- | --- |
| Per-band control definitions and help text | Built |
| Wi-Fi screen and preview | In progress |
| Timed revert on Wi-Fi changes | Engine built; end-to-end test on a real router not yet done |

## See it in action

::sim[wifi-spectrum]

*The panel above is a demonstration with made-up values. It does not read or change your router.*

## Go deeper

- [Roaming and band steering](../wireless/roaming.md)
- [DFS channels and radar](../wireless/dfs-channels.md)
- [Smart Connect](../wireless/smart-connect.md)
- [Wi-Fi schedule](../wireless/wifi-schedule.md)
- [WPS push-button setup](../wireless/wps.md)
