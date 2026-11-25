---
title: WireGuard peers and keys
category: connect
order: 4
summary: Add, label and remove the devices allowed to join your WireGuard server, with how the keys and addresses fit together.
status: in-progress
related: router/vpn-wireguard, connect/vpn-servers, safety/encrypted-vault
---

WireGuard identifies each device by a pair of keys instead of a user name and password. The **server** (your router) and each **peer** (a phone or laptop) hold a private key, which never leaves the device, and share the matching public key with the other side. Add a peer and the router will let that key in. Remove it and that device is out, with no effect on anyone else.

> [!NOTE]
> **In progress.** The server switch and port are built (see [WireGuard](../router/vpn-wireguard.md)). Adding and removing peers in the app is not.

## What a peer record holds

| Field | Meaning |
| --- | --- |
| Label | Your name for the device, such as "Pat phone" |
| Public key | The device's public key. Safe to display |
| Address | The device's address inside the VPN, such as 203.0.113.2 |
| Allowed addresses | Which addresses the device may use. Normally just its own |
| Pre-shared key | Optional extra secret, adds protection against future attacks |

The router address range for the VPN must not overlap your home range.

## Add a device

1. Ask the app to create a peer. It generates the key pair **on your device or in the browser** where possible, so the private key never has to travel.
2. Give it a label. The app picks the next free VPN address.
3. Read the preview. Private keys and pre-shared keys are masked and never put in the change history.
4. Confirm. The app shows a QR code and a config file for the device. Scan it with the WireGuard phone app, or import the file on a computer.

> [!WARNING]
> The QR code and file contain the device's private key. Treat them like a password. Show them once, do not email them, and close the screen when done.

## Remove a device

Delete the peer from the list. The router stops accepting that key straight away, which is exactly what to do if a phone is lost.

## Which traffic goes through

| Setting on the device | Effect |
| --- | --- |
| Route only home addresses | Only traffic for your home goes through the router. Other browsing is direct |
| Route everything | All the device's traffic goes via your home connection |

## Status

| Part | State |
| --- | --- |
| Server switch and port | Built |
| Peer list, key generation, QR | Planned |
