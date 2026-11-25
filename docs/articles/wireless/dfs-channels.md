---
title: DFS channels and radar
category: wireless
order: 5
summary: Why some 5 GHz channels are shared with weather radar, what the one-minute wait means, and when to avoid DFS channels.
status: in-progress
related: wireless/smart-connect, router/wifi, tools/wifi-channel-analyser
---

On the 5 GHz band, part of the channel list is shared with radar systems such as weather radar. Wi-Fi equipment may use these channels only if it listens for radar and moves away the moment it hears one. That rule is called Dynamic Frequency Selection, or DFS. The shared channels are usually the middle ones (roughly 52 to 144). The others (36 to 48 and 149 to 165) are never subject to it.

> [!NOTE]
> **In progress.** The channel list in the app is built (see [Wi-Fi](../router/wifi.md)). The DFS-specific switch and radar status are not.

## What you will notice

| Behaviour | Why |
| --- | --- |
| After choosing a DFS channel, 5 GHz is silent for about a minute | The router must listen for radar before it may transmit |
| Wi-Fi drops for a moment, then returns on another channel | It heard something that looked like radar and had to leave |
| Some devices cannot see DFS channels at all | Older or travel-restricted devices do not scan them |

Radar events are rare in most homes, but near an airport, a harbour or a weather station they can happen several times a day.

## Should you use DFS channels?

| Situation | Suggestion |
| --- | --- |
| Crowded block of flats, many neighbours on the low channels | Allow DFS. The extra channels are often much quieter |
| Old devices that cannot find the network | Use a non-DFS channel such as 36 or 149 |
| Wi-Fi drops repeatedly at the same hour | Switch DFS channels off and choose a fixed non-DFS channel |

::sim[wifi-spectrum]

*The panel above is a demonstration with made-up neighbours. It does not scan your area.*

## Steps

1. Use a phone scanner or the [channel analyser](../tools/wifi-channel-analyser.md) to see which channels are busy.
2. Open **Wi-Fi**, pick 5 GHz, and set the channel. Automatic may include DFS channels on your model.
3. Read the preview. The band restarts, and you may wait about a minute on a DFS channel before it returns.
4. Look in the [logs](../router/logs.md) for radar messages if drops repeat.

## Status

| Part | State |
| --- | --- |
| Channel list (fixed non-DFS choices) | Built |
| Include or exclude DFS switch | In progress |
| Radar event display | Planned |
