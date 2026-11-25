---
title: VPN with OpenVPN
category: router
order: 14
summary: Run an OpenVPN server on the router, or connect the router to a provider as an OpenVPN client.
status: in-progress
related: router/vpn, router/vpn-wireguard, router/port-forwarding, router/dynamic-dns
---

OpenVPN is the long-established VPN protocol. It works on almost every network and every device, at the price of more settings and lower speed than WireGuard. Read [VPN](vpn.md) first for the server and client roles.

> [!NOTE]
> **In progress.** Detecting OpenVPN support is built. The server and client screens, profile import and export, and real-router tests are still being built.

## Server: reach home from outside

### What the settings mean

| Setting | Meaning | Safe recommendation |
| --- | --- | --- |
| Server on or off | Starts or stops the OpenVPN server | Turn on only when you need it, or keep on with strong keys |
| Port and protocol | Where the router listens (UDP or TCP, default port 1194) | UDP for speed; TCP on port 443 for strict networks |
| Authentication | Certificate and key, or user name and password | Certificate and key, plus a short list of allowed users |
| Allowed network access | Whether clients see only the router or the whole local network | The whole network only if you need it |
| Exported profile | The `.ovpn` file clients import | Send by a secure channel; treat it like a password |

### Set up a server

1. Set up [Dynamic DNS](dynamic-dns.md) and note the name.
2. Open **VPN** and choose **OpenVPN server**.
3. Choose port, protocol and authentication. Keep the defaults for the cipher unless you know why you change them.
4. Add a user for each person or device, for example `Pat phone`.
5. Review the preview, confirm, and let the app create the forwarding rule, or forward the port yourself ([Port forwarding](port-forwarding.md)).
6. Export the profile for each user and import it into the OpenVPN app on the device.
7. Test from outside your home network, such as mobile data.

Starting the server restarts a router service; the connection-loss guard is armed.

## Client: send traffic through a provider

1. Download the `.ovpn` file from your provider.
2. Open **VPN**, choose **OpenVPN client** and **Import profile**.
3. Enter the provider's user name and password, if the provider uses them. They are typed once into masked fields and stored encrypted.
4. Choose which devices use the tunnel, or all devices.
5. Review and confirm. When the status shows connected, check your public address changed.

> [!WARNING]
> Sending all devices through a provider can slow the whole house. If something stops working, switch the client off and check again. The app can [undo](../safety/undo-changes.md) the change.

## Stock and Merlin differences

| Item | Stock ASUS | Asuswrt-Merlin |
| --- | --- | --- |
| OpenVPN server | Yes, on most models | Yes, with more settings |
| OpenVPN client profiles | A few | More, with selective routing by device or destination |
| Custom scripts on connect | No | Yes; see [Merlin extras](merlin-extras.md) |

## Status

| Part | State |
| --- | --- |
| Support detection | Built |
| Server and client screens | In progress |
| Profile export and import | In progress |
| Real-router test | Not yet |
