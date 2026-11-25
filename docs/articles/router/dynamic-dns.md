---
title: Dynamic DNS
category: router
order: 6
summary: Keep a fixed name pointing at your home internet address even when your provider changes it.
status: in-progress
related: router/internet, router/port-forwarding, router/vpn
---

Most home connections get a public address that changes from time to time. Dynamic DNS (DDNS) gives you a name, such as `myhome.example.net`, and the router updates it whenever the address changes. You then reach home by name for a VPN, a forwarded port or remote access, without knowing the current number.

> [!NOTE]
> **In progress.** The DDNS controls are defined; the screen, update status and real-router tests are still being built.

## Controls

| Control | What it does | Safe recommendation |
| --- | --- | --- |
| Dynamic DNS | Turns the update service on or off | Turn on only if you need to reach home from outside |
| Provider | The company that hosts the name | The router's built-in ASUS service is easiest; others if you already have an account |
| Host name | The full name, for example `myhome.asuscomm.com` | Choose a name that does not reveal personal details |
| User name or key | Your login with the provider, where required | Use a dedicated update key if the provider offers one |
| Password or token | Your secret with the provider | Typed once into a masked field, stored encrypted, never shown or logged |

## Set it up

1. Create an account with a DDNS provider and register a name, or choose the built-in ASUS service and let the router register one.
2. Open **Internet** and go to **Dynamic DNS**.
3. Switch it on, pick the provider and type the name and credentials.
4. Review the preview. Credentials are masked.
5. Confirm. The router contacts the provider and reports the result, such as "registered" or "authentication failed".
6. Check the name from outside your network, for example from a phone on mobile data, by running a lookup. See [Network tools](../tools/network-tools.md).

## Common problems

| Symptom | Likely cause |
| --- | --- |
| "Authentication failed" | Wrong user name or password or token |
| Name resolves to an old address | The router has not updated yet, or the update is blocked. Wait a few minutes and check the status |
| Name resolves, but nothing answers | The provider gives you a private address (carrier-grade NAT), or no port is forwarded. See [Port forwarding](port-forwarding.md) |
| Name works from inside only | Your router does not loop the traffic back. Test from outside |

> [!IMPORTANT]
> A name that points at your home is public. Only forward ports or run a VPN that you have secured. See [Firewall](firewall.md).

## Stock and Merlin differences

| Item | Stock ASUS | Asuswrt-Merlin |
| --- | --- | --- |
| Built-in ASUS service | Yes | Yes |
| Other providers | Several | More, plus custom update scripts (see [Merlin extras](merlin-extras.md)) |

## Status

| Part | State |
| --- | --- |
| DDNS controls and help text | Built |
| DDNS screen and update status | In progress |
| Tested against a live provider | Not yet |
