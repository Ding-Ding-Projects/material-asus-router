---
title: Choosing a connection type
category: internet
order: 1
summary: Automatic IP, PPPoE, static IP, PPTP and L2TP explained in plain words, with how to tell which one your provider uses.
status: in-progress
related: router/internet, internet/dual-wan, internet/ipv6, tools/network-tools
---

The connection type is how the router logs in to your provider. Picking the wrong one is the most common reason a new router has no internet. The app shows the connection type in the **Internet** area. You can change it, and the change runs under the [connection-loss guard](../safety/connection-guard.md).

> [!NOTE]
> **In progress.** The connection type control is built and checked against the pretend router. It has not been tested against real provider connections.

## The types

| Type | What the provider gives you | Typical use |
| --- | --- | --- |
| Automatic IP | An address handed out automatically, like a home network does | Cable, most fibre, most mobile broadband. The default |
| PPPoE | A user name and password you must supply | Some fibre and older broadband lines |
| Static IP | A fixed address, mask, gateway and DNS written on your paperwork | Business lines |
| PPTP and L2TP | A login to a VPN-style server | A few providers, mostly older |

## Find out which one you have

1. Read the paperwork or the provider's setup page. It will name the type and, for PPPoE, the user name.
2. If the old router worked with no login, it was almost certainly Automatic IP.
3. If nothing says, leave **Automatic IP** and look at the connection status. Connected with an address means it worked. "Waiting" or "no response" means try the next type.

## Switching type safely

1. Have the login details in front of you before you start. Do not guess a PPPoE password.
2. Change the type in **Internet**. The preview shows old and new values. Passwords are masked.
3. Confirm. The router restarts the connection, so for a moment you lose internet, not the router page.
4. Check **Overview** for a connected state, then run [ping](../tools/network-tools.md) to a site you know is online.

> [!WARNING]
> A wrong login makes the provider refuse the connection. The router is fine. Put the old values back from the [change history](../safety/change-history.md).

## When it connects but is slow

The type is not the cause. See [Troubleshooting by symptom](../reference/troubleshooting-by-symptom.md).

## Stock and Merlin

Both firmwares support the types above on every model. Merlin shows a little more detail in its connection log.

## Status

| Part | State |
| --- | --- |
| Connection type and DNS controls | Built |
| Test on a real provider line | Not yet done |
