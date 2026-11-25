---
title: Troubleshooting by symptom
category: reference
order: 7
summary: Start from what you see, such as "no internet", "slow Wi-Fi" or "a port forward does not work", and follow a short path to the likely cause.
status: ready
related: setup/troubleshooting, tools/network-tools, router/logs, reference/faq
---

Start from the symptom, not from a setting. Each section gives the quick checks first, in the order that finds most causes. This page is about the router and home network. Problems with installing or starting the app itself are in [Troubleshooting the app](../setup/troubleshooting.md).

## No internet on any device

1. Look at **Overview**. Is the router's connection shown as connected?
2. If not connected: restart the modem or ONT if you have one, wait two minutes, then check the [connection type](../internet/wan-types.md). A wrong type or login is the usual cause.
3. If connected but nothing loads: [ping](../tools/network-tools.md) a public address by number. Works by number, fails by name: it is DNS. Change the DNS servers, see [DNS over TLS](../internet/dns-over-tls.md).
4. If ping to the number fails: call the provider. The fault is on their side.

## One device has no internet

1. Is it joined to Wi-Fi, and is the Wi-Fi password still the right one?
2. Is it **blocked** in [Devices](../router/devices.md) or by a [parental schedule](../security/parental-schedules.md)?
3. Does it have an address? A device with no address from the router, or one that it made up for itself, did not get one from the router. Restart its Wi-Fi.
4. Another device holds the same address. See [Plan the address pool](../lan/dhcp-pool-planning.md).

## Wi-Fi is slow

| Check | What it tells you |
| --- | --- |
| Wired test on the same line | If wired is fast, Wi-Fi is the problem. If wired is slow too, it is the line or provider |
| Distance and walls | Weak signal. See [Roaming](../wireless/roaming.md) and [AiMesh](../connect/aimesh-management.md) |
| 2.4 GHz crowded | See [DFS channels](../wireless/dfs-channels.md) and the [channel analyser](../tools/wifi-channel-analyser.md) |
| Slow only when busy | Use [traffic priority](../connect/qos-modes.md) |
| Slow only one device | Old device, or stuck on a poor band. See [Smart Connect](../wireless/smart-connect.md) |

## Wi-Fi keeps dropping

- A single device: see [OFDMA](../wireless/ofdma.md), [Target Wake Time](../wireless/target-wake-time.md) and [Beamforming](../wireless/beamforming.md). Try switching one off and test.
- All devices at the same time of day: check the [log](../router/logs.md) for DFS radar events and scheduled restarts.
- Everything at random: power supply or overheating. Give the router air.

## A port forward does not work

1. Test from outside your home, not from inside.
2. Is the target device on a fixed address, and is that address right in the rule?
3. Is the service listening, and is the device's own firewall allowing it?
4. Is the protocol (TCP or UDP) correct?
5. **Double NAT.** If the router's internet address is itself a private or shared-carrier address (the router's internet status page shows it, and your provider can confirm), a device in front of it is also translating. Forward there too, or put the first device in bridge mode.
6. Some providers do not give a public address at all. Ask them. See [Forward a port safely](../security/port-forward-safely.md).

## Cannot reach the router page or the app lost the router

1. Is the router address you use still the router's address? Changing it moves the page.
2. Did a change just run? The [guard](../safety/connection-guard.md) puts old values back within about 90 seconds.
3. Check the host key. If the router's key changed, the app stops on purpose. See [Host key pinning](../safety/host-key-pinning.md).
4. As a last resort, a reset button on the router restores factory settings. Restore your [backup](../router/backup-restore.md).

## VPN will not connect

Check, in order: the server is on, the port is forwarded or reachable, the address or name resolves to your home, there is no double NAT, and the VPN's address range does not clash with the network you are visiting. See [VPN server types](../connect/vpn-servers.md).

## Smart device will not set up

It probably only supports 2.4 GHz. Use a separate 2.4 GHz name for setup. See [Smart Connect](../wireless/smart-connect.md).

## Still stuck?

Collect the router [log](../merlin/logging.md), the model and firmware version and what you changed last. The [change history](../safety/change-history.md) tells you what the app changed and when, and you can undo it.
