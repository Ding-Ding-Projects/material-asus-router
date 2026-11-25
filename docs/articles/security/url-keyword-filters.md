---
title: URL and keyword filters
category: security
order: 2
summary: Block sites by address or by a word in the address, what these filters can and cannot see on today's encrypted web, and better alternatives.
status: in-progress
related: security/parental-schedules, internet/dns-director, router/parental-controls
---

A **URL filter** blocks addresses that match a list. A **keyword filter** blocks addresses that contain a chosen word. They are simple to understand, but most of the web is now encrypted, and that changes what a router can see.

> [!NOTE]
> **In progress.** The app has no URL or keyword filter editor yet.

## What the router can really see

| Traffic | The router sees |
| --- | --- |
| Plain HTTP (rare now) | The whole address, including the path |
| HTTPS (almost everything) | Usually only the site name during connection set-up, not the path or page |

So a keyword filter that looks for a word in a path works only on plain HTTP. On HTTPS, a filter can match only the site name, and even that can be hidden by newer encrypted connection set-up. Expect gaps.

## Better tools, in order

| Goal | Approach |
| --- | --- |
| Block known bad or adult sites for a child's device | A family DNS resolver with [DNS Director](../internet/dns-director.md) (Merlin) or the router's DNS setting |
| Block a specific site for everyone | Block its name at the DNS level, or use the filter below |
| Block distractions at set times | [Parental schedules](parental-schedules.md) |
| Stop one device from the internet entirely | Block it in [Devices](../router/devices.md) |

## Using the filter anyway

1. Add whole site names, such as `example.com`. A short word will match unrelated pages.
2. Test with one device before widening.
3. Review the log occasionally. A blocked page appears as a failed connection, not a friendly message.

> [!WARNING]
> A too-short keyword blocks innocent sites. A word like `sex` also matches `Essex`. Prefer full names.

## What it will not stop

- Anyone using a VPN, a proxy or a phone's mobile data.
- A device using its own encrypted DNS.
- A determined teenager. Combine tools with conversation.

## Status

| Part | State |
| --- | --- |
| Guide | Written |
| Filter editor | Planned |
