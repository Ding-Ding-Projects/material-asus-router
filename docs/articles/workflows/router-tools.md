---
title: Router tools
category: workflows
order: 1
summary: Ping, traceroute, name lookup and wake-on-LAN run from the router itself. What each shows, how to read it and what the app protects you from.
status: in-progress
related: tools/network-tools, workflows/ssh-action-catalogue, router/logs, tools/port-checker
---

The app can run a few diagnostic tools **on the router**. That matters: the result shows what the router sees, which is often not what your laptop sees. They are built and checked against the pretend router (see [Network tools](../tools/network-tools.md)). They have not been tried on a real router.

## The four tools

| Tool | Question it answers | Input |
| --- | --- | --- |
| Ping | Is that address reachable, and how long does a reply take? | Host name or IPv4 address, 1 to 9 tries |
| Traceroute | Which hops does traffic cross to get there? | Host name or IPv4 address, up to 15 hops |
| Name lookup | What address does this name resolve to, and which server answered? | Host name |
| Wake-on-LAN | Switch on a sleeping device on the home network | The device's hardware address |

## Reading a ping (example, not from your router)

```text
PING 203.0.113.9 (203.0.113.9): 56 data bytes
64 bytes from 203.0.113.9: seq=0 ttl=57 time=12.4 ms
64 bytes from 203.0.113.9: seq=1 ttl=57 time=12.1 ms
4 packets transmitted, 4 packets received, 0% packet loss
```

| Part | Meaning |
| --- | --- |
| `time` | Round trip in milliseconds. Under 30 is good for the same country |
| `ttl` | How many hops are left. It only matters for traceroute |
| `packet loss` | Replies that never came back. Anything above 1 percent over a few tries deserves a look |

## A diagnosis path

1. **Ping the router's own address.** If this fails, the problem is between you and the router.
2. **Ping a public address by number**, then **by name**. Number works but name fails: it is DNS. See [DNS over TLS](../internet/dns-over-tls.md).
3. **Run traceroute** to a site that is slow. A sudden jump in time, or stars from one hop onward, shows where the delay or block is. Stars alone are not always a fault: some hops refuse to answer.
4. **Name lookup** shows which server answers and how fast.

## What the app does for safety

- Host names and addresses are checked before they are sent. Anything with spaces, shell characters or an invalid shape is refused.
- The command is built by the app from validated parts, never from text you type. See [SSH action catalogue](ssh-action-catalogue.md).
- Output is shown as text and copied, never run.

## Status

| Part | State |
| --- | --- |
| Ping, traceroute, name lookup, wake-on-LAN | Built, checked on the pretend router |
| Port checker, speed test, latency monitor | In progress |
