---
title: Traffic priority (QoS)
category: router
order: 12
summary: Keep calls and games smooth while someone downloads, by choosing a method and telling the router your real speeds.
status: in-progress
related: router/internet, router/devices, router/parental-controls
---

Quality of Service (QoS) decides whose traffic goes first when the internet connection is full. Without it, one large download can make a video call stutter. With it, calls and games are served first and bulk downloads take what is left.

> [!NOTE]
> **In progress.** The QoS controls are defined; the screen, per-device and per-application rules, and real-router tests are still being built.

## Controls

| Control | What it does | Safe recommendation |
| --- | --- | --- |
| Traffic priority (QoS) | Turns prioritisation on or off | Turn on if calls or games suffer when others download |
| Method | Adaptive, Traditional or a bandwidth limiter | Adaptive needs the least setup; start there |
| Upload speed | Your real upload speed | A little below what the plan promises, from a speed test |
| Download speed | Your real download speed | A little below what the plan promises |

Adaptive uses the router's built-in classification of traffic and works on stock firmware without extra setup. Traditional gives you fixed priority levels. The limiter caps chosen devices.

## Measure your speeds first

QoS only works if the router knows the real size of the pipe. If you give it a number that is too high, it never has to prioritise because the queue builds up in the provider's equipment instead.

1. Connect a computer by cable.
2. Run a speed test at a quiet time and write down download and upload.
3. Enter about 90 to 95 percent of those numbers in the fields above.

## Turn on QoS

1. Open **Traffic priority** and switch **QoS** on.
2. Choose **Adaptive**, or pick Traditional and fill in the speeds.
3. Review the preview. Turning QoS on restarts the traffic service, so connections can drop for a few seconds. The connection-loss guard is armed.
4. Confirm and test: start a large download on one device while making a video call on another.

> [!WARNING]
> On some models, QoS turns off hardware acceleration and lowers the top speed of a fast connection. If your speed drops sharply after switching it on, turn it off again or use the [undo](../safety/undo-changes.md) option.

## Set per-device priority (planned)

Giving a device a higher or lower priority, and limiting a single device's bandwidth, are planned for the screen and are not available yet. For now, block a device briefly from [Devices](devices.md) if it must stop at once.

## Stock and Merlin differences

| Item | Stock ASUS | Asuswrt-Merlin |
| --- | --- | --- |
| Adaptive, Traditional, limiter | Yes | Yes |
| Extra traffic classes and scripts | No | Yes; see [Merlin extras](merlin-extras.md) |
| Third-party QoS options | No | Depends on installed add-ons |

## Status

| Part | State |
| --- | --- |
| QoS controls and help text | Built |
| Screen | In progress |
| Per-device rules | Planned |
