---
title: DNS over TLS
category: internet
order: 5
summary: Encrypt the name lookups that leave your home, what it protects, what it does not, and how to pick a resolver.
status: in-progress
related: internet/dns-director, router/internet, tools/dns-benchmark, security/hardening-checklist
---

Every time a device opens a website it asks a DNS server for the address behind the name. Ordinarily that question and answer travel unencrypted, so your provider, or anyone on the path, can read which sites you look up. **DNS over TLS** (DoT) wraps the exchange in the same encryption websites use. It uses port 853.

> [!NOTE]
> **In progress.** The app can set the router's DNS servers today (see [Internet](../router/internet.md)). The DoT switch and resolver list are planned.

## What it protects

| Protects against | Does not protect against |
| --- | --- |
| Someone on the line reading or changing your lookups | The provider seeing which address you then connect to |
| A provider that rewrites failed lookups into ads | The resolver you chose knowing your lookups |
| | Devices that use their own hard-coded DNS |

DoT moves trust from your provider to the resolver you choose. It is a good trade only if you choose a resolver you trust more.

## Strict or opportunistic

| Mode | Behaviour | Risk |
| --- | --- | --- |
| Strict | Only encrypted lookups. If the resolver is unreachable, lookups fail | Internet appears down when the resolver is down |
| Opportunistic | Encrypted when possible, plain text when not | Quietly drops back to plain text |

Strict is the real privacy mode. Choose two resolvers so one failing does not stop the house.

## Steps (planned)

1. Open **Internet** and find the DNS section.
2. Pick two resolvers that support DoT. Note each one's address and its TLS name, which the router checks.
3. Choose Strict mode and read the preview. The DNS service restarts, so lookups pause for a few seconds.
4. After confirming, use [name lookup](../tools/network-tools.md) to test a name, and the [DNS benchmark](../tools/dns-benchmark.md) to compare resolvers.

::sim[dns-race]

*The race above is a demonstration with made-up times. It does not query real servers.*

> [!TIP]
> If everything breaks after enabling Strict, turn it back to Opportunistic from the [change history](../safety/change-history.md) and check the TLS name.

## Status

| Part | State |
| --- | --- |
| DNS server controls | Built |
| DoT switch, Strict mode, resolver list | Planned |
