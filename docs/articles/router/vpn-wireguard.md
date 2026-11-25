---
title: VPN with WireGuard
category: router
order: 15
summary: Use WireGuard on routers that support it, as a server for your own devices or a client to a provider.
status: in-progress
related: router/vpn, router/vpn-openvpn, router/dynamic-dns, router/firmware
---

WireGuard is a newer VPN protocol with a small code base and fast speeds. Instead of certificates, each side has a key pair and the list of peers it trusts. It is simple to set up once you understand that idea.

> [!NOTE]
> **In progress.** Detecting WireGuard support is built. The WireGuard screens, peer management and QR export are still being built, and nothing here has been verified on a real router yet.

> [!IMPORTANT]
> WireGuard is not available on every Asus model or firmware version. On stock firmware it appears only in recent versions of supported models, and on Asuswrt-Merlin only on supported models. If your router does not have it, the app shows the control disabled with the reason, and OpenVPN is the alternative ([OpenVPN](vpn-openvpn.md)).

## Key ideas

| Term | Meaning |
| --- | --- |
| Private key | Secret, stays on its own device. The app never shows it again after creation |
| Public key | Shared with the other side so it recognises you |
| Peer | A device allowed to connect, such as `Pat phone` |
| Allowed addresses | Which addresses go through the tunnel. Everything, or just your home network |
| Endpoint | The address and port of the server, usually your dynamic DNS name and port 51820 |

## Server: reach home from outside

1. Set up [Dynamic DNS](dynamic-dns.md) and check the router has a public address.
2. Open **VPN** and choose **WireGuard server**.
3. Pick a port (default 51820, UDP) and a tunnel address range that does not overlap your home network, for example 192.0.2.0/24.
4. Add a peer for each device. The app creates a key pair for each and builds a configuration.
5. Review the preview and confirm. The connection-loss guard is armed because the VPN service restarts.
6. Show the peer's QR code and scan it with the WireGuard app on the phone, or export a `.conf` file for a computer. Treat both like a password.
7. Test from mobile data. Remove peers you no longer use.

## Client: send traffic through a provider

1. Get the configuration from your provider.
2. Choose **WireGuard client** and **Import configuration**.
3. Choose which devices use the tunnel.
4. Confirm, then check that your public address changed.

> [!TIP]
> If some sites stop loading through the tunnel, the cause is often the size of packets. Ask the provider for the recommended setting, or lower the MTU value in [Advanced](advanced.md).

## Stock and Merlin differences

| Item | Stock ASUS | Asuswrt-Merlin |
| --- | --- | --- |
| WireGuard server | Newer versions of supported models | Supported models |
| WireGuard client | Limited | More profiles and selective routing |
| Per-peer scripts | No | Yes; see [Merlin extras](merlin-extras.md) |

## Status

| Part | State |
| --- | --- |
| Support detection | Built |
| Server and client screens | In progress |
| QR export of a peer | In progress |
| Real-router test | Not yet |
