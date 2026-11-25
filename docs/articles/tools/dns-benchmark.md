---
title: DNS benchmark
category: tools
order: 5
summary: Planned: compare the response time of several DNS servers from your router.
status: in-progress
related: tools/network-tools, router/internet
---

This is one of the planned router tools. It is marked **In progress**, which means the description below is the plan, not something you can use yet.

> [!NOTE]
> DNS benchmark is **In progress**. Treat everything under "Planned behaviour" as a goal until this page says otherwise.

## What it is for

Test a handful of DNS servers from the router and show which answers fastest, before you change the DNS setting.

## Planned behaviour

- Time lookups against your current DNS servers and a list of public ones you choose.
- Show the median and the slowest answer, not only the best case.
- Offer to open the Internet DNS change preview with the winner filled in.
- Say plainly that a faster server is not always a more private one.

## What is missing

No benchmark runner and no result view yet. The list of servers to compare is not decided.

## Good to know

- The test uses the router's own name lookup, so it reflects what your devices will get.
- Choosing a DNS server is a privacy decision as well as a speed decision.
