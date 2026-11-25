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
