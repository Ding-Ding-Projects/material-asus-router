---
title: DMZ host
category: lan
order: 4
summary: Send all unsolicited internet traffic to one device, why that is the riskiest way to let traffic in, and safer alternatives.
status: in-progress
related: router/port-forwarding, lan/port-triggering, security/port-forward-safely, router/firewall
---

A **DMZ host** is one device that receives every unsolicited incoming connection the router has no other rule for. It is the "send everything there" setting. Games consoles and some old applications work immediately with it, which is why it is tempting.

> [!WARNING]
> A DMZ host is exposed to the whole internet on every port. If it has any weakness, it can be attacked from anywhere. Use it only when the narrower options below do not work, and only for a device you keep updated.

> [!NOTE]
> **In progress.** The app has no DMZ switch yet.

## Ranking the ways in, safest first

| Method | What opens | Use when |
| --- | --- | --- |
| Nothing | Nothing | Almost always |
| Port forwarding | Chosen ports to one device | You know the ports |
| Port triggering | Chosen ports, only after the device connects out | A game that needs a range |
| UPnP | Ports the device asks for itself | You trust the device |
| DMZ | Everything not otherwise handled | Last resort |

## If you must use it

1. Give the device a fixed address with an [address reservation](../router/address-reservations.md), or the DMZ will point at whichever device gets that address next.
2. Keep the device's own firewall on and its software updated.
3. Do not use a device that holds anything private as the DMZ host.
4. Remove the DMZ rule when you are done. Add a reminder.

## Things DMZ does not do

- It does not make your game faster. It only removes a filter.
- It does not help if the provider shares one public address between customers. See [Troubleshooting by symptom](../reference/troubleshooting-by-symptom.md).

## Steps (planned)

1. Open **Port forwarding** and choose DMZ.
2. Pick the device from the list. The preview names it and shows its address.
3. A second confirmation explains the exposure before it is applied.

## Status

| Part | State |
| --- | --- |
| Guide | Written |
| DMZ control | Planned |
