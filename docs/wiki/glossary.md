---
title: Glossary
order: 2
summary: Plain definitions of the words used in the app and the documentation.
---

Short definitions, in alphabetical order. Where a longer guide exists, the entry links to it.

## A

**AiMesh**: ASUS's way of linking several compatible routers or nodes into one Wi-Fi network with a single name.

**Asuswrt-Merlin**: A community-maintained firmware for many Asus routers that adds features to the stock ASUS firmware. Some controls in the app exist only on Merlin and are shown disabled, with the reason, on stock firmware. See [firmware detection](../articles/setup/firmware-detection.md).

## C

**Connection guard**: A timer placed on the router before a risky change. If the app cannot reach the router afterwards, the timer restores the old values by itself. See the [guide](../articles/safety/connection-guard.md).

## D

**Demo mode**: A built-in pretend router that lets anyone try the app with no real router. Its numbers are made up.

**DHCP**: The service on the router that hands out addresses to devices when they join the network. A *reservation* gives one device the same address every time.

**DNS**: The service that turns a name such as a website into an address. See [network tools](../articles/tools/network-tools.md).

## F

**Firmware**: The software that runs the router. The app detects whether it is stock ASUS firmware or Asuswrt-Merlin.

## H

**Host key**: The fingerprint an SSH server presents to prove which device it is. The app asks you to approve it once and then pins it. See [host key pinning](../articles/safety/host-key-pinning.md).

## N

**NAT**: The router feature that lets many devices share one public address. *Double NAT* happens when two routers in a row both do it, which often breaks port forwarding.

## O

**Operator**: A role that can view the router and change settings. See [accounts and roles](../articles/app/accounts-and-roles.md).

**Owner**: The first account created. It can also manage people and the router connection.

## P

**Port forwarding**: Sending traffic that arrives from outside on a chosen port to a device on your network.

**Preview**: The list of old and new values shown before any change is applied. See [preview, confirm and apply](../articles/safety/safe-changes.md).

## Q

**QoS**: Quality of service, also called traffic priority: deciding which kinds of traffic get bandwidth first.

## S

**SSH**: The secure remote login that the app uses to talk to the router. Its settings are in the router's administration page.

**Subnet**: A block of addresses that belong to one network, written like `198.51.100.0/24`.

## V

**Vault**: The encrypted store for the router password or key. See [the encrypted vault](../articles/safety/encrypted-vault.md).

**Viewer**: A role that can look but not change.

## W

**Wake-on-LAN**: A special packet that switches on a device that has been set up to listen for it, on the local network only.
