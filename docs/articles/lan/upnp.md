---
title: UPnP
category: lan
order: 5
summary: How devices ask the router to open ports for themselves, why that is both handy and risky, and how to review what is open.
status: in-progress
related: security/port-forward-safely, lan/dmz, router/port-forwarding, security/hardening-checklist
---

Universal Plug and Play (UPnP) lets a device on your network ask the router to open a port for it automatically. Games consoles, video call apps and some cameras use it so you never see a port forwarding screen. The router writes the rule, and the device removes it when finished.

> [!NOTE]
> **In progress.** The app has no UPnP switch or lease list yet.

## Convenience against risk

| For | Against |
| --- | --- |
| Works with no setup | Any program on any device can open a port, including malicious software |
| Rules expire when the device goes away | Badly written devices leave rules behind |
| | You may never see what was opened |

## Recommendation

| Home | Advice |
| --- | --- |
| One or two consoles and nothing else unusual | Leave UPnP on, review the list now and then |
| Security cameras, a home server or shared computers | Turn UPnP off and use [port forwarding](../router/port-forwarding.md) for what you actually need |
| Anyone who cannot review the list | Turn it off |

## Review what is open

An active UPnP list should show the device, its internal port, the external port and the protocol. Merlin shows the active leases in its logs. Expect only things you recognise. An entry you do not recognise is a reason to find the device and fix or remove it.

::sim[port-forward]

*The panel above is a demonstration with made-up rules. It does not read your router.*

## Steps (planned)

1. Open **Port forwarding** and find UPnP.
2. Switch it on or off. Read the preview. Turning it off removes existing automatic rules, which can break a game for one session.
3. Confirm and test the application that needed it.

## Status

| Part | State |
| --- | --- |
| Guide | Written |
| UPnP switch and active list | Planned |
