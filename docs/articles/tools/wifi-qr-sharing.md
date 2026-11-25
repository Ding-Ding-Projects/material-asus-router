---
title: Wi-Fi QR sharing
category: tools
order: 8
summary: Planned: show a QR code so visitors can join the guest network by scanning.
status: in-progress
related: router/wifi
---

This is one of the planned router tools. It is marked **In progress**, which means the description below is the plan, not something you can use yet.

> [!NOTE]
> Wi-Fi QR sharing is **In progress**. Treat everything under "Planned behaviour" as a goal until this page says otherwise.

## What it is for

Let a visitor join the Wi-Fi by pointing a phone camera at the screen, without reading out a long password.

## Planned behaviour

- Generate the QR code on your device from the network name and password, without sending them anywhere else.
- Offer a print view for the guest network.
- Hide the code until you press show, because it contains the password.
- Respect roles: viewers cannot reveal the password.

## What is missing

No QR generator and no print view yet. The password reveal rules are not finalised.

## Good to know

- Anyone who sees the code can join, so show it only to people you trust.
- Changing the password makes an old printed code stop working.

## How it will work

Wi-Fi QR codes use a standard text format that phone cameras understand: the network name, the security type and the password, packed into one code. Scanning joins the network with no typing.

## Making one

1. Open the guest network (or any band) in the app.
2. Choose **Show QR code**. The app builds the code on your device from the name and password you already see. Nothing is sent anywhere.
3. Show it to the visitor, or print it for a frame by the door.

## Handling it safely

> [!WARNING]
> A QR code **is** the Wi-Fi password in picture form. Anyone who photographs it can join. Use it for the **guest network**, not the main one, and replace it when visitors have gone.

| Do | Do not |
| --- | --- |
| Use a guest network with its own password | Print the main network's code on the fridge |
| Rotate the password now and then | Post the code online |
| Check the guest network cannot reach your devices | Assume it is isolated without testing |

## Questions people ask

**A phone will not scan it.** Hold the camera steady, make the code bigger, and check it is not for a hidden network that the phone must be told about.

**Does it work for WPA3?** Yes for modern phones. Older ones may need the password typed.

