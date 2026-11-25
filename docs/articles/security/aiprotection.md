---
title: AiProtection
category: security
order: 3
summary: What ASUS's built-in protection suite blocks, what data it shares with a third party, and where it fits next to a firewall.
status: in-progress
related: security/hardening-checklist, router/firewall, router/merlin-extras, reference/security-model
---

AiProtection is ASUS's security suite on supported routers. It bundles a router security check, blocking of known malicious sites, an intrusion prevention filter and detection of devices that have been infected and are talking to bad servers. The detection lists are supplied by a security company, Trend Micro, under an ASUS licence.

> [!NOTE]
> **In progress.** The app does not manage AiProtection. This guide is here so you can decide whether to turn it on in the router's own page.

## The parts

| Part | What it does |
| --- | --- |
| Router security assessment | Checks for weak passwords, open services and out-of-date firmware, and lists what to fix |
| Malicious site blocking | Blocks connections to addresses on a known-bad list |
| Two-way intrusion prevention | Looks for known attack patterns in traffic going in and out |
| Infected device prevention and blocking | Spots a device calling known bad servers and cuts it off |

## Trade-offs

| Benefit | Cost |
| --- | --- |
| Catches a lot with no work | Needs you to accept the licence terms |
| Helps non-technical households | Traffic information, such as which known-bad addresses were contacted, goes to the supplier |
| Works for devices you cannot patch | Uses router processing power; fast connections can slow a little on small models |
| | Merlin may have the feature on some models only |

> [!IMPORTANT]
> Read the licence screen before agreeing. If you do not want to share that data, leave AiProtection off and use the [hardening checklist](hardening-checklist.md) and a family DNS resolver instead.

## Where it sits

AiProtection works on top of the [firewall](../router/firewall.md), not instead of it. It does not replace updates, a strong router password or sensible port forwarding.

## What you should still do

1. Keep firmware current. See [Firmware](../router/firmware.md).
2. Review the log for blocked events. A device that triggers many is the one to inspect.
3. Treat a repeated alert about one device as a real problem and clean or reset it.

## Status

| Part | State |
| --- | --- |
| Guide | Written |
| Managing AiProtection from the app | Not planned for the first release. The app does not read or change it |
