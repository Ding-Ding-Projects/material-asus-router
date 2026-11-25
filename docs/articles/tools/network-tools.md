---
title: Network tools
category: tools
order: 1
summary: Run ping, traceroute and name lookup from the router, and wake a device on the local network.
status: in-progress
related: tools/speed-test, tools/latency-monitor, tools/wake-on-lan-schedules, router/logs
---

The network tools run a few standard checks from the router itself rather than from your own computer. That matters because the router sits between your network and the internet, so a result from the router tells you whether the router can reach something, which is often the real question.

> [!NOTE]
> The server can run ping, traceroute, name lookup and wake requests. The screen that presents them is **In progress**, so details of the layout may change. The other tools in this section are planned and are listed at the end.

## The tools

| Tool | What it answers | Typical input |
| --- | --- | --- |
| Ping | Can the router reach this address, and how long does it take? | `198.51.100.1`, or a host name |
| Traceroute | Which stops does traffic make on the way, and where does it stall? | A host name or address |
| Name lookup | What address does this name resolve to, according to the router's DNS? | A host name |
| Wake a device | Send a Wake-on-LAN packet to a device on the local network | A device from the Devices list |

## Run a ping

1. Open **Network tools** and choose **Ping**.
2. Type an address or name. Input is checked, and anything that is not a host name or address is refused before it reaches the router.
3. Press **Run**. The result appears as lines of text with a short summary.

> [!EXAMPLE]
> Example output, not from your router: four replies from the target, then "4 sent, 4 received, 0% loss". Times shown here are only an example of the format.

## Reading the results

- **Replies but slow**: look at the times. A steady high time suggests a congested line; a time that jumps around suggests an unstable connection.
- **No replies**: the target may block ping on purpose. Try another target before drawing a conclusion.
- **Traceroute stops partway**: some routers along the way do not answer. A stall that continues to the end is more meaningful than a few missing lines in the middle.
- **Name lookup fails but ping to an address works**: the problem is DNS, not the line. See the [Internet guide](../router/internet.md).

## Safety of the tools

- Commands are fixed. The app builds the command itself from a small set of tools and only passes your input as a checked argument.
- Results are not stored in the change history, because running a tool changes nothing on the router.
- Running a tool sends a request to the router, so it follows your role. Owners and operators can run tools; viewers can only look.

## Wake a device

Pick a device, press **Wake**, and the router sends the packet. The device must have Wake-on-LAN enabled in its own settings and must be on the same local network. The packet works only inside the network, so it is no use for waking a device from outside.

## Planned tools

These are not built yet. Each page says what is missing.

- [Speed test](speed-test.md)
- [Wi-Fi channel analyser](wifi-channel-analyser.md)
- [Per-device traffic](per-device-traffic.md)
- [DNS benchmark](dns-benchmark.md)
- [Port checker](port-checker.md)
- [Settings snapshots and diff](settings-snapshots.md)
- [Wi-Fi QR sharing](wifi-qr-sharing.md)
- [Wake-on-LAN schedules](wake-on-lan-schedules.md)
- [Subnet calculator](subnet-calculator.md)
- [Latency monitor](latency-monitor.md)

## Go deeper

- [Router tools](../workflows/router-tools.md)
- [The SSH action catalogue](../workflows/ssh-action-catalogue.md)
