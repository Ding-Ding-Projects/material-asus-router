---
title: Port checker
category: tools
order: 6
summary: Planned: check whether a forwarded port is open from the outside.
status: in-progress
related: router/port-forwarding, tools/network-tools
---

This is one of the planned router tools. It is marked **In progress**, which means the description below is the plan, not something you can use yet.

> [!NOTE]
> Port checker is **In progress**. Treat everything under "Planned behaviour" as a goal until this page says otherwise.

## What it is for

After you set up port forwarding, confirm that the port really answers from the internet instead of wondering why it does not work.

## Planned behaviour

- Test a port on the router's public address and report open, closed or filtered.
- Explain the usual causes of a closed port, such as double NAT or a firewall rule.
- Link from each port forwarding rule so you can test it with one press.
- Show which address was tested.

## What is missing

A check from outside needs a test service the app can call, which has not been chosen. Nothing is built yet.

## Good to know

- Only test ports on your own router.
- The app will tell you what leaves your network before it sends the test request.

## How it will work

You enter a port and protocol. An outside server tries to connect to your public address on that port and reports whether it is **open**, **closed** or **filtered**. This is the honest test for a forward, because a check from inside your home often says "open" when the world cannot reach it.

## What the answers mean

| Answer | Meaning |
| --- | --- |
| Open | Something answered. The forward works and the service is listening |
| Closed | The connection reached your router and was refused. The forward may be missing, or the service is not running |
| Filtered or no answer | Something dropped it: a firewall, double NAT, or your provider |

## Run it as part of a routine

1. Before you forward a port, check it is **closed**. That is the baseline.
2. Add the forward, then check again. It should be **open**.
3. Delete the forward when finished, and check it is **closed** again.

Use it as part of the [hardening checklist](../security/hardening-checklist.md): scan your common ports and expect all closed except the ones you chose.

## Questions people ask

**Is it safe to send my address to a checker?** The checker sees your public address, which every site you visit already sees. Use a service you trust.

**Why does it say open for a port I never forwarded?** UPnP may have opened it. See [UPnP](../lan/upnp.md).

