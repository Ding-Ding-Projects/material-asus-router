---
title: Static routes
category: lan
order: 2
summary: Tell the router how to reach another network behind a second router, with a worked example and the mistakes that cause one-way traffic.
status: in-progress
related: lan/dhcp-pool-planning, router/local-network, tools/subnet-calculator
---

A router normally knows two places: your home network and "everywhere else", which goes to the internet. If you add a second router that has its own network behind it, the first router does not know that network exists. A **static route** adds one line: "to reach that network, send the traffic to that router."

> [!NOTE]
> **In progress.** The app has no route table editor yet. The guide shows how to plan a route correctly.

## Worked example (demonstration)

Main router: 198.51.100.1, home network 198.51.100.0/24.
Workshop router: its outside port takes 198.51.100.20 from the main router, and it serves 203.0.113.0/24 behind itself.

To let home devices reach the workshop devices, add this route on the main router:

| Field | Value |
| --- | --- |
| Destination network | 203.0.113.0 |
| Mask | 255.255.255.0 |
| Gateway | 198.51.100.20 |

The gateway must be an address on a network the main router is already on.

## Both directions

Traffic needs a way back. Workshop devices reply to home devices through their own router, which usually has a default route to the main router, so replies work. If the workshop router does network address translation, home devices can still not start connections *to* workshop devices unless it also forwards ports or its translation is off.

## Mistakes

| Mistake | Result |
| --- | --- |
| Two networks with the same range, such as both 198.51.100.0/24 | Neither side knows which is meant. Change one |
| Gateway not on the router's own network | Route is refused |
| Typing a mask for the wrong size | Traffic for part of the network goes the wrong way |
| Forgetting the second router's firewall | Pings fail even though the route is right |

## Check it

1. From a home device, [ping](../tools/network-tools.md) the second router's outside address. It should answer.
2. Ping a device behind it.
3. Run traceroute to it. The first hop should be your main router and the second the second router.

## Status

| Part | State |
| --- | --- |
| Guide | Written |
| Route table editor | Planned |
