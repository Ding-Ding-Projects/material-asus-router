---
title: Dual WAN: failover and load balancing
category: internet
order: 2
summary: Use a second connection, such as a phone modem on USB, as a backup or to share traffic, and how the router decides the first has failed.
status: in-progress
related: internet/wan-types, router/usb-storage, router/internet, internet/dns-over-tls
---

Dual WAN lets the router use two internet connections. The second is often a USB mobile modem or a second line into another port. Two ways to use them:

| Mode | What happens | Good for |
| --- | --- | --- |
| Failover | The primary does all the work. If it fails, the router switches to the backup and switches back when the primary returns | Home offices that must stay online |
| Load balance | Both are used at once. Each new connection goes to one of them, by a ratio you choose | Two similar lines, many devices |

> [!NOTE]
> **In progress.** The app does not manage dual WAN yet. The router can do it, and this guide explains the decisions.

## How the router decides a line has failed

A router that only checks "is the cable plugged in" misses most outages, because the cable is fine when the provider's network is broken. Network monitoring instead checks a real target:

| Check | Meaning |
| --- | --- |
| Link only | Cable is up. Weak: misses a provider fault |
| DNS query | The router asks a name server for a name. Detects a broken path to the internet |
| Ping | The router pings an address you choose. Pick a stable target, not your own provider's first hop |

Settings that matter: how often it checks, how many failures count as down, and how many successes before it returns. A very short window flaps between lines on a brief blip; a long window means you wait for the switch.

## Things to know before you try it

- **Failover breaks existing connections.** Your public address changes, so open video calls drop and reconnect. Normal.
- **Port forwarding and remote access** only work on the line that has your forwards. See [Port forwarding](../router/port-forwarding.md) and [Dynamic DNS](../router/dynamic-dns.md).
- **Mobile data may be metered.** Failover to a phone modem can use up an allowance quickly if large downloads continue.
- **Two lines to the same provider** may fail together.

## Test it

1. Start a continuous ping to a stable address.
2. Unplug the primary line's cable.
3. Count how long until pings return. This is your failover time.
4. Plug it back and confirm the router returns, if you chose that.

## Status

| Part | State |
| --- | --- |
| Guide | Written |
| Dual WAN controls | Planned |
| Needs | A model and firmware that support dual WAN, a USB modem or a second port |
