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

## How it will work

1. You pick a few resolvers to compare: your provider's, and one or two public ones.
2. The router asks each one for the same list of popular names, several times, and times every answer.
3. The app shows the median time, the slowest answers and any failures.

::sim[dns-race]

*The race above is a demonstration with made-up times. It does not query real servers.*

## What to look for

| Result | Meaning |
| --- | --- |
| Low median, few slow outliers | A fast, steady resolver |
| Low median but sometimes very slow | Occasional stalls that make pages hang |
| Failures | The resolver blocks or drops some names |

The fastest resolver on a quiet test is not always the best. Speed matters less than reliability and, for [DNS over TLS](../internet/dns-over-tls.md), trust.

## Questions people ask

**Is it safe to run?** Yes. It only looks up names. It changes nothing.

**Will the answer last?** Not forever. Re-run it when browsing feels slow.

