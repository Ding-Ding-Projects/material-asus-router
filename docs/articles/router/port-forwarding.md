---
title: Port forwarding
category: router
order: 9
summary: Let the internet reach one chosen device on one chosen port, and keep the list as short as possible.
status: in-progress
related: router/address-reservations, router/firewall, router/dynamic-dns, router/vpn
---

Port forwarding sends connections that arrive at your router on a certain port to a device inside your home. People use it for a game server, a camera or a web server. Every forward is a door into your network, so the goal is to have as few as possible.

> [!NOTE]
> **In progress.** The master switch is defined; the rule list, form and real-router tests are still being built.

> [!IMPORTANT]
> Before forwarding, ask whether a [VPN](vpn.md) would do the job. A VPN needs one forwarded port and lets you reach everything safely, instead of opening one door per service.

## Master switch

| Control | What it does | Safe recommendation |
| --- | --- | --- |
| Port forwarding | Turns all forwarding rules on or off at once | Leave on if you have rules; turn off to close every door quickly |

## Fields in a rule

| Field | Meaning | Example |
| --- | --- | --- |
| Name | A label for you | `Game server` |
| Protocol | TCP, UDP or both | TCP |
| External port | The port on the router's internet side | 25565 |
| Internal address | The device inside your network | 198.51.100.20 |
| Internal port | The port on that device | 25565 |
| Source restriction | Only accept connections from a given address range | Leave empty, or limit to a known address |

## Add a forward

1. Give the target device a fixed address with an [address reservation](address-reservations.md). A forward to an address that changes will break.
2. Open **Port forwarding** and choose **Add rule**.
3. Fill in the fields. The app checks that ports are between 1 and 65535 and that the external port is not already used.
4. Review the preview. It shows the new rule in plain words, for example "Connections to port 25565 from the internet go to 198.51.100.20 port 25565 (TCP)".
5. Confirm. Port forwarding changes do not normally affect your link to the router, so a timed revert is only armed when the rule touches the router's own management port.
6. Test from outside your network, such as a phone on mobile data. Testing from inside often fails even when the rule is right.

If the test fails, check that the device's own firewall allows the port, that the router has a real public address and not one shared by the provider, and that [Dynamic DNS](dynamic-dns.md) points to the current address.

## Remove or disable a rule

Disable a rule you only need now and then, instead of deleting it. Everything you remove is saved and can be restored with [undo](../safety/undo-changes.md).

## Safety checklist

- Forward only to a device that is updated and has a strong password.
- Never forward the router's own management ports (SSH, web login) to the internet.
- Prefer a non-standard external port that points to the standard internal port.
- Review the list every few months and delete what you no longer use.

## Stock and Merlin differences

| Item | Stock ASUS | Asuswrt-Merlin |
| --- | --- | --- |
| Port range and single-port rules | Yes | Yes |
| Source restriction | Limited | More flexible |
| Extra firewall scripts | No | Yes; see [Merlin extras](merlin-extras.md) |

## Status

| Part | State |
| --- | --- |
| Master switch | Built |
| Rule list, form and plain-word preview | In progress |
| Real-router test | Not yet |
