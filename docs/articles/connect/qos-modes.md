---
title: Traffic priority modes
category: connect
order: 1
summary: Choose between adaptive, traditional and per-device limit modes, enter honest line speeds, and test whether it helped.
status: in-progress
related: router/traffic-priority, tools/speed-test, tools/latency-monitor, merlin/addons
---

Traffic priority, also called QoS, decides what goes first when the internet line is full. It matters only when the line is full: on an empty line there is nothing to prioritise. The usual symptom it fixes is a video call stuttering while someone downloads a game.

The app already supports the QoS switch, the method and the upload and download speeds (see [Traffic priority](../router/traffic-priority.md)).

::sim[qos-queues]

*The panel above is a demonstration with made-up traffic. It does not measure your line.*

## The methods

| Method | How it decides | Good for |
| --- | --- | --- |
| Adaptive | Recognises kinds of traffic (calls, streaming, gaming, browsing, downloads) and ranks them | Most homes: set and forget |
| Traditional | You write rules by port, device or application | People who want exact control |
| Bandwidth limiter | Caps each device or group at a set speed | Stopping one device taking all of it |
| Modern queue methods (such as CAKE on supported Merlin builds) | Shares the line fairly and keeps delay low | Anyone chasing low lag on a busy line |

## Enter honest speeds

QoS works by holding traffic back before the line fills. For that to work the router needs to know how fast the line really is.

1. Run a [speed test](../tools/speed-test.md) with nothing else using the line, at a quiet hour.
2. Enter **about 90 percent** of the measured upload and download. Leaving headroom keeps the queue in the router, where it is controlled, rather than at the provider.
3. Re-measure after the provider changes your plan.

> [!WARNING]
> Entering the plan's advertised speed instead of the measured one is the commonest mistake and makes QoS useless. Entering a number that is too low throttles you for no benefit.

## Test that it helped

1. Start a continuous ping to a stable address and note the delay.
2. Start a large download. Without QoS the delay usually jumps by hundreds of milliseconds.
3. Turn QoS on, repeat, and compare. A good result keeps the delay close to the idle figure.

Use the [latency monitor](../tools/latency-monitor.md) once it is built.

## Side effects

- Hardware acceleration may be switched off on some models while QoS runs, lowering the top speed on very fast lines. The preview warns you if the model does this.
- The change restarts the QoS service, so connections pause for a moment.

## Status

| Part | State |
| --- | --- |
| Switch, method and speeds | Built |
| Per-device and per-application rules | Planned |
