---
title: Speed test
category: tools
order: 2
summary: Planned: measure the router's internet download and upload speed and keep a history.
status: in-progress
related: tools/network-tools, router/internet
---

This is one of the planned router tools. It is marked **In progress**, which means the description below is the plan, not something you can use yet.

> [!NOTE]
> Speed test is **In progress**. Treat everything under "Planned behaviour" as a goal until this page says otherwise.

## What it is for

Find out whether your internet line delivers the speed you pay for, measured from the router itself so Wi-Fi and device problems do not skew the result.

## Planned behaviour

- Run a download and upload test from the router and show the result as a plain number with a short verdict.
- Keep a history so a slow evening can be compared with a normal morning.
- Warn before starting, because a test uses the whole connection for a short time.
- Show clearly when the router firmware has no suitable test tool.

## What is missing

No test runner, no result screen and no history store yet. Which test method each firmware supports has not been confirmed.

## Good to know

- A result is only as good as the moment it was taken. Run it a few times.
- Results will be labelled with the time and the test server used.

## How it will work

The test runs **from the router** to a test server, so it measures your internet line and not your Wi-Fi. It downloads data for a few seconds, then uploads, and reports the speeds and the delay.

## Getting a trustworthy number

1. Pause other downloads and streaming. Anything using the line lowers the result.
2. Run it at least three times and compare. One run can be a fluke.
3. Test at a quiet hour and a busy hour to see the difference.
4. Compare with a **wired** laptop's result from the same server. If the router is much lower, the router is the limit. If both are low, the line or provider is.

## Using the result

| Result | What to do |
| --- | --- |
| Close to the plan | Wi-Fi is the thing to improve. See [Roaming](../wireless/roaming.md) |
| Well below the plan, at all hours | Contact the provider with your results |
| Fine at night, slow at peak | Provider congestion. Note times for the call |

Feed about 90 percent of the result into [Traffic priority](../connect/qos-modes.md).

## Questions people ask

**Why is my phone slower than the router's test?** Wi-Fi adds distance, walls and sharing. That is expected.

**Does it use a lot of data?** A test moves hundreds of megabytes on a fast line. Avoid it on a metered mobile connection.

